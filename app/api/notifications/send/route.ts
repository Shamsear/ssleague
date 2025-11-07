import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/auth-helper';
import admin from 'firebase-admin';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.NEON_TOURNAMENT_DB_URL!);

/**
 * Send push notification to a user via FCM
 * POST /api/notifications/send
 * 
 * Request body:
 * {
 *   userId: string,           // Target user ID
 *   title: string,            // Notification title
 *   body: string,             // Notification body
 *   icon?: string,            // Notification icon URL
 *   url?: string,             // URL to open when clicked
 *   data?: object             // Additional custom data
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication (only committee/admin can send notifications)
    const auth = await verifyAuth(['admin', 'committee', 'committee_admin'], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const senderId = auth.userId!;

    // Get notification details from request
    const { userId, title, body, icon, url, data } = await request.json();

    if (!userId || !title || !body) {
      return NextResponse.json(
        { success: false, error: 'userId, title, and body are required' },
        { status: 400 }
      );
    }

    // Get all active FCM tokens for this user from Neon
    const tokensResult = await sql`
      SELECT id, token, device_name
      FROM fcm_tokens
      WHERE user_id = ${userId}
        AND is_active = true
      ORDER BY last_used_at DESC
    `;

    if (tokensResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'User has not enabled notifications on any device' },
        { status: 400 }
      );
    }

    const tokens = tokensResult.map(t => t.token);

    // Prepare notification message for multiple devices
    // Note: imageUrl must be a full URL (not relative path), or omitted
    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification: {
        title,
        body,
        // Only include imageUrl if it's a valid full URL
        ...(icon && (icon.startsWith('http://') || icon.startsWith('https://')) ? { imageUrl: icon } : {})
      },
      data: {
        url: url || '/',
        ...data
      },
      webpush: {
        fcmOptions: {
          link: url || '/'
        },
        notification: {
          // webpush.notification.icon can be a relative path
          icon: icon || '/logo.png',
          badge: '/badge.png'
        }
      }
    };

    // Send notification to all user's devices
    const response = await admin.messaging().sendEachForMulticast(message);
    
    console.log(`📬 Notification sent to user ${userId} on ${response.successCount} device(s)`);

    // Update last_used_at for successful tokens
    if (response.successCount > 0) {
      await sql`
        UPDATE fcm_tokens
        SET last_used_at = NOW()
        WHERE user_id = ${userId} AND is_active = true
      `;
    }

    // Mark failed tokens as inactive
    if (response.failureCount > 0) {
      const failedTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.error(`❌ FCM Error for token ${tokens[idx].substring(0, 20)}...`);
          console.error('Error code:', resp.error?.code);
          console.error('Error message:', resp.error?.message);
          failedTokens.push(tokens[idx]);
        }
      });

      if (failedTokens.length > 0) {
        await sql`
          UPDATE fcm_tokens
          SET is_active = false, updated_at = NOW()
          WHERE token = ANY(${failedTokens})
        `;
        console.log(`❌ Marked ${failedTokens.length} invalid tokens as inactive`);
      }
    }

    // Save notification to database for history
    await adminDb.collection('notifications').add({
      userId,
      title,
      body,
      icon,
      url,
      data,
      sentAt: new Date(),
      sentBy: senderId,
      deviceCount: response.successCount,
      status: response.successCount > 0 ? 'sent' : 'failed'
    });

    return NextResponse.json({
      success: true,
      sentToDevices: response.successCount,
      failedDevices: response.failureCount,
      message: `Notification sent to ${response.successCount} device(s)`
    });

  } catch (error: any) {
    console.error('Error sending notification:', error);

    // Handle specific FCM errors
    if (error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered') {
      // Token is invalid, remove it from database
      const { userId } = await request.json();
      if (userId) {
        await adminDb.collection('users').doc(userId).update({
          fcmToken: null,
          notificationsEnabled: false
        });
      }
      
      return NextResponse.json(
        { success: false, error: 'Invalid FCM token (removed from database)' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Failed to send notification' },
      { status: 500 }
    );
  }
}

/**
 * Send notification to multiple users
 * POST /api/notifications/send-batch
 */
export async function PUT(request: NextRequest) {
  try {
    const token = await getAuthToken(request);
    
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const senderId = decodedToken.uid;

    // Get user role from Firestore
    const userDoc = await adminDb.collection('users').doc(senderId).get();
    if (!userDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    const senderRole = userData?.role;

    if (senderRole !== 'committee' && senderRole !== 'admin' && senderRole !== 'committee_admin') {
      return NextResponse.json(
        { success: false, error: 'Only committee/admin can send notifications' },
        { status: 403 }
      );
    }

    const { userIds, title, body, icon, url, data } = await request.json();

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'userIds array is required' },
        { status: 400 }
      );
    }

    if (!title || !body) {
      return NextResponse.json(
        { success: false, error: 'title and body are required' },
        { status: 400 }
      );
    }

    // Get all users' FCM tokens
    const usersSnapshot = await adminDb.collection('users')
      .where(admin.firestore.FieldPath.documentId(), 'in', userIds)
      .get();

    const tokens: string[] = [];
    usersSnapshot.docs.forEach(doc => {
      const fcmToken = doc.data()?.fcmToken;
      if (fcmToken) tokens.push(fcmToken);
    });

    if (tokens.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No users with notifications enabled' },
        { status: 400 }
      );
    }

    // Send to multiple tokens (batch send)
    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification: {
        title,
        body,
        imageUrl: icon || undefined
      },
      data: {
        url: url || '/',
        ...data
      },
      webpush: {
        fcmOptions: {
          link: url || '/'
        },
        notification: {
          icon: icon || '/logo.png',
          badge: '/badge.png'
        }
      }
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    console.log(`📬 Batch notification sent to ${tokens.length} users:`, {
      successCount: response.successCount,
      failureCount: response.failureCount
    });

    return NextResponse.json({
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
      message: `Sent to ${response.successCount} users`
    });

  } catch (error: any) {
    console.error('Error sending batch notification:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to send notifications' },
      { status: 500 }
    );
  }
}
