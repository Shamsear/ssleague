import { config } from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Load environment variables
config({ path: '.env.local' });

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

interface TeamLogoStatus {
  teamId: string;
  teamName: string;
  userId?: string;
  usersLogo?: string | null;
  teamsLogo?: string | null;
  teamSeasonsLogos: { [seasonId: string]: string | null };
  needsSync: boolean;
  issues: string[];
}

async function checkAndSyncTeamLogos() {
  console.log('🔍 Checking team logo synchronization across Firebase collections...\n');

  const results: TeamLogoStatus[] = [];

  try {
    // 1. Get all teams from the teams collection
    const teamsSnapshot = await db.collection('teams').get();
    console.log(`📊 Found ${teamsSnapshot.size} teams in teams collection\n`);

    for (const teamDoc of teamsSnapshot.docs) {
      const teamData = teamDoc.data();
      const teamId = teamDoc.id;
      const teamName = teamData.name || 'Unknown';
      const teamsLogo = teamData.logo_url || null;

      const status: TeamLogoStatus = {
        teamId,
        teamName,
        teamsLogo,
        teamSeasonsLogos: {},
        needsSync: false,
        issues: [],
      };

      console.log(`\n🏆 Team: ${teamName} (${teamId})`);
      console.log(`   teams.logo_url: ${teamsLogo || 'NOT SET'}`);

      // 2. Find corresponding user (if exists)
      const usersSnapshot = await db.collection('users')
        .where('teamId', '==', teamId)
        .limit(1)
        .get();

      if (!usersSnapshot.empty) {
        const userData = usersSnapshot.docs[0].data();
        const userId = usersSnapshot.docs[0].id;
        status.userId = userId;
        status.usersLogo = userData.logoUrl || null;
        
        console.log(`   users.logoUrl: ${status.usersLogo || 'NOT SET'} (${userId})`);

        // Check if users and teams logos match
        if (status.usersLogo !== teamsLogo) {
          status.needsSync = true;
          status.issues.push(`users.logoUrl (${status.usersLogo}) != teams.logo_url (${teamsLogo})`);
        }
      } else {
        console.log(`   ⚠️  No user account found for this team`);
      }

      // 3. Get all team_seasons for this team
      const teamSeasonsSnapshot = await db.collection('team_seasons')
        .where('team_id', '==', teamId)
        .get();

      console.log(`   📅 Found ${teamSeasonsSnapshot.size} season(s)`);

      teamSeasonsSnapshot.forEach(doc => {
        const seasonData = doc.data();
        const seasonId = seasonData.season_id;
        const teamLogo = seasonData.team_logo || null;
        
        status.teamSeasonsLogos[seasonId] = teamLogo;
        console.log(`      Season ${seasonId}: ${teamLogo || 'NOT SET'}`);

        // Check if team_seasons logo matches teams logo
        if (teamLogo !== teamsLogo) {
          status.needsSync = true;
          status.issues.push(`team_seasons[${seasonId}].team_logo (${teamLogo}) != teams.logo_url (${teamsLogo})`);
        }
      });

      if (status.issues.length > 0) {
        console.log(`   ❌ Issues found:`);
        status.issues.forEach(issue => console.log(`      - ${issue}`));
      } else {
        console.log(`   ✅ All logos synchronized`);
      }

      results.push(status);
    }

    // Summary
    console.log('\n\n📊 SUMMARY');
    console.log('='.repeat(80));
    
    const teamsNeedingSync = results.filter(r => r.needsSync);
    const teamsOk = results.filter(r => !r.needsSync);

    console.log(`✅ Teams with synchronized logos: ${teamsOk.length}`);
    console.log(`❌ Teams needing synchronization: ${teamsNeedingSync.length}`);

    if (teamsNeedingSync.length > 0) {
      console.log('\n\n⚠️  Teams with logo sync issues:');
      teamsNeedingSync.forEach(team => {
        console.log(`\n🏆 ${team.teamName} (${team.teamId})`);
        team.issues.forEach(issue => console.log(`   - ${issue}`));
      });

      // Ask if user wants to sync
      console.log('\n\n💡 To fix these issues, you can either:');
      console.log('   1. Use the profile edit page to re-upload the logo');
      console.log('   2. Manually update the Firebase collections');
      console.log('   3. Create a sync script to copy logos from teams to other collections');
    }

    console.log('\n✨ Check complete!\n');

  } catch (error) {
    console.error('❌ Error checking logos:', error);
    process.exit(1);
  }
}

// Run the check
checkAndSyncTeamLogos()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
