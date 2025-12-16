/**
 * Script to check for late lineup submissions and apply penalties
 * Teams that submit after the deadline should lose their warning chance
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

const SEASON_ID = 'SSPSLS16';

async function checkLateSubmissions() {
  const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);

  console.log('🔍 Checking for late lineup submissions...\n');

  try {
    // Get all fixtures with lineups submitted
    const fixtures = await sql`
      SELECT 
        f.id,
        f.home_team_id,
        f.home_team_name,
        f.away_team_id,
        f.away_team_name,
        f.home_lineup_submitted_at,
        f.away_lineup_submitted_at,
        f.round_number,
        f.leg,
        rd.scheduled_date,
        rd.home_fixture_deadline_time,
        rd.away_fixture_deadline_time
      FROM fixtures f
      JOIN round_deadlines rd ON 
        f.season_id = rd.season_id AND 
        f.round_number = rd.round_number AND 
        f.leg = rd.leg
      WHERE f.season_id = ${SEASON_ID}
        AND (f.home_lineup_submitted_at IS NOT NULL OR f.away_lineup_submitted_at IS NOT NULL)
      ORDER BY f.round_number, f.id
    `;

    console.log(`Found ${fixtures.length} fixtures with lineups\n`);

    const lateSubmissions = [];

    for (const fixture of fixtures) {
      const baseDateStr = new Date(fixture.scheduled_date).toISOString().split('T')[0];
      const [homeHour, homeMin] = fixture.home_fixture_deadline_time.split(':').map(Number);
      const [awayHour, awayMin] = fixture.away_fixture_deadline_time.split(':').map(Number);

      // Create deadlines in UTC
      const homeDeadline = new Date(baseDateStr);
      homeDeadline.setUTCHours(homeHour - 5, homeMin - 30, 0, 0);

      const awayDeadline = new Date(baseDateStr);
      awayDeadline.setUTCHours(awayHour - 5, awayMin - 30, 0, 0);

      // Check home team
      if (fixture.home_lineup_submitted_at) {
        const submittedAt = new Date(fixture.home_lineup_submitted_at);
        if (submittedAt > awayDeadline) {
          lateSubmissions.push({
            fixture_id: fixture.id,
            team_id: fixture.home_team_id,
            team_name: fixture.home_team_name,
            submitted_at: submittedAt,
            deadline: awayDeadline,
            minutes_late: Math.round((submittedAt - awayDeadline) / 60000)
          });
        }
      }

      // Check away team
      if (fixture.away_lineup_submitted_at) {
        const submittedAt = new Date(fixture.away_lineup_submitted_at);
        if (submittedAt > awayDeadline) {
          lateSubmissions.push({
            fixture_id: fixture.id,
            team_id: fixture.away_team_id,
            team_name: fixture.away_team_name,
            submitted_at: submittedAt,
            deadline: awayDeadline,
            minutes_late: Math.round((submittedAt - awayDeadline) / 60000)
          });
        }
      }
    }

    if (lateSubmissions.length === 0) {
      console.log('✅ No late submissions found');
      return;
    }

    console.log(`⚠️  Found ${lateSubmissions.length} late submission(s):\n`);
    
    lateSubmissions.forEach((late, index) => {
      console.log(`${index + 1}. ${late.team_name}`);
      console.log(`   Fixture: ${late.fixture_id}`);
      console.log(`   Deadline: ${late.deadline.toISOString()}`);
      console.log(`   Submitted: ${late.submitted_at.toISOString()}`);
      console.log(`   Late by: ${late.minutes_late} minutes`);
      console.log(`   ⚠️  Should lose warning chance!\n`);
    });

    console.log('\n📝 Recommended Actions:');
    console.log('1. Record these violations in the system');
    console.log('2. Deduct warning chances from these teams');
    console.log('3. Send notifications to team owners');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

checkLateSubmissions()
  .then(() => {
    console.log('\n✅ Check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });
