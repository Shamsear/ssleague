import { fantasySql } from '../lib/neon/fantasy-config';
import { adminDb } from '../lib/firebase/admin';

async function autoFixOwnerUids() {
  try {
    console.log('🔧 Auto-fixing fantasy team owner UIDs...\n');
    
    // Get all fantasy teams
    const teams = await fantasySql`
      SELECT id, team_id, real_team_name, owner_uid, owner_name 
      FROM fantasy_teams
      ORDER BY id ASC
    `;
    
    console.log(`Found ${teams.length} fantasy teams\n`);
    
    for (const team of teams) {
      console.log(`\n📋 Team: ${team.real_team_name}`);
      console.log(`   Team ID: ${team.team_id}`);
      console.log(`   Current owner_uid: ${team.owner_uid || '(empty)'}`);
      
      // Look up the team in Firebase to get the correct UID
      try {
        const teamDoc = await adminDb.collection('teams').doc(team.team_id).get();
        
        if (!teamDoc.exists) {
          console.log(`   ⚠️  Team not found in Firebase teams collection`);
          continue;
        }
        
        const teamData = teamDoc.data()!;
        const correctUid = teamData.uid;
        
        if (!correctUid) {
          console.log(`   ⚠️  No 'uid' field in Firebase team document`);
          continue;
        }
        
        // Check if it's a valid Firebase UID (20+ chars with lowercase)
        const isValidUid = correctUid.length >= 20 && /[a-z]/.test(correctUid);
        
        if (!isValidUid) {
          console.log(`   ⚠️  Invalid UID format: ${correctUid}`);
          continue;
        }
        
        // Update if different
        if (correctUid !== team.owner_uid) {
          console.log(`   ✅ Updating to correct UID: ${correctUid}`);
          
          await fantasySql`
            UPDATE fantasy_teams
            SET owner_uid = ${correctUid},
                updated_at = NOW()
            WHERE id = ${team.id}
          `;
          
          console.log(`   ✅ Updated successfully!`);
        } else {
          console.log(`   ✓ Already correct`);
        }
        
      } catch (error) {
        console.log(`   ❌ Error processing team: ${error}`);
      }
    }
    
    console.log('\n\n✅ Fix complete!');
    console.log('\n📊 Final verification:\n');
    
    const updated = await fantasySql`
      SELECT team_id, real_team_name, owner_uid, owner_name 
      FROM fantasy_teams
      ORDER BY id ASC
    `;
    
    console.log('Fantasy teams after update:');
    updated.forEach((team: any) => {
      const isValidUid = team.owner_uid && team.owner_uid.length >= 20 && /[a-z]/.test(team.owner_uid);
      console.log(`${isValidUid ? '✅' : '❌'} ${team.real_team_name}`);
      console.log(`   owner_uid: ${team.owner_uid || '(empty)'}`);
      console.log(`   owner_name: ${team.owner_name || '(empty)'}\n`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

autoFixOwnerUids();
