const { neon } = require('@neondatabase/serverless');

const connectionString = process.env.FANTASY_DATABASE_URL || 'postgresql://neondb_owner:npg_K1IGoDtlkPA3@ep-silent-sun-a1hf5mn7-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

const sql = neon(connectionString);

async function findTable() {
  console.log('🔍 Searching for transfer_windows table...\n');

  try {
    // Find which schema the table is in
    const tables = await sql`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_name = 'transfer_windows';
    `;

    console.log('📋 Found transfer_windows in:');
    tables.forEach(t => {
      console.log(`   Schema: ${t.table_schema}, Table: ${t.table_name}`);
    });

    if (tables.length > 0) {
      const schema = tables[0].table_schema;
      console.log(`\n✅ Using schema: ${schema}\n`);

      // Now try to add columns with explicit schema
      console.log('📝 Attempting to add columns...\n');

      await sql.unsafe(`
        ALTER TABLE ${schema}.transfer_windows
        ADD COLUMN IF NOT EXISTS max_transfers_per_window INTEGER DEFAULT 3,
        ADD COLUMN IF NOT EXISTS points_cost_per_transfer INTEGER DEFAULT 4,
        ADD COLUMN IF NOT EXISTS transfer_window_start TIMESTAMP,
        ADD COLUMN IF NOT EXISTS transfer_window_end TIMESTAMP;
      `);

      console.log('✅ Columns added successfully!\n');

      // Verify
      const result = await sql`
        SELECT column_name, data_type, column_default
        FROM information_schema.columns
        WHERE table_schema = ${schema}
        AND table_name = 'transfer_windows'
        AND column_name IN ('max_transfers_per_window', 'points_cost_per_transfer', 'transfer_window_start', 'transfer_window_end')
        ORDER BY column_name;
      `;

      console.log('🎯 Verification:');
      result.forEach(col => {
        console.log(`   ✓ ${col.column_name} (${col.data_type})${col.column_default ? ` DEFAULT ${col.column_default}` : ''}`);
      });

      console.log(`\n🎉 Successfully added ${result.length}/4 columns!`);

    } else {
      console.log('❌ transfer_windows table not found!');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

findTable();
