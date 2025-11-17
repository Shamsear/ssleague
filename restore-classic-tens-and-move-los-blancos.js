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

async function restoreClassicTensAndMoveLosBlancas() {
  try {
    console.log('🔄 Starting restoration process...\n');

    // Step 1: Get the current Los Blancos data from SSPSLT0001
    const losBlancosCurrent = await db.collection('teams').doc('SSPSLT0001').get();
    const losBlancoesData = losBlancosCurrent.data();

    console.log('📋 Current data at SSPSLT0001:');
    console.log(`   Team: ${losBlancoesData.team_name}`);
    console.log(`   Owner: ${losBlancoesData.owner_name}`);
    console.log(`   Seasons: [${losBlancoesData.seasons?.join(', ')}]`);
    console.log('');

    // Step 2: Find the next available team ID
    const teamsSnapshot = await db.collection('teams').get();
    const teamIds = teamsSnapshot.docs.map(doc => doc.id);
    
    // Extract team numbers and find the highest
    const teamNumbers = teamIds
      .filter(id => id.startsWith('SSPSLT'))
      .map(id => parseInt(id.replace('SSPSLT', '')))
      .filter(num => !isNaN(num));
    
    const maxTeamNumber = Math.max(...teamNumbers);
    const newTeamId = `SSPSLT${String(maxTeamNumber + 1).padStart(4, '0')}`;

    console.log(`🆕 Creating new team ID for Los Blancos: ${newTeamId}\n`);

    // Step 3: Create Los Blancos at new ID
    const losBlancoesNewData = {
      ...losBlancoesData,
      id: newTeamId,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection('teams').doc(newTeamId).set(losBlancoesNewData);
    console.log(`✅ Los Blancos moved to ${newTeamId}`);

    // Step 4: Update any related documents (teamstats, player stats, etc.)
    console.log('\n🔄 Updating related documents...');
    
    // Update teamstats documents
    const teamstatsSnapshot = await db.collection('teamstats')
      .where('team_id', '==', 'SSPSLT0001')
      .get();
    
    if (!teamstatsSnapshot.empty) {
      const batch = db.batch();
      let updateCount = 0;

      for (const doc of teamstatsSnapshot.docs) {
        const seasonId = doc.data().season_id;
        const newDocId = `${newTeamId}_${seasonId}`;
        
        // Create new document with updated team_id
        const newDocRef = db.collection('teamstats').doc(newDocId);
        batch.set(newDocRef, {
          ...doc.data(),
          team_id: newTeamId,
        });
        
        // Delete old document
        batch.delete(doc.ref);
        updateCount++;
      }

      await batch.commit();
      console.log(`   ✅ Updated ${updateCount} teamstats documents`);
    }

    // Update realplayerstats documents
    const playerStatsSnapshot = await db.collection('realplayerstats')
      .where('team_id', '==', 'SSPSLT0001')
      .get();
    
    if (!playerStatsSnapshot.empty) {
      const batch = db.batch();
      let updateCount = 0;

      for (const doc of playerStatsSnapshot.docs) {
        batch.update(doc.ref, {
          team_id: newTeamId,
          team_name: losBlancoesData.team_name,
        });
        updateCount++;
      }

      await batch.commit();
      console.log(`   ✅ Updated ${updateCount} player stats documents`);
    }

    // Step 5: Restore Classic Tens to SSPSLT0001
    console.log('\n🔄 Restoring Classic Tens to SSPSLT0001...');
    
    const classicTensData = {
      id: 'SSPSLT0001',
      team_name: 'Classic Tens',
      teamName: 'Classic Tens',
      owner_name: 'AKSHAY',
      userId: 'peqzXzrQDRTYLRtgbdWcOTE36c63',
      user_id: 'peqzXzrQDRTYLRtgbdWcOTE36c63',
      uid: 'peqzXzrQDRTYLRtgbdWcOTE36c63',
      owner_uid: 'peqzXzrQDRTYLRtgbdWcOTE36c63',
      userEmail: 'classictens@historical.team',
      email: 'classictens@historical.team',
      logoUrl: 'https://ik.imagekit.io/ssleague/team-logos/peqzXzrQDRTYLRtgbdWcOTE36c63_1762280148426_IMG_4225_0szUrWA065.jpeg',
      logo_url: 'https://ik.imagekit.io/ssleague/team-logos/peqzXzrQDRTYLRtgbdWcOTE36c63_1762280148426_IMG_4225_0szUrWA065.jpeg',
      teamLogo: 'https://ik.imagekit.io/ssleague/team-logos/peqzXzrQDRTYLRtgbdWcOTE36c63_1762280148426_IMG_4225_0szUrWA065.jpeg',
      
      current_season_id: 'SSPSLS15',
      seasons: ['SSPSLS15'],
      
      is_active: false,
      isActive: false,
      is_historical: true,
      
      hasUserAccount: true,
      
      name_history: [],
      previous_names: [],
      
      total_seasons_participated: 1,
      
      role: 'team',
      
      is_approved: true,
      isApproved: true,
      approvedAt: admin.firestore.FieldValue.serverTimestamp(),
      approvedBy: 'system',
      
      committeeId: '',
      players: [],
      
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      
      fantasy_participating: false,
      fantasy_joined_at: null,
      fantasy_league_id: null,
      fantasy_player_points: 0,
      fantasy_team_bonus_points: 0,
      fantasy_total_points: 0,
      
      manager_name: ''
    };

    await db.collection('teams').doc('SSPSLT0001').set(classicTensData);
    console.log('✅ Classic Tens restored to SSPSLT0001');

    console.log(`\n${'='.repeat(60)}`);
    console.log('✅ RESTORATION COMPLETE!');
    console.log(`${'='.repeat(60)}`);
    console.log(`\n📊 Summary:`);
    console.log(`   SSPSLT0001 → Classic Tens (AKSHAY) - Historical Team`);
    console.log(`   ${newTeamId} → Los Blancos (losblancos) - Active Team`);
    console.log(`${'='.repeat(60)}\n`);

  } catch (error) {
    console.error('❌ Error during restoration:', error);
    throw error;
  }
}

// Run the restoration
restoreClassicTensAndMoveLosBlancas()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
