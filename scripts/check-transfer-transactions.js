const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function checkTransferTransactions() {
  try {
    console.log('🔍 Checking player_transfer_transactions table...\n');

    // Check if table exists
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'player_transfer_transactions'
      );
    `;

    if (!tableCheck[0].exists) {
      console.log('❌ Table player_transfer_transactions does not exist!');
      console.log('\n📋 Available tables:');
      const tables = await sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name;
      `;
      tables.forEach(t => console.log(`  - ${t.table_name}`));
      return;
    }

    console.log('✅ Table exists!\n');

    // Get table structure
    console.log('📋 Table structure:');
    const columns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'player_transfer_transactions'
      ORDER BY ordinal_position;
    `;
    columns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });

    // Count total records
    const count = await sql`
      SELECT COUNT(*) as total FROM player_transfer_transactions;
    `;
    console.log(`\n📊 Total records: ${count[0].total}`);

    // Get sample records
    if (count[0].total > 0) {
      console.log('\n📄 Sample records (first 5):');
      const samples = await sql`
        SELECT * FROM player_transfer_transactions
        ORDER BY created_at DESC
        LIMIT 5;
      `;
      samples.forEach((record, index) => {
        console.log(`\n${index + 1}. Transaction ID: ${record.id}`);
        console.log(`   Type: ${record.transaction_type}`);
        console.log(`   Season: ${record.season_id}`);
        console.log(`   Created: ${record.created_at}`);
        if (record.player_id) console.log(`   Player: ${record.player_id}`);
        if (record.old_team_id) console.log(`   Old Team: ${record.old_team_id}`);
        if (record.new_team_id) console.log(`   New Team: ${record.new_team_id}`);
      });

      // Group by season
      console.log('\n📊 Records by season:');
      const bySeason = await sql`
        SELECT season_id, COUNT(*) as count
        FROM player_transfer_transactions
        GROUP BY season_id
        ORDER BY season_id DESC;
      `;
      bySeason.forEach(s => {
        console.log(`  ${s.season_id}: ${s.count} transactions`);
      });

      // Group by type
      console.log('\n📊 Records by type:');
      const byType = await sql`
        SELECT transaction_type, COUNT(*) as count
        FROM player_transfer_transactions
        GROUP BY transaction_type
        ORDER BY count DESC;
      `;
      byType.forEach(t => {
        console.log(`  ${t.transaction_type}: ${t.count} transactions`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkTransferTransactions();
