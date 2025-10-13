/**
 * Database Table Audit Script
 * Checks all tables in your Neon database and reports structure
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkDatabase() {
  const sql = neon(process.env.NEON_DATABASE_URL || process.env.DATABASE_URL);

  console.log('🔍 Checking Neon Database Tables...\n');
  console.log('='.repeat(80));

  try {
    // 1. List all tables
    console.log('\n📋 ALL TABLES IN DATABASE:\n');
    const tables = await sql`
      SELECT table_name, table_type
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;

    if (tables.length === 0) {
      console.log('❌ No tables found!');
      return;
    }

    tables.forEach((table, index) => {
      console.log(`${index + 1}. ${table.table_name} (${table.table_type})`);
    });

    // 2. Check for rounds-related tables specifically
    console.log('\n' + '='.repeat(80));
    console.log('\n🎯 ROUNDS-RELATED TABLES:\n');
    
    const roundsTables = tables.filter(t => 
      t.table_name.includes('round') || 
      t.table_name.includes('bid')
    );

    for (const table of roundsTables) {
      console.log(`\n📊 Table: ${table.table_name.toUpperCase()}`);
      console.log('-'.repeat(40));

      // Get column information
      const columns = await sql`
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_name = ${table.table_name}
        ORDER BY ordinal_position;
      `;

      console.log('  Columns:');
      columns.forEach(col => {
        const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
        console.log(`    - ${col.column_name} (${col.data_type}) ${nullable}${defaultVal}`);
      });

      // Get row count
      try {
        const count = await sql.unsafe(`SELECT COUNT(*) as count FROM ${table.table_name}`);
        console.log(`  Row count: ${count[0]?.count || 0}`);
      } catch (err) {
        console.log(`  Row count: Error - ${err.message}`);
      }
    }

    // 3. Check for specific problematic tables
    console.log('\n' + '='.repeat(80));
    console.log('\n⚠️  CHECKING FOR DUPLICATE/PROBLEMATIC TABLES:\n');

    const checkTables = ['rounds', 'round', 'auction_rounds', 'round_players'];
    
    for (const tableName of checkTables) {
      const exists = tables.find(t => t.table_name === tableName);
      if (exists) {
        console.log(`✅ ${tableName} - EXISTS`);
        
        // Get primary key info
        const pk = await sql`
          SELECT 
            kcu.column_name,
            c.data_type
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
          JOIN information_schema.columns c
            ON kcu.column_name = c.column_name
            AND kcu.table_name = c.table_name
          WHERE tc.constraint_type = 'PRIMARY KEY'
            AND tc.table_name = ${tableName};
        `;
        
        if (pk.length > 0) {
          console.log(`   Primary Key: ${pk[0].column_name} (${pk[0].data_type})`);
        }
      } else {
        console.log(`❌ ${tableName} - DOES NOT EXIST`);
      }
    }

    // 4. Check foreign key relationships
    console.log('\n' + '='.repeat(80));
    console.log('\n🔗 FOREIGN KEY RELATIONSHIPS:\n');

    const fks = await sql`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND (tc.table_name LIKE '%round%' OR tc.table_name LIKE '%bid%')
      ORDER BY tc.table_name;
    `;

    if (fks.length === 0) {
      console.log('No foreign keys found for rounds/bids tables.');
    } else {
      fks.forEach(fk => {
        console.log(`${fk.table_name}.${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`);
      });
    }

    // 5. Summary and Recommendations
    console.log('\n' + '='.repeat(80));
    console.log('\n📝 SUMMARY & RECOMMENDATIONS:\n');

    const hasRounds = tables.find(t => t.table_name === 'rounds');
    const hasRound = tables.find(t => t.table_name === 'round');
    const hasAuctionRounds = tables.find(t => t.table_name === 'auction_rounds');

    if (hasRounds && hasRound) {
      console.log('⚠️  WARNING: Both "rounds" and "round" tables exist!');
      console.log('   Recommendation: Drop "round" table if it\'s not being used.');
    }

    if (hasRounds && hasAuctionRounds) {
      console.log('⚠️  WARNING: Both "rounds" and "auction_rounds" tables exist!');
      console.log('   Recommendation: Migrate to unified "rounds" table and drop "auction_rounds".');
    }

    if (hasRound && !hasRounds) {
      console.log('⚠️  WARNING: Only "round" table exists (should be "rounds")!');
      console.log('   Recommendation: Rename "round" to "rounds" or create "rounds" table.');
    }

    if (hasRounds && !hasRound && !hasAuctionRounds) {
      console.log('✅ GOOD: Only "rounds" table exists (correct setup).');
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Database audit complete!\n');

  } catch (error) {
    console.error('\n❌ Error checking database:', error);
    console.error('\nMake sure your DATABASE_URL or NEON_DATABASE_URL is set in .env.local');
  }
}

// Run the audit
checkDatabase();
