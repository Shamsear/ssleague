/**
 * Check SSPSLS12 Season Details
 */

const admin = require('firebase-admin');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n')
    })
  });
}

const db = admin.firestore();

async function checkSSPSLS12() {
  console.log('🔍 Checking SSPSLS12 season document...\n');
  
  try {
    const seasonDoc = await db.collection('seasons').doc('SSPSLS12').get();
    
    if (!seasonDoc.exists) {
      console.log('❌ SSPSLS12 document does NOT exist!');
      return;
    }
    
    const data = seasonDoc.data();
    console.log('✅ Found SSPSLS12:');
    console.log(JSON.stringify(data, null, 2));
    
    console.log('\n📅 Date Analysis:');
    if (data.start_date) {
      const startDate = data.start_date.toDate ? data.start_date.toDate() : new Date(data.start_date);
      const now = new Date();
      
      console.log(`  Start Date: ${startDate}`);
      console.log(`  Current Date: ${now}`);
      console.log(`  Has Started: ${startDate <= now ? 'YES ✅' : 'NO ❌'}`);
      
      if (startDate > now) {
        console.log('\n⚠️  PROBLEM: Start date is in the FUTURE!');
        console.log('   This season will be filtered out on player pages.');
      }
    } else {
      console.log('  No start_date field - should be visible ✅');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkSSPSLS12();
