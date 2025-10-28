import { NextRequest, NextResponse } from 'next/server';
import { fantasySql } from '@/lib/neon/fantasy-config';

/**
 * GET /api/fantasy/transfers/settings?window_id=xxx
 * Get transfer settings for a specific transfer window
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const window_id = searchParams.get('window_id');

    if (!window_id) {
      return NextResponse.json(
        { error: 'Missing window_id parameter' },
        { status: 400 }
      );
    }

    // Get window with settings from PostgreSQL
    const windows = await fantasySql`
      SELECT 
        window_id,
        league_id,
        window_name,
        opens_at,
        closes_at,
        is_active,
        max_transfers_per_window,
        points_cost_per_transfer,
        transfer_window_start,
        transfer_window_end
      FROM transfer_windows
      WHERE window_id = ${window_id}
      LIMIT 1
    `;

    if (windows.length === 0) {
      return NextResponse.json(
        { error: 'Transfer window not found' },
        { status: 404 }
      );
    }

    const window = windows[0];

    return NextResponse.json({
      settings: {
        max_transfers_per_window: Number(window.max_transfers_per_window || 3),
        is_transfer_window_open: window.is_active,
        transfer_window_start: window.transfer_window_start || window.opens_at,
        transfer_window_end: window.transfer_window_end || window.closes_at,
        points_cost_per_transfer: Number(window.points_cost_per_transfer || 4),
      },
    });
  } catch (error) {
    console.error('Error fetching transfer settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transfer settings', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/fantasy/transfers/settings
 * Update transfer settings for a specific window
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      window_id,
      max_transfers_per_window,
      points_cost_per_transfer,
      transfer_window_start,
      transfer_window_end,
      is_transfer_window_open,
    } = body;

    if (!window_id) {
      return NextResponse.json(
        { error: 'Missing required field: window_id' },
        { status: 400 }
      );
    }

    // Validate settings
    if (max_transfers_per_window !== undefined && max_transfers_per_window < 0) {
      return NextResponse.json(
        { error: 'max_transfers_per_window must be non-negative' },
        { status: 400 }
      );
    }

    if (points_cost_per_transfer !== undefined && points_cost_per_transfer < 0) {
      return NextResponse.json(
        { error: 'points_cost_per_transfer must be non-negative' },
        { status: 400 }
      );
    }

    // Check if window exists
    const windows = await fantasySql`
      SELECT window_id, league_id FROM transfer_windows
      WHERE window_id = ${window_id}
      LIMIT 1
    `;

    if (windows.length === 0) {
      return NextResponse.json(
        { error: 'Transfer window not found' },
        { status: 404 }
      );
    }

    // Build update query dynamically based on provided fields
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (max_transfers_per_window !== undefined) {
      updates.push(`max_transfers_per_window = $${paramIndex++}`);
      values.push(max_transfers_per_window);
    }

    if (points_cost_per_transfer !== undefined) {
      updates.push(`points_cost_per_transfer = $${paramIndex++}`);
      values.push(points_cost_per_transfer);
    }

    if (transfer_window_start !== undefined) {
      updates.push(`transfer_window_start = $${paramIndex++}`);
      values.push(transfer_window_start || null);
    }

    if (transfer_window_end !== undefined) {
      updates.push(`transfer_window_end = $${paramIndex++}`);
      values.push(transfer_window_end || null);
    }

    if (is_transfer_window_open !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(is_transfer_window_open);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    values.push(window_id);

    await fantasySql.unsafe(`
      UPDATE transfer_windows
      SET ${updates.join(', ')}
      WHERE window_id = $${paramIndex}
    `, values);

    // Fetch updated window
    const updatedWindows = await fantasySql`
      SELECT 
        window_id,
        max_transfers_per_window,
        points_cost_per_transfer,
        transfer_window_start,
        transfer_window_end,
        is_active
      FROM transfer_windows
      WHERE window_id = ${window_id}
      LIMIT 1
    `;

    return NextResponse.json({
      success: true,
      message: 'Transfer settings updated successfully',
      settings: {
        max_transfers_per_window: Number(updatedWindows[0].max_transfers_per_window),
        points_cost_per_transfer: Number(updatedWindows[0].points_cost_per_transfer),
        transfer_window_start: updatedWindows[0].transfer_window_start,
        transfer_window_end: updatedWindows[0].transfer_window_end,
        is_transfer_window_open: updatedWindows[0].is_active,
      },
    });
  } catch (error) {
    console.error('Error saving transfer settings:', error);
    return NextResponse.json(
      { error: 'Failed to save transfer settings', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
