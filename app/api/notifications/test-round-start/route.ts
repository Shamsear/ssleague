import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-helper';
import { sendNotificationToSeason } from '@/lib/notifications/send-notification';

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const auth = await verifyAuth(['admin', 'committee_admin'], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { seasonId } = await request.json();

    if (!seasonId) {
      return NextResponse.json(
        { success: false, error: 'Season ID is required' },
        { status: 400 }
      );
    }

    // Send test round start notification
    const result = await sendNotificationToSeason(
      {
        title: '🎯 Test: New Auction Round Available!',
        body: 'GK bidding is now open. Duration: 2 hour(s). Place your bids now! (This is a test notification)',
        url: `/dashboard/team`,
        icon: '/logo.png',
        data: {
          type: 'test_round_started',
          roundId: 'TEST_ROUND',
          position: 'GK',
          endTime: new Date(Date.now() + 2 * 3600 * 1000).toISOString()
        }
      },
      seasonId
    );

    return NextResponse.json({
      success: result.success,
      sentCount: result.sentCount,
      failedCount: result.failedCount,
      message: `Sent to ${result.sentCount} devices, failed: ${result.failedCount}`
    });
  } catch (error: any) {
    console.error('Error sending test round start notification:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
