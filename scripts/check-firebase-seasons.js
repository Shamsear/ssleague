/**
 * Quick script to check all seasons in Firebase
 * Run: node scripts/check-firebase-seasons.js
 */

const admin = require('firebase-admin');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

async function checkSeasons() {
  console.log('🔍 Checking all seasons in Firebase...\n');

  try {
    const snapshot = await db.collection('seasons').get();
    
    if (snapshot.empty) {
      console.log('❌ No seasons found in Firebase!');
      return;
    }

    console.log(`Found ${snapshot.size} season(s):\n`);
    
    snapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`${index + 1}. Season ID: ${doc.id}`);
      console.log(`   Name: ${data.name || 'N/A'}`);
      console.log(`   Status: ${data.status || 'N/A'}`);
      console.log(`   isActive: ${data.isActive || false}`);
      console.log(`   is_historical: ${data.is_historical || false}`);
      console.log(`   season_number: ${data.season_number || 'N/A'}`);
      console.log(`   created_at: ${data.created_at?.toDate?.() || 'N/A'}`);
      console.log('');
    });

    // Check for active seasons
    const activeSeasons = snapshot.docs.filter(doc => {
      const data = doc.data();
      return data.isActive === true || data.status === 'active';
    });

    console.log('📊 Summary:');
    console.log(`   Total seasons: ${snapshot.size}`);
    console.log(`   Active seasons: ${activeSeasons.length}`);
    
    if (activeSeasons.length > 0) {
      console.log('\n✅ Active seasons found:');
      activeSeasons.forEach(doc => {
        const data = doc.data();
        console.log(`   - ${data.name || doc.id} (${data.status})`);
      });
    } else {
      console.log('\n❌ No active seasons found');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  process.exit(0);
}

checkSeasons();
