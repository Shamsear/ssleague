const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

async function checkTeamSeasonsData() {
  const teamId = 'SSPSLT0016';
  
  console.log(`\n🔍 Checking data for team: ${teamId}\n`);
  
  try {
    const auctionSql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);
    
    // Check what seasons this team has data in
    console.log('📋 Checking team_players table for all seasons...');
    const allTeamPlayers = await auctionSql`
      SELECT DISTINCT season_id, COUNT(*) as player_count
      FROM team_players
      WHERE team_id = ${teamId}
      GROUP BY season_id
      ORDER BY season_id DESC
    `;
    
    console.log(`\nFound data in ${allTeamPlayers.length} seasons:`);
    allTeamPlayers.forEach(s => {
      console.log(`  - ${s.season_id}: ${s.player_count} football players`);
    });
    
    // For each season, test the API query
    console.log('\n🔍 Testing API query for each season...\n');
    for (const seasonData of allTeamPlayers) {
      const season = seasonData.season_id;
      console.log(`Season ${season}:`);
      
      const footballPlayers = await auctionSql`
        SELECT 
          tp.player_id,
          tp.purchase_price,
          fp.name,
          fp.position,
          fp.overall_rating
        FROM team_players tp
        INNER JOIN footballplayers fp ON tp.player_id = fp.id
        WHERE tp.team_id = ${teamId}
          AND tp.season_id = ${season}
      `;
      
      console.log(`  ✅ Query returned ${footballPlayers.length} players`);
      if (footballPlayers.length > 0) {
        console.log(`  Sample: ${footballPlayers[0].name} (${footballPlayers[0].position})`);
      }
      console.log('');
    }
    
    // Check if there's data in SSPSLS17
    console.log('🔍 Specifically checking SSPSLS17...');
    const s17Data = await auctionSql`
      SELECT COUNT(*) as count
      FROM team_players
      WHERE team_id = ${teamId}
        AND season_id = 'SSPSLS17'
    `;
    
    if (s17Data[0].count > 0) {
      console.log(`  ✅ Team has ${s17Data[0].count} players in SSPSLS17`);
    } else {
      console.log(`  ❌ Team has NO players in SSPSLS17`);
      console.log(`  ⚠️  If committee admin is assigned to SSPSLS17, they won't see any football players!`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

checkTeamSeasonsData();
