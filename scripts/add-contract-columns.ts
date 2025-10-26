/**
 * Add contract-related columns to player_seasons table
 * Run with: npx tsx scripts/add-contract-columns.ts
 */

import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function addContractColumns() {
  const dbUrl = process.env.NEON_TOURNAMENT_DB_URL;
  
  if (!dbUrl) {
    console.error('❌ NEON_TOURNAMENT_DB_URL not found in environment variables');
    console.error('Make sure .env.local exists and contains NEON_TOURNAMENT_DB_URL');
    process.exit(1);
  }

  const sql = neon(dbUrl);

  try {
    console.log('🔄 Adding contract columns to player_seasons table...');

    // Add columns
    await sql`
      ALTER TABLE player_seasons
      ADD COLUMN IF NOT EXISTS auction_value INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS salary_per_match DECIMAL(10, 2) DEFAULT 0.00,
      ADD COLUMN IF NOT EXISTS contract_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS contract_start_season VARCHAR(50),
      ADD COLUMN IF NOT EXISTS contract_end_season VARCHAR(50),
      ADD COLUMN IF NOT EXISTS contract_length INTEGER DEFAULT 1
    `;
    console.log('✅ Columns added successfully');

    // Add indexes
    console.log('🔄 Adding indexes...');
    await sql`CREATE INDEX IF NOT EXISTS idx_player_seasons_contract_id ON player_seasons(contract_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_player_seasons_contract_season ON player_seasons(contract_start_season, contract_end_season)`;
    console.log('✅ Indexes created successfully');

    // Verify
    console.log('🔍 Verifying columns...');
    const columns = await sql`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'player_seasons'
      AND column_name IN ('auction_value', 'salary_per_match', 'contract_id', 'contract_start_season', 'contract_end_season', 'contract_length')
      ORDER BY column_name
    `;

    console.log('\n📋 Contract columns in player_seasons table:');
    console.table(columns);

    console.log('\n✅ Migration complete!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

addContractColumns()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
