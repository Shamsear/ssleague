import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get('league_id');

    if (!leagueId) {
      return NextResponse.json({ error: 'League ID is required' }, { status: 400 });
    }

    // Get all tiers with their status and bid counts
    const tiers = await sql`
      SELECT 
        fdt.tier_id,
        fdt.tier_number,
        fdt.tier_name,
        fdt.tier_status,
        fdt.opened_at,
        fdt.closed_at,
        COUNT(DISTINCT fdrp.player_id) as player_count,
        COUNT(fdb.bid_id) as total_bids
      FROM fantasy_draft_tiers fdt
      LEFT JOIN fantasy_draft_real_players fdrp ON fdt.tier_id = fdrp.tier_id
      LEFT JOIN fantasy_draft_bids fdb ON fdrp.player_id = fdb.player_id AND fdb.league_id = ${leagueId}
      WHERE fdt.league_id = ${leagueId}
      GROUP BY fdt.tier_id, fdt.tier_number, fdt.tier_name, fdt.tier_status, fdt.opened_at, fdt.closed_at
      ORDER BY fdt.tier_number ASC
    `;

    return NextResponse.json({ tiers });
  } catch (error) {
    console.error('Error fetching tier status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tier status' },
      { status: 500 }
    );
  }
}
