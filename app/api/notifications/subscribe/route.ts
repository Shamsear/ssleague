import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/auth-helper';
import { neon } from '@neondatabase/serverless';
import { getDeviceInfoFromRequest } from '@/lib/device-detector';

const sql = neon(process.env.NEON_TOURNAMENT_DB_URL!);

/**
 * Save FCM token to user's Firestore document
 * POST /api/notifications/subscribe
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(['team', 'committee'], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = auth.userId!;

    // Get FCM token from request body
    const { fcmToken } = await request.json();

    if (!fcmToken) {
      return NextResponse.json(
        { success: false, error: 'FCM token is required' },
        { status: 400 }
      );
    }

    // Detect device information
    const deviceInfo = getDeviceInfoFromRequest(request);

    // Save FCM token to Neon database (supports multiple devices)
    await sql`
      INSERT INTO fcm_tokens (user_id, token, device_name, device_type, browser, os, last_used_at)
      VALUES (
        ${userId},
        ${fcmToken},
        ${deviceInfo.deviceName},
        ${deviceInfo.deviceType},
        ${deviceInfo.browser},
        ${deviceInfo.os},
        NOW()
      )
      ON CONFLICT (token) 
      DO UPDATE SET 
        last_used_at = NOW(),
        is_active = true,
        updated_at = NOW()
    `;

    // Also keep Firestore updated for backward compatibility
    await adminDb.collection('users').doc(userId).update({
      fcmToken, // Keep last token for legacy support
      fcmTokenUpdatedAt: new Date(),
      notificationsEnabled: true
    });

    console.log(`✅ FCM token saved for user ${userId} on ${deviceInfo.deviceName}`);

    return NextResponse.json({
      success: true,
      message: 'Notification token saved successfully',
      device: deviceInfo
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
    const auth = await verifyAuth(['team', 'committee'], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = auth.userId!;

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
