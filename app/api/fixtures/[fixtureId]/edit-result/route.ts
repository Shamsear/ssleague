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
  const sql = getTournamentDb();
  const { fixtureId, oldResult, seasonId } = params;

  // Get fixture details
  const [fixture] = await sql`
    SELECT home_team_id, away_team_id, tournament_id, round_number, leg
    FROM fixtures
    WHERE id = ${fixtureId}
    LIMIT 1
  `;

  if (!fixture) {
    console.log('Fixture not found for reward reversion');
    return;
  }

  const { home_team_id, away_team_id, tournament_id, round_number, leg } = fixture;

  // Get tournament rewards configuration
  const [tournament] = await sql`
    SELECT rewards
    FROM tournaments
    WHERE id = ${tournament_id}
    LIMIT 1
  `;

  if (!tournament || !tournament.rewards || !tournament.rewards.match_results) {
    console.log(`No match rewards configured for tournament ${tournament_id}`);
    return;
  }

  const matchRewards = tournament.rewards.match_results;

  // Determine what rewards were given based on old result
  let homeECoin = 0, homeSSCoin = 0, awayECoin = 0, awaySSCoin = 0;

  if (oldResult === 'home_win') {
    homeECoin = matchRewards.win_ecoin || 0;
    homeSSCoin = matchRewards.win_sscoin || 0;
    awayECoin = matchRewards.loss_ecoin || 0;
    awaySSCoin = matchRewards.loss_sscoin || 0;
  } else if (oldResult === 'away_win') {
    homeECoin = matchRewards.loss_ecoin || 0;
    homeSSCoin = matchRewards.loss_sscoin || 0;
    awayECoin = matchRewards.win_ecoin || 0;
    awaySSCoin = matchRewards.win_sscoin || 0;
  } else {
    homeECoin = matchRewards.draw_ecoin || 0;
    homeSSCoin = matchRewards.draw_sscoin || 0;
    awayECoin = matchRewards.draw_ecoin || 0;
    awaySSCoin = matchRewards.draw_sscoin || 0;
  }

  // Revert rewards from home team
  if (homeECoin > 0 || homeSSCoin > 0) {
    await sql`
      UPDATE teams
      SET 
        football_budget = COALESCE(football_budget, 0) - ${homeECoin},
        real_budget = COALESCE(real_budget, 0) - ${homeSSCoin},
        updated_at = NOW()
      WHERE id = ${home_team_id}
    `;

    // Record reversal transaction
    await sql`
      INSERT INTO transactions (
        team_id,
        season_id,
        transaction_type,
        amount_football,
        amount_real,
        description,
        created_at
      ) VALUES (
        ${home_team_id},
        ${seasonId},
        'match_reward',
        ${-homeECoin},
        ${-homeSSCoin},
        ${'Match Reward Reversal (Result Edited) - Round ' + round_number + (leg > 1 ? ' Leg ' + leg : '')},
        NOW()
      )
    `;

    console.log(`✅ Reverted match rewards from home team ${home_team_id}: eCoin -${homeECoin}, SSCoin -${homeSSCoin}`);
  }

  // Revert rewards from away team
  if (awayECoin > 0 || awaySSCoin > 0) {
    await sql`
      UPDATE teams
      SET 
        football_budget = COALESCE(football_budget, 0) - ${awayECoin},
        real_budget = COALESCE(real_budget, 0) - ${awaySSCoin},
        updated_at = NOW()
      WHERE id = ${away_team_id}
    `;

    // Record reversal transaction
    await sql`
      INSERT INTO transactions (
        team_id,
        season_id,
        transaction_type,
        amount_football,
        amount_real,
        description,
        created_at
      ) VALUES (
        ${away_team_id},
        ${seasonId},
        'match_reward',
        ${-awayECoin},
        ${-awaySSCoin},
        ${'Match Reward Reversal (Result Edited) - Round ' + round_number + (leg > 1 ? ' Leg ' + leg : '')},
        NOW()
      )
    `;

    console.log(`✅ Reverted match rewards from away team ${away_team_id}: eCoin -${awayECoin}, SSCoin -${awaySSCoin}`);
  }
}

/**
 * Distribute match rewards based on new result
 */
