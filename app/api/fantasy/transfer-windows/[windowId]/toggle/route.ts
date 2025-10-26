import { NextRequest, NextResponse } from 'next/server';
import { fantasySql } from '@/lib/neon/fantasy-config';

/**
 * POST /api/fantasy/transfer-windows/[windowId]/toggle
 * Toggle transfer window active status
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { windowId: string } }
) {
  try {
    const { windowId } = params;

    // Get current window
    const windows = await fantasySql`
      SELECT * FROM transfer_windows
      WHERE window_id = ${windowId}
      LIMIT 1
    `;

    if (windows.length === 0) {
      return NextResponse.json(
        { error: 'Transfer window not found' },
        { status: 404 }
      );
    }

    const window = windows[0];
    const newStatus = !window.is_active;

    // If activating, deactivate all other windows for this league
    if (newStatus) {
      await fantasySql`
        UPDATE transfer_windows
        SET is_active = false
        WHERE league_id = ${window.league_id} AND window_id != ${windowId}
      `;
    }

    // Toggle the window
    await fantasySql`
      UPDATE transfer_windows
      SET is_active = ${newStatus}
      WHERE window_id = ${windowId}
    `;

    console.log(`✅ Transfer window ${windowId} ${newStatus ? 'opened' : 'closed'}`);

    return NextResponse.json({
      success: true,
      is_active: newStatus,
      message: `Transfer window ${newStatus ? 'opened' : 'closed'}`,
    });
  } catch (error) {
    console.error('Error toggling transfer window:', error);
    return NextResponse.json(
      { error: 'Failed to toggle transfer window' },
      { status: 500 }
    );
  }
}
