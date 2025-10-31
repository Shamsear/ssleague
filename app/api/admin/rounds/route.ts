import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { verifyAuth } from '@/lib/auth-helper';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

/**
 * GET /api/admin/rounds
 * List all rounds for a season
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication and authorization
    const auth = await verifyAuth(['admin', 'committee_admin']);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const seasonId = searchParams.get('season_id');
    const status = searchParams.get('status');

    let rounds;

    if (seasonId && status) {
      rounds = await sql`
        SELECT 
          r.*,
          COUNT(DISTINCT b.id) as total_bids,
          COUNT(DISTINCT b.team_id) as teams_bid
        FROM rounds r
        LEFT JOIN bids b ON r.id = b.round_id
        WHERE r.season_id = ${seasonId} AND r.status = ${status}
        GROUP BY r.id
        ORDER BY r.created_at DESC
      `;
    } else if (seasonId) {
      rounds = await sql`
        SELECT 
          r.*,
          COUNT(DISTINCT b.id) as total_bids,
          COUNT(DISTINCT b.team_id) as teams_bid
        FROM rounds r
        LEFT JOIN bids b ON r.id = b.round_id
        WHERE r.season_id = ${seasonId}
        GROUP BY r.id
        ORDER BY r.created_at DESC
      `;
    } else {
      rounds = await sql`
        SELECT 
          r.*,
          COUNT(DISTINCT b.id) as total_bids,
          COUNT(DISTINCT b.team_id) as teams_bid
        FROM rounds r
        LEFT JOIN bids b ON r.id = b.round_id
        GROUP BY r.id
        ORDER BY r.created_at DESC
      `;
    }

    return NextResponse.json({
      success: true,
      data: rounds,
    });
  } catch (error: any) {
    console.error('Error fetching rounds:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/rounds
 * Create a new round
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication and authorization
    const auth = await verifyAuth(['admin', 'committee_admin']);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    let body;
    try {
      const text = await request.text();
      if (!text || text.trim() === '') {
        return NextResponse.json(
          { success: false, error: 'Request body is empty' },
          { status: 400 }
        );
      }
      body = JSON.parse(text);
    } catch (parseError) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const {
      season_id,
      position,
      max_bids_per_team,
      duration_hours,
    } = body;

    // Validate required fields
    if (!season_id || !position || !max_bids_per_team || !duration_hours) {
      return NextResponse.json(
        { success: false, error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Check if there's already an active round for this season
    const activeRound = await sql`
      SELECT id FROM rounds
      WHERE season_id = ${season_id}
      AND status = 'active'
      LIMIT 1
    `;

    if (activeRound.length > 0) {
      return NextResponse.json(
        { success: false, error: 'There is already an active round. Please complete it first.' },
        { status: 400 }
      );
    }

    // Calculate end time
    const now = new Date();
    const endTime = new Date(now.getTime() + (parseFloat(duration_hours) * 3600 * 1000));

    // Create the round
    const newRound = await sql`
      INSERT INTO rounds (
        season_id,
        position,
        max_bids_per_team,
        end_time,
        status,
        created_at,
        updated_at
      ) VALUES (
        ${season_id},
        ${position},
        ${max_bids_per_team},
        ${endTime.toISOString()},
        'active',
        NOW(),
        NOW()
      )
      RETURNING *
    `;

    return NextResponse.json({
      success: true,
      data: newRound[0],
      message: 'Round created successfully',
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error creating round:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
