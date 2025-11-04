import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

if (!process.env.FANTASY_DATABASE_URL) {
  console.error('❌ FANTASY_DATABASE_URL not found in environment variables');
  process.exit(1);
}

const sql = neon(process.env.FANTASY_DATABASE_URL!);

async function runMigration() {
  try {
    console.log('🚀 Starting migration: Add season_id to round_bids and round_players');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '../database/migrations/add-season-id-to-round-bids.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    // Run the migration
    console.log('📝 Running migration...\n');
    await sql.unsafe(migrationSQL);
    
    console.log('\n✅ Migration completed successfully!');
    console.log('\n📊 Verifying changes...');
    
    // Verify round_bids
    const roundBidsColumns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'round_bids'
      ORDER BY ordinal_position
    `;
    
    console.log('\n✅ round_bids columns:');
    console.table(roundBidsColumns);
    
    // Verify round_players
    const roundPlayersColumns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'round_players'
      ORDER BY ordinal_position
    `;
    
    console.log('\n✅ round_players columns:');
    console.table(roundPlayersColumns);
    
    // Check if data was backfilled
    const roundBidsWithSeason = await sql`
      SELECT COUNT(*) as total, COUNT(season_id) as with_season_id
      FROM round_bids
    `;
    
    console.log('\n📊 round_bids data:');
    console.log(`   Total rows: ${roundBidsWithSeason[0].total}`);
    console.log(`   With season_id: ${roundBidsWithSeason[0].with_season_id}`);
    
    const roundPlayersWithSeason = await sql`
      SELECT COUNT(*) as total, COUNT(season_id) as with_season_id
      FROM round_players
    `;
    
    console.log('\n📊 round_players data:');
    console.log(`   Total rows: ${roundPlayersWithSeason[0].total}`);
    console.log(`   With season_id: ${roundPlayersWithSeason[0].with_season_id}`);
    
    console.log('\n🎉 All done!');
    
  } catch (error) {
    console.error('❌ Error running migration:', error);
    process.exit(1);
  }
}

runMigration();
