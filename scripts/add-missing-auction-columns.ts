import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

async function addMissingColumns() {
  console.log('🔧 Adding missing columns to auction_settings...\n');

  try {
    // Add max_squad_size column
    console.log('1. Adding max_squad_size column...');
    await sql`
      ALTER TABLE auction_settings
      ADD COLUMN IF NOT EXISTS max_squad_size INTEGER DEFAULT 25
    `;
    
    await sql`
      UPDATE auction_settings
      SET max_squad_size = 25
      WHERE max_squad_size IS NULL
    `;
    console.log('✅ max_squad_size column added\n');

    // Verify phase columns exist (from previous migration)
    console.log('2. Verifying phase columns...');
    await sql`
      ALTER TABLE auction_settings
      ADD COLUMN IF NOT EXISTS phase_1_end_round INTEGER DEFAULT 18,
      ADD COLUMN IF NOT EXISTS phase_1_min_balance INTEGER DEFAULT 30,
      ADD COLUMN IF NOT EXISTS phase_2_end_round INTEGER DEFAULT 20,
      ADD COLUMN IF NOT EXISTS phase_2_min_balance INTEGER DEFAULT 30,
      ADD COLUMN IF NOT EXISTS phase_3_min_balance INTEGER DEFAULT 10
    `;
    console.log('✅ Phase columns verified\n');

    // Check final structure
    console.log('3. Checking table structure...');
    const columns = await sql`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'auction_settings'
      ORDER BY ordinal_position
    `;
    
    console.log('📋 auction_settings columns:');
    columns.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} (default: ${col.column_default || 'none'})`);
    });

    // Check current data
    console.log('\n4. Current auction_settings data:');
    const settings = await sql`SELECT * FROM auction_settings LIMIT 1`;
    if (settings.length > 0) {
      console.log('   Current settings:', {
        season_id: settings[0].season_id,
        max_rounds: settings[0].max_rounds,
        max_squad_size: settings[0].max_squad_size,
        phase_1_end_round: settings[0].phase_1_end_round,
        phase_2_end_round: settings[0].phase_2_end_round,
      });
    }

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

addMissingColumns()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
