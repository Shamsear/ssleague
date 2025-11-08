import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

/**
 * GET /api/auction-settings/all
 * Fetch all auction settings for a season
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('season_id');

    if (!seasonId) {
      return NextResponse.json(
        { success: false, error: 'season_id is required' },
        { status: 400 }
      );
    }

    const settings = await sql`
      SELECT 
        id,
        season_id,
        auction_window,
        max_rounds,
        min_balance_per_round,
        contract_duration,
        max_squad_size,
        phase_1_end_round,
        phase_1_min_balance,
        phase_2_end_round,
        phase_2_min_balance,
        phase_3_min_balance,
        created_at,
        updated_at
      FROM auction_settings
      WHERE season_id = ${seasonId}
      ORDER BY 
        CASE auction_window
          WHEN 'season_start' THEN 1
          WHEN 'transfer_window' THEN 2
          WHEN 'mid_season' THEN 3
          WHEN 'winter_window' THEN 4
          WHEN 'summer_window' THEN 5
          ELSE 6
        END
    `;

    return NextResponse.json({
      success: true,
      data: settings,
    });
  } catch (error: any) {
    console.error('❌ Error fetching auction settings:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
