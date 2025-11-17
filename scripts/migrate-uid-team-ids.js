const { config } = require('dotenv');
const { resolve } = require('path');
const admin = require('firebase-admin');
const { neon } = require('@neondatabase/serverless');

config({ path: resolve(process.cwd(), '.env.local') });

// Initialize Firebase Admin
if (!admin.apps.length) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  
  if (process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
  } else if (projectId) {
    admin.initializeApp({ projectId });
  } else {
    admin.initializeApp();
  }
}

const db = admin.firestore();

// Initialize Neon (PostgreSQL) connection
const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);

// Function to check if a string looks like a Firebase UID (28-character alphanumeric)
function isFirebaseUID(str) {
  // Firebase UIDs are typically 28 characters long and alphanumeric
  return /^[a-zA-Z0-9]{20,30}$/.test(str) && str.length >= 20;
}

// Function to check if a string is a proper team ID (SSPSLT####)
function isProperTeamId(str) {
  return /^SSPSLT\d{4}$/.test(str);
}

// Function to get the next available team ID number
async function getNextTeamIdNumber() {
  const teamsSnapshot = await db.collection('teams').get();
  
  let maxNumber = 0;
  teamsSnapshot.forEach(doc => {
    const teamId = doc.id;
    if (isProperTeamId(teamId)) {
      const number = parseInt(teamId.replace('SSPSLT', ''));
      if (number > maxNumber) {
        maxNumber = number;
      }
    }
  });
  
  return maxNumber + 1;
}

// Function to generate new team ID
function generateTeamId(number) {
  return `SSPSLT${number.toString().padStart(4, '0')}`;
}

