require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkSchema() {
    if (!process.env.FANTASY_DATABASE_URL) {
        console.error('❌ FANTASY_DATABASE_URL not found in environment variables');
        process.exit(1);
    }

    const sql = neon(process.env.FANTASY_DATABASE_URL);

    console.log('🔍 Checking Database Schema...\n');

    // Check fantasy_transfers columns
    console.log('📋 fantasy_transfers columns:');
    const transferCols = await sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns 
    WHERE table_name = 'fantasy_transfers'
    ORDER BY ordinal_position
  `;

    transferCols.forEach(col => {
        console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    // Check fantasy_teams columns
    console.log('\n📋 fantasy_teams columns:');
    const teamCols = await sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns 
    WHERE table_name = 'fantasy_teams'
    ORDER BY ordinal_position
  `;

    teamCols.forEach(col => {
        console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    // Check transfer_windows columns
    console.log('\n📋 transfer_windows columns:');
    const windowCols = await sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns 
    WHERE table_name = 'transfer_windows'
    ORDER BY ordinal_position
  `;

    windowCols.forEach(col => {
        console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    console.log('\n✅ Schema check complete!');
}

checkSchema().catch(console.error);
