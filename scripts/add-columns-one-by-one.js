const { neon } = require('@neondatabase/serverless');

const connectionString = process.env.FANTASY_DATABASE_URL || 'postgresql://neondb_owner:npg_K1IGoDtlkPA3@ep-silent-sun-a1hf5mn7-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

const sql = neon(connectionString);

async function addColumns() {
  console.log('🚀 Adding columns one by one...\n');

  const columns = [
    { name: 'max_transfers_per_window', type: 'INTEGER', default: '3' },
    { name: 'points_cost_per_transfer', type: 'INTEGER', default: '4' },
    { name: 'transfer_window_start', type: 'TIMESTAMP', default: null },
    { name: 'transfer_window_end', type: 'TIMESTAMP', default: null }
  ];

  for (const col of columns) {
    try {
      console.log(`📝 Adding column: ${col.name}...`);
      
      const alterSQL = col.default 
        ? `ALTER TABLE public.transfer_windows ADD COLUMN IF NOT EXISTS ${col.name} ${col.type} DEFAULT ${col.default}`
        : `ALTER TABLE public.transfer_windows ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`;
      
      console.log(`   SQL: ${alterSQL}`);
      
      await sql.unsafe(alterSQL);
      
      console.log(`   ✅ ${col.name} added successfully\n`);
    } catch (error) {
      console.error(`   ❌ Error adding ${col.name}:`, error.message);
    }
  }

  // Final verification
  console.log('📊 Final verification...\n');
  
  const result = await sql`
    SELECT column_name, data_type, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'transfer_windows'
    ORDER BY ordinal_position;
  `;

  console.log('📋 All columns in transfer_windows:\n');
  result.forEach(col => {
    console.log(`   ${col.column_name} (${col.data_type})${col.column_default ? ` DEFAULT ${col.column_default}` : ''}`);
  });

  const newCols = result.filter(col => 
    ['max_transfers_per_window', 'points_cost_per_transfer', 'transfer_window_start', 'transfer_window_end'].includes(col.column_name)
  );

  console.log(`\n✅ New columns found: ${newCols.length}/4`);
  
  if (newCols.length === 4) {
    console.log('\n🎉 Migration complete! All columns added successfully.');
  } else {
    console.log('\n⚠️  Some columns may not have been added.');
  }
}

addColumns();
