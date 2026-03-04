const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

async function checkTeamFootballPlayers() {
  const teamId = 'SSPSLT0016';
  const seasonId = 'SSPSLS16';
  
  console.log(`\n🔍 Checking football players for team: ${teamId}, season: ${seasonId}\n`);
  
  const auctionSql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);
  
  try {
    // Check team_players table
    console.log('📋 Checking team_players table...');
    const teamPlayers = await auctionSql`
      SELECT 
        tp.id,
        tp.player_id,
        tp.team_id,
        tp.season_id,
        tp.purchase_price,
        tp.round_id,
        tp.created_at
      FROM team_players tp
      WHERE tp.team_id = ${teamId}
        AND tp.season_id = ${seasonId}
      ORDER BY tp.created_at DESC
    `;
    
    console.log(`Found ${teamPlayers.length} records in team_players table`);
    if (teamPlayers.length > 0) {
      console.log('\nSample records:');
      teamPlayers.slice(0, 3).forEach((tp, i) => {
        console.log(`  ${i + 1}. Player ID: ${tp.player_id}, Price: ${tp.purchase_price}, Round: ${tp.round_id}`);
      });
    }
    
    // Check footballplayers table for this team
    console.log('\n⚽ Checking footballplayers table...');
    const footballPlayers = await auctionSql`
      SELECT 
        fp.id,
        fp.player_id,
        fp.name,
        fp.position,
        fp.overall_rating,
        fp.team_id,
        fp.season_id,
        fp.team_name
      FROM footballplayers fp
      WHERE fp.team_id = ${teamId}
        AND fp.season_id = ${seasonId}
      ORDER BY fp.name
    `;
    
    console.log(`Found ${footballPlayers.length} records in footballplayers table`);
    if (footballPlayers.length > 0) {
      console.log('\nSample records:');
      footballPlayers.slice(0, 3).forEach((fp, i) => {
        console.log(`  ${i + 1}. ${fp.name} (${fp.position}) - Rating: ${fp.overall_rating}, Team: ${fp.team_name}`);
      });
    }
    
    // Check if there's a mismatch
    console.log('\n🔄 Checking for data consistency...');
    const playerIdsInTeamPlayers = new Set(teamPlayers.map(tp => tp.player_id));
    const playerIdsInFootballPlayers = new Set(footballPlayers.map(fp => fp.player_id));
    
    const inTeamPlayersOnly = [...playerIdsInTeamPlayers].filter(id => !playerIdsInFootballPlayers.has(id));
    const inFootballPlayersOnly = [...playerIdsInFootballPlayers].filter(id => !playerIdsInTeamPlayers.has(id));
    
    if (inTeamPlayersOnly.length > 0) {
      console.log(`⚠️  ${inTeamPlayersOnly.length} players in team_players but not in footballplayers`);
    }
    if (inFootballPlayersOnly.length > 0) {
      console.log(`⚠️  ${inFootballPlayersOnly.length} players in footballplayers but not in team_players`);
    }
    if (inTeamPlayersOnly.length === 0 && inFootballPlayersOnly.length === 0) {
      console.log('✅ Data is consistent between both tables');
    }
    
    // Try the exact query from the API
    console.log('\n🔍 Testing API query...');
    const apiQuery = await auctionSql`
      SELECT 
        tp.player_id,
        tp.purchase_price,
        fp.name,
        fp.position,
        fp.overall_rating,
        fp.team_name as club
      FROM team_players tp
      INNER JOIN footballplayers fp ON tp.player_id = fp.id
      WHERE tp.team_id = ${teamId}
        AND tp.season_id = ${seasonId}
    `;
    
    console.log(`API query returned ${apiQuery.length} records`);
    if (apiQuery.length > 0) {
      console.log('\nSample results:');
      apiQuery.slice(0, 3).forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.name} (${p.position}) - Rating: ${p.overall_rating}, Price: ${p.purchase_price}`);
      });
    } else {
      console.log('❌ API query returned no results - this is the problem!');
      console.log('\n🔍 Checking JOIN condition...');
      console.log('The query joins: tp.player_id = fp.id');
      console.log('Let\'s check if player_id in team_players matches id in footballplayers...\n');
      
      if (teamPlayers.length > 0 && footballPlayers.length > 0) {
        console.log('Sample player_id from team_players:', teamPlayers[0].player_id);
        console.log('Sample id from footballplayers:', footballPlayers[0].id);
        console.log('Sample player_id from footballplayers:', footballPlayers[0].player_id);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

checkTeamFootballPlayers();
