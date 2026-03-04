const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

async function testTeamAPI() {
  const teamId = 'SSPSLT0016';
  const seasonId = 'SSPSLS16';
  
  console.log(`\n🧪 Simulating API call for team: ${teamId}, season: ${seasonId}\n`);
  
  const auctionSql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);
  
  try {
    // Simulate the exact API query
    console.log('📋 Fetching football players (exact API query)...');
    const footballPlayersData = await auctionSql`
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

    console.log(`✅ Query returned ${footballPlayersData.length} records\n`);

    // Map to the format used in API
    const footballPlayers = footballPlayersData.map((player) => ({
      id: player.player_id,
      name: player.name || 'Unknown',
      position: player.position || 'Unknown',
      rating: player.overall_rating || 0,
      category: 'Football',
      value: player.purchase_price,
      is_real_player: false,
    }));

    console.log('📊 Mapped football players:');
    console.log(`Total: ${footballPlayers.length}`);
    console.log('\nFirst 5 players:');
    footballPlayers.slice(0, 5).forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.name} (${p.position}) - Rating: ${p.rating}, Value: ${p.value}, is_real_player: ${p.is_real_player}`);
    });

    // Check for any null or undefined values
    console.log('\n🔍 Checking for data issues...');
    const hasNullNames = footballPlayers.filter(p => !p.name || p.name === 'Unknown');
    const hasNullPositions = footballPlayers.filter(p => !p.position || p.position === 'Unknown');
    const hasZeroRating = footballPlayers.filter(p => p.rating === 0);
    
    if (hasNullNames.length > 0) console.log(`⚠️  ${hasNullNames.length} players with missing names`);
    if (hasNullPositions.length > 0) console.log(`⚠️  ${hasNullPositions.length} players with missing positions`);
    if (hasZeroRating.length > 0) console.log(`⚠️  ${hasZeroRating.length} players with zero rating`);
    
    if (hasNullNames.length === 0 && hasNullPositions.length === 0 && hasZeroRating.length === 0) {
      console.log('✅ All player data looks good!');
    }

    // Simulate the response
    console.log('\n📤 Simulated API Response:');
    const response = {
      success: true,
      data: {
        players: footballPlayers,
        totalPlayers: footballPlayers.length,
      }
    };
    
    console.log(JSON.stringify(response, null, 2).substring(0, 500) + '...');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

testTeamAPI();
