import { NextRequest, NextResponse } from 'next/server';
import { getAuthToken } from '@/lib/auth/token-helper';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.NEON_TOURNAMENT_DB_URL!);

/**
 * Get all users who have enabled notifications
 * GET /api/notifications/users
 */
export async function GET(request: NextRequest) {
  try {
    // Get and verify auth token (only committee/admin)
    const token = await getAuthToken(request);
    
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    // Get user role from Firestore
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    const userRole = userData?.role;

    // Only committee or admin can view notification users
    if (userRole !== 'committee' && userRole !== 'admin' && userRole !== 'committee_admin') {
      return NextResponse.json(
        { success: false, error: 'Only committee/admin can view notification users' },
        { status: 403 }
      );
    }

    // Get all users with active notification tokens grouped by user_id
    let result;
    try {
      result = await sql`
        SELECT 
          user_id,
          COUNT(*) as device_count,
          json_agg(
            json_build_object(
              'deviceName', device_name,
              'deviceType', device_type,
              'browser', browser,
              'os', os
            )
          ) as devices
        FROM fcm_tokens
        WHERE is_active = true
        GROUP BY user_id
        ORDER BY device_count DESC
      `;
    } catch (dbError: any) {
      // Handle case where table doesn't exist yet
      if (dbError.message?.includes('does not exist')) {
        return NextResponse.json({
          success: true,
          users: [],
          total: 0,
          message: 'No notification users found. Run the SQL migration first.'
        });
      }
      throw dbError;
    }

    const users = result.map(row => ({
      userId: row.user_id,
      deviceCount: parseInt(row.device_count),
      devices: row.devices
    }));

    return NextResponse.json({
      success: true,
      users,
      total: users.length
    });

  } catch (error: any) {
    console.error('Error fetching notification users:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch notification users' },
      { status: 500 }
    );
  }
}
