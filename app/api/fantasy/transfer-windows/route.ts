import { NextRequest, NextResponse } from 'next/server';
import { fantasySql } from '@/lib/neon/fantasy-config';

/**
 * GET /api/fantasy/transfer-windows?league_id=xxx
 * Get all transfer windows for a league
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const league_id = searchParams.get('league_id');

    if (!league_id) {
      return NextResponse.json(
        { error: 'league_id is required' },
        { status: 400 }
      );
    }

    const windows = await fantasySql`
      SELECT * FROM transfer_windows
      WHERE league_id = ${league_id}
      ORDER BY opens_at DESC
    `;

    // Add status based on current time
    const now = new Date();
    const windowsWithStatus = windows.map((window: any) => ({
      ...window,
      status: window.is_active 
        ? 'active' 
        : new Date(window.opens_at) > now 
          ? 'upcoming' 
          : 'closed'
    }));

    return NextResponse.json({
      success: true,
      windows: windowsWithStatus,
    });
  } catch (error) {
    console.error('Error fetching transfer windows:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transfer windows' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/fantasy/transfer-windows
 * Create a new transfer window (committee only)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { league_id, window_name, opens_at, closes_at } = body;

    if (!league_id || !window_name || !opens_at || !closes_at) {
      return NextResponse.json(
        { error: 'league_id, window_name, opens_at, and closes_at are required' },
        { status: 400 }
      );
    }

    const window_id = `tw_${league_id}_${Date.now()}`;

    await fantasySql`
      INSERT INTO transfer_windows (
        window_id, league_id, window_name, opens_at, closes_at, is_active
      ) VALUES (
        ${window_id}, ${league_id}, ${window_name}, ${opens_at}, ${closes_at}, false
      )
    `;

    console.log(`✅ Transfer window created: ${window_name}`);

    return NextResponse.json({
      success: true,
      message: 'Transfer window created successfully',
      window_id,
    });
  } catch (error) {
    console.error('Error creating transfer window:', error);
    return NextResponse.json(
      { error: 'Failed to create transfer window' },
      { status: 500 }
    );
  }
}
