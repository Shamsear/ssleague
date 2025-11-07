import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import { sendNotificationToSeason } from '@/lib/notifications/send-notification';

/**
 * POST - Lock a lineup (committee admin only)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sql = getTournamentDb();
    const { id: lineupId } = await params;
    const body = await request.json();
    const { locked_by, locked_by_name } = body;

    if (!locked_by) {
      return NextResponse.json(
        { error: 'locked_by is required' },
        { status: 400 }
      );
    }

    // Check if lineup exists
    const lineups = await sql`
      SELECT id, is_locked
      FROM lineups
      WHERE id = ${lineupId}
      LIMIT 1
    `;

    if (lineups.length === 0) {
      return NextResponse.json(
        { error: 'Lineup not found' },
        { status: 404 }
      );
    }

    const lineup = lineups[0];

    if (lineup.is_locked) {
      return NextResponse.json(
        { error: 'Lineup is already locked' },
        { status: 400 }
      );
    }

    // Lock the lineup
    await sql`
      UPDATE lineups SET
        is_locked = true,
        locked_at = NOW(),
        locked_by = ${locked_by},
        updated_at = NOW()
      WHERE id = ${lineupId}
    `;

    // Get season_id and team info for notification
    const lineupDetails = await sql`
      SELECT l.season_id, l.team_id, l.team_name, l.round_number
      FROM lineups l
      WHERE l.id = ${lineupId}
    `;

    if (lineupDetails.length > 0) {
      const { season_id, team_name, round_number } = lineupDetails[0];
      
      // Send FCM notification
      try {
        await sendNotificationToSeason(
          {
            title: '🔒 Lineup Locked',
            body: `${team_name}'s lineup for Round ${round_number} has been locked by committee.`,
            url: `/lineups/${lineupId}`,
            icon: '/logo.png',
            data: {
              type: 'lineup_locked',
              lineup_id: lineupId,
              team_name,
              round_number: round_number.toString(),
            }
          },
          season_id
        );
      } catch (notifError) {
        console.error('Failed to send lineup lock notification:', notifError);
        // Don't fail the request
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Lineup locked successfully',
    });
  } catch (error: any) {
    console.error('Error locking lineup:', error);
    return NextResponse.json(
      { error: 'Failed to lock lineup', details: error.message },
      { status: 500 }
    );
  }
}
