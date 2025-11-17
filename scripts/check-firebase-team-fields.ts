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

async function checkFirebaseFields() {
  console.log('🔍 Checking Firebase team fields...\n');
  
  const teamIds = ['SSPSLT0007', 'SSPSLT0006'];
  
  for (const teamId of teamIds) {
    const teamRef = adminDb.collection('teams').doc(teamId);
    const teamDoc = await teamRef.get();
    
    if (teamDoc.exists) {
      const data = teamDoc.data();
      console.log(`${teamId}:`);
      console.log(`  name: "${data?.name}"`);
      console.log(`  team_name: "${data?.team_name}"`);
      console.log();
    } else {
      console.log(`${teamId}: Document not found\n`);
    }
  }
}

checkFirebaseFields()
  .then(() => {
    console.log('✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
