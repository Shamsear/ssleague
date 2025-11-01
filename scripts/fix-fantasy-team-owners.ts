import { fantasySql } from '../lib/neon/fantasy-config';
import { adminDb } from '../lib/firebase/admin';

async function fixFantasyTeamOwners() {
  try {
    console.log('🔧 Fixing fantasy team owner_uid values...\n');
    
    // Get all fantasy teams with non-Firebase UIDs (no lowercase letters or too short)
    const teams = await fantasySql`
      SELECT team_id, owner_uid, owner_name, real_team_name 
      FROM fantasy_teams
      WHERE LENGTH(owner_uid) < 20 OR owner_uid !~ '[a-z]'
    `;
    
    console.log(`Found ${teams.length} teams with incorrect owner_uid\n`);
    
    for (const team of teams) {
      console.log(`\n📋 Team: ${team.real_team_name}`);
      console.log(`   Current owner_uid: ${team.owner_uid}`);
      console.log(`   Real team ID: ${team.team_id}`);
      
      // Try to find the Firebase user by team_id
      const teamDoc = await adminDb.collection('teams').doc(team.team_id).get();
      
      if (teamDoc.exists) {
        const teamData = teamDoc.data()!;
        const correctUid = teamData.uid;
        
        if (correctUid && correctUid !== team.owner_uid) {
          console.log(`   ✅ Found correct UID: ${correctUid}`);
          
          // Update the owner_uid
          await fantasySql`
            UPDATE fantasy_teams
            SET owner_uid = ${correctUid},
                updated_at = NOW()
            WHERE team_id = ${team.team_id}
          `;
          
          console.log(`   ✅ Updated!`);
        } else {
          console.log(`   ⚠️  No UID found in Firebase teams collection`);
        }
      } else {
        console.log(`   ❌ Team document not found in Firebase`);
      }
    }
    
    console.log('\n\n✅ Migration complete!');
    console.log('\n📊 Verifying results...\n');
    
    const fixed = await fantasySql`
      SELECT team_id, owner_uid, owner_name, real_team_name 
      FROM fantasy_teams
      ORDER BY id ASC
    `;
    
    console.log('Current fantasy teams:');
    fixed.forEach((team: any) => {
      const isValidUid = team.owner_uid.length >= 20 && /[a-z]/.test(team.owner_uid);
      console.log(`${isValidUid ? '✅' : '❌'} ${team.real_team_name} - owner_uid: ${team.owner_uid}`);
    });
    
  } catch (error) {
    console.error('❌ Error fixing fantasy team owners:', error);
    process.exit(1);
  }
}

fixFantasyTeamOwners();
