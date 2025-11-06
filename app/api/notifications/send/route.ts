import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase/admin';
import { getAuthToken } from '@/lib/auth/token-helper';
import admin from 'firebase-admin';

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
    // Get and verify auth token (only committee/admin can send notifications)
    const token = await getAuthToken(request);
    
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const senderRole = decodedToken.role;

    // Only committee or admin can send notifications
    // Remove this check if you want teams to send notifications too
    if (senderRole !== 'committee' && senderRole !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Only committee/admin can send notifications' },
        { status: 403 }
      );
    }

    // Get notification details from request
    const { userId, title, body, icon, url, data } = await request.json();

    if (!userId || !title || !body) {
      return NextResponse.json(
        { success: false, error: 'userId, title, and body are required' },
        { status: 400 }
      );
    }

    // Get target user's FCM token
    const userDoc = await adminDb.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    const fcmToken = userData?.fcmToken;

    if (!fcmToken) {
      return NextResponse.json(
        { success: false, error: 'User has not enabled notifications' },
        { status: 400 }
      );
    }

    // Prepare notification message
    const message: admin.messaging.Message = {
      token: fcmToken,
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

    // Send notification via FCM
    const response = await admin.messaging().send(message);
    
    console.log(`📬 Notification sent to user ${userId}:`, response);

    // Save notification to database for history
    await adminDb.collection('notifications').add({
      userId,
      title,
      body,
      icon,
      url,
      data,
      sentAt: new Date(),
      sentBy: decodedToken.uid,
      messageId: response,
      status: 'sent'
    });

    return NextResponse.json({
      success: true,
      messageId: response,
      message: 'Notification sent successfully'
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
    const senderRole = decodedToken.role;

    if (senderRole !== 'committee' && senderRole !== 'admin') {
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
