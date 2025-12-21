import { NextRequest, NextResponse } from 'next/server';
import { fantasySql } from '@/lib/neon/fantasy-config';
import { sendNotificationToSeason } from '@/lib/notifications/send-notification';

/**
 * POST /api/fantasy/transfer-windows/[windowId]/toggle
 * Toggle transfer window active status
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ windowId: string }> }
) {
  try {
    const { windowId } = await params;

    // Get current window
    const windows = await fantasySql`
      SELECT * FROM transfer_windows
      WHERE window_id = ${windowId}
      LIMIT 1
    `;

    if (windows.length === 0) {
      return NextResponse.json(
        { error: 'Transfer window not found' },
        { status: 404 }
      );
    }

    const window = windows[0];
    const newStatus = !window.is_active;

    // If activating, deactivate all other windows for this league
    if (newStatus) {
      await fantasySql`
        UPDATE transfer_windows
        SET is_active = false
        WHERE league_id = ${window.league_id} AND window_id != ${windowId}
      `;
    }

    // Toggle the window
    await fantasySql`
      UPDATE transfer_windows
      SET is_active = ${newStatus}
      WHERE window_id = ${windowId}
    `;

    console.log(`✅ Transfer window ${windowId} ${newStatus ? 'opened' : 'closed'}`);

    // Send FCM notification if opening the window
    if (newStatus) {
      try {
        // Get season_id from league
        const leagues = await fantasySql`
          SELECT fl.season_id, fl.league_name
          FROM fantasy_leagues fl
          WHERE fl.league_id = ${window.league_id}
          LIMIT 1
        `;
        
        if (leagues.length > 0) {
          const league = leagues[0];
          await sendNotificationToSeason(
            {
              title: '🔄 Fantasy Transfer Window Open!',
              body: `Transfer window is now open for ${league.league_name}. Make your transfers now!`,
              url: `/fantasy/transfers`,
              icon: '/logo.png',
              data: {
                type: 'transfer_window_open',
                window_id: windowId,
                league_id: window.league_id,
              }
            },
            league.season_id
          );
        }
      } catch (notifError) {
        console.error('Failed to send transfer window notification:', notifError);
        // Don't fail the request
      }
    }

    return NextResponse.json({
      success: true,
      is_active: newStatus,
      message: `Transfer window ${newStatus ? 'opened' : 'closed'}`,
    });
  } catch (error) {
    console.error('Error toggling transfer window:', error);
    return NextResponse.json(
      { error: 'Failed to toggle transfer window' },
      { status: 500 }
    );
  }
}
