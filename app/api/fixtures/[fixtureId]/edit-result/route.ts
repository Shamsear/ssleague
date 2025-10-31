import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import { triggerNews } from '@/lib/news/trigger';
import { triggerPlayerOfMatchPoll } from '@/lib/polls/auto-trigger';

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

    // Step 7: Apply new points
    console.log('Applying new points...');
    const applyPointsRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/realplayers/update-points`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fixture_id: fixtureId,
        season_id: seasonId,
        matchups: matchups,
      })
    });

    if (!applyPointsRes.ok) {
      throw new Error('Failed to apply new points');
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
          }
        })}
      )
    `;

    // Trigger news for match result
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
    } catch (newsError) {
      console.error('Failed to generate match result news:', newsError);
    }

    // Trigger player of the match poll (async, non-blocking)
    triggerPlayerOfMatchPoll(fixtureId).catch(pollError => {
      console.error('Failed to create player of match poll:', pollError);
    });

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
