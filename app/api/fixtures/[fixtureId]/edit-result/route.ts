import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import { triggerNews } from '@/lib/news/trigger';
import { triggerPlayerOfMatchPoll } from '@/lib/polls/auto-trigger';
import { sendNotificationToSeason } from '@/lib/notifications/send-notification';

/**
 * Revert match rewards that were previously distributed
 */
async function revertMatchRewards(params: {
  fixtureId: string;
  oldResult: 'home_win' | 'away_win' | 'draw';
  seasonId: string;
}) {
  console.log('Skipping match reward reversion - teams and budgets are managed in Firebase/Auction DB');
  return;
}

/**
 * Distribute match rewards based on new result
 */
async function distributeMatchRewards(params: {
  fixtureId: string;
  matchResult: 'home_win' | 'away_win' | 'draw';
  seasonId: string;
}) {
  console.log('Skipping match reward distribution - teams and budgets are managed in Firebase/Auction DB');
  return;
}

/**
 * PATCH - Edit fixture results (with stat reversion)
 * Reverts old stats and applies new stats
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ fixtureId: string }> }
) {
  try {
    const sql = getTournamentDb();
    const { fixtureId } = await params;
    const body = await request.json();
    const { 
      matchups, 
      edited_by, 
      edited_by_name, 
      edit_reason,
      motm_player_id,
      motm_player_name,
      home_penalty_goals,
      away_penalty_goals
    } = body;

    if (!matchups || !Array.isArray(matchups)) {
      return NextResponse.json(
        { error: 'Invalid matchups data' },
        { status: 400 }
      );
    }

    // Set fallback baseUrl for API requests to avoid undefined hostname errors in dev environments
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    // Fetch fixture and old matchups
    const fixtures = await sql`
      SELECT f.*, ts.scoring_type, f.knockout_format, f.scoring_system
      FROM fixtures f
      LEFT JOIN tournaments t ON f.tournament_id = t.id
      LEFT JOIN tournament_settings ts ON t.id = ts.tournament_id
      WHERE f.id = ${fixtureId}
      LIMIT 1
    `;

    if (fixtures.length === 0) {
      return NextResponse.json(
        { error: 'Fixture not found' },
        { status: 404 }
      );
    }

    const fixture = fixtures[0];
    const seasonId = fixture.season_id;
    const scoringType = fixture.scoring_system || fixture.scoring_type || 'goals';
    const knockoutFormat = fixture.knockout_format;
    const isFirstTimeSubmit = fixture.status !== 'completed';
    const oldResult = fixture.result;

    // Fetch old matchups
    const oldMatchups = await sql`
      SELECT * FROM matchups WHERE fixture_id = ${fixtureId} ORDER BY position ASC
    `;

    // Merge old matchups with new scores from request body to preserve player IDs, substitutions, and is_null
    const mergedMatchups = matchups.map((m: any) => {
      const oldM = oldMatchups.find((om: any) => om.position === m.position);
      if (!oldM) {
        throw new Error(`Matchup at position ${m.position} not found in database`);
      }
      return {
        ...oldM,
        home_goals: m.home_goals,
        away_goals: m.away_goals,
      };
    });

    if (!isFirstTimeSubmit) {
      // Step 1: Revert old stats
      console.log('Reverting old stats...');
      const revertStatsRes = await fetch(`${baseUrl}/api/realplayers/revert-fixture-stats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          season_id: seasonId,
          fixture_id: fixtureId,
          matchups: oldMatchups.map((m: any) => ({
            home_player_id: m.home_player_id,
            home_player_name: m.home_player_name,
            away_player_id: m.away_player_id,
            away_player_name: m.away_player_name,
            home_goals: m.home_goals,
            away_goals: m.away_goals,
          }))
        })
      });

      if (!revertStatsRes.ok) {
        throw new Error('Failed to revert stats');
      }

      // Step 2: Revert old points
      console.log('Reverting old points...');
      const revertPointsRes = await fetch(`${baseUrl}/api/realplayers/revert-fixture-points`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fixture_id: fixtureId,
          season_id: seasonId,
          matchups: oldMatchups.map((m: any) => ({
            home_player_id: m.home_player_id,
            away_player_id: m.away_player_id,
            home_goals: m.home_goals,
            away_goals: m.away_goals,
          }))
        })
      });

      if (!revertPointsRes.ok) {
        throw new Error('Failed to revert points');
      }
    }

    // Step 3: Update matchups with new scores
    console.log('Updating matchups...');
    for (const matchup of mergedMatchups) {
      await sql`
        UPDATE matchups
        SET 
          home_goals = ${matchup.home_goals},
          away_goals = ${matchup.away_goals},
          updated_at = NOW()
        WHERE fixture_id = ${fixtureId}
          AND position = ${matchup.position}
      `;
    }

    // Destructure penalty goals and MOTM (or fall back to existing database columns)
    const finalHomePenaltyGoals = home_penalty_goals !== undefined ? (Number(home_penalty_goals) || 0) : (Number(fixture.home_penalty_goals) || 0);
    const finalAwayPenaltyGoals = away_penalty_goals !== undefined ? (Number(away_penalty_goals) || 0) : (Number(fixture.away_penalty_goals) || 0);
    let finalMotmPlayerId = motm_player_id !== undefined ? motm_player_id : (fixture.motm_player_id || null);
    let finalMotmPlayerName = motm_player_name !== undefined ? motm_player_name : (fixture.motm_player_name || null);

    // Validate MOTM - clear if player was removed from matchups
    if (finalMotmPlayerId) {
      const motmStillInMatch = mergedMatchups.some(
        (m: any) => m.home_player_id === finalMotmPlayerId || m.away_player_id === finalMotmPlayerId
      );

      if (!motmStillInMatch) {
        console.log(`⚠️ MOTM player ${finalMotmPlayerName} was removed from match - clearing MOTM`);
        finalMotmPlayerId = null;
        finalMotmPlayerName = null;
      }
    }

    // Step 4: Calculate new fixture totals
    const totalHomeSubPenalty = oldMatchups.reduce((sum: number, om: any) => sum + (Number(om.home_sub_penalty) || 0), 0);
    const totalAwaySubPenalty = oldMatchups.reduce((sum: number, om: any) => sum + (Number(om.away_sub_penalty) || 0), 0);

    let totalHomeScore = 0;
    let totalAwayScore = 0;

    if (knockoutFormat === 'round_robin' && scoringType === 'goals') {
      let homeGoals = 0;
      let awayGoals = 0;
      for (const m of mergedMatchups) {
        homeGoals += m.home_goals || 0;
        awayGoals += m.away_goals || 0;
      }
      totalHomeScore = homeGoals + totalAwaySubPenalty + finalHomePenaltyGoals;
      totalAwayScore = awayGoals + totalHomeSubPenalty + finalAwayPenaltyGoals;
    } else if (scoringType === 'wins') {
      for (const m of mergedMatchups) {
        const homeMatchupScore = (m.home_goals || 0) + (Number(m.away_sub_penalty) || 0);
        const awayMatchupScore = (m.away_goals || 0) + (Number(m.home_sub_penalty) || 0);
        
        if (homeMatchupScore > awayMatchupScore) {
          totalHomeScore += 3;
        } else if (awayMatchupScore > homeMatchupScore) {
          totalAwayScore += 3;
        } else {
          totalHomeScore += 1;
          totalAwayScore += 1;
        }
      }
      totalHomeScore += finalHomePenaltyGoals;
      totalAwayScore += finalAwayPenaltyGoals;
    } else {
      const matchupsHomeGoals = mergedMatchups.reduce((sum: number, m: any) => sum + (m.home_goals || 0), 0);
      const matchupsAwayGoals = mergedMatchups.reduce((sum: number, m: any) => sum + (m.away_goals || 0), 0);
      totalHomeScore = matchupsHomeGoals + totalAwaySubPenalty + finalHomePenaltyGoals;
      totalAwayScore = matchupsAwayGoals + totalHomeSubPenalty + finalAwayPenaltyGoals;
    }

    const newHomeScore = totalHomeScore;
    const newAwayScore = totalAwayScore;
    const newResult = newHomeScore > newAwayScore ? 'home_win' : 
                      newAwayScore > newHomeScore ? 'away_win' : 'draw';

    if (!isFirstTimeSubmit) {
      // Step 4.3: Revert old match rewards if result changed
      if (oldResult && oldResult !== newResult) {
        console.log(`🔄 Result changed from ${oldResult} to ${newResult} - adjusting match rewards...`);
        try {
          await revertMatchRewards({
            fixtureId,
            oldResult: oldResult as 'home_win' | 'away_win' | 'draw',
            seasonId,
          });
          console.log('✅ Old match rewards reverted');
        } catch (rewardError) {
          console.error('⚠️ Failed to revert old match rewards:', rewardError);
          // Continue anyway - we'll still distribute new rewards
        }
      }
    }

    // Step 5: Update fixture details
    await sql`
      UPDATE fixtures
      SET 
        home_score = ${newHomeScore},
        away_score = ${newAwayScore},
        result = ${newResult},
        status = 'completed',
        motm_player_id = ${finalMotmPlayerId},
        motm_player_name = ${finalMotmPlayerName},
        home_penalty_goals = ${finalHomePenaltyGoals},
        away_penalty_goals = ${finalAwayPenaltyGoals},
        played_date = NOW(),
        updated_at = NOW()
      WHERE id = ${fixtureId}
    `;

    // Step 5.5: Distribute new match rewards if result changed
    if (oldResult && oldResult !== newResult) {
      console.log('💰 Distributing corrected match rewards...');
      try {
        await distributeMatchRewards({
          fixtureId,
          matchResult: newResult as 'home_win' | 'away_win' | 'draw',
          seasonId,
        });
        console.log('✅ New match rewards distributed');
      } catch (rewardError) {
        console.error('⚠️ Failed to distribute new match rewards:', rewardError);
        // Don't fail the whole request
      }
    } else if (!oldResult) {
      // If there was no previous result (shouldn't happen, but handle it)
      console.log('💰 Distributing match rewards for first-time result...');
      try {
        await distributeMatchRewards({
          fixtureId,
          matchResult: newResult as 'home_win' | 'away_win' | 'draw',
          seasonId,
        });
        console.log('✅ Match rewards distributed');
      } catch (rewardError) {
        console.error('⚠️ Failed to distribute match rewards:', rewardError);
      }
    } else {
      console.log('ℹ️ Result unchanged - no reward adjustment needed');
    }

    // Step 6: Apply new stats
    console.log('Applying new stats...');
    const applyStatsRes = await fetch(`${baseUrl}/api/realplayers/update-stats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        season_id: seasonId,
        fixture_id: fixtureId,
        matchups: mergedMatchups,
        motm_player_id: finalMotmPlayerId,
      })
    });

    if (!applyStatsRes.ok) {
      throw new Error('Failed to apply new stats');
    }

    // Step 7: Apply new points (skip salary deduction if this is an edit, but run it on first submit)
    console.log('Applying new points...');
    const applyPointsRes = await fetch(`${baseUrl}/api/realplayers/update-points`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fixture_id: fixtureId,
        season_id: seasonId,
        matchups: mergedMatchups,
        skip_salary_deduction: !isFirstTimeSubmit, // Don't deduct salary again on edit
      })
    });

    if (!applyPointsRes.ok) {
      throw new Error('Failed to apply new points');
    }

    // Step 7.1: Adjust salaries for player swaps
    console.log('Adjusting salaries for player swaps...');
    try {
      const salaryAdjustRes = await fetch(`${baseUrl}/api/realplayers/adjust-salaries-for-edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fixture_id: fixtureId,
          season_id: seasonId,
          old_matchups: oldMatchups,
          new_matchups: mergedMatchups,
        })
      });

      if (salaryAdjustRes.ok) {
        const salaryData = await salaryAdjustRes.json();
        console.log(`✅ Salary adjustments: ${salaryData.refunds?.length || 0} refunds, ${salaryData.deductions?.length || 0} deductions`);
      } else {
        console.error('⚠️ Salary adjustment failed (non-critical)');
      }
    } catch (salaryError) {
      console.error('Salary adjustment error (non-critical):', salaryError);
      // Don't fail the whole request if salary adjustment fails
    }

    // Step 7.5: Update team stats with new results
    console.log('Updating team stats...');
    try {
      const teamStatsRes = await fetch(`${baseUrl}/api/teamstats/update-stats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          season_id: seasonId,
          fixture_id: fixtureId,
          home_team_id: fixture.home_team_id,
          away_team_id: fixture.away_team_id,
          home_score: newHomeScore,
          away_score: newAwayScore,
          home_penalty_goals: finalHomePenaltyGoals,
          away_penalty_goals: finalAwayPenaltyGoals,
          matchups: mergedMatchups,
          is_edit: true  // Flag to indicate this is an edit
        })
      });

      if (teamStatsRes.ok) {
        const teamStatsData = await teamStatsRes.json();
        console.log(`✅ Team stats updated: ${teamStatsData.message}`);
      } else {
        const errorData = await teamStatsRes.json();
        console.error('❌ Team stats update failed:', errorData);
        throw new Error(`Team stats update failed: ${errorData.error}`);
      }
    } catch (teamStatsError) {
      console.error('Team stats update error:', teamStatsError);
      throw new Error('Failed to update team stats');
    }

    if (!isFirstTimeSubmit) {
      // Step 7.5.5: Delete old fantasy team bonus points to prevent duplicates
      console.log('🗑️  Deleting old fantasy team bonus points...');
      try {
        const { getFantasyDb } = await import('@/lib/neon/fantasy-config');
        const fantasySql = getFantasyDb();
        
        await fantasySql`
          DELETE FROM fantasy_team_bonus_points
          WHERE fixture_id = ${fixtureId}
        `;
        console.log('✅ Old fantasy team bonus points deleted');
      } catch (bonusError) {
        console.error('⚠️  Failed to delete old fantasy bonus points:', bonusError);
      }

      // Step 7.6: Revert old fantasy points
      console.log('Reverting old fantasy points...');
      try {
        const revertFantasyRes = await fetch(`${baseUrl}/api/fantasy/revert-fixture-points`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fixture_id: fixtureId,
            season_id: seasonId,
          })
        });

        if (revertFantasyRes.ok) {
          const revertData = await revertFantasyRes.json();
          console.log(`✓ Reverted fantasy points: ${revertData.message}`);
        } else {
          console.log('ℹ️ No fantasy points to revert');
        }
      } catch (fantasyError) {
        console.error('Fantasy points revert error (non-critical):', fantasyError);
      }
    }

    // Step 7.7: Calculate fantasy points with new results
    console.log('Recalculating fantasy points...');
    try {
      const recalcFantasyRes = await fetch(`${baseUrl}/api/fantasy/calculate-points`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fixture_id: fixtureId,
          season_id: seasonId,
          round_number: fixture.round_number,
        })
      });

      if (recalcFantasyRes.ok) {
        const fantasyData = await recalcFantasyRes.json();
        console.log(`✅ Fantasy points recalculated: ${fantasyData.message}`);
      } else {
        console.log('ℹ️ No fantasy league active or fantasy calculation skipped');
      }
    } catch (fantasyError) {
      console.error('Fantasy points calculation error (non-critical):', fantasyError);
    }

    // Step 8: Log in audit trail
    await sql`
      INSERT INTO fixture_audit_log (
        fixture_id,
        change_type,
        changed_by,
        changes,
        tournament_id
      ) VALUES (
        ${fixtureId},
        'result_edited',
        ${edited_by_name || 'Committee Admin'},
        ${JSON.stringify({
          edited_by: edited_by || 'system',
          edit_reason: edit_reason || 'Result edited by committee admin',
          season_id: fixture.season_id,
          round_number: fixture.round_number,
          match_number: fixture.match_number,
          old: {
            home_score: fixture.home_score,
            away_score: fixture.away_score,
            result: fixture.result,
            matchups: oldMatchups
          },
          new: {
            home_score: newHomeScore,
            away_score: newAwayScore,
            result: newResult,
            matchups: mergedMatchups
          },
          rewards_adjusted: oldResult !== newResult
        })},
        ${fixture.season_id}
      )
    `;

    // Delete old news for this fixture (if exists)
    console.log('Deleting old match result news...');
    try {
      await sql`
        DELETE FROM news
        WHERE event_type = 'match_result'
          AND metadata->>'fixture_id' = ${fixtureId}
      `;
      console.log('✓ Old news deleted');
    } catch (newsDeleteError) {
      console.error('Failed to delete old news:', newsDeleteError);
    }

    // Generate new news for updated match result
    console.log('Generating new match result news...');
    try {
      await triggerNews('match_result', {
        season_id: seasonId,
        fixture_id: fixtureId,
        home_team_name: fixture.home_team_name,
        away_team_name: fixture.away_team_name,
        home_score: newHomeScore,
        away_score: newAwayScore,
        result: newResult,
        motm_player_name: finalMotmPlayerName || null,
      });
      console.log('✅ New match result news generated');
    } catch (newsError) {
      console.error('Failed to generate match result news:', newsError);
    }

    // Trigger player of the match poll (async, non-blocking)
    triggerPlayerOfMatchPoll(fixtureId).catch(pollError => {
      console.error('Failed to create player of match poll:', pollError);
    });

    // Revalidate cache for relevant pages
    try {
      console.log('🔄 Revalidating cache...');
      revalidatePath(`/fixtures/${fixtureId}`);
      revalidatePath(`/dashboard/team/fixtures/${fixtureId}`);
      revalidatePath(`/dashboard/committee/team-management/fixture/${fixtureId}`);
      revalidatePath(`/tournaments/${fixture.tournament_id}/standings`);
      revalidatePath(`/fantasy/leaderboard`);
      revalidatePath('/'); // Homepage might show recent results
      console.log('✅ Cache revalidated');
    } catch (cacheError) {
      console.error('Cache revalidation error (non-critical):', cacheError);
    }

    // Send FCM notification
    try {
      await sendNotificationToSeason(
        {
          title: '✏️ Match Result Edited',
          body: `${fixture.home_team_name} vs ${fixture.away_team_name} result updated: ${newHomeScore}-${newAwayScore}`,
          url: `/fixtures/${fixtureId}`,
          icon: '/logo.png',
          data: {
            type: 'result_edited',
            fixture_id: fixtureId,
            home_team: fixture.home_team_name,
            away_team: fixture.away_team_name,
            home_score: newHomeScore.toString(),
            away_score: newAwayScore.toString(),
            result: newResult,
          }
        },
        seasonId
      );
    } catch (notifError) {
      console.error('Failed to send result edit notification:', notifError);
      // Don't fail the request
    }

    return NextResponse.json({
      success: true,
      message: 'Results edited successfully',
      fixture: {
        id: fixtureId,
        home_score: newHomeScore,
        away_score: newAwayScore,
        result: newResult
      }
    });
  } catch (error) {
    console.error('Error editing result:', error);
    return NextResponse.json(
      { error: `Failed to edit result: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
