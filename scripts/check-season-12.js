/**
 * Check Season 12 Status in Firebase
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

async function checkSeason12() {
  console.log('🔍 Checking Season 12 in Firebase...\n');
  
  try {
    // Get all seasons
    const seasonsSnapshot = await db.collection('seasons').get();
    
    console.log(`Found ${seasonsSnapshot.size} total seasons\n`);
    
    // Look for Season 12
    let season12 = null;
    seasonsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.name && data.name.includes('12')) {
        season12 = { id: doc.id, ...data };
        console.log('Found Season 12:');
        console.log(`  Document ID: ${doc.id}`);
        console.log(`  Name: ${data.name}`);
        console.log(`  Short Name: ${data.short_name || 'N/A'}`);
        console.log(`  Start Date: ${data.start_date ? (data.start_date.toDate ? data.start_date.toDate() : data.start_date) : 'Not set'}`);
        console.log(`  End Date: ${data.end_date ? (data.end_date.toDate ? data.end_date.toDate() : data.end_date) : 'Not set'}`);
        console.log(`  Active: ${data.is_active || false}`);
      }
    });
    
    if (!season12) {
      console.log('❌ Season 12 NOT FOUND in Firebase seasons collection');
      console.log('\nAll seasons:');
      seasonsSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`  - ${doc.id}: ${data.name || 'No name'} (${data.short_name || 'No short name'})`);
      });
    } else {
      console.log('\n');
      if (season12.start_date) {
        const startDate = season12.start_date.toDate ? season12.start_date.toDate() : new Date(season12.start_date);
        const now = new Date();
        
        if (startDate > now) {
          console.log('⚠️  ISSUE: Season 12 start date is in the FUTURE');
          console.log(`   Start: ${startDate}`);
          console.log(`   Now: ${now}`);
          console.log('\n   This is why it\'s not showing on player pages!');
        } else {
          console.log('✅ Season 12 has started and should be visible');
        }
      } else {
        console.log('✅ Season 12 has no start_date, so it should be visible');
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkSeason12();
