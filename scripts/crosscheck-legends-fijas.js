require('dotenv').config({path:'.env.local'});
const {neon}=require('@neondatabase/serverless');
const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);

async function crossCheckLegendsFijas() {
  console.log('🔍 Cross-checking Muhammed Fijas in Legends FC across all fantasy tables\n');
  console.log('='.repeat(80));
  
  const teamId = 'SSPSLT0015';
  const playerId = 'sspslpsl0020';
  
  // 1. Check fantasy_squad
  console.log('\n1️⃣  FANTASY_SQUAD TABLE:');
  const squad = await fantasyDb`
    SELECT 
      squad_id,
      player_name,
      is_captain,
      is_vice_captain,
      total_points
    FROM fantasy_squad
    WHERE team_id = ${teamId}
      AND real_player_id = ${playerId}
  `;
  console.table(squad);
  
  // 2. Check fantasy_player_points
  console.log('\n2️⃣  FANTASY_PLAYER_POINTS TABLE:');
  const playerPoints = await fantasyDb`
    SELECT 
      fixture_id,
      round_number,
      goals_scored,
      is_captain,
      points_multiplier,
      base_points,
      total_points
    FROM fantasy_player_points
    WHERE team_id = ${teamId}
      AND real_player_id = ${playerId}
    ORDER BY round_number
  `;
  console.table(playerPoints);
  
  const sumPlayerPoints = playerPoints.reduce((sum, p) => sum + Number(p.total_points), 0);
  console.log(`\n   Sum of total_points: ${sumPlayerPoints}`);
  
  // 3. Check fantasy_teams
  console.log('\n3️⃣  FANTASY_TEAMS TABLE:');
  const team = await fantasyDb`
    SELECT 
      team_name,
      player_points,
      passive_points,
      total_points,
      rank
    FROM fantasy_teams
    WHERE team_id = ${teamId}
  `;
  console.table(team);
  
  // 4. Check fantasy_players (if exists)
  console.log('\n4️⃣  FANTASY_PLAYERS TABLE:');
  try {
    const fantasyPlayers = await fantasyDb`
      SELECT 
        player_name,
        total_points
      FROM fantasy_players
      WHERE real_player_id = ${playerId}
      LIMIT 1
    `;
    if (fantasyPlayers.length > 0) {
      console.table(fantasyPlayers);
    } else {
      console.log('   No record found');
    }
  } catch (error) {
    console.log('   Table might not exist or error:', error.message);
  }
  
  // 5. Summary and Analysis
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 ANALYSIS:\n');
  
  const squadTotal = Number(squad[0]?.total_points || 0);
  const isVC = squad[0]?.is_vice_captain;
  const isCaptain = squad[0]?.is_captain;
  
  console.log(`Squad Role: ${isCaptain ? 'Captain' : isVC ? 'Vice-Captain' : 'Regular'}`);
  console.log(`Squad Total Points: ${squadTotal}`);
  console.log(`Player Points Records Sum: ${sumPlayerPoints}`);
  console.log(`Match: ${squadTotal === sumPlayerPoints ? '✅ CORRECT' : '❌ MISMATCH'}`);
  
  if (squadTotal !== sumPlayerPoints) {
    console.log(`\n⚠️  DISCREPANCY: ${Math.abs(squadTotal - sumPlayerPoints)} points difference!`);
  }
  
  // Check multipliers
  console.log(`\nMultipliers in records:`);
  const multipliers = [...new Set(playerPoints.map(p => p.points_multiplier))];
  multipliers.forEach(m => {
    const count = playerPoints.filter(p => p.points_multiplier === m).length;
    const type = m === 200 || m === 2 ? 'Captain (2x)' : m === 150 ? 'Vice-Captain (1.5x)' : m === 100 || m === 1 ? 'Regular (1x)' : 'Unknown';
    console.log(`  ${m}: ${count} records (${type})`);
  });
  
  // Expected vs Actual
  console.log(`\nExpected multiplier: ${isCaptain ? '200 (Captain)' : isVC ? '150 (Vice-Captain)' : '100 (Regular)'}`);
  console.log(`Actual multipliers: ${multipliers.join(', ')}`);
  
  if (isVC && !multipliers.includes(150)) {
    console.log('\n❌ ERROR: Player is Vice-Captain but records don\'t have multiplier 150!');
  } else if (isCaptain && !multipliers.includes(200) && !multipliers.includes(2)) {
    console.log('\n❌ ERROR: Player is Captain but records don\'t have multiplier 200/2!');
  } else {
    console.log('\n✅ Multipliers match the role');
  }
}

crossCheckLegendsFijas()
  .then(() => {
    console.log('\n✅ Cross-check complete');
    process.exit(0);
  })
  .catch(e => {
    console.error('\n❌ Error:', e);
    process.exit(1);
  });
