require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkFootballPlayers() {
    // Check auction DB
    const auctionSql = neon(process.env.NEON_DATABASE_URL);

    console.log('🔍 Checking footballplayers table (Auction DB)...\n');

    const cols = await auctionSql`
    SELECT column_name, data_type
    FROM information_schema.columns 
    WHERE table_name = 'footballplayers'
    ORDER BY ordinal_position
  `;

    console.log('📋 Columns in footballplayers:');
    cols.forEach(col => {
        console.log(`  - ${col.column_name} (${col.data_type})`);
    });

    // Get sample
    console.log('\n📊 Sample footballplayer:');
    const sample = await auctionSql`SELECT * FROM footballplayers LIMIT 1`;

    if (sample.length > 0) {
        console.log(JSON.stringify(sample[0], null, 2));
    }

    console.log('\n✅ Done!');
}

checkFootballPlayers().catch(console.error);
