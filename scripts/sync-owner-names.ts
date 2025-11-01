import { fantasySql } from '../lib/neon/fantasy-config';
import { adminDb } from '../lib/firebase/admin';

async function syncOwnerNames() {
  try {
    console.log('🔧 Syncing fantasy team owner names from Firebase...\n');
    
    const teams = await fantasySql`
      SELECT id, team_id, real_team_name, owner_uid, owner_name 
      FROM fantasy_teams
      WHERE owner_uid IS NOT NULL AND owner_uid != ''
      ORDER BY id ASC
    `;
    
    console.log(`Found ${teams.length} fantasy teams with owner_uid\n`);
    
    for (const team of teams) {
      console.log(`\n📋 Team: ${team.real_team_name}`);
      console.log(`   Current owner_name: ${team.owner_name}`);
      console.log(`   Owner UID: ${team.owner_uid}`);
      
      try {
        // Get user data from Firebase
        const userDoc = await adminDb.collection('users').doc(team.owner_uid).get();
        
        if (!userDoc.exists) {
          console.log(`   ⚠️  User not found in Firebase`);
          continue;
        }
        
        const userData = userDoc.data()!;
        
        // Prioritize: username > firstName > teamName
        const correctName = userData.username || userData.firstName || userData.teamName || team.owner_name;
        
        console.log(`   Firebase user data:`);
        console.log(`     - username: ${userData.username || '(none)'}`);
        console.log(`     - firstName: ${userData.firstName || '(none)'}`);
        console.log(`     - teamName: ${userData.teamName || '(none)'}`);
        console.log(`   → Using: ${correctName}`);
        
        if (correctName !== team.owner_name) {
          await fantasySql`
            UPDATE fantasy_teams
            SET owner_name = ${correctName},
                updated_at = NOW()
            WHERE id = ${team.id}
          `;
          console.log(`   ✅ Updated owner_name`);
        } else {
          console.log(`   ✓ Already correct`);
        }
        
      } catch (error) {
        console.log(`   ❌ Error: ${error}`);
      }
    }
    
    console.log('\n\n✅ Sync complete!');
    console.log('\n📊 Final state:\n');
    
    const updated = await fantasySql`
      SELECT team_id, real_team_name, owner_uid, owner_name 
      FROM fantasy_teams
      ORDER BY id ASC
    `;
    
    console.log('Fantasy teams:');
    updated.forEach((team: any) => {
      console.log(`\n${team.real_team_name}`);
      console.log(`  Owner: ${team.owner_name}`);
      console.log(`  UID: ${team.owner_uid || '(empty)'}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

syncOwnerNames();
