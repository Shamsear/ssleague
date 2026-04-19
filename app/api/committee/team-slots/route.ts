import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { verifyAuth } from '@/lib/auth-helper';

const sql = neon(process.env.NEON_AUCTION_DB_URL || process.env.NEON_DATABASE_URL!);

/**
 * POST /api/committee/team-slots
 * Get team player counts from Neon database
 * Committee admin only
 */
export async function POST(request: NextRequest) {
  try {
    // Verify committee admin auth
    const auth = await verifyAuth(['committee_admin'], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { season_id } = body;

    if (!season_id) {
      return NextResponse.json(
        { success: false, error: 'Season ID is required' },
        { status: 400 }
      );
    }

    // Get all teams for this season with their player counts
    const teams = await sql`
      SELECT 
        id,
        name,
        football_players_count,
        football_base_slots,
        football_purchased_slots,
        football_total_slots
      FROM teams
      WHERE season_id = ${season_id}
      ORDER BY name
    `;

    return NextResponse.json({
      success: true,
      teams: teams.map(t => ({
        id: t.id,
        name: t.name,
        football_players_count: parseInt(t.football_players_count) || 0,
        football_base_slots: parseInt(t.football_base_slots) || 25,
        football_purchased_slots: parseInt(t.football_purchased_slots) || 0,
        football_total_slots: parseInt(t.football_total_slots) || 25,
      }))
    });

  } catch (error) {
    console.error('Error fetching team slots:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch team data' },
      { status: 500 }
    );
  }
}
