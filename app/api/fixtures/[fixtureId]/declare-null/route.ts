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

    await sql`
      UPDATE fixtures
      SET 
        status = 'cancelled',
        match_status_reason = 'null_both_absent',
        played_date = NOW(),
        updated_at = NOW()
      WHERE id = ${fixtureId}
    `;

    // Log in audit trail
    await sql`
      INSERT INTO fixture_audit_log (
        fixture_id,
        change_type,
        changed_by,
        changes,
        tournament_id
      ) VALUES (
        ${fixtureId},
        'null_declared',
        ${declared_by_name || 'Committee Admin'},
        ${JSON.stringify({
          declared_by: declared_by || 'system',
          notes: notes || 'Match declared NULL - both teams absent',
          season_id: fixture.season_id,
          round_number: fixture.round_number,
          match_number: fixture.match_number,
          reason: 'both_teams_absent',
          home_team: fixture.home_team_name,
          away_team: fixture.away_team_name
        })},
        ${fixture.season_id}
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
