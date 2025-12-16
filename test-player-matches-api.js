require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function testPlayerMatchesAPI() {
  const tournamentDb = neon(process.env.NEON_TOURNAMENT_DB_URL);
  const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);
  
  const playerId = 'sspslpsl0098'; // Aju
  const leagueId = 'SSPSLFLS16';
  
  console.log('🧪 Testing player matches API logic...\n');
  
  try {
    // Step 1: Get squad info
    console.log('1️⃣ Getting squad info...');
    const squadInfo = await fantasyDb`
      SELECT fs.is_captain, fs.is_vice_captain, fs.team_id
      FROM fantasy_squad fs
      JOIN fantasy_teams ft ON fs.team_id = ft.team_id
      WHERE fs.real_player_id = ${playerId}
      AND ft.league_id = ${leagueId}
      LIMIT 1
    `;
    console.log('Squad info:', squadInfo);
    
    const isCaptain = squadInfo[0]?.is_captain || false;
    const isViceCaptain = squadInfo[0]?.is_vice_captain || false;
    
    // Step 2: Get matchups
    console.log('\n2️⃣ Getting matchups...');
    const matchups = await tournamentDb`
      SELECT 
        m.fixture_id,
        m.home_player_id,
        m.home_player_name,
        m.away_player_id,
        m.away_player_name,
        m.home_goals,
        m.away_goals,
        m.position,
        f.motm_player_id,
        f.round_number,
        f.home_team_name,
        f.away_team_name,
        f.status
      FROM matchups m
      JOIN fixtures f ON m.fixture_id = f.id
      WHERE (m.home_player_id = ${playerId} OR m.away_player_id = ${playerId})
        AND f.status = 'completed'
        AND m.home_goals IS NOT NULL
        AND m.away_goals IS NOT NULL
      ORDER BY f.round_number
    `;
    console.log(`Found ${matchups.length} matchups`);
    
    // Step 3: Process matches
    console.log('\n3️⃣ Processing matches...');
    const matches = matchups.map((m) => {
      const isHome = m.home_player_id === playerId;
      const goalsScored = isHome ? m.home_goals : m.away_goals;
      const goalsConceded = isHome ? m.away_goals : m.home_goals;
      const opponentName = isHome ? m.away_team_name : m.home_team_name;
      const cleanSheet = goalsConceded === 0;
      const motm = m.motm_player_id === playerId;

      return {
        round_number: m.round_number,
        opponent_name: opponentName,
        goals_scored: goalsScored,
        goals_conceded: goalsConceded,
        clean_sheet: cleanSheet,
        motm: motm,
        is_captain: isCaptain,
        is_vice_captain: isViceCaptain,
      };
    });
    
    console.log('Processed matches:', JSON.stringify(matches, null, 2));
    
    // Step 4: Calculate stats
    console.log('\n4️⃣ Calculating stats...');
    const totalGoals = matches.reduce((sum, m) => sum + m.goals_scored, 0);
    const totalCleanSheets = matches.filter((m) => m.clean_sheet).length;
    const totalMotm = matches.filter((m) => m.motm).length;
    const totalMatches = matches.length;
    
    // Step 5: Get total points
    console.log('\n5️⃣ Getting total points...');
    const pointsData = await fantasyDb`
      SELECT fs.total_points
      FROM fantasy_squad fs
      JOIN fantasy_teams ft ON fs.team_id = ft.team_id
      WHERE fs.real_player_id = ${playerId}
      AND ft.league_id = ${leagueId}
      LIMIT 1
    `;
    
    const totalPoints = pointsData[0]?.total_points || 0;
    const averagePoints = totalMatches > 0 ? (totalPoints / totalMatches).toFixed(1) : '0.0';
    
    const result = {
      stats: {
        total_goals: totalGoals,
        total_clean_sheets: totalCleanSheets,
        total_motm: totalMotm,
        total_matches: totalMatches,
        total_points: totalPoints,
        average_points: averagePoints,
        best_performance: totalPoints,
        total_bonus_points: 0,
      },
      matches: matches,
    };
    
    console.log('\n✅ Final result:');
    console.log(JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

testPlayerMatchesAPI();
