import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase/admin';
import { getAuthToken } from '@/lib/auth/token-helper';

/**
 * Save FCM token to user's Firestore document
 * POST /api/notifications/subscribe
 */
export async function POST(request: NextRequest) {
  try {
    // Get and verify auth token
    const token = await getAuthToken(request);
    
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - No token' },
        { status: 401 }
      );
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    // Get FCM token from request body
    const { fcmToken } = await request.json();

    if (!fcmToken) {
      return NextResponse.json(
        { success: false, error: 'FCM token is required' },
        { status: 400 }
      );
    }

    // Save FCM token to user document
    await adminDb.collection('users').doc(userId).update({
      fcmToken,
      fcmTokenUpdatedAt: new Date(),
      notificationsEnabled: true
    });

    console.log(`✅ FCM token saved for user ${userId}`);

    return NextResponse.json({
      success: true,
      message: 'Notification token saved successfully'
    });

  } catch (error: any) {
    console.error('Error saving FCM token:', error);
    
    if (error.code === 'auth/invalid-user-token' || error.code === 'auth/argument-error') {
      return NextResponse.json(
        { success: false, error: 'Invalid authentication token' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to save notification token' },
      { status: 500 }
    );
  }
}

/**
 * Remove FCM token (unsubscribe from notifications)
 * DELETE /api/notifications/subscribe
 */
export async function DELETE(request: NextRequest) {
  try {
    const token = await getAuthToken(request);
    
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    // Remove FCM token
    await adminDb.collection('users').doc(userId).update({
      fcmToken: null,
      notificationsEnabled: false,
      fcmTokenRemovedAt: new Date()
    });

    console.log(`🔕 FCM token removed for user ${userId}`);

    return NextResponse.json({
      success: true,
      message: 'Unsubscribed from notifications'
    });

  } catch (error: any) {
    console.error('Error removing FCM token:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to unsubscribe' },
      { status: 500 }
    );
  }
}
