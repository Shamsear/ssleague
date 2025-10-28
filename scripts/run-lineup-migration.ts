import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { neon } from '@neondatabase/serverless';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function runMigration() {
  try {
    const tournamentDbUrl = process.env.NEON_TOURNAMENT_DB_URL;
    
    if (!tournamentDbUrl) {
      console.error('❌ NEON_TOURNAMENT_DB_URL not found in environment');
      process.exit(1);
    }
    
    console.log('🔄 Running lineup system migration...\n');
    
    const sql = neon(tournamentDbUrl);
    
    // Read migration file
    const migrationPath = path.join(process.cwd(), 'database', 'migrations', 'create-lineup-system.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    // Execute migration
    await sql.unsafe(migrationSQL);
    
    console.log('✅ Migration completed successfully!\n');
    
    // Verify tables
    console.log('🔍 Verifying tables...\n');
    
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('lineups', 'lineup_substitutions')
      ORDER BY table_name
    `;
    
    console.log('Created tables:');
    tables.forEach(t => console.log(`  ✓ ${t.table_name}`));
    
    // Check realplayerstats columns
    const columns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'realplayerstats' 
      AND column_name IN ('participation_type', 'match_played', 'lineup_id')
      ORDER BY column_name
    `;
    
    console.log('\nAdded columns to realplayerstats:');
    columns.forEach(c => console.log(`  ✓ ${c.column_name}`));
    
    console.log('\n🎉 Lineup system database migration complete!');
    
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    if (error.detail) console.error('Detail:', error.detail);
    process.exit(1);
  }
}

runMigration();
