require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkAjuMatch() {
  const tournamentDb = neon(process.env.NEON_TOURNAMENT_DB_URL);
  
  console.log('🔍 Checking Aju\'s match data...\n');
  
  try {
    // Find Aju's player_id
    const players = await tournamentDb`
      SELECT player_id, player_name 
      FROM player_seasons 
      WHERE player_name ILIKE '%Aju%'
      LIMIT 5
    `;
    
    console.log('Players matching "Aju":');
    players.forEach(p => console.log(`  - ${p.player_name} (${p.player_id})`));
    
    if (players.length === 0) return;
    
    const ajuId = players[0].player_id;
    console.log(`\nUsing player_id: ${ajuId}\n`);
    
    // Get Aju's matchups
    const matchups = await tournamentDb`
      SELECT 
        m.*,
        f.motm_player_id,
        f.home_team_name,
        f.away_team_name,
        f.round_number
      FROM matchups m
      JOIN fixtures f ON m.fixture_id = f.id
      WHERE (m.home_player_id = ${ajuId} OR m.away_player_id = ${ajuId})
        AND m.home_goals IS NOT NULL
        AND m.away_goals IS NOT NULL
      ORDER BY f.round_number
    `;
    
    console.log(`Found ${matchups.length} completed matches:\n`);
    
    matchups.forEach((m, idx) => {
      const isHome = m.home_player_id === ajuId;
      const playerGoals = isHome ? m.home_goals : m.away_goals;
      const opponentGoals = isHome ? m.away_goals : m.home_goals;
      const won = playerGoals > opponentGoals;
      const draw = playerGoals === opponentGoals;
      const cleanSheet = opponentGoals === 0;
      const isMotm = m.motm_player_id === ajuId;
      
      console.log(`Match ${idx + 1} - Round ${m.round_number}:`);
      console.log(`  Position: ${isHome ? 'Home' : 'Away'}`);
      console.log(`  Score: ${playerGoals}-${opponentGoals}`);
      console.log(`  Result: ${won ? 'WIN' : draw ? 'DRAW' : 'LOSS'}`);
      console.log(`  Goals: ${playerGoals}`);
      console.log(`  Clean Sheet: ${cleanSheet ? 'Yes' : 'No'}`);
      console.log(`  MOTM: ${isMotm ? 'Yes' : 'No'}`);
      console.log(`  Opponent: ${isHome ? m.away_team_name : m.home_team_name}`);
      console.log();
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkAjuMatch();