async function distributeMatchRewards(params: {
  fixtureId: string;
  matchResult: 'home_win' | 'away_win' | 'draw';
  seasonId: string;
}) {
  const sql = getTournamentDb();
  const { fixtureId, matchResult, seasonId } = params;

  // Get fixture details
  const [fixture] = await sql`
    SELECT home_team_id, away_team_id, tournament_id, round_number, leg
    FROM fixtures
    WHERE id = ${fixtureId}
    LIMIT 1
  `;

  if (!fixture) {
    console.log('Fixture not found for rewards distribution');
    return;
  }

  const { home_team_id, away_team_id, tournament_id, round_number, leg } = fixture;

  // Get tournament rewards configuration
  const [tournament] = await sql`
    SELECT rewards
    FROM tournaments
    WHERE id = ${tournament_id}
    LIMIT 1
  `;

  if (!tournament || !tournament.rewards || !tournament.rewards.match_results) {
    console.log(`No match rewards configured for tournament ${tournament_id}`);
    return;
  }

  const matchRewards = tournament.rewards.match_results;

  // Determine rewards for each team
  let homeECoin = 0, homeSSCoin = 0, awayECoin = 0, awaySSCoin = 0;
  let homeResult = '', awayResult = '';

  if (matchResult === 'home_win') {
    homeECoin = matchRewards.win_ecoin || 0;
    homeSSCoin = matchRewards.win_sscoin || 0;
    awayECoin = matchRewards.loss_ecoin || 0;
    awaySSCoin = matchRewards.loss_sscoin || 0;
    homeResult = 'Win';
    awayResult = 'Loss';
  } else if (matchResult === 'away_win') {
    homeECoin = matchRewards.loss_ecoin || 0;
    homeSSCoin = matchRewards.loss_sscoin || 0;
    awayECoin = matchRewards.win_ecoin || 0;
    awaySSCoin = matchRewards.win_sscoin || 0;
    homeResult = 'Loss';
    awayResult = 'Win';
  } else {
    homeECoin = matchRewards.draw_ecoin || 0;
    homeSSCoin = matchRewards.draw_sscoin || 0;
    awayECoin = matchRewards.draw_ecoin || 0;
    awaySSCoin = matchRewards.draw_sscoin || 0;
    homeResult = 'Draw';
    awayResult = 'Draw';
  }

  // Distribute rewards to home team
  if (homeECoin > 0 || homeSSCoin > 0) {
    await sql`
      UPDATE teams
      SET 
        football_budget = COALESCE(football_budget, 0) + ${homeECoin},
        real_budget = COALESCE(real_budget, 0) + ${homeSSCoin},
        updated_at = NOW()
      WHERE id = ${home_team_id}
    `;

    // Record transaction
    await sql`
      INSERT INTO transactions (
        team_id,
        season_id,
        transaction_type,
        amount_football,
        amount_real,
        description,
        created_at
      ) VALUES (
        ${home_team_id},
        ${seasonId},
        'match_reward',
        ${homeECoin},
        ${homeSSCoin},
        ${'Match Reward (' + homeResult + ') - Round ' + round_number + (leg > 1 ? ' Leg ' + leg : '') + ' [Corrected]'},
        NOW()
      )
    `;

    console.log(`✅ Distributed corrected match rewards to home team ${home_team_id}: eCoin ${homeECoin}, SSCoin ${homeSSCoin}`);
  }

  // Distribute rewards to away team
  if (awayECoin > 0 || awaySSCoin > 0) {
    await sql`
      UPDATE teams
      SET 
        football_budget = COALESCE(football_budget, 0) + ${awayECoin},
        real_budget = COALESCE(real_budget, 0) + ${awaySSCoin},
        updated_at = NOW()
      WHERE id = ${away_team_id}
    `;

    // Record transaction
    await sql`
      INSERT INTO transactions (
        team_id,
        season_id,
        transaction_type,
        amount_football,
        amount_real,
        description,
        created_at
      ) VALUES (
        ${away_team_id},
        ${seasonId},
        'match_reward',
        ${awayECoin},
        ${awaySSCoin},
        ${'Match Reward (' + awayResult + ') - Round ' + round_number + (leg > 1 ? ' Leg ' + leg : '') + ' [Corrected]'},
        NOW()
      )
    `;

    console.log(`✅ Distributed corrected match rewards to away team ${away_team_id}: eCoin ${awayECoin}, SSCoin ${awaySSCoin}`);
  }
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
      edit_reason 
    } = body;

    if (!matchups || !Array.isArray(matchups)) {
      return NextResponse.json(
        { error: 'Invalid matchups data' },
        { status: 400 }
      );
    }

    // Fetch fixture and old matchups
    const fixtures = await sql`
      SELECT * FROM fixtures WHERE id = ${fixtureId} LIMIT 1
    `;

    if (fixtures.length === 0) {
      return NextResponse.json(
        { error: 'Fixture not found' },
        { status: 404 }
      );
    }

    const fixture = fixtures[0];
    const seasonId = fixture.season_id;

    // Fetch old matchups
    const oldMatchups = await sql`
      SELECT * FROM matchups WHERE fixture_id = ${fixtureId}
    `;

    // Step 1: Revert old stats
    console.log('Reverting old stats...');
    const revertStatsRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/realplayers/revert-fixture-stats`, {
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
    const revertPointsRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/realplayers/revert-fixture-points`, {
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

    // Step 3: Update matchups with new scores
    console.log('Updating matchups...');
    for (const matchup of matchups) {
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

    // Step 4: Calculate new fixture totals
    const newHomeScore = matchups.reduce((sum: number, m: any) => sum + (m.home_goals || 0), 0);
    const newAwayScore = matchups.reduce((sum: number, m: any) => sum + (m.away_goals || 0), 0);
    const newResult = newHomeScore > newAwayScore ? 'home_win' : 
                      newAwayScore > newHomeScore ? 'away_win' : 'draw';

    // Step 4.2: Delete old transactions for this fixture to prevent duplicates
    console.log('🗑️  Deleting old transactions for this fixture...');
    try {
      await sql`
        DELETE FROM transactions
        WHERE description LIKE ${'%Fixture: ' + fixtureId + '%'}
          AND transaction_type = 'match_reward'
      `;
      console.log('✅ Old transactions deleted');
    } catch (txError) {
      console.error('⚠️  Failed to delete old transactions:', txError);
    }

    // Step 4.3: Revert old match rewards if result changed
    const oldResult = fixture.result;
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

    // Step 4.5: Validate MOTM - clear if player was removed from match
    if (fixture.motm_player_id) {
      const motmStillInMatch = matchups.some(
        (m: any) => m.home_player_id === fixture.motm_player_id || m.away_player_id === fixture.motm_player_id
      );

      if (!motmStillInMatch) {
        console.log(`⚠️  MOTM player ${fixture.motm_player_name} was removed from match - clearing MOTM`);
        // Clear MOTM since the player is no longer in the match
        await sql`
          UPDATE fixtures
          SET 
            motm_player_id = NULL,
            motm_player_name = NULL,
            updated_at = NOW()
          WHERE id = ${fixtureId}
        `;
      }
    }

    // Step 5: Update fixture
    await sql`
      UPDATE fixtures
      SET 
        home_score = ${newHomeScore},
        away_score = ${newAwayScore},
        result = ${newResult},
        updated_by = ${edited_by || null},
        updated_by_name = ${edited_by_name || null},
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
    const applyStatsRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/realplayers/update-stats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        season_id: seasonId,
        fixture_id: fixtureId,
        matchups: matchups,
        motm_player_id: fixture.motm_player_id || null,
      })
    });

    if (!applyStatsRes.ok) {
      throw new Error('Failed to apply new stats');
    }

    // Step 7: Apply new points (skip salary deduction since it was already done on initial submit)
    console.log('Applying new points...');
    const applyPointsRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/realplayers/update-points`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fixture_id: fixtureId,
        season_id: seasonId,
        matchups: matchups,
        skip_salary_deduction: true, // Don't deduct salary again on edit
      })
    });

    if (!applyPointsRes.ok) {
      throw new Error('Failed to apply new points');
    }

    // Step 7.1: Adjust salaries for player swaps
    console.log('Adjusting salaries for player swaps...');
    try {
      const salaryAdjustRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/realplayers/adjust-salaries-for-edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fixture_id: fixtureId,
          season_id: seasonId,
          old_matchups: oldMatchups,
          new_matchups: matchups,
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
      const teamStatsRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/teamstats/update-stats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          season_id: seasonId,
          fixture_id: fixtureId,
          home_team_id: fixture.home_team_id,
          away_team_id: fixture.away_team_id,
          home_score: totalHomeScore,
          away_score: totalAwayScore,
          home_penalty_goals: Number(home_penalty_goals) || 0,
          away_penalty_goals: Number(away_penalty_goals) || 0,
          matchups: matchups,
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
      const revertFantasyRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/fantasy/revert-fixture-points`, {
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

        // Step 7.7: Recalculate fantasy points with new results
        console.log('Recalculating fantasy points...');
        const recalcFantasyRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/fantasy/calculate-points`, {
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
      } else {
        console.log('ℹ️ No fantasy points to revert');
      }
    } catch (fantasyError) {
      console.error('Fantasy points update error (non-critical):', fantasyError);
      // Don't fail the whole request if fantasy fails
    }

    // Step 8: Log in audit trail
    await sql`
      INSERT INTO fixture_audit_log (
        fixture_id,
        action_type,
        action_by,
        action_by_name,
        notes,
        season_id,
        round_number,
        match_number,
        changes
      ) VALUES (
        ${fixtureId},
        'result_edited',
        ${edited_by || 'system'},
        ${edited_by_name || 'Committee Admin'},
        ${edit_reason || 'Result edited by committee admin'},
        ${fixture.season_id},
        ${fixture.round_number},
        ${fixture.match_number},
        ${JSON.stringify({
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
            matchups: matchups
          },
          rewards_adjusted: oldResult !== newResult
        })}
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
        motm_player_name: fixture.motm_player_name || null,
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
