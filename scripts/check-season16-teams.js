const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  try {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
    
    if (process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
      console.log('Firebase Admin initialized with service account');
    } else if (projectId) {
      admin.initializeApp({
        projectId: projectId,
      });
      console.log(`Firebase Admin initialized with project ID: ${projectId}`);
    } else {
      admin.initializeApp();
      console.log('Firebase Admin initialized with default credentials');
    }
  } catch (error) {
    console.error('Firebase admin initialization error:', error);
    process.exit(1);
  }
}

const db = admin.firestore();

async function checkSeason16Teams() {
  try {
    console.log('\n🔍 Checking teams registered to Season 16...\n');
    
    const snapshot = await db.collection('teamSeasons')
      .where('season_id', '==', 'season_16')
      .get();
    
    console.log(`📊 Total teams registered to season 16: ${snapshot.size}\n`);
    
    if (snapshot.empty) {
      console.log('❌ No teams found registered to season 16');
      return;
    }
    
    let dualCurrencyCount = 0;
    let singleCurrencyCount = 0;
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const isDualCurrency = data.currency_system === 'dual';
      
      if (isDualCurrency) dualCurrencyCount++;
      else singleCurrencyCount++;
      
      console.log('─────────────────────────────────────────');
      console.log(`Team ID: ${doc.id}`);
      console.log(`Season ID: ${data.season_id}`);
      console.log(`Status: ${data.status || 'N/A'}`);
      console.log(`\n💰 Currency System: ${data.currency_system || 'single (default)'}`);
      
      if (isDualCurrency) {
        console.log(`\n⚽ Football Budget (€): ${data.football_budget || 0}`);
        console.log(`   Football Spent (€): ${data.football_spent || 0}`);
        console.log(`   Football Remaining (€): ${(data.football_budget || 0) - (data.football_spent || 0)}`);
        
        console.log(`\n🎮 Real Player Budget ($): ${data.real_player_budget || 0}`);
        console.log(`   Real Player Spent ($): ${data.real_player_spent || 0}`);
        console.log(`   Real Player Remaining ($): ${(data.real_player_budget || 0) - (data.real_player_spent || 0)}`);
        
        if (data.balance !== undefined || data.total_spent !== undefined) {
          console.log(`\n⚠️  Legacy fields also present:`);
          console.log(`   Legacy Balance: ${data.balance}`);
          console.log(`   Legacy Total Spent: ${data.total_spent}`);
        }
      } else {
        console.log(`\n💷 Balance: ${data.balance || 0}`);
        console.log(`   Total Spent: ${data.total_spent || 0}`);
        console.log(`   Remaining: ${(data.balance || 0)}`);
      }
      
      // Get team name
      try {
        const userDoc = await db.collection('users').doc(doc.id).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          console.log(`\nTeam Name: ${userData.teamName || userData.username || 'Unknown'}`);
        }
      } catch (err) {
        console.log('\nTeam Name: Could not fetch');
      }
      
      console.log('');
    }
    
    console.log('═════════════════════════════════════════');
    console.log('\n📈 Summary:');
    console.log(`   Total Teams: ${snapshot.size}`);
    console.log(`   ✅ Dual Currency Teams: ${dualCurrencyCount}`);
    console.log(`   💷 Single Currency Teams: ${singleCurrencyCount}`);
    console.log('');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

checkSeason16Teams();
