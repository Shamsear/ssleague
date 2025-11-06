import admin from 'firebase-admin';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.NEON_TOURNAMENT_DB_URL!);

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  url?: string;
  data?: Record<string, string>;
}

export interface NotificationOptions {
  userId?: string;          // Send to specific user
  userIds?: string[];       // Send to multiple users
  teamId?: string;          // Send to team owner
  teamIds?: string[];       // Send to multiple team owners
  allUsers?: boolean;       // Send to all users with notifications enabled
  excludeUserIds?: string[]; // Exclude specific users
}

/**
 * Send push notification to users
 * 
 * @example
 * // Send to specific user
 * await sendNotification(
 *   { title: 'Round Started', body: 'New auction round is live!' },
 *   { userId: 'user123' }
 * );
 * 
 * // Send to team owner
 * await sendNotification(
 *   { title: 'Player Won', body: 'You won Messi for $100M!' },
 *   { teamId: 'team123' }
 * );
 * 
 * // Send to all users
 * await sendNotification(
 *   { title: 'Season Started', body: 'Season 16 has begun!' },
 *   { allUsers: true }
 * );
 */
export async function sendNotification(
  payload: NotificationPayload,
  options: NotificationOptions
): Promise<{ success: boolean; sentCount: number; failedCount: number; error?: string }> {
  try {
    let targetUserIds: string[] = [];

    // Determine target users
    if (options.userId) {
      targetUserIds = [options.userId];
    } else if (options.userIds) {
      targetUserIds = options.userIds;
    } else if (options.teamId) {
      // Team ID is same as user ID in Firebase Auth
      targetUserIds = [options.teamId];
    } else if (options.teamIds) {
      targetUserIds = options.teamIds;
    } else if (options.allUsers) {
      // Get all users with active FCM tokens
      const usersResult = await sql`
        SELECT DISTINCT user_id
        FROM fcm_tokens
        WHERE is_active = true
      `;
      targetUserIds = usersResult.map(u => u.user_id);
    }

    // Apply exclusions
    if (options.excludeUserIds && options.excludeUserIds.length > 0) {
      targetUserIds = targetUserIds.filter(id => !options.excludeUserIds!.includes(id));
    }

    if (targetUserIds.length === 0) {
      return { success: false, sentCount: 0, failedCount: 0, error: 'No target users found' };
    }

    // Get all FCM tokens for target users
    const tokensResult = await sql`
      SELECT token, user_id, device_name
      FROM fcm_tokens
      WHERE user_id = ANY(${targetUserIds})
        AND is_active = true
      ORDER BY last_used_at DESC
    `;

    if (tokensResult.length === 0) {
      return { success: false, sentCount: 0, failedCount: 0, error: 'No active FCM tokens found' };
    }

    const tokens = tokensResult.map(t => t.token);

    // Prepare FCM message
    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification: {
        title: payload.title,
        body: payload.body,
        // Only include imageUrl if it's a valid full URL
        ...(payload.icon && (payload.icon.startsWith('http://') || payload.icon.startsWith('https://')) 
          ? { imageUrl: payload.icon } 
          : {}
        )
      },
      data: {
        url: payload.url || '/',
        ...payload.data
      },
      webpush: {
        fcmOptions: {
          link: payload.url || '/'
        },
        notification: {
          icon: payload.icon || '/logo.png',
          badge: '/badge.png'
        }
      }
    };

    // Send notification
    const response = await admin.messaging().sendEachForMulticast(message);

    console.log(`📬 Notification sent: "${payload.title}" to ${response.successCount}/${tokens.length} devices`);

    // Update last_used_at for successful tokens
    if (response.successCount > 0) {
      await sql`
        UPDATE fcm_tokens
        SET last_used_at = NOW()
        WHERE user_id = ANY(${targetUserIds}) AND is_active = true
      `;
    }

    // Mark failed tokens as inactive
    if (response.failureCount > 0) {
      const failedTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.error(`❌ FCM Error for device ${tokensResult[idx].device_name}:`, resp.error?.code);
          failedTokens.push(tokens[idx]);
        }
      });

      if (failedTokens.length > 0) {
        await sql`
          UPDATE fcm_tokens
          SET is_active = false, updated_at = NOW()
          WHERE token = ANY(${failedTokens})
        `;
      }
    }

    return {
      success: response.successCount > 0,
      sentCount: response.successCount,
      failedCount: response.failureCount
    };

  } catch (error: any) {
    console.error('❌ Error sending notification:', error);
    return {
      success: false,
      sentCount: 0,
      failedCount: 0,
      error: error.message
    };
  }
}

/**
 * Send notification to all teams in a season
 */
export async function sendNotificationToSeason(
  seasonId: string,
  payload: NotificationPayload
): Promise<{ success: boolean; sentCount: number; failedCount: number }> {
  try {
    // Get all teams registered for this season
    const teamsResult = await sql`
      SELECT team_id
      FROM team_seasons
      WHERE season_id = ${seasonId}
        AND status = 'active'
    `;

    const teamIds = teamsResult.map(t => t.team_id);

    return await sendNotification(payload, { teamIds });
  } catch (error: any) {
    console.error('❌ Error sending season notification:', error);
    return { success: false, sentCount: 0, failedCount: 0 };
  }
}

/**
 * Send notification about a specific player to their team owner
 */
export async function sendNotificationToPlayerOwner(
  playerId: string,
  payload: NotificationPayload
): Promise<{ success: boolean; sentCount: number; failedCount: number }> {
  try {
    // Get player's current team
    const playerResult = await sql`
      SELECT team_id
      FROM players
      WHERE id = ${playerId}
      LIMIT 1
    `;

    if (playerResult.length === 0 || !playerResult[0].team_id) {
      return { success: false, sentCount: 0, failedCount: 0 };
    }

    const teamId = playerResult[0].team_id;

    return await sendNotification(payload, { teamId });
  } catch (error: any) {
    console.error('❌ Error sending player owner notification:', error);
    return { success: false, sentCount: 0, failedCount: 0 };
  }
}
