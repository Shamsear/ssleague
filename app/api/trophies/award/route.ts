import { NextRequest, NextResponse } from 'next/server';
import { awardSeasonTrophies } from '@/lib/award-season-trophies';
import { sendNotificationToSeason } from '@/lib/notifications/send-notification';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { season_id } = body;

    if (!season_id) {
      return NextResponse.json(
        { success: false, error: 'season_id is required' },
        { status: 400 }
      );
    }

    const result = await awardSeasonTrophies(season_id, 2);

    // Send FCM notification to all teams in the season
    if (result.success && result.trophiesAwarded > 0) {
      try {
        await sendNotificationToSeason(
          {
            title: '🏆 Season Trophies Awarded!',
            body: `Season trophies have been awarded! Check the trophy cabinet to see who won.`,
            url: `/trophies`,
            icon: '/logo.png',
            data: {
              type: 'season_trophies',
              season_id,
              trophies_count: result.trophiesAwarded.toString(),
            }
          },
          season_id
        );
      } catch (notifError) {
        console.error('Failed to send trophies notification:', notifError);
        // Don't fail the request
      }
    }

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Error awarding trophies:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
