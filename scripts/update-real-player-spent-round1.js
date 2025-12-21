/**
 * Update real_player_spent for all 14 teams based on Round 1 salary deductions
 * 
 * This adds the salary amounts to real_player_spent field
 */

const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

// Initialize Firebase Admin
if (!admin.apps.length) {
  if (process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
    console.log('✅ Firebase Admin initialized\n');
  } else {
    admin.initializeApp();
    console.log('✅ Firebase Admin initialized with default credentials\n');
  }
}

const db = admin.firestore();

// Round 1 salary deductions from the previous run
const round1Deductions = {
  'SSPSLT0002': 3.89,   // Manchester United
  'SSPSLT0004': 3.29,   // Red Hawks FC
  'SSPSLT0006': 3.35,   // FC Barcelona
  'SSPSLT0008': 5.32,   // La Masia
  'SSPSLT0009': 3.79,   // Qatar Gladiators
  'SSPSLT0010': 3.32,   // Varsity Soccers
  'SSPSLT0013': 4.75,   // Psychoz
  'SSPSLT0015': 5.10,   // Legends FC
  'SSPSLT0016': 4.34,   // Blue Strikers
  'SSPSLT0020': 4.86,   // Skill 555
  'SSPSLT0021': 5.28,   // Los Galacticos
  'SSPSLT0023': 3.79,   // Kopites
  'SSPSLT0026': 3.60,   // Portland Timbers
  'SSPSLT0034': 3.71,   // Los Blancos
};

async function updateRealPlayerSpent() {
  try {
    const seasonId = 'SSPSLS16';
    
    console.log('🔍 Updating real_player_spent for all 14 teams...\n');
    
    let totalUpdated = 0;
    let totalSpent = 0;
    
    for (const [teamId, salaryAmount] of Object.entries(round1Deductions)) {
      // Find team_season document
      const teamSeasonsSnapshot = await db.collection('team_seasons')
        .where('team_id', '==', teamId)
        .where('season_id', '==', seasonId)
        .limit(1)
        .get();
      
      if (teamSeasonsSnapshot.empty) {
        console.log(`⚠️  Team ${teamId} not found - SKIPPING`);
        continue;
      }
      
      const teamSeasonDoc = teamSeasonsSnapshot.docs[0];
      const teamSeasonData = teamSeasonDoc.data();
      const teamName = teamSeasonData.team_name;
      const currentSpent = teamSeasonData.real_player_spent || 0;
      const newSpent = currentSpent + salaryAmount;
      
      // Update the document
      await db.collection('team_seasons').doc(teamSeasonDoc.id).update({
        real_player_spent: newSpent,
        updated_at: new Date()
      });
      
      console.log(`✅ ${teamName}`);
      console.log(`   Team ID: ${teamId}`);
      console.log(`   Old spent: ${currentSpent.toFixed(2)}`);
      console.log(`   Salary: +${salaryAmount.toFixed(2)}`);
      console.log(`   New spent: ${newSpent.toFixed(2)}`);
      console.log();
      
      totalUpdated++;
      totalSpent += salaryAmount;
    }
    
    console.log('═'.repeat(60));
    console.log('📊 SUMMARY');
    console.log('═'.repeat(60));
    console.log(`✅ Teams updated: ${totalUpdated}`);
    console.log(`💰 Total salary added to spent: ${totalSpent.toFixed(2)} SSCoin`);
    console.log('\n✅ ALL DONE!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

updateRealPlayerSpent();
