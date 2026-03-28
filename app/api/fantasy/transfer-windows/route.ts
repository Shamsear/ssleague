import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-helper';
import { fantasySql } from '@/lib/neon/fantasy-config';

/**
 * GET /api/fantasy/transfer-windows?league_id=xxx
 * Get all transfer windows for a league
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(['committee_admin'], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { error: 'Unauthorized - Committee access required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get('league_id');

    if (!leagueId) {
      return NextResponse.json(
        { error: 'league_id is required' },
        { status: 400 }
      );
    }

    // Get all transfer windows for the league
    const windows = await fantasySql`
      SELECT 
        window_id,
        window_name,
        opens_at,
        closes_at,
        is_active,
        CASE
          WHEN NOW() < opens_at THEN 'upcoming'
          WHEN NOW() BETWEEN opens_at AND closes_at AND is_active THEN 'active'
          ELSE 'closed'
        END as status
      FROM fantasy_transfer_windows
      WHERE league_id = ${leagueId}
      ORDER BY opens_at DESC
    `;

    return NextResponse.json({
      success: true,
      windows
    });

  } catch (error) {
    console.error('Error fetching transfer windows:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch transfer windows',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/fantasy/transfer-windows
 * Create a new transfer window
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(['committee_admin'], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { error: 'Unauthorized - Committee access required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { league_id, window_name, opens_at, closes_at } = body;

    // Validate required fields
    if (!league_id || !window_name || !opens_at || !closes_at) {
      return NextResponse.json(
        { error: 'Missing required fields: league_id, window_name, opens_at, closes_at' },
        { status: 400 }
      );
    }

    // Validate dates
    const opensDate = new Date(opens_at);
    const closesDate = new Date(closes_at);

    if (closesDate <= opensDate) {
      return NextResponse.json(
        { error: 'closes_at must be after opens_at' },
        { status: 400 }
      );
    }

    // Check for overlapping windows
    const overlapping = await fantasySql`
      SELECT window_id, window_name
      FROM fantasy_transfer_windows
      WHERE league_id = ${league_id}
        AND (
          (opens_at <= ${opens_at} AND closes_at >= ${opens_at})
          OR (opens_at <= ${closes_at} AND closes_at >= ${closes_at})
          OR (opens_at >= ${opens_at} AND closes_at <= ${closes_at})
        )
    `;

    if (overlapping.length > 0) {
      return NextResponse.json(
        { 
          error: `Transfer window overlaps with existing window: ${overlapping[0].window_name}`,
          overlapping_window: overlapping[0]
        },
        { status: 400 }
      );
    }

    // Create the transfer window
    const windowId = `window_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await fantasySql`
      INSERT INTO fantasy_transfer_windows (
        window_id, league_id, window_name,
        opens_at, closes_at, is_active
      ) VALUES (
        ${windowId}, ${league_id}, ${window_name},
        ${opens_at}, ${closes_at}, false
      )
    `;

    console.log(`✅ Created transfer window: ${window_name} for league ${league_id}`);

    return NextResponse.json({
      success: true,
      message: 'Transfer window created successfully',
      window_id: windowId
    });

  } catch (error) {
    console.error('Error creating transfer window:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create transfer window',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
