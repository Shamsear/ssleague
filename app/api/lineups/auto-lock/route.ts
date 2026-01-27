import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import { adminDb } from '@/lib/firebase/admin';

/**
 * Auto-lock lineups for a specific fixture if deadline has passed
 * Called automatically when pages load - no cron needed
 * 
 * NOTE: Lineups are stored in Neon database (lineups table)
 * 
 * LOCKING RULES:
 * - Away team lineup: Locks at round start time (round_start_time or home_fixture_deadline_time)
 * - Home team lineup: Locks when matchups are created (no time deadline)
 * 
 * WARNING SYSTEM:
 * - If away team doesn't submit by deadline: Gets 1 warning, can still submit with penalty
 * - After 1 warning in any fixture: Home team can submit lineup for away team
 * - Teams with exactly 5 players (min squad): Auto-submit all players, no warning
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fixture_id } = body;

    if (!fixture_id) {
      return NextResponse.json(
        { success: false, error: 'fixture_id is required' },
        { status: 400 }
      );
    }

    const now = new Date();
    const sql = getTournamentDb();

    // Get fixture from Neon
    const fixtures = await sql`
      SELECT * FROM fixtures WHERE id = ${fixture_id} LIMIT 1
    `;
    
    if (fixtures.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Fixture not found' },
        { status: 404 }
      );
    }

    const fixture = fixtures[0];
    
    // Get round deadlines to calculate the actual deadline
    const roundDeadlines = await sql`
      SELECT * FROM round_deadlines 
      WHERE season_id = ${fixture.season_id}
        AND tournament_id = ${fixture.tournament_id}
        AND round_number = ${fixture.round_number}
        AND leg = ${fixture.leg || 'first'}
      LIMIT 1
    `;

    if (roundDeadlines.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Round configuration not found' },
        { status: 404 }
      );
    }

    const roundData = roundDeadlines[0];
    const scheduledDate = roundData.scheduled_date;
    
    if (!scheduledDate) {
      return NextResponse.json({
        success: true,
        message: 'Round not scheduled yet',
        locked: false
      });
    }

    // Calculate round start time (away team deadline)
    const roundStartTimeStr = roundData.round_start_time || roundData.home_fixture_deadline_time;
    const baseDateStr = new Date(scheduledDate).toISOString().split('T')[0];
    const [startHour, startMin] = roundStartTimeStr.split(':').map(Number);
    const roundStartDeadline = new Date(baseDateStr);
    roundStartDeadline.setUTCHours(startHour - 5, startMin - 30, 0, 0); // Convert IST to UTC

    // Check if round has started
    if (now <= roundStartDeadline) {
      return NextResponse.json({
        success: true,
        message: 'Round not started yet',
        locked: false,
        round_start: roundStartDeadline.toISOString(),
        now: now.toISOString()
      });
    }

    console.log('🔒 Processing lineup auto-lock for fixture:', fixture_id, {
      now: now.toISOString(),
      roundStartDeadline: roundStartDeadline.toISOString(),
      deadlinePassed: true
    });

    // Check if matchups exist (home team lineup locks when matchups are created)
    const matchups = await sql`
      SELECT COUNT(*) as count FROM matchups WHERE fixture_id = ${fixture_id}
    `;
    const matchupsExist = matchups[0].count > 0;

    const homeTeamId = fixture.home_team_id;
    const awayTeamId = fixture.away_team_id;
    const seasonId = fixture.season_id;

    // Process home team lineup
    let homeLocked = false;
    let homeAutoSubmitted = false;
    
    const homeLineups = await sql`
      SELECT * FROM lineups 
      WHERE fixture_id = ${fixture_id} 
        AND team_id = ${homeTeamId}
      LIMIT 1
    `;
    
    const homeLineup = homeLineups.length > 0 ? homeLineups[0] : null;
    const homeSubmitted = homeLineup && homeLineup.starting_xi && homeLineup.starting_xi.length > 0;
    
    if (!homeSubmitted && !matchupsExist) {
      // Home team hasn't submitted and no matchups yet
      // Check if they have exactly 5 players
      const homePlayers = await sql`
        SELECT player_id, player_name 
        FROM player_seasons 
        WHERE team_id = ${homeTeamId} 
          AND season_id = ${seasonId}
          AND status = 'active'
      `;
      
      if (homePlayers.length === 5) {
        // Auto-submit all 5 players (no substitute, no warning)
        const playerIds = homePlayers.map((p: any) => p.player_id);
        
        await sql`
          INSERT INTO lineups (
            fixture_id,
            team_id,
            starting_xi,
            substitutes,
            is_locked,
            is_valid,
            submitted_at,
            submitted_by
          ) VALUES (
            ${fixture_id},
            ${homeTeamId},
            ${playerIds},
            ARRAY[]::text[],
            false,
            true,
            NOW(),
            'system'
          )
          ON CONFLICT (fixture_id, team_id) 
          DO UPDATE SET
            starting_xi = ${playerIds},
            substitutes = ARRAY[]::text[],
            submitted_at = NOW(),
            submitted_by = 'system',
            updated_at = NOW()
        `;
        
        homeAutoSubmitted = true;
        console.log('✅ Auto-submitted home lineup (5 players, no warning):', fixture_id);
      }
    } else if (matchupsExist && homeLineup && !homeLineup.is_locked) {
      // Matchups exist, lock the home lineup
      await sql`
        UPDATE lineups
        SET 
          is_locked = true,
          locked_at = NOW(),
          locked_by = 'system',
          locked_reason = 'Matchups created',
          updated_at = NOW()
        WHERE fixture_id = ${fixture_id}
          AND team_id = ${homeTeamId}
      `;
      homeLocked = true;
      console.log('✅ Locked home lineup (matchups exist):', fixture_id);
    }

    // Process away team lineup with warning system
    let awayLocked = false;
    let awayWarningIssued = false;
    let awayAutoSubmitted = false;
    
    const awayLineups = await sql`
      SELECT * FROM lineups 
      WHERE fixture_id = ${fixture_id} 
        AND team_id = ${awayTeamId}
      LIMIT 1
    `;
    
    const awayLineup = awayLineups.length > 0 ? awayLineups[0] : null;
    const awaySubmitted = awayLineup && awayLineup.starting_xi && awayLineup.starting_xi.length > 0;
    
    if (!awaySubmitted) {
      console.log('⚠️ Away team has not submitted lineup:', awayTeamId);
      
      // Get away team's player count
      const awayPlayers = await sql`
        SELECT player_id, player_name 
        FROM player_seasons 
        WHERE team_id = ${awayTeamId} 
          AND season_id = ${seasonId}
          AND status = 'active'
      `;
      
      const playerCount = awayPlayers.length;
      console.log(`📊 Away team has ${playerCount} active players`);
      
      if (playerCount === 5) {
        // Auto-submit all 5 players (no substitute, no warning)
        const playerIds = awayPlayers.map((p: any) => p.player_id);
        
        await sql`
          INSERT INTO lineups (
            fixture_id,
            team_id,
            starting_xi,
            substitutes,
            is_locked,
            is_valid,
            submitted_at,
            submitted_by
          ) VALUES (
            ${fixture_id},
            ${awayTeamId},
            ${playerIds},
            ARRAY[]::text[],
            true,
            true,
            NOW(),
            'system'
          )
          ON CONFLICT (fixture_id, team_id) 
          DO UPDATE SET
            starting_xi = ${playerIds},
            substitutes = ARRAY[]::text[],
            is_locked = true,
            locked_at = NOW(),
            locked_by = 'system',
            locked_reason = 'Auto-submitted (5 players)',
            submitted_at = NOW(),
            submitted_by = 'system',
            updated_at = NOW()
        `;
        
        awayAutoSubmitted = true;
        awayLocked = true;
        console.log('✅ Auto-submitted away lineup (5 players, no warning):', fixture_id);
        
      } else {
        // Check if team already has a warning in this season
        const teamSeasonDocId = `${awayTeamId}_${seasonId}`;
        const teamSeasonDoc = await adminDb.collection('team_seasons').doc(teamSeasonDocId).get();
        const teamSeasonData = teamSeasonDoc.data();
        const existingWarnings = teamSeasonData?.lineup_warnings || 0;
        
        if (existingWarnings === 0) {
          // First offense: Issue warning, allow late submission
          await adminDb.collection('team_seasons').doc(teamSeasonDocId).update({
            lineup_warnings: 1,
            last_lineup_warning_fixture: fixture_id,
            last_lineup_warning_date: now,
            updated_at: now
          });
          
          // Record violation in Neon
          await sql`
            INSERT INTO team_violations (
              team_id,
              season_id,
              violation_type,
              fixture_id,
              round_number,
              violation_date,
              deadline,
              penalty_applied,
              notes
            ) VALUES (
              ${awayTeamId},
              ${seasonId},
              'late_lineup_warning',
              ${fixture_id},
              ${fixture.round_number},
              NOW(),
              ${roundStartDeadline.toISOString()},
              'warning_issued',
              'First lineup warning - team can still submit with penalty'
            )
          `;
          
          awayWarningIssued = true;
          console.log('⚠️ Issued first lineup warning to away team:', awayTeamId);
          
        } else {
          // Second+ offense: Lock lineup, home team can submit for them
          // Create empty locked lineup
          await sql`
            INSERT INTO lineups (
              fixture_id,
              team_id,
              starting_xi,
              substitutes,
              is_locked,
              is_valid,
              locked_at,
              locked_by,
              locked_reason,
              selected_by_opponent
            ) VALUES (
              ${fixture_id},
              ${awayTeamId},
              ARRAY[]::text[],
              ARRAY[]::text[],
              true,
              false,
              NOW(),
              'system',
              'Missed deadline after warning',
              false
            )
            ON CONFLICT (fixture_id, team_id) 
            DO UPDATE SET
              is_locked = true,
              locked_at = NOW(),
              locked_by = 'system',
              locked_reason = 'Missed deadline after warning',
              updated_at = NOW()
          `;
          
          // Record violation
          await sql`
            INSERT INTO team_violations (
              team_id,
              season_id,
              violation_type,
              fixture_id,
              round_number,
              violation_date,
              deadline,
              penalty_applied,
              notes
            ) VALUES (
              ${awayTeamId},
              ${seasonId},
              'late_lineup_locked',
              ${fixture_id},
              ${fixture.round_number},
              NOW(),
              ${roundStartDeadline.toISOString()},
              'lineup_locked',
              'Missed deadline after previous warning - home team can submit lineup'
            )
          `;
          
          awayLocked = true;
          console.log('🔒 Locked away lineup (after warning), home can submit:', fixture_id);
        }
      }
    } else if (awayLineup && !awayLineup.is_locked) {
      // Away team submitted on time, just lock it
      await sql`
        UPDATE lineups
        SET 
          is_locked = true,
          locked_at = NOW(),
          locked_by = 'system',
          locked_reason = 'Round started',
          updated_at = NOW()
        WHERE fixture_id = ${fixture_id}
          AND team_id = ${awayTeamId}
      `;
      awayLocked = true;
      console.log('✅ Locked away lineup (round started):', fixture_id);
    }

    return NextResponse.json({
      success: true,
      message: 'Auto-lock completed',
      locked: true,
      home_locked: homeLocked,
      home_auto_submitted: homeAutoSubmitted,
      away_locked: awayLocked,
      away_warning_issued: awayWarningIssued,
      away_auto_submitted: awayAutoSubmitted,
      matchups_exist: matchupsExist,
      round_start: roundStartDeadline.toISOString()
    });
  } catch (error: any) {
    console.error('Error auto-locking lineups:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to auto-lock' },
      { status: 500 }
    );
  }
}
