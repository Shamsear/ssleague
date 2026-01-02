import { getTournamentDb } from '../lib/neon/tournament-config';

async function checkPolls() {
    const sql = getTournamentDb();

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

        polls.forEach((poll: any, idx: number) => {
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
        columns.forEach((col: any) => {
            console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
        });

    } catch (error: any) {
        console.error('❌ Error:', error.message);

        if (error.message.includes('relation "polls" does not exist')) {
            console.log('\n⚠️  The "polls" table does not exist in the database!');
            console.log('You need to create the polls table first.');
        }
    }
}

checkPolls();
