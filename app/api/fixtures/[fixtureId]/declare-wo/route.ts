import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

/**
 * PATCH - Declare Walkover (WO) when one team is absent
 * Awards automatic win to the present team
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ fixtureId: string }> }
) {
  try {
    const sql = getTournamentDb();
    const { fixtureId } = await params;
    const body = await request.json();
    const { absent_team, declared_by, declared_by_name, notes } = body;

    if (!absent_team || (absent_team !== 'home' && absent_team !== 'away')) {
      return NextResponse.json(
        { error: 'Invalid absent_team. Must be "home" or "away"' },
        { status: 400 }
      );
    }

    // Fetch fixture
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

    // Award WO (typically 3-0 or similar score)
    const woScore = 3; // Can be configurable
    const matchStatusReason = absent_team === 'home' ? 'wo_home_absent' : 'wo_away_absent';
    const homeScore = absent_team === 'home' ? 0 : woScore;
    const awayScore = absent_team === 'away' ? 0 : woScore;
    const result = absent_team === 'home' ? 'away_win' : 'home_win';

    // Update fixture
    await sql`
      UPDATE fixtures
      SET 
        status = 'completed',
        home_score = ${homeScore},
        away_score = ${awayScore},
        result = ${result},
        match_status_reason = ${matchStatusReason},
        declared_by = ${declared_by || null},
        declared_by_name = ${declared_by_name || null},
        declared_at = NOW(),
        updated_by = ${declared_by || null},
        updated_by_name = ${declared_by_name || null},
        updated_at = NOW()
      WHERE id = ${fixtureId}
    `;

    // Log in audit trail
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
        'wo_declared',
        ${declared_by || 'system'},
        ${declared_by_name || 'Committee Admin'},
        ${notes || `Walkover - ${absent_team} team absent`},
        ${fixture.season_id},
        ${fixture.round_number},
        ${fixture.match_number},
        ${JSON.stringify({
          absent_team,
          awarded_to: absent_team === 'home' ? fixture.away_team_name : fixture.home_team_name,
          score: `${homeScore}-${awayScore}`
        })}
      )
    `;

    return NextResponse.json({
      success: true,
      message: `Walkover declared - ${absent_team} team absent`,
      fixture: {
        id: fixtureId,
        home_score: homeScore,
        away_score: awayScore,
        result,
        match_status_reason: matchStatusReason
      }
    });
  } catch (error) {
    console.error('Error declaring walkover:', error);
    return NextResponse.json(
      { error: 'Failed to declare walkover' },
      { status: 500 }
    );
  }
}
