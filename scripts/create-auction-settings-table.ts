import { Pool } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';

async function createAuctionSettingsTable() {
  const databaseUrl = process.env.NEON_DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ NEON_DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  try {
    console.log('🔄 Creating auction_settings table...\n');

    // Read the schema file
    const schemaPath = path.join(__dirname, '..', 'lib', 'neon', 'auction-settings-schema.sql');
    const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

    // Execute the entire schema
    console.log('📝 Executing schema...');
    await client.query(schemaContent);

    console.log('✅ auction_settings table created successfully!\n');

    // Verify the table was created
    console.log('🔍 Verifying table structure...');
    const tableInfo = await client.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'auction_settings'
      ORDER BY ordinal_position;
    `);

    console.log('\n📊 Table structure:');
    console.table(tableInfo.rows);

    // Check if default data exists
    console.log('\n🔍 Checking for default settings...');
    const defaultSettings = await client.query(`
      SELECT * FROM auction_settings WHERE season_id = 'default';
    `);

    if (defaultSettings.rows.length > 0) {
      console.log('\n✅ Default settings found:');
      console.table(defaultSettings.rows);
    } else {
      console.log('\n⚠️  No default settings found. Inserting...');
      await client.query(`
        INSERT INTO auction_settings (season_id, max_rounds, min_balance_per_round)
        VALUES ('default', 25, 30);
      `);
      console.log('✅ Default settings inserted!');
    }

    console.log('\n🎉 Setup complete!');

  } catch (error) {
    console.error('❌ Error creating auction_settings table:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the script
createAuctionSettingsTable();
