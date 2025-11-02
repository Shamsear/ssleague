import { NextRequest, NextResponse } from 'next/server';
import { fantasySql } from '@/lib/neon/fantasy-config';

// WebSocket broadcast function
declare global {
  var wsBroadcast: ((channel: string, data: any) => void) | undefined;
}

/**
 * POST /api/fantasy/draft/control
 * Committee endpoint to control draft periods
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { league_id, draft_status, draft_opens_at, draft_closes_at } = body;

    console.log('🔵 Received from client:', {
      draft_opens_at,
      draft_closes_at
    });

    // Ensure PostgreSQL session uses UTC timezone
    await fantasySql`SET timezone = 'UTC'`;

    if (!league_id || !draft_status) {
      return NextResponse.json(
        { error: 'league_id and draft_status are required' },
        { status: 400 }
      );
    }

    // Validate draft_status
    if (!['pending', 'active', 'closed'].includes(draft_status)) {
      return NextResponse.json(
        { error: 'draft_status must be pending, active, or closed' },
        { status: 400 }
      );
    }

    // Update draft settings
    // Use string literals with AT TIME ZONE 'UTC' to force UTC interpretation
    const opensQuery = draft_opens_at ? `'${draft_opens_at}'::timestamp AT TIME ZONE 'UTC'` : 'NULL';
    const closesQuery = draft_closes_at ? `'${draft_closes_at}'::timestamp AT TIME ZONE 'UTC'` : 'NULL';
    
    const result = await fantasySql`
      UPDATE fantasy_leagues
      SET 
        draft_status = ${draft_status},
        draft_opens_at = ${fantasySql.unsafe(opensQuery)},
        draft_closes_at = ${fantasySql.unsafe(closesQuery)},
        updated_at = CURRENT_TIMESTAMP
      WHERE league_id = ${league_id}
      RETURNING *
    `;

    console.log('🟢 Stored in database:', {
      draft_opens_at: result[0]?.draft_opens_at,
      draft_closes_at: result[0]?.draft_closes_at
    });

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Fantasy league not found' },
        { status: 404 }
      );
    }

    console.log(`✅ Draft status updated to ${draft_status} for league ${league_id}`);

    // Broadcast to WebSocket clients
    if (global.wsBroadcast) {
      global.wsBroadcast(`league:${league_id}:draft`, {
        type: 'draft_status_update',
        data: {
          league_id,
          draft_status,
          draft_opens_at: draft_opens_at || null,
          draft_closes_at: draft_closes_at || null,
        },
      });
      console.log(`📢 Broadcast draft status update to league:${league_id}:draft`);
    }

    return NextResponse.json({
      success: true,
      message: 'Draft settings updated successfully',
      draft_status,
      draft_opens_at: draft_opens_at || null,
      draft_closes_at: draft_closes_at || null,
    });
  } catch (error) {
    console.error('Error updating draft control:', error);
    return NextResponse.json(
      { error: 'Failed to update draft settings', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
