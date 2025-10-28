import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

/**
 * POST /api/admin/migrate-registration-type
 * Run database migration to add registration_type column to player_seasons
 */
export async function POST(request: NextRequest) {
  try {
    const sql = getTournamentDb();

    console.log('🔄 Starting registration_type migration...');

    // Add registration_type column (default to 'confirmed' for existing records)
    await sql`
      ALTER TABLE player_seasons 
      ADD COLUMN IF NOT EXISTS registration_type VARCHAR(20) DEFAULT 'confirmed'
    `;
    console.log('✅ Added registration_type column');

    // Update existing NULL values to 'confirmed'
    const updateResult = await sql`
      UPDATE player_seasons 
      SET registration_type = 'confirmed' 
      WHERE registration_type IS NULL
    `;
    console.log(`✅ Updated ${updateResult.length} rows with NULL registration_type`);

    // Create index for faster queries filtering by registration_type
    await sql`
      CREATE INDEX IF NOT EXISTS idx_player_seasons_registration_type 
      ON player_seasons(registration_type)
    `;
    console.log('✅ Created registration_type index');

    // Create composite index for season + registration_type queries
    await sql`
      CREATE INDEX IF NOT EXISTS idx_player_seasons_season_reg_type 
      ON player_seasons(season_id, registration_type)
    `;
    console.log('✅ Created composite index');

    // Verify the migration
    const stats = await sql`
      SELECT 
        COUNT(*) as total_records,
        COUNT(CASE WHEN registration_type = 'confirmed' THEN 1 END) as confirmed_count,
        COUNT(CASE WHEN registration_type = 'unconfirmed' THEN 1 END) as unconfirmed_count
      FROM player_seasons
    `;

    const verification = stats[0];
    console.log('📊 Migration verification:', verification);

    return NextResponse.json({
      success: true,
      message: 'Database migration completed successfully',
      stats: {
        total_records: Number(verification.total_records),
        confirmed_count: Number(verification.confirmed_count),
        unconfirmed_count: Number(verification.unconfirmed_count),
      },
    });
  } catch (error: any) {
    console.error('❌ Migration error:', error);
    
    // Check if error is because column already exists
    if (error.message?.includes('already exists')) {
      return NextResponse.json({
        success: true,
        message: 'Migration already applied - registration_type column exists',
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to run migration',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/migrate-registration-type
 * Check migration status
 */
export async function GET(request: NextRequest) {
  try {
    const sql = getTournamentDb();

    // Check if column exists
    const columnCheck = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'player_seasons' 
        AND column_name = 'registration_type'
    `;

    if (columnCheck.length === 0) {
      return NextResponse.json({
        success: true,
        migrated: false,
        message: 'Migration not yet applied - registration_type column does not exist',
      });
    }

    // Get stats
    const stats = await sql`
      SELECT 
        COUNT(*) as total_records,
        COUNT(CASE WHEN registration_type = 'confirmed' THEN 1 END) as confirmed_count,
        COUNT(CASE WHEN registration_type = 'unconfirmed' THEN 1 END) as unconfirmed_count
      FROM player_seasons
    `;

    const verification = stats[0];

    return NextResponse.json({
      success: true,
      migrated: true,
      message: 'Migration already applied',
      stats: {
        total_records: Number(verification.total_records),
        confirmed_count: Number(verification.confirmed_count),
        unconfirmed_count: Number(verification.unconfirmed_count),
      },
    });
  } catch (error: any) {
    console.error('❌ Error checking migration status:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to check migration status',
      },
      { status: 500 }
    );
  }
}
