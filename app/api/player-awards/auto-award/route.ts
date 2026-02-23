import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import { sendNotificationToSeason } from '@/lib/notifications/send-notification';

// POST - Auto-award player awards based on tournament statistics
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { season_id, tournament_id, award_types } = body;

    if (!season_id) {
      return NextResponse.json(
        { success: false, error: 'season_id is required' },
        { status: 400 }
      );
    }

    // If tournament_id and award_types provided, use new tournament-specific logic
    if (tournament_id && award_types && Array.isArray(award_types)) {
      return await awardTournamentSpecificAwards(season_id, tournament_id, award_types);
    }

    // Otherwise, fall back to old season-wide logic (for backward compatibility)
    const { autoAwardPlayerAwards } = await import('@/lib/award-player-awards');
    const result = await autoAwardPlayerAwards(season_id);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    // Send FCM notification to all teams in the season
    if (result.awardsGiven > 0) {
      try {
        await sendNotificationToSeason(
          {
            title: '🎖️ Season Awards Announced!',
            body: `${result.awardsGiven} player awards have been automatically awarded based on season performance!`,
            url: `/awards`,
            icon: '/logo.png',
            data: {
              type: 'season_awards_auto',
              season_id,
              awards_count: result.awardsGiven.toString(),
            }
          },
          season_id
        );
      } catch (notifError) {
        console.error('Failed to send auto-awards notification:', notifError);
        // Don't fail the request
      }
    }

    return NextResponse.json({
      success: true,
      awardsGiven: result.awardsGiven,
      awards: result.awards,
      message: `Successfully awarded ${result.awardsGiven} player awards`
    });
  } catch (error: any) {
    console.error('Error auto-awarding player awards:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to auto-award player awards' },
      { status: 500 }
    );
  }
}

