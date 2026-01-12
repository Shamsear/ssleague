import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import { adminDb } from '@/lib/firebase/admin';

/**
 * GET /api/team/player-stats
 * Get player statistics for the logged-in team
 * Calculates stats dynamically from matchups table based on round range
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const { verifyAuth } = await import('@/lib/auth-helper');
    const auth = await verifyAuth(['team'], request);

    if (!auth.authenticated) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = auth.userId!;
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('season_id');
    const fromRound = parseInt(searchParams.get('from_round') || '1');
    const toRound = parseInt(searchParams.get('to_round') || '999');

    if (!seasonId) {
      return NextResponse.json(
        { error: 'season_id is required' },
        { status: 400 }
      );
    }

    // Get team ID from Firebase team_seasons
    let teamSeasonId = `${userId}_${seasonId}`;
    let teamSeasonDoc = await adminDb.collection('team_seasons').doc(teamSeasonId).get();

    if (!teamSeasonDoc.exists) {
      // Fallback: Query by user_id field
      const teamSeasonQuery = await adminDb.collection('team_seasons')
        .where('user_id', '==', userId)
        .where('season_id', '==', seasonId)
        .where('status', '==', 'registered')
        .limit(1)
        .get();

      if (teamSeasonQuery.empty) {
        return NextResponse.json(
          { error: 'Team not registered for this season' },
          { status: 404 }
        );
      }

      teamSeasonDoc = teamSeasonQuery.docs[0];
      teamSeasonId = teamSeasonDoc.id;
    }

    const teamSeasonData = teamSeasonDoc.data();
    const teamId = teamSeasonData?.team_id;

    if (!teamId) {
      return NextResponse.json(
        { error: 'Team ID not found' },
        { status: 404 }
      );
    }

    const sql = getTournamentDb();

    // Get base player info from player_seasons (just for player details and base_points)
    const playerInfo = await sql`
      SELECT 
        id,
        player_id,
        player_name,
        season_id,
        team,
        points as total_points,
        base_points,
        star_rating,
        category,
        auction_value,
        registration_status
      FROM player_seasons
      WHERE team_id = ${teamId}
        AND season_id = ${seasonId}
        AND registration_status = 'active'
    `;

    // Calculate stats from matchups table for the selected round range
    const statsFromMatchups = await sql`
      WITH player_matches AS (
        SELECT 
          ps.id as player_season_id,
          ps.player_id,
          m.round_number,
          m.home_player_id,
          m.away_player_id,
          m.home_goals,
          m.away_goals,
          CASE 
            WHEN m.home_player_id = ps.player_id THEN m.home_goals
            WHEN m.away_player_id = ps.player_id THEN m.away_goals
          END as goals_scored,
          CASE 
            WHEN m.home_player_id = ps.player_id THEN m.away_goals
            WHEN m.away_player_id = ps.player_id THEN m.home_goals
          END as goals_conceded,
          CASE 
            WHEN m.home_player_id = ps.player_id THEN 
              CASE 
                WHEN m.home_goals > m.away_goals THEN 1
                WHEN m.home_goals = m.away_goals THEN 0
                ELSE 0
              END
            WHEN m.away_player_id = ps.player_id THEN 
              CASE 
                WHEN m.away_goals > m.home_goals THEN 1
                WHEN m.away_goals = m.home_goals THEN 0
                ELSE 0
              END
          END as is_win,
          CASE 
            WHEN m.home_player_id = ps.player_id THEN 
              CASE 
                WHEN m.home_goals = m.away_goals THEN 1
                ELSE 0
              END
            WHEN m.away_player_id = ps.player_id THEN 
              CASE 
                WHEN m.away_goals = m.home_goals THEN 1
                ELSE 0
              END
          END as is_draw,
          CASE 
            WHEN m.home_player_id = ps.player_id THEN 
              CASE 
                WHEN m.home_goals < m.away_goals THEN 1
                ELSE 0
              END
            WHEN m.away_player_id = ps.player_id THEN 
              CASE 
                WHEN m.away_goals < m.home_goals THEN 1
                ELSE 0
              END
          END as is_loss,
          CASE 
            WHEN m.home_player_id = ps.player_id AND m.away_goals = 0 THEN 1
            WHEN m.away_player_id = ps.player_id AND m.home_goals = 0 THEN 1
            ELSE 0
          END as is_clean_sheet
        FROM player_seasons ps
        JOIN matchups m ON (m.home_player_id = ps.player_id OR m.away_player_id = ps.player_id)
        JOIN fixtures f ON m.fixture_id = f.id
        WHERE ps.team_id = ${teamId}
          AND ps.season_id = ${seasonId}
          AND m.season_id = ${seasonId}
          AND m.round_number >= ${fromRound}
          AND m.round_number <= ${toRound}
          AND f.status = 'completed'
          AND m.home_goals IS NOT NULL
          AND m.away_goals IS NOT NULL
      )
      SELECT 
        player_season_id,
        player_id,
        COUNT(*) as matches_played,
        SUM(goals_scored) as goals_scored,
        SUM(goals_conceded) as goals_conceded,
        SUM(goals_scored) - SUM(goals_conceded) as goal_difference,
        SUM(is_win) as wins,
        SUM(is_draw) as draws,
        SUM(is_loss) as losses,
        SUM(is_clean_sheet) as clean_sheets,
        SUM(
          CASE 
            WHEN (goals_scored - goals_conceded) > 5 THEN 5
            WHEN (goals_scored - goals_conceded) < -5 THEN -5
            ELSE (goals_scored - goals_conceded)
          END
        ) as points
      FROM player_matches
      GROUP BY player_season_id, player_id
    `;

    // Merge player info with calculated stats
    const players = playerInfo.map(player => {
      const stats = statsFromMatchups.find(s => s.player_season_id === player.id);

      return {
        id: player.id,
        player_id: player.player_id,
        player_name: player.player_name,
        season_id: player.season_id,
        team: player.team,
        points: Number(stats?.points || 0),
        matches_played: Number(stats?.matches_played || 0),
        goals_scored: Number(stats?.goals_scored || 0),
        goals_conceded: Number(stats?.goals_conceded || 0),
        goal_difference: Number(stats?.goal_difference || 0),
        wins: Number(stats?.wins || 0),
        draws: Number(stats?.draws || 0),
        losses: Number(stats?.losses || 0),
        clean_sheets: Number(stats?.clean_sheets || 0),
        auction_value: player.auction_value ? Number(player.auction_value) : undefined,
        star_rating: Number(player.star_rating || 3),
      };
    });

    // Sort by points
    players.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goal_difference !== a.goal_difference) return b.goal_difference - a.goal_difference;
      return b.goals_scored - a.goals_scored;
    });

    // Get max round number from matchups table
    let maxRound = 10;
    try {
      const maxRoundResult = await sql`
        SELECT MAX(round_number) as max_round
        FROM matchups
        WHERE season_id = ${seasonId}
      `;
      maxRound = maxRoundResult[0]?.max_round || 10;
    } catch (error) {
      console.log('Could not determine max round from matchups, using default:', error);
    }

    return NextResponse.json({
      players,
      maxRound,
      teamName: teamSeasonData?.team_name || 'My Team'
    });

  } catch (error: any) {
    console.error('Error fetching team player stats:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch player stats' },
      { status: 500 }
    );
  }
}
