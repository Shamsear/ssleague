import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import { sendNotificationToSeason } from '@/lib/notifications/send-notification';

/**
 * PATCH - Declare match NULL when both teams are absent
 * Match is cancelled and doesn't count in standings
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ fixtureId: string }> }
) {
  try {
    const sql = getTournamentDb();
    const { fixtureId } = await params;
    const body = await request.json();
    const { declared_by, declared_by_name, notes } = body;

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

    // Mark as cancelled/null
    await sql`
      UPDATE fixtures
      SET 
        status = 'cancelled',
        match_status_reason = 'null_both_absent',
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
        'null_declared',
        ${declared_by || 'system'},
        ${declared_by_name || 'Committee Admin'},
        ${notes || 'Match declared NULL - both teams absent'},
        ${fixture.season_id},
        ${fixture.round_number},
        ${fixture.match_number},
        ${JSON.stringify({
      reason: 'both_teams_absent',
      home_team: fixture.home_team_name,
      away_team: fixture.away_team_name
    })}
      )
    `;

    // Send FCM notification
    try {
      await sendNotificationToSeason(
        {
          title: '❌ Match Cancelled',
          body: `${fixture.home_team_name} vs ${fixture.away_team_name} declared NULL - both teams absent`,
          url: `/fixtures/${fixtureId}`,
          icon: '/logo.png',
          data: {
            type: 'match_cancelled',
            fixture_id: fixtureId,
            home_team: fixture.home_team_name,
            away_team: fixture.away_team_name,
            reason: 'both_absent',
          }
        },
        fixture.season_id
      );
    } catch (notifError) {
      console.error('Failed to send match cancellation notification:', notifError);
      // Don't fail the request
    }

    return NextResponse.json({
      success: true,
      message: 'Match declared NULL - both teams absent',
      fixture: {
        id: fixtureId,
        status: 'cancelled',
        match_status_reason: 'null_both_absent'
      }
    });
  } catch (error) {
    console.error('Error declaring NULL:', error);
    return NextResponse.json(
      { error: 'Failed to declare NULL' },
      { status: 500 }
    );
  }
}
