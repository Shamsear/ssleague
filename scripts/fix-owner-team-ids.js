require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function fixOwnerTeamIds() {
  const tournamentSql = neon(process.env.NEON_TOURNAMENT_DB_URL);
  const mainSql = neon(process.env.DATABASE_URL);

  console.log('🔍 Finding owners with incorrect team_id (Firebase UID instead of team ID)...\n');

  // Find owners where team_id looks like a Firebase UID (long alphanumeric)
  const ownersToFix = await tournamentSql`
    SELECT id, owner_id, name, team_id, registered_user_id
    FROM owners
    WHERE LENGTH(team_id) > 20  -- Firebase UIDs are long
    AND team_id NOT LIKE 'SSPSLT%'  -- Not already a proper team ID
  `;

  if (ownersToFix.length === 0) {
    console.log('✅ All owners have correct team_id format!\n');
    return;
  }

  console.log(`⚠️  Found ${ownersToFix.length} owner(s) with incorrect team_id:\n`);
  
  for (const owner of ownersToFix) {
    console.log(`Owner: ${owner.name} (${owner.owner_id})`);
    console.log(`  Current team_id: ${owner.team_id}`);
    console.log(`  Firebase UID: ${owner.registered_user_id}`);

    // Find the correct team_id from the teams table using registered_user_id
    const teams = await mainSql`
      SELECT id, name 
      FROM teams 
      WHERE firebase_uid = ${owner.registered_user_id}
      LIMIT 1
    `;

    if (teams.length > 0) {
      const correctTeamId = teams[0].id;
      console.log(`  ✅ Found correct team_id: ${correctTeamId} (${teams[0].name})`);

      // Update the owner record
      await tournamentSql`
        UPDATE owners
        SET team_id = ${correctTeamId},
            updated_at = NOW()
        WHERE id = ${owner.id}
      `;

      console.log(`  ✅ Updated!\n`);
    } else {
      console.log(`  ❌ WARNING: Could not find team for this user\n`);
    }
  }

  // Verify the fix
  console.log('✔️  Verification:\n');
  const remainingIssues = await tournamentSql`
    SELECT owner_id, name, team_id
    FROM owners
    WHERE LENGTH(team_id) > 20
    AND team_id NOT LIKE 'SSPSLT%'
  `;

  if (remainingIssues.length === 0) {
    console.log('✅ SUCCESS! All owners now have correct team_id format.\n');
    
    // Show final state
    const allOwners = await tournamentSql`
      SELECT owner_id, name, team_id, registered_user_id
      FROM owners
      ORDER BY id
    `;
    
    console.log('📊 Current owners:');
    allOwners.forEach(o => {
      console.log(`  ${o.owner_id}: ${o.name} → team_id: ${o.team_id}`);
    });
  } else {
    console.log('❌ Some issues remain:');
    remainingIssues.forEach(o => {
      console.log(`  ${o.owner_id}: ${o.name} → ${o.team_id}`);
    });
  }

  console.log('\n🎉 Done!\n');
}

// Run the fix
fixOwnerTeamIds()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
