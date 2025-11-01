import { NextRequest, NextResponse } from 'next/server';
import { fantasySql } from '@/lib/neon/fantasy-config';

/**
 * GET /api/fantasy/players/drafted?league_id=xxx
 * Get all drafted players for a league, grouped by team
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get('league_id');

    if (!leagueId) {
      return NextResponse.json(
        { error: 'Missing required parameter: league_id' },
        { status: 400 }
      );
    }

    // Get all squad players for this league with team info
    const squadPlayers = await fantasySql`
      SELECT 
        fs.squad_id,
        fs.team_id as fantasy_team_id,
        fs.real_player_id,
        fs.player_name,
        fs.position,
        fs.real_team_name,
        fs.purchase_price as draft_price,
        fs.total_points,
        fs.is_captain,
        fs.is_vice_captain,
        ft.team_name as fantasy_team_name,
        ft.owner_name
      FROM fantasy_squad fs
      JOIN fantasy_teams ft ON fs.team_id = ft.team_id
      WHERE fs.league_id = ${leagueId}
      ORDER BY ft.team_name, fs.player_name
    `;

    // Get match statistics for each player
    const draftedPlayers = await Promise.all(
      squadPlayers.map(async (player: any) => {
        // Get player's match count
        const matches = await fantasySql`
          SELECT COUNT(*) as matches_played
          FROM fantasy_player_points
          WHERE team_id = ${player.fantasy_team_id}
            AND real_player_id = ${player.real_player_id}
        `;

        const matchesPlayed = Number(matches[0]?.matches_played || 0);

        // For star rating, we'll get it from fantasy_players if it exists
        const playerInfo = await fantasySql`
          SELECT star_rating
          FROM fantasy_players
          WHERE league_id = ${leagueId}
            AND real_player_id = ${player.real_player_id}
          LIMIT 1
        `;

        return {
          draft_id: player.squad_id,
          fantasy_team_id: player.fantasy_team_id,
          fantasy_team_name: player.fantasy_team_name,
          real_player_id: player.real_player_id,
          player_name: player.player_name,
          position: player.position,
          real_team_name: player.real_team_name,
          star_rating: playerInfo.length > 0 ? playerInfo[0].star_rating : 5,
          draft_price: Number(player.draft_price),
          total_points: Number(player.total_points || 0),
          matches_played: matchesPlayed,
          is_captain: player.is_captain,
          is_vice_captain: player.is_vice_captain,
        };
      })
    );

    return NextResponse.json({
      success: true,
      drafted_players: draftedPlayers,
      total_players: draftedPlayers.length,
    });
  } catch (error) {
    console.error('Error fetching drafted players:', error);
    return NextResponse.json(
      { error: 'Failed to fetch drafted players', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
