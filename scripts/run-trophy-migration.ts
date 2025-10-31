/**
 * Run team_trophies table migration
 * Usage: npx tsx scripts/run-trophy-migration.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { neon } from '@neondatabase/serverless';

// Load environment variables FIRST
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function runMigration() {
  console.log('🏆 Running team_trophies table migration...\n');

  try {
    // Get connection string directly
    const connectionString = process.env.NEON_TOURNAMENT_DB_URL;
    
    if (!connectionString) {
      throw new Error('NEON_TOURNAMENT_DB_URL not found in environment');
    }
    
    const sql = neon(connectionString);
    
    // Read SQL file
    const sqlFile = path.join(process.cwd(), 'database/migrations/create-team-trophies-table.sql');
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');
    
    // Split by semicolons and execute each statement
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`📋 Executing ${statements.length} SQL statements...\n`);
    
    for (const statement of statements) {
      if (statement.includes('CREATE TABLE')) {
        console.log('✅ Creating team_trophies table...');
      } else if (statement.includes('CREATE INDEX')) {
        console.log('✅ Creating index...');
      } else if (statement.includes('COMMENT')) {
        console.log('✅ Adding table comments...');
      }
      
      try {
        await sql.unsafe(statement);
      } catch (error: any) {
        // Ignore "already exists" errors
        if (error.message?.includes('already exists')) {
          console.log('ℹ️  Already exists, skipping...');
        } else {
          throw error;
        }
      }
    }
    
    console.log('\n🎉 Migration completed successfully!\n');
    
    // Verify table exists
    const result = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'team_trophies'
    `;
    
    if (result.length > 0) {
      console.log('✅ Verified: team_trophies table exists\n');
      
      // Show table structure
      const columns = await sql`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'team_trophies'
        ORDER BY ordinal_position
      `;
      
      console.log('📊 Table structure:');
      columns.forEach((col: any) => {
        console.log(`   - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
      });
      
      console.log('\n✅ Migration successful!');
    }
    
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  }
}

runMigration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
