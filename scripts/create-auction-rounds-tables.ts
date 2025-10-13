import { Pool } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';

async function createAuctionRoundsTables() {
  const databaseUrl = process.env.NEON_DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ NEON_DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  try {
    console.log('🔄 Creating auction rounds tables...\n');

    // Read the schema file
    const schemaPath = path.join(__dirname, '..', 'lib', 'neon', 'auction-rounds-schema.sql');
    const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

    // Execute the entire schema
    console.log('📝 Executing schema...');
    await client.query(schemaContent);

    console.log('✅ Auction rounds tables created successfully!\n');

    // Verify the tables were created
    console.log('🔍 Verifying tables...');
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('auction_rounds', 'round_players', 'round_bids')
      ORDER BY table_name;
    `);

    console.log('\n📊 Tables created:');
    console.table(tables.rows);

    // Show auction_rounds structure
    console.log('\n📋 auction_rounds table structure:');
    const roundsStructure = await client.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'auction_rounds'
      ORDER BY ordinal_position;
    `);
    console.table(roundsStructure.rows);

    console.log('\n🎉 Setup complete!');

  } catch (error) {
    console.error('❌ Error creating auction rounds tables:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the script
createAuctionRoundsTables();
