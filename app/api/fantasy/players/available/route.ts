import { NextRequest, NextResponse } from 'next/server';
import { fantasySql } from '@/lib/neon/fantasy-config';

/**
 * GET /api/fantasy/players/available?league_id=xxx
 * Get all available (undrafted) players for a fantasy league from PostgreSQL
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const league_id = searchParams.get('league_id');

    if (!league_id) {
      return NextResponse.json(
        { error: 'league_id query parameter is required' },
        { status: 400 }
      );
    }

    // Get fantasy league from PostgreSQL
    const leagues = await fantasySql`
      SELECT * FROM fantasy_leagues
      WHERE league_id = ${league_id}
      LIMIT 1
    `;

    if (leagues.length === 0) {
      return NextResponse.json(
        { error: 'Fantasy league not found' },
        { status: 404 }
      );
    }

    // Get all drafted player IDs from PostgreSQL
    const draftedPlayers = await fantasySql`
      SELECT DISTINCT real_player_id
      FROM fantasy_squad
      WHERE league_id = ${league_id}
    `;

    const draftedPlayerIds = new Set(
      draftedPlayers.map((p: any) => p.real_player_id)
    );

    // Get all players from fantasy_players table in PostgreSQL
    const allPlayers = await fantasySql`
      SELECT 
        real_player_id,
        player_name,
        position,
        real_team_id,
        real_team_name,
        star_rating,
        draft_price,
        current_price,
        total_points,
        is_available
      FROM fantasy_players
      WHERE league_id = ${league_id}
        AND is_available = true
    `;

    // Filter out drafted players
    const availablePlayers = allPlayers
      .filter((player: any) => !draftedPlayerIds.has(player.real_player_id))
      .map((player: any) => ({
        real_player_id: player.real_player_id,
        player_name: player.player_name,
        position: player.position || 'Unknown',
        team: player.real_team_name || 'Unknown',
        team_id: player.real_team_id,
        star_rating: player.star_rating || 5,
        draft_price: parseFloat(player.draft_price) || 10,
        points: player.total_points || 100,
        category: 'Classic',
        is_available: true,
      }));

    // Sort by star rating (highest first), then by name
    availablePlayers.sort((a, b) => {
      if (b.star_rating !== a.star_rating) {
        return b.star_rating - a.star_rating;
      }
      return a.player_name.localeCompare(b.player_name);
    });

    return NextResponse.json({
      success: true,
      available_players: availablePlayers,
      total_available: availablePlayers.length,
      total_drafted: draftedPlayerIds.size,
    });
  } catch (error) {
    console.error('Error fetching available players:', error);
    return NextResponse.json(
      { error: 'Failed to fetch available players' },
      { status: 500 }
    );
  }
}