// Tournament-specific award logic
async function awardTournamentSpecificAwards(
  seasonId: string,
  tournamentId: string,
  awardTypes: string[]
) {
  try {
    const sql = getTournamentDb();
    const awards: any[] = [];
    let awardsGiven = 0;

    console.log(`🏆 Awarding player awards for tournament ${tournamentId}...`);

    for (const awardType of awardTypes) {
      console.log(`  📊 Awarding ${awardType}...`);

      if (awardType === 'Golden Boot') {
        // Top goal scorer - aggregate from matchups (home + away)
        const topScorer = await sql`
          WITH player_goals AS (
            SELECT 
              home_player_id as player_id,
              home_player_name as player_name,
              SUM(home_goals) as total_goals
            FROM matchups
            WHERE tournament_id = ${tournamentId}
              AND season_id = ${seasonId}
            GROUP BY home_player_id, home_player_name
            
            UNION ALL
            
            SELECT 
              away_player_id as player_id,
              away_player_name as player_name,
              SUM(away_goals) as total_goals
            FROM matchups
            WHERE tournament_id = ${tournamentId}
              AND season_id = ${seasonId}
            GROUP BY away_player_id, away_player_name
          )
          SELECT 
            player_id,
            player_name,
            SUM(total_goals) as total_goals
          FROM player_goals
          GROUP BY player_id, player_name
          ORDER BY total_goals DESC
          LIMIT 1
        `;

        if (topScorer.length > 0) {
          const result = await sql`
            INSERT INTO player_awards (
              player_id, player_name, season_id, tournament_id,
              award_category, award_type, award_position,
              player_category, awarded_by, notes,
              performance_stats
            )
            VALUES (
              ${topScorer[0].player_id}, ${topScorer[0].player_name}, ${seasonId}, ${tournamentId},
              'individual', 'Golden Boot', 'Winner',
              NULL, 'system', 'Auto-awarded based on goals scored',
              ${JSON.stringify({ goals: topScorer[0].total_goals })}
            )
            ON CONFLICT (player_id, season_id, tournament_id, award_category, award_type, award_position) DO NOTHING
            RETURNING *
          `;

          if (result.length > 0) {
            awardsGiven++;
            awards.push({ award_type: 'Golden Boot', player_name: topScorer[0].player_name });
            console.log(`    ✅ Winner: ${topScorer[0].player_name} (${topScorer[0].total_goals} goals)`);
          }
        }
      } else if (awardType === 'Golden Glove') {
        // Best goalkeeper (lowest goals conceded per match)
        const topKeeper = await sql`
          WITH keeper_stats AS (
            SELECT 
              home_player_id as player_id,
              home_player_name as player_name,
              COUNT(*) as matches_played,
              SUM(away_goals) as goals_conceded,
              SUM(CASE WHEN away_goals = 0 THEN 1 ELSE 0 END) as clean_sheets
            FROM matchups
            WHERE tournament_id = ${tournamentId}
              AND season_id = ${seasonId}
            GROUP BY home_player_id, home_player_name
            
            UNION ALL
            
            SELECT 
              away_player_id as player_id,
              away_player_name as player_name,
              COUNT(*) as matches_played,
              SUM(home_goals) as goals_conceded,
              SUM(CASE WHEN home_goals = 0 THEN 1 ELSE 0 END) as clean_sheets
            FROM matchups
            WHERE tournament_id = ${tournamentId}
              AND season_id = ${seasonId}
            GROUP BY away_player_id, away_player_name
          )
          SELECT 
            player_id,
            player_name,
            SUM(matches_played) as total_matches,
            SUM(goals_conceded) as total_goals_conceded,
            SUM(clean_sheets) as total_clean_sheets,
            CAST(SUM(goals_conceded) AS FLOAT) / NULLIF(SUM(matches_played), 0) as goals_per_match
          FROM keeper_stats
          GROUP BY player_id, player_name
          HAVING SUM(matches_played) >= 5
          ORDER BY goals_per_match ASC, total_clean_sheets DESC
          LIMIT 1
        `;

        if (topKeeper.length > 0) {
          const result = await sql`
            INSERT INTO player_awards (
              player_id, player_name, season_id, tournament_id,
              award_category, award_type, award_position,
              player_category, awarded_by, notes,
              performance_stats
            )
            VALUES (
              ${topKeeper[0].player_id}, ${topKeeper[0].player_name}, ${seasonId}, ${tournamentId},
              'individual', 'Golden Glove', 'Winner',
              NULL, 'system', 'Auto-awarded based on goals conceded per match',
              ${JSON.stringify({ 
                goals_conceded: topKeeper[0].total_goals_conceded,
                matches: topKeeper[0].total_matches,
                goals_per_match: parseFloat(topKeeper[0].goals_per_match).toFixed(2),
                clean_sheets: topKeeper[0].total_clean_sheets
              })}
            )
            ON CONFLICT (player_id, season_id, tournament_id, award_category, award_type, award_position) DO NOTHING
            RETURNING *
          `;

          if (result.length > 0) {
            awardsGiven++;
            awards.push({ award_type: 'Golden Glove', player_name: topKeeper[0].player_name });
            console.log(`    ✅ Winner: ${topKeeper[0].player_name} (${parseFloat(topKeeper[0].goals_per_match).toFixed(2)} goals/match, ${topKeeper[0].total_clean_sheets} clean sheets)`);
          }
        }
      } else if (awardType === 'Golden Ball') {
        // Best player overall (most goals scored)
        const bestPlayer = await sql`
          WITH player_goals AS (
            SELECT 
              home_player_id as player_id,
              home_player_name as player_name,
              SUM(home_goals) as total_goals,
              SUM(CASE WHEN away_goals = 0 THEN 1 ELSE 0 END) as clean_sheets
            FROM matchups
            WHERE tournament_id = ${tournamentId}
              AND season_id = ${seasonId}
            GROUP BY home_player_id, home_player_name
            
            UNION ALL
            
            SELECT 
              away_player_id as player_id,
              away_player_name as player_name,
              SUM(away_goals) as total_goals,
              SUM(CASE WHEN home_goals = 0 THEN 1 ELSE 0 END) as clean_sheets
            FROM matchups
            WHERE tournament_id = ${tournamentId}
              AND season_id = ${seasonId}
            GROUP BY away_player_id, away_player_name
          )
          SELECT 
            player_id,
            player_name,
            SUM(total_goals) as total_goals,
            SUM(clean_sheets) as total_clean_sheets,
            (SUM(total_goals) * 2 + SUM(clean_sheets)) as total_score
          FROM player_goals
          GROUP BY player_id, player_name
          ORDER BY total_score DESC
          LIMIT 1
        `;

        if (bestPlayer.length > 0) {
          const result = await sql`
            INSERT INTO player_awards (
              player_id, player_name, season_id, tournament_id,
              award_category, award_type, award_position,
              player_category, awarded_by, notes,
              performance_stats
            )
            VALUES (
              ${bestPlayer[0].player_id}, ${bestPlayer[0].player_name}, ${seasonId}, ${tournamentId},
              'individual', 'Golden Ball', 'Winner',
              NULL, 'system', 'Auto-awarded based on overall performance',
              ${JSON.stringify({ 
                goals: bestPlayer[0].total_goals,
                clean_sheets: bestPlayer[0].total_clean_sheets
              })}
            )
            ON CONFLICT (player_id, season_id, tournament_id, award_category, award_type, award_position) DO NOTHING
            RETURNING *
          `;

          if (result.length > 0) {
            awardsGiven++;
            awards.push({ award_type: 'Golden Ball', player_name: bestPlayer[0].player_name });
            console.log(`    ✅ Winner: ${bestPlayer[0].player_name}`);
          }
        }
      } else if (awardType === 'Manager of Season') {
        const bestManager = await sql`
          SELECT 
            ts.team_id,
            ts.team_name,
            ts.manager_name,
            ts.points
          FROM teamstats ts
          WHERE ts.season_id = ${seasonId}
            AND ts.tournament_id = ${tournamentId}
          ORDER BY ts.points DESC, ts.goal_difference DESC
          LIMIT 1
        `;

        if (bestManager.length > 0 && bestManager[0].manager_name) {
          const result = await sql`
            INSERT INTO player_awards (
              player_id, player_name, season_id, tournament_id,
              award_category, award_type, award_position,
              player_category, awarded_by, notes,
              performance_stats
            )
            VALUES (
              ${bestManager[0].team_id}, ${bestManager[0].manager_name}, ${seasonId}, ${tournamentId},
              'individual', 'Manager of Season', 'Winner',
              NULL, 'system', 'Auto-awarded based on team performance',
              ${JSON.stringify({ team: bestManager[0].team_name, points: bestManager[0].points })}
            )
            ON CONFLICT (player_id, season_id, tournament_id, award_category, award_type, award_position) DO NOTHING
            RETURNING *
          `;

          if (result.length > 0) {
            awardsGiven++;
            awards.push({ award_type: 'Manager of Season', player_name: bestManager[0].manager_name });
            console.log(`    ✅ Winner: ${bestManager[0].manager_name} (${bestManager[0].team_name})`);
          }
        }
      } else if (awardType.startsWith('Best ')) {
        // Category-based awards disabled - no position field in players table
        console.log(`    ⚠️  ${awardType} award skipped - no position data available`);
      }
    }

    console.log(`\n🏆 Tournament awards complete: ${awardsGiven} awards given`);

    // Send notification
    if (awardsGiven > 0) {
      try {
        await sendNotificationToSeason(
          {
            title: '🎖️ Tournament Awards Announced!',
            body: `${awardsGiven} player awards have been awarded for the tournament!`,
            url: `/awards`,
            icon: '/logo.png',
            data: {
              type: 'tournament_awards_auto',
              season_id: seasonId,
              tournament_id: tournamentId,
              awards_count: awardsGiven.toString(),
            }
          },
          seasonId
        );
      } catch (notifError) {
        console.error('Failed to send auto-awards notification:', notifError);
      }
    }

    return NextResponse.json({
      success: true,
      awardsGiven,
      awards,
      message: `Successfully awarded ${awardsGiven} player awards`
    });
  } catch (error: any) {
    console.error('❌ Error awarding tournament player awards:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to award player awards' },
      { status: 500 }
    );
  }
}
