const { neon } = require('@neondatabase/serverless');
const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

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

async function diagnoseTeamPageIssue() {
  const teamId = 'SSPSLT0016';
  
  console.log(`\n🔍 Diagnosing team page issue for: ${teamId}\n`);
  
  try {
    // Step 1: Check what seasons this team has data in
    console.log('📋 Step 1: Checking team_players table for all seasons...');
    const auctionSql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);
    
    const allTeamPlayers = await auctionSql`
      SELECT DISTINCT season_id, COUNT(*) as player_count
      FROM team_players
      WHERE team_id = ${teamId}
      GROUP BY season_id
      ORDER BY season_id DESC
    `;
    
    console.log(`Found data in ${allTeamPlayers.length} seasons:`);
    allTeamPlayers.forEach(s => {
      console.log(`  - ${s.season_id}: ${s.player_count} football players`);
    });
    
    // Step 2: Check committee admin users and their assigned seasons
    console.log('\n📋 Step 2: Checking committee admin users...');
    const listUsers = await admin.auth().listUsers(1000);
    const committeeUsers = listUsers.users.filter(user => 
      user.customClaims?.role === 'committee_admin'
    );
    
    console.log(`Found ${committeeUsers.length} committee admin users:`);
    const seasonCounts = {};
    committeeUsers.forEach((user, i) => {
      const season = user.customClaims?.seasonId || 'NOT SET';
      seasonCounts[season] = (seasonCounts[season] || 0) + 1;
      console.log(`  ${i + 1}. ${user.email} → Season: ${season}`);
    });
    
    console.log('\nSeason distribution:');
    Object.entries(seasonCounts).forEach(([season, count]) => {
      console.log(`  ${season}: ${count} users`);
    });
    
    // Step 3: Check if there's a mismatch
    console.log('\n🔍 Step 3: Checking for potential issues...');
    const teamSeasons = new Set(allTeamPlayers.map(s => s.season_id));
    const committeeSeasons = new Set(
      committeeUsers
        .map(u => u.customClaims?.seasonId)
        .filter(s => s && s !== 'NOT SET')
    );
    
    console.log('\nTeam has data in seasons:', Array.from(teamSeasons).join(', '));
    console.log('Committee admins assigned to:', Array.from(committeeSeasons).join(', '));
    
    const missingSeasons = Array.from(committeeSeasons).filter(s => !teamSeasons.has(s));
    if (missingSeasons.length > 0) {
      console.log(`\n⚠️  ISSUE FOUND: Committee admins are assigned to seasons where team has NO data:`);
      missingSeasons.forEach(s => console.log(`  - ${s}`));
    }
    
    // Step 4: For each season the team has data in, check football players
    console.log('\n📋 Step 4: Checking football players by season...');
    for (const seasonData of allTeamPlayers) {
      const season = seasonData.season_id;
      console.log(`\nSeason ${season}:`);
      
      const footballPlayers = await auctionSql`
        SELECT 
          tp.player_id,
          tp.purchase_price,
          fp.name,
          fp.position,
          fp.overall_rating
        FROM team_players tp
        INNER JOIN footballplayers fp ON tp.player_id = fp.id
        WHERE tp.team_id = ${teamId}
          AND tp.season_id = ${season}
        LIMIT 3
      `;
      
      console.log(`  Query returned ${footballPlayers.length} players (showing first 3):`);
      footballPlayers.forEach((p, i) => {
        console.log(`    ${i + 1}. ${p.name} (${p.position}) - Rating: ${p.overall_rating}`);
      });
    }
    
    // Step 5: Check Firebase team_seasons
    console.log('\n📋 Step 5: Checking Firebase team_seasons...');
    const db = admin.firestore();
    const teamSeasonsSnapshot = await db.collection('team_seasons')
      .where('team_id', '==', teamId)
      .get();
    
    console.log(`Found ${teamSeasonsSnapshot.size} team_seasons documents:`);
    teamSeasonsSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`  - ${doc.id}: ${data.team_name || 'Unknown'}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

diagnoseTeamPageIssue();
