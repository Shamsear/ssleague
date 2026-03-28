import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-helper';
import { fantasySql } from '@/lib/neon/fantasy-config';

/**
 * POST /api/fantasy/transfer-windows/[windowId]/toggle
 * Toggle a transfer window open/closed
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { windowId: string } }
) {
  try {
    const auth = await verifyAuth(['committee_admin'], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { error: 'Unauthorized - Committee access required' },
        { status: 401 }
      );
    }

    const { windowId } = params;

    if (!windowId) {
      return NextResponse.json(
        { error: 'window_id is required' },
        { status: 400 }
      );
    }

    // Get the window
    const windows = await fantasySql`
      SELECT window_id, league_id, window_name, is_active, opens_at, closes_at
      FROM fantasy_transfer_windows
      WHERE window_id = ${windowId}
    `;

    if (windows.length === 0) {
      return NextResponse.json(
        { error: 'Transfer window not found' },
        { status: 404 }
      );
    }

    const window = windows[0];
    const newStatus = !window.is_active;

    // If opening the window, close all other windows in the same league
    if (newStatus) {
      // Check if window is within valid time range
      const now = new Date();
      const opensAt = new Date(window.opens_at);
      const closesAt = new Date(window.closes_at);

      if (now < opensAt) {
        return NextResponse.json(
          { error: 'Cannot open window before its start time' },
          { status: 400 }
        );
      }

      if (now > closesAt) {
        return NextResponse.json(
          { error: 'Cannot open window after its end time' },
          { status: 400 }
        );
      }

      // Close all other windows in the league
      await fantasySql`
        UPDATE fantasy_transfer_windows
        SET is_active = false
        WHERE league_id = ${window.league_id}
          AND window_id != ${windowId}
      `;

      console.log(`🔒 Closed all other transfer windows for league ${window.league_id}`);
    }

    // Toggle the window
    await fantasySql`
      UPDATE fantasy_transfer_windows
      SET is_active = ${newStatus}
      WHERE window_id = ${windowId}
    `;

    const action = newStatus ? 'opened' : 'closed';
    console.log(`✅ Transfer window ${action}: ${window.window_name}`);

    return NextResponse.json({
      success: true,
      message: `Transfer window ${action} successfully`,
      is_active: newStatus
    });

  } catch (error) {
    console.error('Error toggling transfer window:', error);
    return NextResponse.json(
      { 
        error: 'Failed to toggle transfer window',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
