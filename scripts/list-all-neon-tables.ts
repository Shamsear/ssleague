import * as dotenv from 'dotenv';
import * as path from 'path';
import { neon } from '@neondatabase/serverless';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function listTablesInDatabase(url: string | undefined, dbName: string) {
  if (!url) {
    console.log(`\n⚠️  ${dbName}: Not configured\n`);
    return;
  }

  console.log(`\n${dbName}`);
  console.log('=' .repeat(60));

  const sql = neon(url);

  try {
    // List all tables
    const tables = await sql`
      SELECT 
        table_name,
        (SELECT COUNT(*) FROM information_schema.columns 
         WHERE table_schema = 'public' AND table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;

    if (tables.length === 0) {
      console.log('No tables found');
      console.log('=' .repeat(60));
      return;
    }

    console.log(`\nFound ${tables.length} tables:\n`);

    let totalRows = 0;

    for (const table of tables) {
      try {
        const countResult = await sql.unsafe(`SELECT COUNT(*) as count FROM "${table.table_name}"`);
        const count = parseInt(countResult[0]?.count || '0');
        
        if (count > 0) {
          console.log(`${table.table_name}: ${count} rows (${table.column_count} columns)`);
          totalRows += count;
        } else {
          console.log(`${table.table_name}: 0 rows (${table.column_count} columns)`);
        }
      } catch (error: any) {
        console.log(`${table.table_name}: Error reading - ${error.message}`);
      }
    }

    console.log('\n' + '=' .repeat(60));
    console.log(`📊 Total tables: ${tables.length}`);
    console.log(`📊 Total rows: ${totalRows}`);
    console.log('=' .repeat(60));

  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    console.log('=' .repeat(60));
  }
}

async function main() {
  console.log('\n🔍 LISTING ALL NEON DATABASE TABLES\n');

  // Check all three Neon databases
  await listTablesInDatabase(
    process.env.NEON_DATABASE_URL || process.env.NEON_AUCTION_DB_URL,
    '🎯 NEON AUCTION DB'
  );

  await listTablesInDatabase(
    process.env.NEON_TOURNAMENT_DB_URL,
    '⚽ NEON TOURNAMENT DB'
  );

  await listTablesInDatabase(
    process.env.FANTASY_DATABASE_URL,
    '🏆 NEON FANTASY DB'
  );

  console.log('\n✅ Done\n');
}

main().catch(console.error);
