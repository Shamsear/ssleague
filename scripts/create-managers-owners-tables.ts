import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Use tournament database
const connectionString = process.env.NEON_TOURNAMENT_DB_URL;

if (!connectionString) {
  console.error('❌ NEON_TOURNAMENT_DB_URL environment variable is not set.');
  process.exit(1);
}

const sql = neon(connectionString);

async function runMigration() {
  try {
    console.log('🚀 Starting managers and owners tables migration...');
    
    // Read the SQL migration file
    const migrationPath = path.join(process.cwd(), 'database', 'migrations', 'create-managers-owners-tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    // Execute the migration
    console.log('📝 Creating tables...');
    
    // Split SQL into individual statements and execute them
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (const statement of statements) {
      if (statement.trim()) {
        await sql([statement] as any);
      }
    }
    
    console.log('✅ Migration completed successfully!');
    console.log('');
    console.log('Created tables:');
    console.log('  - managers');
    console.log('  - owners');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Remove manager_name field from team registration');
    console.log('  2. Add owner registration flow');
    console.log('  3. Add manager selection flow (after players assigned)');
    console.log('  4. Update team dashboard to show manager and owner info');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
