const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

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
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || `https://${process.env.FIREBASE_ADMIN_PROJECT_ID}-default-rtdb.firebaseio.com`,
    });
  } else if (projectId) {
    admin.initializeApp({
      projectId: projectId,
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || `https://${projectId}-default-rtdb.firebaseio.com`,
    });
  } else {
    admin.initializeApp();
  }
}

const db = admin.firestore();

async function checkTeamMixing() {
  try {
    console.log('🔍 CHECKING FOR TEAM DATA MIXING\n');
    console.log('=' .repeat(70));
    
    const issues = [];
    
    // Check Firebase collections
    console.log('\n📦 FIREBASE COLLECTIONS:\n');
    
    // 1. Check teams collection
    console.log('1️⃣  Checking teams collection...');
    const team0001 = await db.collection('teams').doc('SSPSLT0001').get();
    const team0034 = await db.collection('teams').doc('SSPSLT0034').get();
    
    if (team0001.exists) {
      const data = team0001.data();
      console.log(`   SSPSLT0001: ${data.team_name} (Owner: ${data.owner_name})`);
      console.log(`   Seasons: [${data.seasons?.join(', ')}]`);
      
      if (data.team_name !== 'Classic Tens') {
        issues.push(`❌ SSPSLT0001 has wrong team name: ${data.team_name}`);
      }
      if (data.owner_name !== 'AKSHAY') {
        issues.push(`❌ SSPSLT0001 has wrong owner: ${data.owner_name}`);
      }
    } else {
      issues.push('❌ SSPSLT0001 (Classic Tens) not found!');
    }
    
    if (team0034.exists) {
      const data = team0034.data();
      console.log(`   SSPSLT0034: ${data.team_name} (Owner: ${data.owner_name})`);
      console.log(`   Seasons: [${data.seasons?.join(', ')}]`);
      
      if (data.team_name !== 'Los Blancos') {
        issues.push(`❌ SSPSLT0034 has wrong team name: ${data.team_name}`);
      }
      if (data.owner_name !== 'losblancos') {
        issues.push(`❌ SSPSLT0034 has wrong owner: ${data.owner_name}`);
      }
    } else {
      issues.push('❌ SSPSLT0034 (Los Blancos) not found!');
    }
    
    // 2. Check teamstats collection
    console.log('\n2️⃣  Checking teamstats collection...');
    const teamstats0001 = await db.collection('teamstats')
      .where('team_id', '==', 'SSPSLT0001')
      .get();
    
    console.log(`   SSPSLT0001: ${teamstats0001.size} documents`);
    teamstats0001.forEach(doc => {
      const data = doc.data();
      console.log(`      - ${doc.id}: ${data.team_name} (${data.season_id})`);
      
      if (data.team_name === 'Los Blancos') {
        issues.push(`❌ teamstats ${doc.id} has Los Blancos data but team_id is SSPSLT0001`);
      }
    });
    
    const teamstats0034 = await db.collection('teamstats')
      .where('team_id', '==', 'SSPSLT0034')
      .get();
    
    console.log(`   SSPSLT0034: ${teamstats0034.size} documents`);
    teamstats0034.forEach(doc => {
      const data = doc.data();
      console.log(`      - ${doc.id}: ${data.team_name} (${data.season_id})`);
      
      if (data.team_name === 'Classic Tens') {
        issues.push(`❌ teamstats ${doc.id} has Classic Tens data but team_id is SSPSLT0034`);
      }
    });
    
    // 3. Check team_seasons collection
    console.log('\n3️⃣  Checking team_seasons collection...');
    
    const checkSeasons = ['SSPSLS16', 'SSPSLS17', 'SSPSLS11', 'SSPSLS12', 'SSPSLS13', 'SSPSLS15'];
    
    for (const season of checkSeasons) {
      const doc0001 = await db.collection('team_seasons').doc(`SSPSLT0001_${season}`).get();
      const doc0034 = await db.collection('team_seasons').doc(`SSPSLT0034_${season}`).get();
      
      if (doc0001.exists) {
        const data = doc0001.data();
        console.log(`   SSPSLT0001_${season}: ${data.team_name || 'N/A'}`);
        
        if (season === 'SSPSLS16' || season === 'SSPSLS17') {
          issues.push(`❌ SSPSLT0001_${season} exists but should be SSPSLT0034_${season} (Los Blancos)`);
        }
      }
      
      if (doc0034.exists) {
        const data = doc0034.data();
        console.log(`   SSPSLT0034_${season}: ${data.team_name || 'N/A'}`);
        
        if (season === 'SSPSLS11' || season === 'SSPSLS12' || season === 'SSPSLS13' || season === 'SSPSLS15') {
          issues.push(`❌ SSPSLT0034_${season} exists but should be SSPSLT0001_${season} (Classic Tens)`);
        }
      }
    }
    
    // 4. Check realplayerstats collection
    console.log('\n4️⃣  Checking realplayerstats collection...');
    const playerStats0001 = await db.collection('realplayerstats')
      .where('team_id', '==', 'SSPSLT0001')
      .limit(5)
      .get();
    
    console.log(`   SSPSLT0001: ${playerStats0001.size} documents (showing first 5)`);
    playerStats0001.forEach(doc => {
      const data = doc.data();
      console.log(`      - ${data.player_name}: ${data.team_name} (${data.season_id})`);
      
      if (data.team_name === 'Los Blancos' && (data.season_id === 'SSPSLS16' || data.season_id === 'SSPSLS17')) {
        issues.push(`❌ Player stat ${doc.id} has Los Blancos data but team_id is SSPSLT0001`);
      }
    });
    
    const playerStats0034 = await db.collection('realplayerstats')
      .where('team_id', '==', 'SSPSLT0034')
      .limit(5)
      .get();
    
    console.log(`   SSPSLT0034: ${playerStats0034.size} documents (showing first 5)`);
    playerStats0034.forEach(doc => {
      const data = doc.data();
      console.log(`      - ${data.player_name}: ${data.team_name} (${data.season_id})`);
      
      if (data.team_name === 'Classic Tens') {
        issues.push(`❌ Player stat ${doc.id} has Classic Tens data but team_id is SSPSLT0034`);
      }
    });
    
    // 5. Check match-related collections
    console.log('\n5️⃣  Checking match-related collections...');
    
    const matchesWithTeam = await db.collection('matches')
      .where('team_ids', 'array-contains', 'SSPSLT0001')
      .limit(3)
      .get();
    
    console.log(`   Matches with SSPSLT0001: ${matchesWithTeam.size} (showing first 3)`);
    matchesWithTeam.forEach(doc => {
      const data = doc.data();
      console.log(`      - ${doc.id}: ${data.home_team_name} vs ${data.away_team_name} (${data.season_id})`);
    });
    
    // Note: Neon database check requires pg module
    
    // Print summary
    console.log('\n' + '='.repeat(70));
    console.log('\n📋 SUMMARY:\n');
    
    if (issues.length === 0) {
      console.log('✅ NO ISSUES FOUND! All data is correctly organized.');
      console.log('\n   SSPSLT0001 → Classic Tens (AKSHAY) ✓');
      console.log('   SSPSLT0034 → Los Blancos (losblancos) ✓');
    } else {
      console.log(`❌ FOUND ${issues.length} ISSUE(S):\n`);
      issues.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue}`);
      });
    }
    
    console.log('\n' + '='.repeat(70) + '\n');
    
  } catch (error) {
    console.error('❌ Error checking team mixing:', error);
    throw error;
  }
}

// Run the check
checkTeamMixing()
  .then(() => {
    console.log('Check completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Check failed:', error);
    process.exit(1);
  });
