import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-helper';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.NEON_TOURNAMENT_DB_URL!);

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const auth = await verifyAuth(['admin', 'committee_admin', 'team'], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get all FCM tokens
    const tokens = await sql`
      SELECT 
        user_id, 
        device_name, 
        device_type, 
        is_active, 
        created_at,
        last_used_at
      FROM fcm_tokens
      ORDER BY created_at DESC
    `;

    // Get count by status
    const activeCount = tokens.filter(t => t.is_active).length;
    const inactiveCount = tokens.filter(t => !t.is_active).length;

    return NextResponse.json({
      success: true,
      totalTokens: tokens.length,
      activeTokens: activeCount,
      inactiveTokens: inactiveCount,
      tokens: tokens.map(t => ({
        userId: t.user_id,
        deviceName: t.device_name,
        deviceType: t.device_type,
        isActive: t.is_active,
        createdAt: t.created_at,
        lastUsedAt: t.last_used_at
      }))
    });
  } catch (error: any) {
    console.error('Error checking FCM tokens:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
