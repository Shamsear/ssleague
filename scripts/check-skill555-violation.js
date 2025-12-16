/**
 * Check if Skill 555 has any late lineup submissions and show violations
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkSkill555() {
  const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);

  console.log('🔍 Checking Skill 555 violations...\n');

  try {
    // Get team_id from fixtures
    const fixtures = await sql`
      SELECT home_team_id, home_team_name, away_team_id, away_team_name
      FROM fixtures
      WHERE season_id = 'SSPSLS16'
        AND (home_team_name LIKE '%Skill%' OR away_team_name LIKE '%Skill%')
      LIMIT 1
    `;

    if (fixtures.length === 0) {
      console.log('❌ Skill 555 not found');
      return;
    }

    const teamId = fixtures[0].home_team_name.includes('Skill') 
      ? fixtures[0].home_team_id 
      : fixtures[0].away_team_id;
    
    const teamName = fixtures[0].home_team_name.includes('Skill')
      ? fixtures[0].home_team_name
      : fixtures[0].away_team_name;

    console.log(`Team: ${teamName}`);
    console.log(`Team ID: ${teamId}\n`);

    // Check for violations
    const violations = await sql`
      SELECT *
      FROM team_violations
      WHERE team_id = ${teamId}
        AND season_id = 'SSPSLS16'
      ORDER BY created_at DESC
    `;

    if (violations.length === 0) {
      console.log('✅ No violations recorded for Skill 555');
      console.log('\n💡 If they submitted late, the violation should be recorded automatically');
      console.log('   when they submit their next lineup.');
    } else {
      console.log(`⚠️  Found ${violations.length} violation(s):\n`);
      
      violations.forEach((v, i) => {
        console.log(`${i + 1}. ${v.violation_type.toUpperCase()}`);
        console.log(`   Fixture: ${v.fixture_id}`);
        console.log(`   Date: ${new Date(v.violation_date).toLocaleString()}`);
        console.log(`   Minutes Late: ${v.minutes_late}`);
        console.log(`   Penalty: ${v.penalty_applied}`);
        console.log(`   Notes: ${v.notes}\n`);
      });
    }

    // Check their lineup submissions
    const lineupFixtures = await sql`
      SELECT 
        id,
        round_number,
        home_team_name,
        away_team_name,
        home_lineup_submitted_at,
        away_lineup_submitted_at
      FROM fixtures
      WHERE season_id = 'SSPSLS16'
        AND (home_team_id = ${teamId} OR away_team_id = ${teamId})
        AND (home_lineup_submitted_at IS NOT NULL OR away_lineup_submitted_at IS NOT NULL)
      ORDER BY round_number
    `;

    console.log(`\n📋 Lineup Submissions (${lineupFixtures.length} fixtures):\n`);
    
    lineupFixtures.forEach(f => {
      const isHome = f.home_team_name.includes('Skill');
      const submittedAt = isHome ? f.home_lineup_submitted_at : f.away_lineup_submitted_at;
      
      console.log(`Round ${f.round_number}: ${f.home_team_name} vs ${f.away_team_name}`);
      console.log(`   Submitted: ${submittedAt ? new Date(submittedAt).toLocaleString() : 'Not submitted'}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

checkSkill555()
  .then(() => {
    console.log('\n✅ Check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });
