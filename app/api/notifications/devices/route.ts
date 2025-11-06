import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';
import { getAuthToken } from '@/lib/auth/token-helper';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.NEON_TOURNAMENT_DB_URL!);

/**
 * Get all devices for current user
 * GET /api/notifications/devices
 */
export async function GET(request: NextRequest) {
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

    // Get all devices for this user
    const devices = await sql`
      SELECT 
        id,
        token,
        device_name,
        device_type,
        browser,
        os,
        is_active,
        created_at,
        last_used_at
      FROM fcm_tokens
      WHERE user_id = ${userId}
      ORDER BY last_used_at DESC
    `;

    return NextResponse.json({
      success: true,
      devices: devices.map(d => ({
        id: d.id,
        deviceName: d.device_name,
        deviceType: d.device_type,
        browser: d.browser,
        os: d.os,
        isActive: d.is_active,
        createdAt: d.created_at,
        lastUsedAt: d.last_used_at,
        // Don't expose full token for security
        tokenPreview: d.token.substring(0, 20) + '...'
      }))
    });

  } catch (error: any) {
    console.error('Error fetching devices:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch devices' },
      { status: 500 }
    );
  }
}

/**
 * Remove a specific device
 * DELETE /api/notifications/devices?deviceId=123
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

    // Get device ID from query params
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');

    if (!deviceId) {
      return NextResponse.json(
        { success: false, error: 'deviceId is required' },
        { status: 400 }
      );
    }

    // Verify device belongs to user before deleting
    const deviceCheck = await sql`
      SELECT user_id FROM fcm_tokens WHERE id = ${deviceId}
    `;

    if (deviceCheck.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Device not found' },
        { status: 404 }
      );
    }

    if (deviceCheck[0].user_id !== userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized to delete this device' },
        { status: 403 }
      );
    }

    // Delete the device
    await sql`
      DELETE FROM fcm_tokens
      WHERE id = ${deviceId}
    `;

    console.log(`🔕 Device ${deviceId} removed for user ${userId}`);

    return NextResponse.json({
      success: true,
      message: 'Device removed successfully'
    });

  } catch (error: any) {
    console.error('Error removing device:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to remove device' },
      { status: 500 }
    );
  }
}
