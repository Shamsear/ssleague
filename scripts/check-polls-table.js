require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkPolls() {
    const dbUrl = process.env.NEON_TOURNAMENT_DB_URL;

    if (!dbUrl) {
        console.error('❌ NEON_TOURNAMENT_DB_URL not found in .env.local');
        return;
    }

    const sql = neon(dbUrl);

    console.log('🔍 Checking polls table...\n');

    try {
        // Get all polls
        const polls = await sql`
      SELECT 
        poll_id,
        season_id,
        poll_type,
        title_en,
        related_round_id,
        closes_at,
        created_at,
        created_by
      FROM polls
      ORDER BY created_at DESC
      LIMIT 10
    `;

        console.log(`📊 Found ${polls.length} polls in database:\n`);

        if (polls.length === 0) {
            console.log('❌ No polls found in database!');
            console.log('This confirms polls are NOT being saved.\n');
            return;
        }

        polls.forEach((poll, idx) => {
            console.log(`Poll ${idx + 1}:`);
            console.log(`  ID: ${poll.poll_id}`);
            console.log(`  Season: ${poll.season_id}`);
            console.log(`  Type: ${poll.poll_type}`);
            console.log(`  Title: ${poll.title_en}`);
            console.log(`  Related Round ID: ${poll.related_round_id}`);
            console.log(`  Created: ${poll.created_at}`);
            console.log(`  Created By: ${poll.created_by}`);
            console.log('');
        });

        // Check table structure
        console.log('\n📋 Checking polls table structure...\n');
        const columns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'polls'
      ORDER BY ordinal_position
    `;

        console.log('Columns:');
        columns.forEach(col => {
            console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
        });

    } catch (error) {
        console.error('❌ Error:', error.message);

        if (error.message.includes('relation "polls" does not exist')) {
            console.log('\n⚠️  The "polls" table does not exist in the database!');
            console.log('You need to create the polls table first.');
        }
    }
}

checkPolls();
