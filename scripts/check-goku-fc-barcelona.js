require('dotenv').config({path:'.env.local'});
const {neon}=require('@neondatabase/serverless');
const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);

async function checkGoku() {
  console.log('🔍 Checking Goku in FC Barcelona\n');
  
  // Get Goku from squad
  const squad = await fantasyDb`
    SELECT 
      real_player_id,
      player_name,
      team_id,
      is_captain,
      is_vice_captain,
      total_points
    FROM fantasy_squad
    WHERE team_id = 'SSPSLT0006'
      AND player_name LIKE 'Goku%'
  `;
  
  console.log('Squad Info:');
  console.table(squad);
  
  if (squad.length === 0) return;
  
  const player = squad[0];
  
  // Get fantasy_player_points records
  const points = await fantasyDb`
    SELECT 
      fixture_id,
      round_number,
      goals_scored,
      points_multiplier,
      base_points,
      total_points,
      is_captain
    FROM fantasy_player_points
    WHERE team_id = 'SSPSLT0006'
      AND real_player_id = ${player.real_player_id}
    ORDER BY round_number
  `;
  
  console.log('\nFantasy Player Points Records:');
  console.table(points);
  
  console.log('\nAnalysis:');
  console.log(`  Squad says: ${player.is_vice_captain ? 'Vice-Captain' : player.is_captain ? 'Captain' : 'Regular'}`);
  console.log(`  Records say: Multiplier ${points[0]?.points_multiplier} (${points[0]?.points_multiplier === 150 ? 'VC' : points[0]?.points_multiplier === 200 || points[0]?.points_multiplier === 2 ? 'Captain' : 'Regular'})`);
  console.log(`  Squad total: ${player.total_points}`);
  console.log(`  Records sum: ${points.reduce((sum, p) => sum + Number(p.total_points), 0)}`);
}

checkGoku()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
