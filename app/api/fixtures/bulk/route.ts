import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import { triggerMatchPredictionPoll } from '@/lib/polls/auto-trigger';
import { sendNotificationToSeason } from '@/lib/notifications/send-notification';

export async function POST(request: NextRequest) {
  try {
    const sql = getTournamentDb();
    const { fixtures } = await request.json();

    if (!fixtures || !Array.isArray(fixtures) || fixtures.length === 0) {
      return NextResponse.json(
        { error: 'fixtures array is required' },
        { status: 400 }
      );
    }

    console.log(`📥 Inserting ${fixtures.length} fixtures into Neon...`);

    // Insert fixtures one by one (could be optimized with bulk insert)
    for (const fixture of fixtures) {
      await sql`
        INSERT INTO fixtures (
          id,
          season_id,
          round_number,
          match_number,
          home_team_id,
          away_team_id,
          home_team_name,
          away_team_name,
          status,
          leg,
          scheduled_date,
          created_at,
          updated_at
        ) VALUES (
          ${fixture.id},
          ${fixture.season_id},
          ${fixture.round_number},
          ${fixture.match_number},
          ${fixture.home_team_id},
          ${fixture.away_team_id},
          ${fixture.home_team_name},
          ${fixture.away_team_name},
          ${fixture.status || 'scheduled'},
          ${fixture.leg || 'first'},
          ${fixture.scheduled_date || null},
          NOW(),
          NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          season_id = EXCLUDED.season_id,
          round_number = EXCLUDED.round_number,
          match_number = EXCLUDED.match_number,
          home_team_id = EXCLUDED.home_team_id,
          away_team_id = EXCLUDED.away_team_id,
          home_team_name = EXCLUDED.home_team_name,
          away_team_name = EXCLUDED.away_team_name,
          status = EXCLUDED.status,
          leg = EXCLUDED.leg,
          scheduled_date = EXCLUDED.scheduled_date,
          updated_at = NOW()
      `;
    }

    console.log(`✅ Successfully inserted ${fixtures.length} fixtures`);

    // Auto-create match prediction polls for scheduled fixtures (async, non-blocking)
    Promise.all(
      fixtures
        .filter((f: any) => f.status === 'scheduled' && f.scheduled_date)
        .map((f: any) => triggerMatchPredictionPoll(f.id))
    ).catch(error => {
      console.error('Error creating match prediction polls:', error);
    });

    // Send FCM notification (use first fixture's season_id)
    if (fixtures.length > 0 && fixtures[0].season_id) {
      try {
        await sendNotificationToSeason(
          {
            title: '📅 New Fixtures Created',
            body: `${fixtures.length} new fixtures have been scheduled for the tournament!`,
            url: `/fixtures`,
            icon: '/logo.png',
            data: {
              type: 'fixtures_created',
              count: fixtures.length.toString(),
              round_number: fixtures[0].round_number?.toString() || '0',
            }
          },
          fixtures[0].season_id
        );
      } catch (notifError) {
        console.error('Failed to send fixtures creation notification:', notifError);
        // Don't fail the request
      }
    }

    return NextResponse.json({
      success: true, 
      message: `${fixtures.length} fixtures saved successfully` 
    });
  } catch (error) {
    console.error('Error saving fixtures to Neon:', error);
    return NextResponse.json(
      { error: 'Failed to save fixtures', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
