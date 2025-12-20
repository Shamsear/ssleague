/**
 * Diagnose player breakdown data mismatch issues
 * Check if fantasy_player_points has correct team_id associations
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);

async function diagnose() {
  console.log('🔍 Diagnosing Player Breakdown Data Mismatch...\n');

  try {
    // 1. Check for players in multiple teams
    console.log('1️⃣ Checking for players in multiple fantasy teams...');
    const multiTeamPlayers = await fantasyDb`
      SELECT 
        fs.real_player_id,
        fs.player_name,
        COUNT(DISTINCT fs.team_id) as team_count,
        array_agg(DISTINCT fs.team_id) as team_ids,
        array_agg(DISTINCT ft.team_name) as team_names
      FROM fantasy_squad fs
      JOIN fantasy_teams ft ON fs.team_id = ft.team_id
      GROUP BY fs.real_player_id, fs.player_name
      HAVING COUNT(DISTINCT fs.team_id) > 1
      ORDER BY team_count DESC
    `;
    
    console.log(`Found ${multiTeamPlayers.length} players in multiple teams:`);
    multiTeamPlayers.slice(0, 5).forEach(p => {
      console.log(`  - ${p.player_name}: ${p.team_count} teams (${p.team_names.join(', ')})`);
    });
    console.log('');

    // 2. Check fantasy_player_points team_id consistency
    console.log('2️⃣ Checking fantasy_player_points team_id consistency...');
    const pointsTeamCheck = await fantasyDb`
      SELECT 
        fpp.real_player_id,
        fpp.team_id as points_team_id,
        fs.team_id as squad_team_id,
        fs.player_name,
        COUNT(*) as mismatch_count
      FROM fantasy_player_points fpp
      LEFT JOIN fantasy_squad fs ON fpp.real_player_id = fs.real_player_id 
        AND fpp.team_id = fs.team_id
      WHERE fs.team_id IS NULL
      GROUP BY fpp.real_player_id, fpp.team_id, fs.team_id, fs.player_name
      LIMIT 10
    `;
    
    if (pointsTeamCheck.length > 0) {
      console.log(`⚠️  Found ${pointsTeamCheck.length} mismatches where fantasy_player_points.team_id doesn't match fantasy_squad:`);
      pointsTeamCheck.forEach(p => {
        console.log(`  - Player ${p.real_player_id}: points team_id=${p.points_team_id}, squad team_id=${p.squad_team_id || 'NOT FOUND'}`);
      });
    } else {
      console.log('✅ All fantasy_player_points records have matching team_ids in fantasy_squad');
    }
    console.log('');

    // 3. Sample a specific player to show the data flow
    console.log('3️⃣ Sampling a player with points data...');
    const samplePlayer = await fantasyDb`
      SELECT DISTINCT 
        fpp.real_player_id,
        fs.player_name,
        fpp.team_id,
        ft.team_name,
        ft.league_id,
        COUNT(fpp.fixture_id) as match_count
      FROM fantasy_player_points fpp
      JOIN fantasy_squad fs ON fpp.real_player_id = fs.real_player_id 
        AND fpp.team_id = fs.team_id
      JOIN fantasy_teams ft ON fpp.team_id = ft.team_id
      GROUP BY fpp.real_player_id, fs.player_name, fpp.team_id, ft.team_name, ft.league_id
      LIMIT 1
    `;

    if (samplePlayer.length > 0) {
      const player = samplePlayer[0];
      console.log(`Sample Player: ${player.player_name}`);
      console.log(`  - real_player_id: ${player.real_player_id}`);
      console.log(`  - team_id: ${player.team_id}`);
      console.log(`  - team_name: ${player.team_name}`);
      console.log(`  - league_id: ${player.league_id}`);
      console.log(`  - match_count: ${player.match_count}`);
      
      // Get their points records
      const pointsRecords = await fantasyDb`
        SELECT 
          fixture_id,
          round_number,
          team_id,
          goals_scored,
          base_points,
          total_points,
          points_multiplier,
          is_captain
        FROM fantasy_player_points
        WHERE real_player_id = ${player.real_player_id}
          AND team_id = ${player.team_id}
        ORDER BY round_number
        LIMIT 3
      `;
      
      console.log(`\n  Points Records (first 3):`);
      pointsRecords.forEach(r => {
        console.log(`    Round ${r.round_number}: ${r.total_points} pts (base: ${r.base_points}, mult: ${r.points_multiplier}, captain: ${r.is_captain})`);
      });
    }
    console.log('');

    // 4. Check if there are orphaned fantasy_player_points records
    console.log('4️⃣ Checking for orphaned fantasy_player_points records...');
    const orphanedPoints = await fantasyDb`
      SELECT COUNT(*) as orphan_count
      FROM fantasy_player_points fpp
      WHERE NOT EXISTS (
        SELECT 1 FROM fantasy_squad fs 
        WHERE fs.real_player_id = fpp.real_player_id 
          AND fs.team_id = fpp.team_id
      )
    `;
    
    console.log(`Found ${orphanedPoints[0].orphan_count} orphaned fantasy_player_points records (no matching squad entry)`);
    console.log('');

    // 5. Check league_id vs team_id relationship
    console.log('5️⃣ Checking league_id to team_id mapping...');
    const leagueTeamMapping = await fantasyDb`
      SELECT 
        league_id,
        COUNT(DISTINCT team_id) as team_count,
        array_agg(DISTINCT team_name) as team_names
      FROM fantasy_teams
      GROUP BY league_id
      ORDER BY league_id
    `;
    
    console.log('League to Team mapping:');
    leagueTeamMapping.forEach(l => {
      console.log(`  League ${l.league_id}: ${l.team_count} teams`);
    });

    console.log('\n✅ Diagnosis complete!');
    console.log('\n💡 Key Findings:');
    console.log('   - The modal needs to pass team_id parameter to the API');
    console.log('   - The pages use league_id to find the team, then filter by team_id');
    console.log('   - If a player is in multiple teams, team_id is required to get correct data');

  } catch (error) {
    console.error('❌ Error during diagnosis:', error);
    throw error;
  }
}

diagnose()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
