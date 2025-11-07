import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { verifyAuth } from '@/lib/auth-helper';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

/**
 * POST /api/admin/bulk-tiebreakers/:id/start
 * Start a tiebreaker auction (Last Person Standing)
 * Committee admin only
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ✅ ZERO FIREBASE READS - Uses JWT claims only
    const auth = await verifyAuth(['admin', 'committee_admin'], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: tiebreakerId } = await params;

    console.log(`🎯 Starting tiebreaker ${tiebreakerId}`);

    // Get tiebreaker details
    const tiebreakerCheck = await sql`
      SELECT 
        id, 
        player_name, 
        position, 
        status, 
        teams_remaining,
        base_price
      FROM bulk_tiebreakers
      WHERE id = ${tiebreakerId}
    `;

    if (tiebreakerCheck.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tiebreaker not found' },
        { status: 404 }
      );
    }

    const tiebreaker = tiebreakerCheck[0];

    if (tiebreaker.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: `Cannot start tiebreaker. Current status: ${tiebreaker.status}` },
        { status: 400 }
      );
    }

    // Check if teams are still active
    const activeTeams = await sql`
      SELECT COUNT(*) as count
      FROM bulk_tiebreaker_teams
      WHERE tiebreaker_id = ${tiebreakerId}
      AND status = 'active'
    `;

    const teamsCount = parseInt(activeTeams[0].count);

    if (teamsCount < 2) {
      return NextResponse.json(
        { success: false, error: `Cannot start tiebreaker with less than 2 teams. Current: ${teamsCount}` },
        { status: 400 }
      );
    }

    // Start the tiebreaker
    const startTime = new Date();
    const maxEndTime = new Date(startTime.getTime() + 24 * 60 * 60 * 1000); // 24 hours max

    await sql`
      UPDATE bulk_tiebreakers
      SET 
        status = 'active',
        start_time = ${startTime.toISOString()},
        last_activity_time = ${startTime.toISOString()},
        max_end_time = ${maxEndTime.toISOString()},
        updated_at = NOW()
      WHERE id = ${tiebreakerId}
    `;

    console.log(`✅ Tiebreaker started for player: ${tiebreaker.player_name}`);
    console.log(`⏰ Start: ${startTime.toISOString()}`);
    console.log(`⏰ Max End (24h): ${maxEndTime.toISOString()}`);
    console.log(`👥 Teams: ${teamsCount}`);

    // Get participating teams
    const teams = await sql`
      SELECT team_id, team_name, current_bid
      FROM bulk_tiebreaker_teams
      WHERE tiebreaker_id = ${tiebreakerId}
      AND status = 'active'
      ORDER BY team_name
    `;

    // TODO: Send notifications via WebSocket and email
    // - Notify all participating teams
    // - Broadcast tiebreaker started event

    return NextResponse.json({
      success: true,
      data: {
        tiebreaker_id: tiebreakerId,
        player_name: tiebreaker.player_name,
        position: tiebreaker.position,
        status: 'active',
        start_time: startTime.toISOString(),
        max_end_time: maxEndTime.toISOString(),
        base_price: tiebreaker.base_price,
        teams_count: teamsCount,
        teams: teams,
        message: `Tiebreaker started for ${tiebreaker.player_name}. ${teamsCount} teams competing. Last person standing wins!`,
      },
    });

  } catch (error: any) {
    console.error('❌ Error starting tiebreaker:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
