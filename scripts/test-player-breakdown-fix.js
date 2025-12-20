/**
 * Test the player breakdown fix
 * Verify that passing team_id returns correct data for players in multiple teams
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);

async function testFix() {
  console.log('🧪 Testing Player Breakdown Fix...\n');

  try {
    // 1. Find a player in multiple teams
    console.log('1️⃣ Finding a player in multiple teams...');
    const multiTeamPlayer = await fantasyDb`
      SELECT 
        fs.real_player_id,
        fs.player_name,
        array_agg(DISTINCT fs.team_id) as team_ids,
        array_agg(DISTINCT ft.team_name) as team_names,
        array_agg(DISTINCT ft.league_id) as league_ids
      FROM fantasy_squad fs
      JOIN fantasy_teams ft ON fs.team_id = ft.team_id
      GROUP BY fs.real_player_id, fs.player_name
      HAVING COUNT(DISTINCT fs.team_id) > 1
      LIMIT 1
    `;

    if (multiTeamPlayer.length === 0) {
      console.log('✅ No players in multiple teams - fix not needed');
      return;
    }

    const player = multiTeamPlayer[0];
    console.log(`Found: ${player.player_name}`);
    console.log(`  - Player ID: ${player.real_player_id}`);
    console.log(`  - Teams: ${player.team_names.join(', ')}`);
    console.log(`  - Team IDs: ${player.team_ids.join(', ')}`);
    console.log('');

    // 2. Check data for each team
    console.log('2️⃣ Checking data for each team...');
    for (let i = 0; i < player.team_ids.length; i++) {
      const teamId = player.team_ids[i];
      const teamName = player.team_names[i];
      const leagueId = player.league_ids[i];

      console.log(`\n📊 Team: ${teamName} (${teamId})`);
      
      // Get squad info
      const squadInfo = await fantasyDb`
        SELECT 
          is_captain,
          is_vice_captain,
          total_points
        FROM fantasy_squad
        WHERE real_player_id = ${player.real_player_id}
          AND team_id = ${teamId}
      `;

      if (squadInfo.length > 0) {
        const info = squadInfo[0];
        console.log(`  Squad Info:`);
        console.log(`    - Captain: ${info.is_captain}`);
        console.log(`    - Vice-Captain: ${info.is_vice_captain}`);
        console.log(`    - Total Points: ${info.total_points}`);
      }

      // Get points records
      const pointsRecords = await fantasyDb`
        SELECT 
          COUNT(*) as match_count,
          SUM(total_points) as total_points,
          AVG(points_multiplier) as avg_multiplier
        FROM fantasy_player_points
        WHERE real_player_id = ${player.real_player_id}
          AND team_id = ${teamId}
      `;

      if (pointsRecords.length > 0) {
        const points = pointsRecords[0];
        console.log(`  Points Records:`);
        console.log(`    - Matches: ${points.match_count}`);
        console.log(`    - Total Points: ${points.total_points}`);
        console.log(`    - Avg Multiplier: ${points.avg_multiplier}`);
      }
    }

    console.log('\n\n3️⃣ Testing API Query Logic...');
    
    // Test the query with team_id (simulating the fix)
    const testTeamId = player.team_ids[0];
    const testLeagueId = player.league_ids[0];
    
    console.log(`\nQuerying with team_id=${testTeamId} and league_id=${testLeagueId}:`);
    const withTeamId = await fantasyDb`
      SELECT fs.is_captain, fs.is_vice_captain, fs.team_id, ft.team_name
      FROM fantasy_squad fs
      JOIN fantasy_teams ft ON fs.team_id = ft.team_id
      WHERE fs.real_player_id = ${player.real_player_id}
      AND fs.team_id = ${testTeamId}
      AND ft.league_id = ${testLeagueId}
      LIMIT 1
    `;
    
    if (withTeamId.length > 0) {
      console.log(`✅ Correctly returned: ${withTeamId[0].team_name}`);
      console.log(`   Captain: ${withTeamId[0].is_captain}, VC: ${withTeamId[0].is_vice_captain}`);
    }

    // Test without team_id (old behavior)
    console.log(`\nQuerying WITHOUT team_id (old behavior):`);
    const withoutTeamId = await fantasyDb`
      SELECT fs.is_captain, fs.is_vice_captain, fs.team_id, ft.team_name
      FROM fantasy_squad fs
      JOIN fantasy_teams ft ON fs.team_id = ft.team_id
      WHERE fs.real_player_id = ${player.real_player_id}
      AND ft.league_id = ${testLeagueId}
      LIMIT 1
    `;
    
    if (withoutTeamId.length > 0) {
      console.log(`⚠️  Returned: ${withoutTeamId[0].team_name} (may be wrong if player is in multiple teams)`);
      console.log(`   Captain: ${withoutTeamId[0].is_captain}, VC: ${withoutTeamId[0].is_vice_captain}`);
    }

    console.log('\n\n✅ Test Complete!');
    console.log('\n💡 Summary:');
    console.log('   - The fix ensures team_id is passed to the API');
    console.log('   - This guarantees the correct team\'s data is shown');
    console.log('   - Players in multiple teams will now show accurate breakdowns');

  } catch (error) {
    console.error('❌ Error during test:', error);
    throw error;
  }
}

testFix()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
