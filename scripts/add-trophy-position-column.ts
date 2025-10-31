// Load environment variables BEFORE any other imports
import { config } from 'dotenv';
import * as path from 'path';
config({ path: path.resolve(__dirname, '..', '.env.local') });

// Now import after env is loaded
import { getTournamentDb } from '../lib/neon/tournament-config';
import * as fs from 'fs';

async function runMigration() {
  console.log('🚀 Starting trophy_position column migration...\n');
  
  try {
    const sql = getTournamentDb();
    
    // Read the SQL migration file
    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', 'add-trophy-position-column.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    console.log('📄 Migration SQL:');
    console.log(migrationSQL);
    console.log('\n🔧 Executing migration...\n');
    
    // Execute the entire migration as raw SQL
    await sql.unsafe(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    console.log('\n📊 Verifying schema...');
    
    // Verify the new column exists
    const columns = await sql`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'team_trophies'
      ORDER BY ordinal_position
    `;
    
    console.log('\nCurrent team_trophies schema:');
    columns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
