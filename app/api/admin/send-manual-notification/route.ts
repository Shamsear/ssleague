import { NextRequest, NextResponse } from 'next/server';
import { getAuthToken } from '@/lib/auth/token-helper';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { sendNotification, sendNotificationToSeason } from '@/lib/notifications/send-notification';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.NEON_TOURNAMENT_DB_URL!);

/**
 * POST /api/admin/send-manual-notification
 * 
 * Admin endpoint to manually send notifications (replaces cron jobs)
 * 
 * Request body:
 * {
 *   type: 'round_deadline' | 'lineup_deadline' | 'custom',
 *   seasonId?: string,
 *   roundId?: string,
 *   fixtureId?: string,
 *   title?: string,      // For custom notifications
 *   body?: string,       // For custom notifications
 *   url?: string,        // For custom notifications
 *   targetType?: 'all' | 'season' | 'specific',
 *   userIds?: string[]   // For specific users
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const token = await getAuthToken(request);
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    // Check if user is admin/committee
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    const userRole = userData?.role;

    if (userRole !== 'committee' && userRole !== 'admin' && userRole !== 'committee_admin') {
      return NextResponse.json(
        { success: false, error: 'Only admin/committee can send notifications' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { type, seasonId, roundId, fixtureId, title, bodyText, url, targetType, userIds } = body;

    let notificationPayload: any = {};
    let notificationOptions: any = {};

    // Handle different notification types
    switch (type) {
      case 'round_deadline': {
        if (!roundId) {
          return NextResponse.json(
            { success: false, error: 'roundId is required for round_deadline type' },
            { status: 400 }
          );
        }

        // Get round details
        const roundResult = await sql`
          SELECT r.*, s.name as season_name
          FROM rounds r
          JOIN seasons s ON r.season_id = s.id
          WHERE r.id = ${roundId}
          LIMIT 1
        `;

        if (roundResult.length === 0) {
          return NextResponse.json(
            { success: false, error: 'Round not found' },
            { status: 404 }
          );
        }

        const round = roundResult[0];
        const endTime = new Date(round.end_time);
        const now = new Date();
        const hoursLeft = Math.floor((endTime.getTime() - now.getTime()) / (1000 * 60 * 60));
        const minutesLeft = Math.floor((endTime.getTime() - now.getTime()) / (1000 * 60)) % 60;

        notificationPayload = {
          title: '⏰ Auction Deadline Reminder',
          body: `Round #${round.round_number}${round.position ? ` (${round.position})` : ''} ends in ${hoursLeft}h ${minutesLeft}m!`,
          url: `/dashboard/team/round/${round.id}`,
          icon: '/logo.png'
        };

        // Send to all teams in the season
        if (round.season_id) {
          return NextResponse.json(
            await sendNotificationToSeason(round.season_id, notificationPayload)
          );
        }
        break;
      }

      case 'lineup_deadline': {
        if (!fixtureId) {
          return NextResponse.json(
            { success: false, error: 'fixtureId is required for lineup_deadline type' },
            { status: 400 }
          );
        }

        // Get fixture details and teams
        const fixtureResult = await sql`
          SELECT f.*, 
                 t1.name as team1_name, 
                 t2.name as team2_name
          FROM fixtures f
          JOIN teams t1 ON f.team1_id = t1.id
          JOIN teams t2 ON f.team2_id = t2.id
          WHERE f.id = ${fixtureId}
          LIMIT 1
        `;

        if (fixtureResult.length === 0) {
          return NextResponse.json(
            { success: false, error: 'Fixture not found' },
            { status: 404 }
          );
        }

        const fixture = fixtureResult[0];
        const matchTime = new Date(fixture.match_date);
        const now = new Date();
        const hoursLeft = Math.floor((matchTime.getTime() - now.getTime()) / (1000 * 60 * 60));

        notificationPayload = {
          title: '⚠️ Lineup Deadline Approaching',
          body: `${fixture.team1_name} vs ${fixture.team2_name} - ${hoursLeft}h left to submit lineup!`,
          url: `/dashboard/team/fixtures`,
          icon: '/logo.png'
        };

        // Send to both teams
        const result = await sendNotification(notificationPayload, {
          teamIds: [fixture.team1_id, fixture.team2_id]
        });

        return NextResponse.json(result);
      }

      case 'custom': {
        if (!title || !bodyText) {
          return NextResponse.json(
            { success: false, error: 'title and body are required for custom type' },
            { status: 400 }
          );
        }

        notificationPayload = {
          title: title,
          body: bodyText,
          url: url || '/',
          icon: '/logo.png'
        };

        // Determine target
        if (targetType === 'all') {
          notificationOptions = { allUsers: true };
        } else if (targetType === 'season' && seasonId) {
          return NextResponse.json(
            await sendNotificationToSeason(seasonId, notificationPayload)
          );
        } else if (targetType === 'specific' && userIds && userIds.length > 0) {
          notificationOptions = { userIds };
        } else {
          return NextResponse.json(
            { success: false, error: 'Invalid target configuration' },
            { status: 400 }
          );
        }

        const result = await sendNotification(notificationPayload, notificationOptions);
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid notification type' },
          { status: 400 }
        );
    }

    // Send notification
    const result = await sendNotification(notificationPayload, notificationOptions);
    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Error sending manual notification:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to send notification' },
      { status: 500 }
    );
  }
}
