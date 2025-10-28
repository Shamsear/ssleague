const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

// Read connection string from environment or use default
const connectionString = process.env.FANTASY_DATABASE_URL || 'postgresql://neondb_owner:npg_K1IGoDtlkPA3@ep-silent-sun-a1hf5mn7-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

const sql = neon(connectionString);

async function runMigration() {
  console.log('🚀 Starting transfer window settings migration...\n');

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', 'add-transfer-window-settings.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded successfully');
    console.log('📝 Executing migration SQL...\n');

    // Execute the ALTER TABLE statement directly
    console.log('   Executing: ALTER TABLE transfer_windows ADD COLUMN...');
    
    await sql.unsafe(`
      ALTER TABLE transfer_windows
      ADD COLUMN IF NOT EXISTS max_transfers_per_window INTEGER DEFAULT 3,
      ADD COLUMN IF NOT EXISTS points_cost_per_transfer INTEGER DEFAULT 4,
      ADD COLUMN IF NOT EXISTS transfer_window_start TIMESTAMP,
      ADD COLUMN IF NOT EXISTS transfer_window_end TIMESTAMP
    `);
    
    console.log('   ✓ Columns added successfully');
    
    console.log('   Executing: Adding column comments...');
    
    await sql.unsafe(`
      COMMENT ON COLUMN transfer_windows.max_transfers_per_window IS 'Maximum number of transfers allowed during this window'
    `);
    
    await sql.unsafe(`
      COMMENT ON COLUMN transfer_windows.points_cost_per_transfer IS 'Fantasy points deducted per transfer made in this window'
    `);
    
    await sql.unsafe(`
      COMMENT ON COLUMN transfer_windows.transfer_window_start IS 'When transfers can start being made (can be different from opens_at)'
    `);
    
    await sql.unsafe(`
      COMMENT ON COLUMN transfer_windows.transfer_window_end IS 'When transfers can no longer be made (can be different from closes_at)'
    `);
    
    console.log('   ✓ Comments added successfully');

    console.log('\n✅ Migration completed successfully!\n');
    console.log('📊 Verifying changes...');

    // Verify the new columns exist
    const result = await sql`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'transfer_windows'
      AND column_name IN ('max_transfers_per_window', 'points_cost_per_transfer', 'transfer_window_start', 'transfer_window_end')
      ORDER BY column_name;
    `;

    if (result.length === 4) {
      console.log('\n✅ All 4 new columns added successfully:');
      result.forEach(col => {
        console.log(`   - ${col.column_name} (${col.data_type})${col.column_default ? ` DEFAULT ${col.column_default}` : ''}`);
      });
    } else {
      console.log('\n⚠️  Warning: Expected 4 columns but found ' + result.length);
    }

    console.log('\n🎉 Migration complete! Your transfer windows now support per-window settings.');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    if (error.message.includes('already exists')) {
      console.log('\nℹ️  Note: The columns may already exist. This is not necessarily an error.');
    }
    process.exit(1);
  }
}

runMigration();