async function migrateTeamIds() {
  console.log('🔍 Scanning for teams with UID-based team IDs...\n');
  
  const teamsSnapshot = await db.collection('teams').get();
  const teamsToMigrate = [];
  
  teamsSnapshot.forEach(doc => {
    const teamId = doc.id;
    const data = doc.data();
    
    if (isFirebaseUID(teamId)) {
      console.log(`❌ Found UID-based team ID: ${teamId}`);
      console.log(`   Team Name: ${data.team_name}`);
      console.log(`   Owner: ${data.owner_name || 'N/A'}`);
      console.log(`   Owner UID: ${data.owner_uid || 'N/A'}\n`);
      
      teamsToMigrate.push({
        oldId: teamId,
        data: data
      });
    } else if (isProperTeamId(teamId)) {
      console.log(`✅ Proper team ID: ${teamId} - ${data.team_name}`);
    } else {
      console.log(`⚠️  Unknown format: ${teamId} - ${data.team_name}`);
    }
  });
  
  if (teamsToMigrate.length === 0) {
    console.log('\n✅ No teams with UID-based IDs found. All teams have proper IDs!');
    return;
  }
  
  console.log(`\n📊 Found ${teamsToMigrate.length} team(s) to migrate\n`);
  console.log('─'.repeat(80));
  
  // Get starting team ID number
  let nextTeamNumber = await getNextTeamIdNumber();
  console.log(`\n🔢 Next available team ID number: ${nextTeamNumber}\n`);
  
  // Confirm before proceeding
  console.log('⚠️  This will:');
  console.log('   1. Create new team documents with proper IDs');
  console.log('   2. Update all team_seasons documents');
  console.log('   3. Update all teamstats records in Neon');
  console.log('   4. Update all realplayerstats documents');
  console.log('   5. Update matches documents');
  console.log('   6. Update owners documents');
  console.log('   7. Update users documents');
  console.log('   8. Delete old team documents\n');
  
  console.log('🚀 Starting migration...\n');
  
  for (const team of teamsToMigrate) {
    const oldTeamId = team.oldId;
    const newTeamId = generateTeamId(nextTeamNumber);
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Migrating: ${oldTeamId} → ${newTeamId}`);
    console.log(`Team: ${team.data.team_name}`);
    console.log(`${'='.repeat(80)}\n`);
    
    try {
      const batch = db.batch();
      
      // 1. Create new team document
      console.log(`1️⃣  Creating new team document: ${newTeamId}`);
      const newTeamRef = db.collection('teams').doc(newTeamId);
      batch.set(newTeamRef, {
        ...team.data,
        team_id: newTeamId,
        old_team_id: oldTeamId, // Keep reference to old ID
        migrated_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // Commit batch for team creation
      await batch.commit();
      console.log(`   ✅ Created team document: ${newTeamId}\n`);
      
      // 2. Update team_seasons documents
      console.log(`2️⃣  Updating team_seasons documents...`);
      const teamSeasonsSnapshot = await db.collection('team_seasons')
        .where('team_id', '==', oldTeamId)
        .get();
      
      if (!teamSeasonsSnapshot.empty) {
        for (const doc of teamSeasonsSnapshot.docs) {
          const data = doc.data();
          const oldDocId = doc.id; // e.g., oldTeamId_SSPSLS16
          const seasonId = data.season_id;
          const newDocId = `${newTeamId}_${seasonId}`;
          
          console.log(`   Moving: ${oldDocId} → ${newDocId}`);
          
          // Create new document
          await db.collection('team_seasons').doc(newDocId).set({
            ...data,
            team_id: newTeamId,
            old_team_id: oldTeamId,
            migrated_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_at: admin.firestore.FieldValue.serverTimestamp()
          });
          
          // Delete old document
          await db.collection('team_seasons').doc(oldDocId).delete();
        }
        console.log(`   ✅ Updated ${teamSeasonsSnapshot.size} team_seasons document(s)\n`);
      } else {
        console.log(`   ℹ️  No team_seasons documents found\n`);
      }
      
      // 3. Update teamstats in Neon
      console.log(`3️⃣  Updating teamstats in Neon...`);
      try {
        const teamstatsResult = await sql`
          SELECT * FROM teamstats WHERE team_id = ${oldTeamId}
        `;
        
        if (teamstatsResult.length > 0) {
          for (const row of teamstatsResult) {
            const oldId = row.id; // e.g., oldTeamId_SSPSLS16
            const seasonId = row.season_id;
            const newId = `${newTeamId}_${seasonId}`;
            
            console.log(`   Updating: ${oldId} → ${newId}`);
            
            // Insert new record
            await sql`
              INSERT INTO teamstats (id, team_id, season_id, team_name, tournament_id, position, points, matches_played, wins, draws, losses, goals_for, goals_against, goal_difference, created_at, updated_at)
              VALUES (${newId}, ${newTeamId}, ${seasonId}, ${row.team_name}, ${row.tournament_id}, ${row.position}, ${row.points}, ${row.matches_played}, ${row.wins}, ${row.draws}, ${row.losses}, ${row.goals_for}, ${row.goals_against}, ${row.goal_difference}, ${row.created_at}, NOW())
              ON CONFLICT (id) DO UPDATE SET team_id = ${newTeamId}, updated_at = NOW()
            `;
            
            // Delete old record
            await sql`DELETE FROM teamstats WHERE id = ${oldId}`;
          }
          console.log(`   ✅ Updated ${teamstatsResult.length} teamstats record(s)\n`);
        } else {
          console.log(`   ℹ️  No teamstats records found\n`);
        }
      } catch (error) {
        console.log(`   ⚠️  Error updating teamstats: ${error.message}\n`);
      }
      
      // 4. Update realplayerstats documents
      console.log(`4️⃣  Updating realplayerstats documents...`);
      const playerstatsSnapshot = await db.collection('realplayerstats')
        .where('team_id', '==', oldTeamId)
        .get();
      
      if (!playerstatsSnapshot.empty) {
        const playerBatch = db.batch();
        playerstatsSnapshot.docs.forEach(doc => {
          playerBatch.update(doc.ref, {
            team_id: newTeamId,
            old_team_id: oldTeamId,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
          });
        });
        await playerBatch.commit();
        console.log(`   ✅ Updated ${playerstatsSnapshot.size} realplayerstats document(s)\n`);
      } else {
        console.log(`   ℹ️  No realplayerstats documents found\n`);
      }
      
      // 5. Update matches documents (home_team_id and away_team_id)
      console.log(`5️⃣  Updating matches documents...`);
      const homeMatchesSnapshot = await db.collection('matches')
        .where('home_team_id', '==', oldTeamId)
        .get();
      
      const awayMatchesSnapshot = await db.collection('matches')
        .where('away_team_id', '==', oldTeamId)
        .get();
      
      let matchesUpdated = 0;
      
      if (!homeMatchesSnapshot.empty) {
        const matchBatch = db.batch();
        homeMatchesSnapshot.docs.forEach(doc => {
          matchBatch.update(doc.ref, {
            home_team_id: newTeamId,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
          });
        });
        await matchBatch.commit();
        matchesUpdated += homeMatchesSnapshot.size;
      }
      
      if (!awayMatchesSnapshot.empty) {
        const matchBatch = db.batch();
        awayMatchesSnapshot.docs.forEach(doc => {
          matchBatch.update(doc.ref, {
            away_team_id: newTeamId,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
          });
        });
        await matchBatch.commit();
        matchesUpdated += awayMatchesSnapshot.size;
      }
      
      if (matchesUpdated > 0) {
        console.log(`   ✅ Updated ${matchesUpdated} matches document(s)\n`);
      } else {
        console.log(`   ℹ️  No matches documents found\n`);
      }
      
      // 6. Update owners documents
      console.log(`6️⃣  Updating owners documents...`);
      const ownersSnapshot = await db.collection('owners')
        .where('team_id', '==', oldTeamId)
        .get();
      
      if (!ownersSnapshot.empty) {
        const ownersBatch = db.batch();
        ownersSnapshot.docs.forEach(doc => {
          ownersBatch.update(doc.ref, {
            team_id: newTeamId,
            old_team_id: oldTeamId,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
          });
        });
        await ownersBatch.commit();
        console.log(`   ✅ Updated ${ownersSnapshot.size} owners document(s)\n`);
      } else {
        console.log(`   ℹ️  No owners documents found\n`);
      }
      
      // 7. Update users document (if user has teamId field)
      console.log(`7️⃣  Updating users documents...`);
      const usersSnapshot = await db.collection('users')
        .where('teamId', '==', oldTeamId)
        .get();
      
      if (!usersSnapshot.empty) {
        const usersBatch = db.batch();
        usersSnapshot.docs.forEach(doc => {
          usersBatch.update(doc.ref, {
            teamId: newTeamId,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
          });
        });
        await usersBatch.commit();
        console.log(`   ✅ Updated ${usersSnapshot.size} users document(s)\n`);
      } else {
        console.log(`   ℹ️  No users documents found with teamId\n`);
      }
      
      // 8. Delete old team document
      console.log(`8️⃣  Deleting old team document: ${oldTeamId}`);
      await db.collection('teams').doc(oldTeamId).delete();
      console.log(`   ✅ Deleted old team document\n`);
      
      console.log(`✅ Successfully migrated ${oldTeamId} → ${newTeamId}\n`);
      
      nextTeamNumber++;
      
    } catch (error) {
      console.error(`❌ Error migrating team ${oldTeamId}:`, error);
      console.error('   Stopping migration to prevent data corruption\n');
      throw error;
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('🎉 Migration Complete!');
  console.log('='.repeat(80));
  console.log(`\n✅ Successfully migrated ${teamsToMigrate.length} team(s)`);
  console.log(`🔢 Next available team ID: SSPSLT${nextTeamNumber.toString().padStart(4, '0')}\n`);
}

// Run the migration
async function main() {
  try {
    await migrateTeamIds();
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

main();
