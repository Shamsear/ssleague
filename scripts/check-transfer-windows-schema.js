const { neon } = require('@neondatabase/serverless');

const connectionString = process.env.FANTASY_DATABASE_URL || 'postgresql://neondb_owner:npg_K1IGoDtlkPA3@ep-silent-sun-a1hf5mn7-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

const sql = neon(connectionString);

async function checkSchema() {
  console.log('🔍 Checking transfer_windows table structure...\n');

  try {
    // Get all columns
    const result = await sql`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'transfer_windows'
      ORDER BY ordinal_position;
    `;

    console.log('📋 All columns in transfer_windows table:\n');
    result.forEach(col => {
      console.log(`   ${col.column_name} (${col.data_type})${col.column_default ? ` DEFAULT ${col.column_default}` : ''} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    console.log(`\n✅ Total columns: ${result.length}`);

    // Check for our specific columns
    const ourColumns = result.filter(col => 
      ['max_transfers_per_window', 'points_cost_per_transfer', 'transfer_window_start', 'transfer_window_end'].includes(col.column_name)
    );

    console.log(`\n✅ New columns found: ${ourColumns.length}/4`);
    if (ourColumns.length === 4) {
      console.log('\n🎉 All migration columns are present!');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkSchema();
