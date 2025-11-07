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
          `INSERT INTO auction_settings (season_id, max_rounds, min_balance_per_round, contract_duration, max_squad_size, phase_1_end_round, phase_1_min_balance, phase_2_end_round, phase_2_min_balance, phase_3_min_balance) 
           VALUES ($1, 25, 30, 2, 25, 18, 30, 20, 30, 10) 
           RETURNING *`,
          [seasonId]
        );
      }

      const settings = result.rows[0];

      // Get actual rounds data from database
      const roundsResult = await client.query(
        `SELECT 
          COUNT(*) as total_rounds,
          COUNT(*) FILTER (WHERE status = 'completed') as completed_rounds
         FROM rounds 
         WHERE season_id = $1`,
        [seasonId]
      );
      
      const totalRounds = parseInt(roundsResult.rows[0]?.total_rounds || '0');
      const completedRounds = parseInt(roundsResult.rows[0]?.completed_rounds || '0');
      const remainingRounds = settings.max_rounds - totalRounds;

      return NextResponse.json({
        success: true,
        data: {
          settings: {
            id: settings.id,
            season_id: settings.season_id,
            max_rounds: settings.max_rounds,
            min_balance_per_round: settings.min_balance_per_round,
            contract_duration: settings.contract_duration || 2,
            max_squad_size: settings.max_squad_size || 25,
            phase_1_end_round: settings.phase_1_end_round || 18,
            phase_1_min_balance: settings.phase_1_min_balance || 30,
            phase_2_end_round: settings.phase_2_end_round || 20,
            phase_2_min_balance: settings.phase_2_min_balance || 30,
            phase_3_min_balance: settings.phase_3_min_balance || 10,
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
    console.log('🔍 [Auction Settings POST] Received body:', body);
    const { 
      season_id = 'default', 
      max_rounds, 
      min_balance_per_round, 
      contract_duration = 2, 
      max_squad_size = 25,
      phase_1_end_round = 18,
      phase_1_min_balance = 30,
      phase_2_end_round = 20,
      phase_2_min_balance = 30,
      phase_3_min_balance = 10
    } = body;
    console.log('🔍 [Auction Settings POST] Extracted max_rounds:', max_rounds);

    if (!max_rounds || !min_balance_per_round || !max_squad_size) {
      return NextResponse.json(
        { success: false, error: 'max_rounds, min_balance_per_round, and max_squad_size are required' },
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
           SET max_rounds = $1, min_balance_per_round = $2, contract_duration = $3, max_squad_size = $4,
               phase_1_end_round = $5, phase_1_min_balance = $6, phase_2_end_round = $7, 
               phase_2_min_balance = $8, phase_3_min_balance = $9
           WHERE season_id = $10 
           RETURNING *`,
          [max_rounds, min_balance_per_round, contract_duration, max_squad_size, 
           phase_1_end_round, phase_1_min_balance, phase_2_end_round, phase_2_min_balance, phase_3_min_balance, season_id]
        );
      } else {
        // Insert new
        result = await client.query(
          `INSERT INTO auction_settings (season_id, max_rounds, min_balance_per_round, contract_duration, max_squad_size, phase_1_end_round, phase_1_min_balance, phase_2_end_round, phase_2_min_balance, phase_3_min_balance) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
           RETURNING *`,
          [season_id, max_rounds, min_balance_per_round, contract_duration, max_squad_size,
           phase_1_end_round, phase_1_min_balance, phase_2_end_round, phase_2_min_balance, phase_3_min_balance]
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
