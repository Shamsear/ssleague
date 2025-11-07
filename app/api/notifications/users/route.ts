import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-helper';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.NEON_TOURNAMENT_DB_URL!);

/**
 * Get all users who have enabled notifications
 * GET /api/notifications/users
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication (only committee/admin can view notification users)
    const auth = await verifyAuth(['admin', 'committee', 'committee_admin'], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
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
