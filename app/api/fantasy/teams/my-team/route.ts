import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { fantasySql } from '@/lib/neon/fantasy-config';

/**
 * GET /api/fantasy/teams/my-team?user_id=xxx
 * Get the fantasy team for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const user_id = searchParams.get('user_id');

    if (!user_id) {
      return NextResponse.json(
        { error: 'user_id query parameter is required' },
        { status: 400 }
      );
    }

    // Get user's fantasy team from PostgreSQL
    const fantasyTeams = await fantasySql`
      SELECT * FROM fantasy_teams
      WHERE owner_uid = ${user_id} AND is_enabled = true
      LIMIT 1
    `;

    if (fantasyTeams.length === 0) {
      return NextResponse.json(
        { error: 'No fantasy team found for this user' },
        { status: 404 }
      );
    }

    const teamData = fantasyTeams[0];
    const teamId = teamData.team_id;
    const leagueId = teamData.league_id;

    // Get drafted players from PostgreSQL
    const squadPlayers = await fantasySql`
      SELECT 
        s.squad_id as draft_id,
        s.real_player_id,
        s.player_name,
        s.position,
        s.real_team_name as team,
        s.purchase_price as draft_price,
        s.total_points,
        s.is_captain,
        s.is_vice_captain
      FROM fantasy_squad s
      WHERE s.team_id = ${teamId}
      ORDER BY s.acquired_at ASC
    `;

    // Get points breakdown for each player
    const draftedPlayers = await Promise.all(
      squadPlayers.map(async (player: any) => {
        // Get player's match-by-match points
        const playerPoints = await fantasySql`
          SELECT 
            COUNT(*) as matches_played,
            SUM(total_points) as total_points
          FROM fantasy_player_points
          WHERE team_id = ${teamId}
            AND real_player_id = ${player.real_player_id}
        `;

        const matchesPlayed = Number(playerPoints[0]?.matches_played || 0);
        const totalPoints = Number(playerPoints[0]?.total_points || player.total_points || 0);
        const averagePoints = matchesPlayed > 0 ? totalPoints / matchesPlayed : 0;

        return {
          draft_id: player.draft_id,
          real_player_id: player.real_player_id,
          player_name: player.player_name,
          position: player.position || 'Unknown',
          team: player.team || 'Unknown',
          draft_price: Number(player.draft_price),
          total_points: totalPoints,
          matches_played: matchesPlayed,
          average_points: Math.round(averagePoints * 10) / 10,
          is_captain: player.is_captain,
          is_vice_captain: player.is_vice_captain,
        };
      })
    );

    // Get recent points (last 5 rounds) from PostgreSQL
    const recentRounds = await fantasySql`
      SELECT 
        round_number as round,
        SUM(total_points) as points
      FROM fantasy_player_points
      WHERE team_id = ${teamId}
        AND round_number IS NOT NULL
      GROUP BY round_number
      ORDER BY round_number DESC
      LIMIT 5
    `;

    // Convert to expected format
    const formattedRounds = recentRounds.map((r: any) => ({
      round: Number(r.round),
      points: Number(r.points),
    }));

    return NextResponse.json({
      success: true,
      team: {
        id: teamId,
        fantasy_league_id: leagueId,
        team_name: teamData.team_name,
        total_points: Number(teamData.total_points) || 0,
        rank: teamData.rank,
        player_count: draftedPlayers.length,
        supported_team_id: teamData.supported_team_id || null,
        supported_team_name: teamData.supported_team_name || null,
        passive_points: Number(teamData.passive_points) || 0,
      },
      players: draftedPlayers,
      recent_rounds: formattedRounds,
    });
  } catch (error) {
    console.error('Error fetching my fantasy team:', error);
    return NextResponse.json(
      { error: 'Failed to fetch fantasy team' },
      { status: 500 }
    );
  }
}
