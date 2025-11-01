import { NextRequest, NextResponse } from 'next/server';
import { fantasySql } from '@/lib/neon/fantasy-config';
import { getTournamentDb } from '@/lib/neon/tournament-config';

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

    const league = leagues[0];
    const season_id = league.season_id;

    // Get star pricing for the league
    const starPricing: Record<number, number> = {};
    if (league.star_rating_prices) {
      league.star_rating_prices.forEach((p: any) => {
        starPricing[p.stars] = p.price;
      });
    }

    // Note: Since multiple teams can draft the same player,
    // we don't filter out drafted players anymore.
    // All players are available for all teams to pick.

    // Get all players directly from player_seasons table (always fresh data)
    // Exclude players without teams (team_id and team must not be null/empty)
    const tournamentSql = getTournamentDb();
    const allPlayers = await tournamentSql`
      SELECT 
        player_id,
        player_name,
        team_id,
        team,
        star_rating,
        category
      FROM player_seasons
      WHERE season_id = ${season_id}
        AND player_name IS NOT NULL
        AND team_id IS NOT NULL
        AND team_id != ''
        AND team IS NOT NULL
        AND team != ''
    `;

    // Map all players to fantasy format (no filtering since players can be drafted by multiple teams)
    const availablePlayers = allPlayers
      .map((player: any) => {
        const starRating = player.star_rating || 5;
        const draftPrice = starPricing[starRating] || 10;
        
        return {
          real_player_id: player.player_id,
          player_name: player.player_name,
          position: player.category || 'Unknown',
          team: player.team || 'Unknown',
          team_id: player.team_id,
          star_rating: starRating,
          draft_price: draftPrice,
          points: 0,
          category: player.category || 'Classic',
          is_available: true,
        };
      });

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
    });
  } catch (error) {
    console.error('Error fetching available players:', error);
    return NextResponse.json(
      { error: 'Failed to fetch available players' },
      { status: 500 }
    );
  }
}
