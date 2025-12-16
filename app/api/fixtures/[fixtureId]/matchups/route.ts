import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import { sendNotificationToSeason } from '@/lib/notifications/send-notification';

/**
 * Distribute match rewards (eCoin & SSCoin) to teams based on match result
 */
async function distributeMatchRewards(params: {
  fixtureId: string;
  matchResult: 'home_win' | 'away_win' | 'draw';
  seasonId: string;
  roundNumber: number;
  leg: number;
}) {
  const sql = getTournamentDb();
  const { fixtureId, matchResult, seasonId, roundNumber, leg } = params;

  // Check if rewards have already been distributed for this fixture
  const existingRewards = await sql`
    SELECT id FROM transactions
    WHERE description LIKE ${'%Fixture: ' + fixtureId + '%'}
    AND transaction_type = 'match_reward'
    LIMIT 1
  `;

  if (existingRewards.length > 0) {
    console.log(`⚠️ Match rewards already distributed for fixture ${fixtureId}, skipping duplicate distribution`);
    return;
  }

  // Get fixture details
  const [fixture] = await sql`
    SELECT home_team_id, away_team_id, tournament_id
    FROM fixtures
    WHERE id = ${fixtureId}
    LIMIT 1
  `;

  if (!fixture) {
    console.log('Fixture not found for rewards distribution');
    return;
  }

  const { home_team_id, away_team_id, tournament_id } = fixture;

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
        ${'Match Reward (' + homeResult + ') - Round ' + roundNumber + (leg > 1 ? ' Leg ' + leg : '') + ' - Fixture: ' + fixtureId},
        NOW()
      )
    `;

    console.log(`✅ Distributed match rewards to home team ${home_team_id}: eCoin ${homeECoin}, SSCoin ${homeSSCoin}`);
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
        ${'Match Reward (' + awayResult + ') - Round ' + roundNumber + (leg > 1 ? ' Leg ' + leg : '') + ' - Fixture: ' + fixtureId},
        NOW()
      )
    `;

    console.log(`✅ Distributed match rewards to away team ${away_team_id}: eCoin ${awayECoin}, SSCoin ${awaySSCoin}`);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fixtureId: string }> }
) {
  try {
    const sql = getTournamentDb();
    const { fixtureId } = await params;

    // Get matchups for this fixture
    const matchups = await sql`
      SELECT * FROM matchups
      WHERE fixture_id = ${fixtureId}
      ORDER BY position ASC
    `;

    return NextResponse.json({ matchups });
  } catch (error) {
    console.error('Error fetching matchups:', error);
    return NextResponse.json(
      { error: 'Failed to fetch matchups' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ fixtureId: string }> }
) {
  try {
    const sql = getTournamentDb();
    const { fixtureId } = await params;
    const body = await request.json();
    const { matchups, created_by, allow_overwrite } = body;

    console.log('📥 Received matchups data:', {
      fixtureId,
      created_by,
      matchupsCount: matchups?.length,
      isArray: Array.isArray(matchups),
      allow_overwrite,
      firstMatchup: matchups?.[0]
    });

    // Validate
    if (!matchups || !Array.isArray(matchups) || matchups.length === 0) {
      console.error('❌ Validation failed:', { matchups, isArray: Array.isArray(matchups), length: matchups?.length });
      return NextResponse.json(
        { error: 'Invalid matchups data' },
        { status: 400 }
      );
    }

    // Get fixture to extract season_id and round_number
    const fixtures = await sql`
      SELECT season_id, round_number, home_team_id, away_team_id, home_team_name, away_team_name 
      FROM fixtures 
      WHERE id = ${fixtureId} 
      LIMIT 1
    `;
    
    if (fixtures.length === 0) {
      return NextResponse.json(
        { error: 'Fixture not found' },
        { status: 404 }
      );
    }
    
    const fixture = fixtures[0];
    const { season_id: seasonId, round_number: roundNumber, home_team_id, away_team_id, home_team_name, away_team_name } = fixture;

    // Check if matchups already exist
    const existingMatchups = await sql`
      SELECT COUNT(*) as count
      FROM matchups
      WHERE fixture_id = ${fixtureId}
    `;

    const matchupsExist = existingMatchups[0].count > 0;

    // If matchups exist and we're not explicitly allowing overwrite, reject
    if (matchupsExist && !allow_overwrite) {
      console.log('⚠️ Race condition detected: Matchups already exist');
      return NextResponse.json(
        { 
          error: 'MATCHUPS_ALREADY_EXIST',
          message: 'Fixture has already been created by the other team'
        },
        { status: 409 } // 409 Conflict
      );
    }

    // If overwriting, delete existing matchups
    let wasOverwritten = false;
    if (matchupsExist) {
      console.log('🗑️ Deleting existing matchups for overwrite');
      await sql`
        DELETE FROM matchups
        WHERE fixture_id = ${fixtureId}
      `;
      wasOverwritten = true;
    }

    // Insert new matchups
    for (const matchup of matchups) {
      await sql`
        INSERT INTO matchups (
          fixture_id,
          season_id,
          round_number,
          home_player_id,
          home_player_name,
          away_player_id,
          away_player_name,
          position,
          match_duration,
          created_by,
          created_at
        ) VALUES (
          ${fixtureId},
          ${seasonId},
          ${roundNumber},
          ${matchup.home_player_id},
          ${matchup.home_player_name},
          ${matchup.away_player_id},
          ${matchup.away_player_name},
          ${matchup.position},
          ${matchup.match_duration || 6},
          ${created_by},
          NOW()
        )
      `;
    }

    // Update fixture with creation tracking
    await sql`
      UPDATE fixtures
      SET 
        matchups_created_by = ${created_by},
        matchups_created_at = NOW(),
        updated_at = NOW()
      WHERE id = ${fixtureId}
    `;

    // Send FCM notification
    try {
      const notificationBody = wasOverwritten
        ? `Matchups for ${home_team_name} vs ${away_team_name} have been updated (${matchups.length} matches).`
        : `Matchups for ${home_team_name} vs ${away_team_name} have been created (${matchups.length} matches).`;

      await sendNotificationToSeason(
        {
          title: wasOverwritten ? '🔄 Matchups Updated' : '⚔️ Matchups Created',
          body: notificationBody,
          url: `/fixtures/${fixtureId}`,
          icon: '/logo.png',
          data: {
            type: wasOverwritten ? 'matchups_updated' : 'matchups_created',
            fixture_id: fixtureId,
            home_team: home_team_name,
            away_team: away_team_name,
            matchup_count: matchups.length.toString(),
          }
        },
        seasonId
      );
    } catch (notifError) {
      console.error('Failed to send matchups creation notification:', notifError);
      // Don't fail the request
    }

    console.log(`✅ Matchups ${wasOverwritten ? 'updated' : 'created'} successfully by ${created_by}`);

    return NextResponse.json({ 
      success: true, 
      message: wasOverwritten ? 'Matchups updated successfully' : 'Matchups created successfully',
      was_overwritten: wasOverwritten
    });
  } catch (error: any) {
    console.error('Error creating matchups:', error);
    console.error('Error details:', error.message, error.stack);
    return NextResponse.json(
      { error: 'Failed to create matchups', details: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ fixtureId: string }> }
) {
  try {
    const sql = getTournamentDb();
    const { fixtureId } = await params;
    const body = await request.json();
    const { matchups } = body;

    // Validate
    if (!matchups || !Array.isArray(matchups) || matchups.length === 0) {
      return NextResponse.json(
        { error: 'Invalid matchups data' },
        { status: 400 }
      );
    }

    // Update existing matchups (including substitution fields)
    for (const matchup of matchups) {
      await sql`
        UPDATE matchups
        SET 
          home_player_id = ${matchup.home_player_id},
          home_player_name = ${matchup.home_player_name},
          away_player_id = ${matchup.away_player_id},
          away_player_name = ${matchup.away_player_name},
          match_duration = ${matchup.match_duration || 6},
          home_original_player_id = ${matchup.home_original_player_id || null},
          home_original_player_name = ${matchup.home_original_player_name || null},
          home_substituted = ${matchup.home_substituted || false},
          home_sub_penalty = ${matchup.home_sub_penalty || 0},
          away_original_player_id = ${matchup.away_original_player_id || null},
          away_original_player_name = ${matchup.away_original_player_name || null},
          away_substituted = ${matchup.away_substituted || false},
          away_sub_penalty = ${matchup.away_sub_penalty || 0},
          updated_at = NOW()
        WHERE fixture_id = ${fixtureId}
        AND position = ${matchup.position}
      `;
    }

    return NextResponse.json({ success: true, message: 'Matchups updated successfully' });
  } catch (error) {
    console.error('Error updating matchups:', error);
    return NextResponse.json(
      { error: 'Failed to update matchups' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ fixtureId: string }> }
) {
  try {
    const sql = getTournamentDb();
    const { fixtureId } = await params;
    const body = await request.json();
    const { results, entered_by } = body;

    // Validate
    if (!results || !Array.isArray(results) || results.length === 0) {
      return NextResponse.json(
        { error: 'Invalid results data' },
        { status: 400 }
      );
    }

    // Check result entry deadline and get penalty goals
    const fixtures = await sql`
      SELECT f.season_id, f.round_number, f.leg, 
             COALESCE(f.home_penalty_goals, 0) as home_penalty_goals,
             COALESCE(f.away_penalty_goals, 0) as away_penalty_goals
      FROM fixtures f
      WHERE f.id = ${fixtureId}
      LIMIT 1
    `;
    
    if (fixtures.length === 0) {
      return NextResponse.json(
        { error: 'Fixture not found' },
        { status: 404 }
      );
    }
    
    const { season_id, round_number, leg, home_penalty_goals, away_penalty_goals } = fixtures[0];
    
    // Get round deadlines
    const deadlines = await sql`
      SELECT scheduled_date, result_entry_deadline_time, result_entry_deadline_day_offset
      FROM round_deadlines
      WHERE season_id = ${season_id}
      AND round_number = ${round_number}
      AND leg = ${leg}
      LIMIT 1
    `;
    
    // Deadline check disabled - phase logic on frontend controls access
    // The frontend already checks if we're in result_entry phase before allowing submission
    if (deadlines.length > 0 && deadlines[0].scheduled_date) {
      const deadline = deadlines[0];
      
      // Calculate result entry deadline for logging
      const resultDate = new Date(deadline.scheduled_date);
      resultDate.setDate(resultDate.getDate() + (deadline.result_entry_deadline_day_offset || 2));
      const resultDateStr = resultDate.toISOString().split('T')[0];
      
      // Parse deadline time (HH:MM format)
      const [hours, minutes] = deadline.result_entry_deadline_time.split(':').map(Number);
      
      // Create deadline in IST (UTC+5:30)
      const resultDeadline = new Date(resultDateStr);
      resultDeadline.setUTCHours(hours - 5, minutes - 30, 0, 0); // Convert IST to UTC
      
      const now = new Date();
      
      console.log('Result entry - Deadline info:', {
        now: now.toISOString(),
        deadline: resultDeadline.toISOString(),
        isPassed: now >= resultDeadline,
        note: 'Deadline check disabled - controlled by frontend phase logic'
      });
      
      // Deadline check commented out - frontend phase logic controls access
      // if (now >= resultDeadline) {
      //   return NextResponse.json(
      //     { 
      //       error: 'Result entry deadline has passed',
      //       deadline: resultDeadline.toISOString(),
      //       current_time: now.toISOString()
      //     },
      //     { status: 403 }
      //   );
      // }
    }

    // Update match results (MOTM is now at fixture level, not matchup level)
    for (const result of results) {
      await sql`
        UPDATE matchups
        SET 
          home_goals = ${result.home_goals},
          away_goals = ${result.away_goals},
          result_entered_by = ${entered_by},
          result_entered_at = NOW(),
          updated_at = NOW()
        WHERE fixture_id = ${fixtureId}
        AND position = ${result.position}
      `;
    }

    // Calculate total scores from all matchups
    let totalHomeScore = 0;
    let totalAwayScore = 0;
    for (const result of results) {
      totalHomeScore += result.home_goals;
      totalAwayScore += result.away_goals;
    }

    // Get substitution penalties from matchups
    const matchupsWithPenalties = await sql`
      SELECT 
        COALESCE(SUM(home_sub_penalty), 0) as total_home_sub_penalty,
        COALESCE(SUM(away_sub_penalty), 0) as total_away_sub_penalty
      FROM matchups
      WHERE fixture_id = ${fixtureId}
    `;
    
    const homeSubPenalty = Number(matchupsWithPenalties[0]?.total_home_sub_penalty) || 0;
    const awaySubPenalty = Number(matchupsWithPenalties[0]?.total_away_sub_penalty) || 0;

    // Add penalty/fine goals to total scores
    // Home team gets: their goals + away's substitution penalties + fine/violation goals
    // Away team gets: their goals + home's substitution penalties + fine/violation goals
    totalHomeScore += awaySubPenalty + (Number(home_penalty_goals) || 0);
    totalAwayScore += homeSubPenalty + (Number(away_penalty_goals) || 0);

    console.log(`Total scores including all penalties - Home: ${totalHomeScore} (goals + ${awaySubPenalty} sub penalties + ${home_penalty_goals} fine penalties), Away: ${totalAwayScore} (goals + ${homeSubPenalty} sub penalties + ${away_penalty_goals} fine penalties)`);

    // Determine match result
    let matchResult: 'home_win' | 'away_win' | 'draw';
    if (totalHomeScore > totalAwayScore) {
      matchResult = 'home_win';
    } else if (totalAwayScore > totalHomeScore) {
      matchResult = 'away_win';
    } else {
      matchResult = 'draw';
    }

    // Update fixture with scores, result, and status
    await sql`
      UPDATE fixtures
      SET 
        home_score = ${totalHomeScore},
        away_score = ${totalAwayScore},
        result = ${matchResult},
        status = 'completed', 
        updated_at = NOW()
      WHERE id = ${fixtureId}
    `;

    // Distribute match rewards based on tournament configuration
    try {
      await distributeMatchRewards({
        fixtureId,
        matchResult,
        seasonId: season_id,
        roundNumber: round_number,
        leg
      });
    } catch (rewardError) {
      console.error('Failed to distribute match rewards:', rewardError);
      // Don't fail the entire request if rewards fail
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Results saved successfully',
      fixture_status: 'completed'
    });
  } catch (error) {
    console.error('Error saving results:', error);
    return NextResponse.json(
      { error: 'Failed to save results' },
      { status: 500 }
    );
  }
}
