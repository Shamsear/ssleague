/**
 * Add season_id column to round_players table
 * Usage: npx tsx scripts/add-season-id-to-round-players.ts
 */

import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

async function addSeasonIdColumn() {
  console.log('🔧 Adding season_id column to round_players table...\n');
  console.log('='.repeat(80));
  
  try {
    // Add season_id column
    console.log('1️⃣ Adding season_id column...');
    await sql`
      ALTER TABLE round_players 
      ADD COLUMN IF NOT EXISTS season_id VARCHAR(255)
    `;
    console.log('✅ Column added\n');

    // Create index
    console.log('2️⃣ Creating index on season_id...');
    await sql`
      CREATE INDEX IF NOT EXISTS idx_round_players_season_id ON round_players(season_id)
    `;
    console.log('✅ Index created\n');

    // Backfill existing data
    console.log('3️⃣ Backfilling season_id from rounds table...');
    const result = await sql`
      UPDATE round_players rp
      SET season_id = r.season_id
      FROM rounds r
      WHERE rp.round_id = r.id
      AND rp.season_id IS NULL
    `;
    console.log(`✅ Updated ${result.count || 0} existing records\n`);

    // Verify the changes
    console.log('4️⃣ Verifying changes...');
    const stats = await sql`
      SELECT 
        COUNT(*) as total_records,
        COUNT(season_id) as records_with_season_id,
        COUNT(*) - COUNT(season_id) as records_without_season_id
      FROM round_players
    `;
    
    console.log('📊 Statistics:');
    console.log(`   Total records: ${stats[0].total_records}`);
    console.log(`   With season_id: ${stats[0].records_with_season_id}`);
    console.log(`   Without season_id: ${stats[0].records_without_season_id}`);
    
    if (parseInt(stats[0].records_without_season_id) > 0) {
      console.log('\n⚠️  Warning: Some records still missing season_id');
      console.log('   This might be due to orphaned records with invalid round_id');
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Migration completed successfully!\n');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

addSeasonIdColumn();
