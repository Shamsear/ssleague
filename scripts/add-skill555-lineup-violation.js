const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

async function addLineupViolation() {
  const sql = neon(process.env.DATABASE_URL);

  try {
    console.log('🔍 Looking up Skill 555 team and Round 2 details...\n');

    // Find the team
    const teams = await sql`
      SELECT team_id, team_name, season_id
      FROM teams
      WHERE LOWER(team_name) LIKE '%skill%555%'
      OR team_id LIKE '%555%'
      LIMIT 5
    `;

    if (teams.length === 0) {
      console.log('❌ Could not find Skill 555 team. Searching all teams with "skill" in name:');
      const allSkillTeams = await sql`
        SELECT team_id, team_name, season_id
        FROM teams
        WHERE LOWER(team_name) LIKE '%skill%'
        ORDER BY team_name
      `;
      console.table(allSkillTeams);
      return;
    }

    console.log('Found team(s):');
    console.table(teams);

    const team = teams[0];
    console.log(`\n✅ Using team: ${team.team_name} (${team.team_id})`);

    // Find Round 2 fixtures for this team
    const fixtures = await sql`
      SELECT 
        f.id as fixture_id,
        f.round_number,
        f.home_team_id,
        f.home_team_name,
        f.away_team_id,
        f.away_team_name,
        f.scheduled_date,
        f.home_lineup_submitted_at,
        f.away_lineup_submitted_at
      FROM fixtures f
      WHERE f.round_number = 2
        AND f.season_id = ${team.season_id}
        AND (f.home_team_id = ${team.team_id} OR f.away_team_id = ${team.team_id})
    `;

    if (fixtures.length === 0) {
      console.log('❌ No Round 2 fixture found for this team');
      return;
    }

    const fixture = fixtures[0];
    console.log('\n📋 Round 2 Fixture:');
    console.table([fixture]);

    const isHomeTeam = fixture.home_team_id === team.team_id;
    const lineupSubmitted = isHomeTeam ? fixture.home_lineup_submitted_at : fixture.away_lineup_submitted_at;

    console.log(`\n📊 Team is: ${isHomeTeam ? 'Home' : 'Away'}`);
    console.log(`Lineup submitted: ${lineupSubmitted || 'NO'}`);

    // Check if violation already exists
    const existingViolations = await sql`
      SELECT *
      FROM team_violations
      WHERE team_id = ${team.team_id}
        AND round_number = 2
        AND violation_type = 'no_lineup'
    `;

    if (existingViolations.length > 0) {
      console.log('\n⚠️ Violation already exists:');
      console.table(existingViolations);
      console.log('\nSkipping duplicate entry.');
      return;
    }

    // Get round deadline
    const rounds = await sql`
      SELECT scheduled_date, round_start_time
      FROM rounds
      WHERE round_number = 2
        AND season_id = ${team.season_id}
    `;

    const round = rounds[0];
    const deadlineStr = `${round.scheduled_date}T${round.round_start_time}:00+05:30`;
    const deadline = new Date(deadlineStr);

    console.log(`\n⏰ Round 2 deadline was: ${deadline.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`);

    // Add the violation
    const violation = await sql`
      INSERT INTO team_violations (
        team_id,
        season_id,
        violation_type,
        fixture_id,
        round_number,
        violation_date,
        deadline,
        penalty_applied,
        penalty_amount,
        notes
      ) VALUES (
        ${team.team_id},
        ${team.season_id},
        'no_lineup',
        ${fixture.fixture_id},
        2,
        ${deadline},
        ${deadline},
        'warning_deducted',
        1,
        'Failed to submit lineup before Round 2 deadline. Warning deducted (1 of 3 warnings used).'
      )
      RETURNING *
    `;

    console.log('\n✅ Violation added successfully:');
    console.table(violation);

    // Show all violations for this team
    const allViolations = await sql`
      SELECT 
        violation_type,
        round_number,
        violation_date,
        penalty_applied,
        penalty_amount,
        notes
      FROM team_violations
      WHERE team_id = ${team.team_id}
        AND season_id = ${team.season_id}
      ORDER BY violation_date DESC
    `;

    console.log(`\n📊 All violations for ${team.team_name}:`);
    console.table(allViolations);

    console.log('\n✅ Done! The team now has 1 warning on record.');
    console.log('⚠️ Note: After 3 warnings, the team will receive a 2-goal penalty in their next match.');

  } catch (error) {
    console.error('❌ Error adding violation:', error);
    process.exit(1);
  }
}

addLineupViolation();
