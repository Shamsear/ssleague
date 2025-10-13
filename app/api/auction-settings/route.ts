import { NextRequest, NextResponse } from 'next/server';
import { Pool } from '@neondatabase/serverless';

const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL });

// GET - Fetch auction settings
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('season_id') || 'default';

    const client = await pool.connect();
    
    try {
      // Get settings
      let result = await client.query(
        'SELECT * FROM auction_settings WHERE season_id = $1 LIMIT 1',
        [seasonId]
      );

      // If no settings found, create default
      if (result.rows.length === 0) {
        result = await client.query(
          `INSERT INTO auction_settings (season_id, max_rounds, min_balance_per_round) 
           VALUES ($1, 25, 30) 
           RETURNING *`,
          [seasonId]
        );
      }

      const settings = result.rows[0];

      // TODO: Get rounds data from Firestore or another source
      // For now, return placeholder values
      const totalRounds = 0;
      const completedRounds = 0;
      const remainingRounds = settings.max_rounds - totalRounds;

      return NextResponse.json({
        success: true,
        data: {
          settings: {
            id: settings.id,
            season_id: settings.season_id,
            max_rounds: settings.max_rounds,
            min_balance_per_round: settings.min_balance_per_round,
            created_at: settings.created_at,
            updated_at: settings.updated_at,
          },
          stats: {
            total_rounds: totalRounds,
            completed_rounds: completedRounds,
            remaining_rounds: remainingRounds,
          }
        }
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('❌ Error fetching auction settings:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST - Update auction settings
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { season_id = 'default', max_rounds, min_balance_per_round } = body;

    if (!max_rounds || !min_balance_per_round) {
      return NextResponse.json(
        { success: false, error: 'max_rounds and min_balance_per_round are required' },
        { status: 400 }
      );
    }

    const client = await pool.connect();

    try {
      // Check if settings exist
      const checkResult = await client.query(
        'SELECT id FROM auction_settings WHERE season_id = $1',
        [season_id]
      );

      let result;
      if (checkResult.rows.length > 0) {
        // Update existing
        result = await client.query(
          `UPDATE auction_settings 
           SET max_rounds = $1, min_balance_per_round = $2 
           WHERE season_id = $3 
           RETURNING *`,
          [max_rounds, min_balance_per_round, season_id]
        );
      } else {
        // Insert new
        result = await client.query(
          `INSERT INTO auction_settings (season_id, max_rounds, min_balance_per_round) 
           VALUES ($1, $2, $3) 
           RETURNING *`,
          [season_id, max_rounds, min_balance_per_round]
        );
      }

      console.log(`✅ Updated auction settings for season ${season_id}`);

      return NextResponse.json({
        success: true,
        data: result.rows[0]
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('❌ Error updating auction settings:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
