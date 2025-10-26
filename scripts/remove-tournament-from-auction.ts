/**
 * Remove Tournament Tables from Auction DB
 * These should only be in Tournament DB
 */

import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const sql = neon(process.env.NEON_AUCTION_DB_URL || process.env.NEON_DATABASE_URL!);

async function removeTournamentTables() {
  console.log('🧹 Removing tournament tables from Auction DB...\n');
  
  try {
    const tournamentTables = [
      'fixture_audit_log',
      'fixtures',
      'match_days',
      'matchups',
      'team_players',
      'tournament_settings',
      'round_deadlines'
    ];
    
    for (const table of tournamentTables) {
      try {
        await sql.unsafe(`DROP TABLE IF EXISTS ${table} CASCADE`);
        console.log(`✅ Dropped: ${table}`);
      } catch (error) {
        console.log(`⚠️  ${table}: ${error.message}`);
      }
    }
    
    console.log('\n📋 Remaining tables in Auction DB:\n');
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;
    
    tables.forEach((table, index) => {
      console.log(`${index + 1}. ${table.table_name}`);
    });
    
    console.log(`\n✅ Done! Auction DB now has ${tables.length} tables (auction-only)`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

removeTournamentTables();
