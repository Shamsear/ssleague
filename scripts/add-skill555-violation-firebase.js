const admin = require('firebase-admin');
const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();
const sql = neon(process.env.DATABASE_URL);

async function addViolation() {
  try {
    console.log('🔍 Searching for Skill 555 team in Round 2...\n');

    // Get all teams
    const teamsSnapshot = await db.collection('teams').get();
    let skill555Team = null;

    teamsSnapshot.forEach(doc => {
      const team = doc.data();
      if (team.name && team.name.toLowerCase().includes('skill') && team.name.includes('555')) {
        skill555Team = { id: doc.id, ...team };
      }
    });

    if (!skill555Team) {
      console.log('❌ Could not find Skill 555 team. Showing all teams with "skill":');
      teamsSnapshot.forEach(doc => {
        const team = doc.data();
        if (team.name && team.name.toLowerCase().includes('skill')) {
          console.log(`  - ${team.name} (${doc.id})`);
        }
      });
      return;
    }

    console.log(`✅ Found team: ${skill555Team.name} (${skill555Team.id})`);
    console.log(`   Season: ${skill555Team.currentSeasonId || 'N/A'}\n`);

    // Find Round 2 fixtures
    const fixturesSnapshot = await db.collection('fixtures')
      .where('roundNumber', '==', 2)
      .where('seasonId', '==', skill555Team.currentSeasonId)
      .get();

    let round2Fixture = null;
    fixturesSnapshot.forEach(doc => {
      const fixture = doc.data();
      if (fixture.homeTeamId === skill555Team.id || fixture.awayTeamId === skill555Team.id) {
        round2Fixture = { id: doc.id, ...fixture };
      }
    });

    if (!round2Fixture) {
      console.log('❌ No Round 2 fixture found for this team');
      return;
    }

    const isHomeTeam = round2Fixture.homeTeamId === skill555Team.id;
    console.log(`📋 Round 2 Fixture: ${round2Fixture.homeTeamName} vs ${round2Fixture.awayTeamName}`);
    console.log(`   Team is: ${isHomeTeam ? 'Home' : 'Away'}`);
    console.log(`   Scheduled: ${round2Fixture.scheduledDate || 'TBD'}\n`);

    // Check if violation already exists in PostgreSQL
    const existing = await sql`
      SELECT * FROM team_violations
      WHERE fixture_id = ${round2Fixture.id}
        AND round_number = 2
        AND violation_type = 'no_lineup'
    `;

    if (existing.length > 0) {
      console.log('⚠️ Violation already exists in database:');
      console.table(existing);
      return;
    }

    // Get round deadline from rounds collection
    const roundsSnapshot = await db.collection('rounds')
      .where('roundNumber', '==', 2)
      .where('seasonId', '==', skill555Team.currentSeasonId)
      .limit(1)
      .get();

    let deadline = new Date();
    if (!roundsSnapshot.empty) {
      const round = roundsSnapshot.docs[0].data();
      if (round.scheduledDate && round.roundStartTime) {
        const deadlineStr = `${round.scheduledDate}T${round.roundStartTime}:00+05:30`;
        deadline = new Date(deadlineStr);
      }
    }

    console.log(`⏰ Round 2 deadline: ${deadline.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST\n`);

    // Add violation to PostgreSQL
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
        ${skill555Team.id},
        ${skill555Team.currentSeasonId},
        'no_lineup',
        ${round2Fixture.id},
        2,
        ${deadline},
        ${deadline},
        'warning_deducted',
        1,
        'Failed to submit lineup before Round 2 deadline. Warning deducted (1 of 3 warnings used).'
      )
      RETURNING *
    `;

    console.log('✅ Violation added to PostgreSQL:');
    console.table(violation);

    // Show all violations for this team
    const allViolations = await sql`
      SELECT 
        violation_type,
        round_number,
        TO_CHAR(violation_date, 'YYYY-MM-DD HH24:MI') as violation_date,
        penalty_applied,
        penalty_amount,
        notes
      FROM team_violations
      WHERE team_id = ${skill555Team.id}
      ORDER BY violation_date DESC
    `;

    console.log(`\n📊 All violations for ${skill555Team.name}:`);
    console.table(allViolations);

    console.log('\n✅ Done! The team now has 1 warning on record.');
    console.log('⚠️ Note: After 3 warnings, the team will receive a 2-goal penalty in their next match.');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

addViolation();
