const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

async function updateAwayDeadlines() {
  const sql = neon(process.env.DATABASE_URL);

  try {
    console.log('🔄 Updating away_fixture_deadline_time to match round_start_time...\n');

    // Update the deadlines
    const result = await sql`
      UPDATE rounds
      SET away_fixture_deadline_time = round_start_time
      WHERE away_fixture_deadline_time != round_start_time
      RETURNING id, round_number, scheduled_date, round_start_time, away_fixture_deadline_time
    `;

    console.log(`✅ Updated ${result.length} round(s):\n`);
    result.forEach(round => {
      console.log(`  Round ${round.round_number} (${round.scheduled_date}): away deadline now ${round.away_fixture_deadline_time}`);
    });

    // Show current state of upcoming rounds
    console.log('\n📋 Current state of upcoming rounds:');
    const rounds = await sql`
      SELECT 
        id,
        round_number,
        scheduled_date,
        round_start_time,
        home_fixture_deadline_time,
        away_fixture_deadline_time,
        status
      FROM rounds
      WHERE scheduled_date >= CURRENT_DATE
      ORDER BY scheduled_date, round_number
      LIMIT 10
    `;

    console.table(rounds);

    console.log('\n✅ Update complete!');
  } catch (error) {
    console.error('❌ Error updating deadlines:', error);
    process.exit(1);
  }
}

updateAwayDeadlines();
