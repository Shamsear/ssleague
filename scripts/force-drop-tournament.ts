import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const sql = neon(process.env.NEON_AUCTION_DB_URL!);

async function forceDrop() {
  console.log('🔨 Force dropping tournament tables...\n');
  
  try {
    // Drop in correct order (child tables first)
    console.log('Dropping fixture_audit_log...');
    await sql`DROP TABLE IF EXISTS fixture_audit_log CASCADE`;
    
    console.log('Dropping team_players...');
    await sql`DROP TABLE IF EXISTS team_players CASCADE`;
    
    console.log('Dropping matchups...');
    await sql`DROP TABLE IF EXISTS matchups CASCADE`;
    
    console.log('Dropping match_days...');
    await sql`DROP TABLE IF EXISTS match_days CASCADE`;
    
    console.log('Dropping fixtures...');
    await sql`DROP TABLE IF EXISTS fixtures CASCADE`;
    
    console.log('Dropping tournament_settings...');
    await sql`DROP TABLE IF EXISTS tournament_settings CASCADE`;
    
    console.log('\n✅ All tournament tables dropped!\n');
    
    // List remaining tables
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;
    
    console.log('📋 Remaining tables:');
    tables.forEach((table, index) => {
      console.log(`${index + 1}. ${table.table_name}`);
    });
    
    console.log(`\nTotal: ${tables.length} tables (should be 12 auction tables)`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

forceDrop();
