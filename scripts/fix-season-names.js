/**
 * Fix Season Names
 * Add name and short_name fields to seasons that are missing them
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

async function fixSeasonNames() {
  console.log('🔧 Fixing season names...\n');
  
  const seasonsToFix = [
    { id: 'SSPSLS12', name: 'Season 12', short_name: 'S12' },
    { id: 'SSPSLS13', name: 'Season 13', short_name: 'S13' },
    { id: 'SSPSLS14', name: 'Season 14', short_name: 'S14' },
    { id: 'SSPSLS15', name: 'Season 15', short_name: 'S15' },
  ];
  
  try {
    for (const season of seasonsToFix) {
      const seasonRef = db.collection('seasons').doc(season.id);
      const seasonDoc = await seasonRef.get();
      
      if (!seasonDoc.exists) {
        console.log(`❌ ${season.id} does not exist`);
        continue;
      }
      
      const data = seasonDoc.data();
      
      if (!data.name || !data.short_name) {
        await seasonRef.update({
          name: season.name,
          short_name: season.short_name,
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log(`✅ Updated ${season.id}:`);
        console.log(`   Name: ${season.name}`);
        console.log(`   Short Name: ${season.short_name}\n`);
      } else {
        console.log(`✓ ${season.id} already has name: ${data.name}\n`);
      }
    }
    
    console.log('✅ Complete! All seasons now have names.');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

fixSeasonNames();
