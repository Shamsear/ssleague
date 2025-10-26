import { fantasySql } from '../lib/neon/fantasy-config';

async function setOwnerUids() {
  try {
    console.log('Setting owner_uid for fantasy teams manually...\n');

    // You need to provide the correct owner UIDs here
    // These should be the Firebase user UIDs of the team owners
    
    const updates = [
      { team_id: 'SSPSLT0013', owner_uid: 'lQB3d7CDn1Wj5ThCX5q0leTWiiB2' },  // Psychoz - GOKU
      { team_id: 'SSPSLT0018', owner_uid: 'UHULi3G7ivdI9AEcdvz2OuEVD4u1' },   // Titans FC - RUKSHAN
    ];

    console.log('Updating owner UIDs for fantasy teams...\n');
    console.log('Current teams:');
    
    const teams = await fantasySql`
      SELECT team_id, real_team_name, owner_name, owner_uid
      FROM fantasy_teams
    `;

    teams.forEach(t => {
      console.log(`  ${t.real_team_name} (${t.owner_name})`);
      console.log(`    Team ID: ${t.team_id}`);
      console.log(`    Current owner_uid: ${t.owner_uid || '(empty)'}`);
      console.log('');
    });

    console.log('\nUpdating database...\n');

    for (const update of updates) {
      await fantasySql`
        UPDATE fantasy_teams
        SET owner_uid = ${update.owner_uid},
            updated_at = CURRENT_TIMESTAMP
        WHERE team_id = ${update.team_id}
      `;

      console.log(`✅ Updated ${update.team_id} with owner_uid: ${update.owner_uid}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

setOwnerUids();
