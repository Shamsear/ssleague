const { Pool } = require('@neondatabase/serverless');

const connectionString = process.env.FANTASY_DATABASE_URL || 'postgresql://neondb_owner:npg_K1IGoDtlkPA3@ep-silent-sun-a1hf5mn7-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

async function migrate() {
  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  try {
    console.log('🚀 Starting migration with transaction...\n');

    await client.query('BEGIN');

    console.log('📝 Adding columns to transfer_windows...\n');

    // Add columns one by one
    const alterStatements = [
      {
        sql: 'ALTER TABLE transfer_windows ADD COLUMN IF NOT EXISTS max_transfers_per_window INTEGER DEFAULT 3',
        desc: 'max_transfers_per_window'
      },
      {
        sql: 'ALTER TABLE transfer_windows ADD COLUMN IF NOT EXISTS points_cost_per_transfer INTEGER DEFAULT 4',
        desc: 'points_cost_per_transfer'
      },
      {
        sql: 'ALTER TABLE transfer_windows ADD COLUMN IF NOT EXISTS transfer_window_start TIMESTAMP',
        desc: 'transfer_window_start'
      },
      {
        sql: 'ALTER TABLE transfer_windows ADD COLUMN IF NOT EXISTS transfer_window_end TIMESTAMP',
        desc: 'transfer_window_end'
      }
    ];

    for (const stmt of alterStatements) {
      console.log(`   Adding ${stmt.desc}...`);
      await client.query(stmt.sql);
      console.log(`   ✓ ${stmt.desc} added`);
    }

    await client.query('COMMIT');
    console.log('\n✅ Transaction committed!\n');

    // Verify
    const result = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'transfer_windows'
      AND column_name IN ('max_transfers_per_window', 'points_cost_per_transfer', 'transfer_window_start', 'transfer_window_end')
      ORDER BY column_name
    `);

    console.log('📊 Verification:\n');
    if (result.rows.length > 0) {
      result.rows.forEach(col => {
        console.log(`   ✓ ${col.column_name} (${col.data_type})${col.column_default ? ` DEFAULT ${col.column_default}` : ''}`);
      });
      console.log(`\n🎉 Successfully added ${result.rows.length}/4 columns!`);
    } else {
      console.log('   ⚠️  No new columns found');
    }

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error during migration:', error.message);
    console.error(error);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
