/**
 * Run polls system database migration
 * Run with: npx tsx scripts/run-polls-migration.ts
 */

import { getTournamentDb } from '../lib/neon/tournament-config';
import fs from 'fs';
import path from 'path';

async function runMigration() {
  console.log('🚀 Running polls system migration...\n');
  
  try {
    const sql = getTournamentDb();
    
    // Read the migration SQL file
    const migrationPath = path.join(process.cwd(), 'database', 'migrations', 'create-polls-system.sql');
    
    if (!fs.existsSync(migrationPath)) {
      console.error('❌ Migration file not found:', migrationPath);
      process.exit(1);
    }
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    console.log('📄 Migration file loaded');
    console.log('📦 Executing SQL statements...\n');
    
    // Split by semicolon but keep multi-line statements intact
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.match(/^\s*(--|COMMENT)/));
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip comments and empty statements
      if (!statement || statement.startsWith('--') || statement.startsWith('COMMENT')) {
        continue;
      }
      
      try {
        // Determine what type of statement this is
        const stmtType = statement.substring(0, 50).toUpperCase();
        
        if (stmtType.includes('CREATE TABLE')) {
          const tableName = statement.match(/CREATE TABLE.*?(\w+)\s*\(/i)?.[1];
          process.stdout.write(`   Creating table ${tableName}... `);
        } else if (stmtType.includes('ALTER TABLE')) {
          const tableName = statement.match(/ALTER TABLE\s+(\w+)/i)?.[1];
          process.stdout.write(`   Altering table ${tableName}... `);
        } else if (stmtType.includes('CREATE INDEX')) {
          const indexName = statement.match(/CREATE INDEX.*?(\w+)\s+ON/i)?.[1];
          process.stdout.write(`   Creating index ${indexName}... `);
        } else if (stmtType.includes('SELECT')) {
          // Skip SELECT statements (verification queries)
          continue;
        } else {
          process.stdout.write(`   Executing statement ${i + 1}... `);
        }
        
        await sql.unsafe(statement + ';');
        console.log('✅');
        successCount++;
      } catch (error: any) {
        // Ignore "already exists" errors
        if (error.message?.includes('already exists')) {
          console.log('⚠️  (already exists)');
          successCount++;
        } else {
          console.log('❌');
          console.error(`      Error: ${error.message}`);
          errorCount++;
        }
      }
    }
    
    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}\n`);
    
    if (errorCount === 0) {
      console.log('🎉 Migration completed successfully!\n');
      
      // Verify the tables
      console.log('🔍 Verifying tables...\n');
      
      const tables = await sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name IN ('polls', 'poll_votes', 'poll_results')
        ORDER BY table_name;
      `;
      
      console.log('📊 Polls Tables:');
      tables.forEach((row: any) => {
        console.log(`   ✅ ${row.table_name}`);
      });
      
      const newsColumns = await sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'news' 
          AND column_name IN ('language', 'tone', 'reporter_name', 'has_poll', 'poll_id')
        ORDER BY column_name;
      `;
      
      console.log('\n📰 News Table - New Columns:');
      newsColumns.forEach((row: any) => {
        console.log(`   ✅ ${row.column_name}`);
      });
      
      console.log('\n✅ Database is ready for bilingual news and polls!\n');
    } else {
      console.log('⚠️  Migration completed with some errors. Please review.\n');
    }
    
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

runMigration();
