import dotenv from 'dotenv';
import { resolve } from 'path';
import * as admin from 'firebase-admin';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

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

const adminDb = admin.firestore();

async function updateFirebaseTeamNames() {
  console.log('🔄 Updating Firebase team names...\n');
  
  // Team 1: SSPSLT0007 (Barcelona) -> FC Barcelona(A)
  console.log('Step 1: Updating SSPSLT0007 to "FC Barcelona(A)"...');
  
  const team1Ref = adminDb.collection('teams').doc('SSPSLT0007');
  const team1Doc = await team1Ref.get();
  
  if (team1Doc.exists) {
    const currentName = team1Doc.data()?.name;
    console.log(`  Current name: "${currentName}"`);
    
    await team1Ref.update({
      name: 'FC Barcelona(A)',
      team_name: 'FC Barcelona(A)',
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('  ✅ Updated to "FC Barcelona(A)"\n');
  } else {
    console.log('  ⚠️ Team document not found in Firebase\n');
  }
  
  // Team 2: SSPSLT0006 (Azzuri) -> FC Barcelona
  console.log('Step 2: Updating SSPSLT0006 to "FC Barcelona"...');
  
  const team2Ref = adminDb.collection('teams').doc('SSPSLT0006');
  const team2Doc = await team2Ref.get();
  
  if (team2Doc.exists) {
    const currentName = team2Doc.data()?.name;
    console.log(`  Current name: "${currentName}"`);
    
    await team2Ref.update({
      name: 'FC Barcelona',
      team_name: 'FC Barcelona',
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('  ✅ Updated to "FC Barcelona"\n');
  } else {
    console.log('  ⚠️ Team document not found in Firebase\n');
  }
  
  // Verify changes
  console.log('📋 Verification - Firebase team names:\n');
  
  const verify1 = await team1Ref.get();
  if (verify1.exists) {
    console.log(`SSPSLT0007: "${verify1.data()?.name}"`);
  }
  
  const verify2 = await team2Ref.get();
  if (verify2.exists) {
    console.log(`SSPSLT0006: "${verify2.data()?.name}"`);
  }
  
  console.log('\n✅ Firebase update complete!');
}

updateFirebaseTeamNames()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
