import { fantasySql } from '../lib/neon/fantasy-config';
import { adminDb } from '../lib/firebase/admin';

async function fixOwnerUids() {
  try {
    console.log('Fixing owner_uid for fantasy teams...\n');

    // Get all fantasy teams
    const teams = await fantasySql`
      SELECT team_id, real_team_name, owner_uid
      FROM fantasy_teams
    `;

    console.log(`Found ${teams.length} fantasy teams to check\n`);

    for (const team of teams) {
      console.log(`Checking ${team.real_team_name} (${team.team_id})...`);
      
      // Get team data from Firestore
      const teamDoc = await adminDb.collection('teams').doc(team.team_id).get();
      
      if (!teamDoc.exists) {
        console.log(`  ❌ Team not found in Firestore`);
        continue;
      }

      const teamData = teamDoc.data();
      const ownerUid = teamData?.uid;

      if (!ownerUid) {
        console.log(`  ⚠️  No uid field in Firestore for this team`);
        console.log(`  Available fields:`, Object.keys(teamData || {}));
        continue;
      }

      if (team.owner_uid === ownerUid) {
        console.log(`  ✓ Already has correct owner_uid: ${ownerUid}`);
        continue;
      }

      // Update the fantasy team with correct owner_uid
      await fantasySql`
        UPDATE fantasy_teams
        SET owner_uid = ${ownerUid},
            updated_at = CURRENT_TIMESTAMP
        WHERE team_id = ${team.team_id}
      `;

      console.log(`  ✅ Updated owner_uid to: ${ownerUid}`);
    }

    console.log('\n✅ All fantasy teams checked and updated!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixOwnerUids();
