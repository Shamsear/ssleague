/**
 * Retroactively check all lineup submissions and record violations for late submissions
 * This will analyze existing lineups and apply penalties where needed
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

const SEASON_ID = 'SSPSLS16';

async function checkRetroactiveViolations() {
  const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);

  console.log('🔍 Checking all lineup submissions for violations...\n');

  try {
    // Get all fixtures with lineup data
    const fixtures = await sql`
      SELECT 
        f.id,
        f.home_team_id,
        f.home_team_name,
        f.away_team_id,
        f.away_team_name,
        f.home_lineup,
        f.away_lineup,
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
        AND (f.home_lineup IS NOT NULL OR f.away_lineup IS NOT NULL)
      ORDER BY f.round_number, f.id
    `;

    console.log(`Found ${fixtures.length} fixtures with lineups\n`);

    const violations = [];
    let teamsChecked = new Set();

    for (const fixture of fixtures) {
      const baseDateStr = new Date(fixture.scheduled_date).toISOString().split('T')[0];
      const [homeHour, homeMin] = fixture.home_fixture_deadline_time.split(':').map(Number);
      const [awayHour, awayMin] = fixture.away_fixture_deadline_time.split(':').map(Number);

      // Create deadlines in UTC
      const homeDeadline = new Date(baseDateStr);
      homeDeadline.setUTCHours(homeHour - 5, homeMin - 30, 0, 0);

      const awayDeadline = new Date(baseDateStr);
      awayDeadline.setUTCHours(awayHour - 5, awayMin - 30, 0, 0);

      // Check home team lineup
      if (fixture.home_lineup) {
        const lineup = fixture.home_lineup;
        const submittedAt = lineup.submitted_at ? new Date(lineup.submitted_at) : null;
        
        if (submittedAt && submittedAt > awayDeadline) {
          const minutesLate = Math.round((submittedAt - awayDeadline) / 60000);
          violations.push({
            team_id: fixture.home_team_id,
            team_name: fixture.home_team_name,
            fixture_id: fixture.id,
            round_number: fixture.round_number,
            submitted_at: submittedAt,
            deadline: awayDeadline,
            minutes_late: minutesLate
          });
          teamsChecked.add(fixture.home_team_name);
        }
      }

      // Check away team lineup
      if (fixture.away_lineup) {
        const lineup = fixture.away_lineup;
        const submittedAt = lineup.submitted_at ? new Date(lineup.submitted_at) : null;
        
        if (submittedAt && submittedAt > awayDeadline) {
          const minutesLate = Math.round((submittedAt - awayDeadline) / 60000);
          violations.push({
            team_id: fixture.away_team_id,
            team_name: fixture.away_team_name,
            fixture_id: fixture.id,
            round_number: fixture.round_number,
            submitted_at: submittedAt,
            deadline: awayDeadline,
            minutes_late: minutesLate
          });
          teamsChecked.add(fixture.away_team_name);
        }
      }
    }

    console.log(`📊 Analysis Results:`);
    console.log(`   Teams checked: ${teamsChecked.size}`);
    console.log(`   Violations found: ${violations.length}\n`);

    if (violations.length === 0) {
      console.log('✅ No late submissions found!');
      return;
    }

    console.log(`⚠️  Late Submissions Detected:\n`);
    
    for (let i = 0; i < violations.length; i++) {
      const v = violations[i];
      console.log(`${i + 1}. ${v.team_name}`);
      console.log(`   Fixture: ${v.fixture_id} (Round ${v.round_number})`);
      console.log(`   Deadline: ${v.deadline.toLocaleString()}`);
      console.log(`   Submitted: ${v.submitted_at.toLocaleString()}`);
      console.log(`   Late by: ${v.minutes_late} minutes`);
      
      // Check if violation already recorded
      const existing = await sql`
        SELECT id FROM team_violations
        WHERE team_id = ${v.team_id}
          AND fixture_id = ${v.fixture_id}
          AND violation_type = 'late_lineup'
        LIMIT 1
      `;

      if (existing.length > 0) {
        console.log(`   ✓ Already recorded\n`);
      } else {
        // Record the violation
        await sql`
          INSERT INTO team_violations (
            team_id,
            season_id,
            violation_type,
            fixture_id,
            round_number,
            violation_date,
            deadline,
            minutes_late,
            penalty_applied,
            penalty_amount,
            notes
          ) VALUES (
            ${v.team_id},
            ${SEASON_ID},
            'late_lineup',
            ${v.fixture_id},
            ${v.round_number},
            ${v.submitted_at.toISOString()},
            ${v.deadline.toISOString()},
            ${v.minutes_late},
            'warning_deducted',
            1,
            ${'Retroactive: Lineup submitted ' + v.minutes_late + ' minutes after deadline'}
          )
        `;
        console.log(`   ✅ Violation recorded!\n`);
      }
    }

    // Summary by team
    console.log(`\n📋 Summary by Team:`);
    const teamViolations = {};
    violations.forEach(v => {
      if (!teamViolations[v.team_name]) {
        teamViolations[v.team_name] = 0;
      }
      teamViolations[v.team_name]++;
    });

    Object.entries(teamViolations).forEach(([team, count]) => {
      console.log(`   ${team}: ${count} violation(s) - Should lose ${count} warning chance(s)`);
    });

    console.log('\n⚠️  Action Required:');
    console.log('   Update warning chances in Firebase team_seasons for these teams');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

checkRetroactiveViolations()
  .then(() => {
    console.log('\n✅ Check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });
