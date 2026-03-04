const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

async function checkDependencies() {
  const sql = neon(process.env.NEON_AUCTION_DB_URL);
  
  console.log('🔍 Checking dependencies on teams primary key...\n');
  
  try {
    // Check foreign keys that reference teams
    console.log('1. Foreign keys referencing teams table:');
    const fks = await sql`
      SELECT
        tc.table_name as referencing_table,
        kcu.column_name as referencing_column,
        ccu.table_name AS referenced_table,
        ccu.column_name AS referenced_column,
        tc.constraint_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_name = 'teams'
      ORDER BY tc.table_name
    `;
    
    if (fks.length > 0) {
      console.log(`   Found ${fks.length} foreign key(s):\n`);
      fks.forEach(fk => {
        console.log(`   ⚠️  ${fk.referencing_table}.${fk.referencing_column}`);
        console.log(`      → teams.${fk.referenced_column}`);
        console.log(`      Constraint: ${fk.constraint_name}\n`);
      });
    } else {
      console.log('   ✅ No foreign keys found\n');
    }
    
    // Check all constraints on teams table
    console.log('2. All constraints on teams table:');
    const constraints = await sql`
      SELECT
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name
      FROM information_schema.table_constraints AS tc
      LEFT JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = 'teams'
      ORDER BY tc.constraint_type, tc.constraint_name
    `;
    
    console.log(`   Found ${constraints.length} constraint(s):\n`);
    constraints.forEach(c => {
      console.log(`   - ${c.constraint_type}: ${c.constraint_name}`);
      if (c.column_name) {
        console.log(`     Column: ${c.column_name}`);
      }
    });
    
    // Check indexes on teams table
    console.log('\n3. Indexes on teams table:');
    const indexes = await sql`
      SELECT
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename = 'teams'
      ORDER BY indexname
    `;
    
    console.log(`   Found ${indexes.length} index(es):\n`);
    indexes.forEach(idx => {
      console.log(`   - ${idx.indexname}`);
      console.log(`     ${idx.indexdef}\n`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkDependencies();
