require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');
const { neon } = require('@neondatabase/serverless');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();
const sql = neon(process.env.DATABASE_URL);

(async () => {
  try {
    // Get active season from Firebase
    const seasonsSnapshot = await db.collection('seasons')
      .where('isActive', '==', true)
      .limit(1)
      .get();
    
    if (seasonsSnapshot.empty) {
      console.log('No active season found in Firebase!');
      return;
    }
    
    const activeSeasonDoc = seasonsSnapshot.docs[0];
    const activeSeason = { id: activeSeasonDoc.id, ...activeSeasonDoc.data() };
    
    console.log('Active Season from Firebase:');
    console.log(JSON.stringify(activeSeason, null, 2));
    
    // Get tournaments for active season from PostgreSQL
    const tournaments = await sql`
      SELECT id, tournament_name, tournament_type, status, is_primary, display_order 
      FROM tournaments 
      WHERE season_id = ${activeSeason.id} 
      ORDER BY display_order ASC
    `;
    
    console.log('\nTournaments for active season from PostgreSQL:');
    console.log(JSON.stringify(tournaments, null, 2));
    
    // Check team_seasons for a sample team
    const teamSeasonsSnapshot = await db.collection('team_seasons')
      .where('season_id', '==', activeSeason.id)
      .where('status', '==', 'registered')
      .limit(5)
      .get();
    
    console.log('\nSample registered teams from Firebase:');
    teamSeasonsSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`- Team: ${data.user_id}, Season: ${data.season_id}, Status: ${data.status}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
})();
