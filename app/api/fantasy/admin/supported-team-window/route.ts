import { NextRequest, NextResponse } from 'next/server';
import { fantasySql } from '@/lib/neon/fantasy-config';

/**
 * POST /api/fantasy/admin/supported-team-window
 * Create a window for supported team changes (Admin only)
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            admin_uid,
            league_id,
            window_name,
            opens_at,
            closes_at,
        } = body;

        console.log('🔧 Creating supported team change window:', { league_id, window_name });

        if (!admin_uid || !league_id || !window_name || !opens_at || !closes_at) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // TODO: Add admin verification here
        // For now, we'll trust the admin_uid

        // Validate dates
        const opensDate = new Date(opens_at);
        const closesDate = new Date(closes_at);

        if (closesDate <= opensDate) {
            return NextResponse.json(
                { error: 'Close date must be after open date' },
                { status: 400 }
            );
        }

        // Check if league exists
        const leagues = await fantasySql`
      SELECT * FROM fantasy_leagues
      WHERE league_id = ${league_id}
      LIMIT 1
    `;

        if (leagues.length === 0) {
            return NextResponse.json(
                { error: 'League not found' },
                { status: 404 }
            );
        }

        // Generate window ID
        const windowId = `stw_${league_id}_${Date.now()}`;

        // Create the window
        await fantasySql`
      INSERT INTO transfer_windows (
        window_id, league_id, window_name,
        opens_at, closes_at, is_active,
        allow_supported_team_change,
        max_transfers_per_window,
        points_cost_per_transfer
      ) VALUES (
        ${windowId}, ${league_id}, ${window_name},
        ${opensDate.toISOString()}, ${closesDate.toISOString()}, true,
        true,
        1,
        0
      )
    `;

        console.log(`✅ Supported team change window created: ${windowId}`);

        return NextResponse.json({
            success: true,
            message: 'Supported team change window created successfully',
            window: {
                window_id: windowId,
                window_name,
                opens_at: opensDate,
                closes_at: closesDate,
                is_active: true,
            },
        });
    } catch (error) {
        console.error('❌ Error creating supported team window:', error);
        return NextResponse.json(
            { error: 'Failed to create window', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/fantasy/admin/supported-team-window
 * Get all supported team change windows for a league
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const league_id = searchParams.get('league_id');

        if (!league_id) {
            return NextResponse.json(
                { error: 'League ID is required' },
                { status: 400 }
            );
        }

        const windows = await fantasySql`
      SELECT * FROM transfer_windows
      WHERE league_id = ${league_id}
        AND allow_supported_team_change = true
      ORDER BY created_at DESC
    `;

        // Get change statistics for each window
        const windowsWithStats = await Promise.all(
            windows.map(async (window) => {
                const changes = await fantasySql`
          SELECT COUNT(*) as change_count
          FROM supported_team_changes
          WHERE window_id = ${window.window_id}
        `;

                const teams = await fantasySql`
          SELECT COUNT(*) as team_count
          FROM fantasy_teams
          WHERE league_id = ${league_id}
            AND is_enabled = true
        `;

                return {
                    ...window,
                    changes_made: Number(changes[0]?.change_count || 0),
                    total_teams: Number(teams[0]?.team_count || 0),
                };
            })
        );

        return NextResponse.json({
            windows: windowsWithStats,
        });
    } catch (error) {
        console.error('❌ Error fetching supported team windows:', error);
        return NextResponse.json(
            { error: 'Failed to fetch windows', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/fantasy/admin/supported-team-window
 * Close a supported team change window
 */
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { admin_uid, window_id } = body;

        if (!admin_uid || !window_id) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Close the window
        await fantasySql`
      UPDATE transfer_windows
      SET is_active = false
      WHERE window_id = ${window_id}
    `;

        console.log(`✅ Supported team window closed: ${window_id}`);

        return NextResponse.json({
            success: true,
            message: 'Window closed successfully',
        });
    } catch (error) {
        console.error('❌ Error closing window:', error);
        return NextResponse.json(
            { error: 'Failed to close window', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
