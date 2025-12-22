import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import { adminDb } from '@/lib/firebase/admin';

/**
 * Auto-lock lineups for a specific fixture if deadline has passed
 * Called automatically when pages load - no cron needed
 * 
 * NOTE: Lineups are stored in Neon database (fixtures.home_lineup, fixtures.away_lineup)
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
    // Away team lineup locks at round start
    // Home team lineup locks when matchups are created (handled separately)
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

    // Process home team lineup - auto-submit if 5 players
    let homeLocked = false;
    let homeAutoSubmitted = false;
    const homeLineup = fixture.home_lineup;
    const homeTeamId = fixture.home_team_id;
    const seasonId = fixture.season_id;
    
    // Check if home team has submitted lineup
    const homeSubmitted = homeLineup && homeLineup.players && homeLineup.players.length > 0;
    
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
      
      const playerCount = homePlayers.length;
      
      if (playerCount === 5) {
        // Auto-submit all 5 players (no substitute, no warning)
        const lineupPlayers = homePlayers.map((p: any, idx: number) => ({
          player_id: p.player_id,
          player_name: p.player_name,
          position: idx + 1,
          is_substitute: false
        }));
        
        const autoLineup = {
          players: lineupPlayers,
          locked: false, // Not locked yet, will lock when matchups created
          submitted_by: 'system',
          submitted_at: now.toISOString(),
          auto_submitted: true
        };
        
        await sql`
          UPDATE fixtures
          SET 
            home_lineup = ${JSON.stringify(autoLineup)}::jsonb,
            home_lineup_submitted_at = NOW(),
            home_lineup_submitted_by = 'system',
            updated_at = NOW()
          WHERE id = ${fixture_id}
        `;
        
        homeAutoSubmitted = true;
        console.log('✅ Auto-submitted home lineup (5 players, no warning):', fixture_id);
      }
    } else if (matchupsExist && homeLineup && !homeLineup.locked) {
      // Matchups exist, lock the home lineup
      await sql`
        UPDATE fixtures
        SET 
          home_lineup = jsonb_set(
            home_lineup,
            '{locked}',
            'true'::jsonb
          ),
          home_lineup = jsonb_set(
            home_lineup,
            '{locked_at}',
            to_jsonb(${now.toISOString()}::text)
          ),
          home_lineup = jsonb_set(
            home_lineup,
            '{locked_by}',
            to_jsonb('system'::text)
          ),
          home_lineup = jsonb_set(
            home_lineup,
            '{locked_reason}',
            to_jsonb('Matchups created'::text)
          ),
          updated_at = NOW()
        WHERE id = ${fixture_id}
      `;
      homeLocked = true;
      console.log('✅ Locked home lineup for fixture (matchups exist):', fixture_id);
    }

    // Process away team lineup with warning system
    let awayLocked = false;
    let awayWarningIssued = false;
    let awayAutoSubmitted = false;
    const awayLineup = fixture.away_lineup;
    const awayTeamId = fixture.away_team_id;
    // seasonId already declared above for home team
    
    // Check if away team has submitted lineup
    const awaySubmitted = awayLineup && awayLineup.players && awayLineup.players.length > 0;
    
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
        const lineupPlayers = awayPlayers.map((p: any, idx: number) => ({
          player_id: p.player_id,
          player_name: p.player_name,
          position: idx + 1,
          is_substitute: false
        }));
        
        const autoLineup = {
          players: lineupPlayers,
          locked: true,
          locked_at: now.toISOString(),
          locked_by: 'system',
          locked_reason: 'Auto-submitted (5 players)',
          submitted_by: 'system',
          submitted_at: now.toISOString(),
          auto_submitted: true
        };
        
        await sql`
          UPDATE fixtures
          SET 
            away_lineup = ${JSON.stringify(autoLineup)}::jsonb,
            updated_at = NOW()
          WHERE id = ${fixture_id}
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
          await sql`
            UPDATE fixtures
            SET 
              away_lineup = jsonb_build_object(
                'players', '[]'::jsonb,
                'locked', true,
                'locked_at', ${now.toISOString()},
                'locked_by', 'system',
                'locked_reason', 'Missed deadline after warning',
                'home_can_submit', true
              ),
              updated_at = NOW()
            WHERE id = ${fixture_id}
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
    } else if (awayLineup && !awayLineup.locked) {
      // Away team submitted on time, just lock it
      await sql`
        UPDATE fixtures
        SET 
          away_lineup = jsonb_set(
            away_lineup,
            '{locked}',
            'true'::jsonb
          ),
          away_lineup = jsonb_set(
            away_lineup,
            '{locked_at}',
            to_jsonb(${now.toISOString()}::text)
          ),
          away_lineup = jsonb_set(
            away_lineup,
            '{locked_by}',
            to_jsonb('system'::text)
          ),
          away_lineup = jsonb_set(
            away_lineup,
            '{locked_reason}',
            to_jsonb('Round started'::text)
          ),
          updated_at = NOW()
        WHERE id = ${fixture_id}
      `;
      awayLocked = true;
      console.log('✅ Locked away lineup for fixture (round started):', fixture_id);
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
