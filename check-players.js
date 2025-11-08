const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

async function checkPlayers() {
  const sql = neon(process.env.NEON_AUCTION_DB_URL);
  
  try {
    // First, check what tables exist
    console.log('📊 Checking database tables...\n');
    
    // Get player stats (without season filter first)
    const stats = await sql`
      SELECT 
        COUNT(*) as total_players,
        COUNT(*) FILTER (WHERE is_auction_eligible = true) as eligible_players,
        COUNT(*) FILTER (WHERE is_sold = false) as unsold_players,
        COUNT(*) FILTER (WHERE is_auction_eligible = true AND is_sold = false) as eligible_and_unsold
      FROM footballplayers
    `;
    
    console.log('📊 Player Statistics (All):');
    console.log(`   Total players: ${stats[0].total_players}`);
    console.log(`   Auction eligible: ${stats[0].eligible_players}`);
    console.log(`   Unsold: ${stats[0].unsold_players}`);
    console.log(`   Eligible & Unsold: ${stats[0].eligible_and_unsold}\n`);
    
    // Get sample of players
    const samplePlayers = await sql`
      SELECT id, name, is_auction_eligible, is_sold, season_id
      FROM footballplayers
      LIMIT 5
    `;
    
    console.log('📋 Sample players:');
    samplePlayers.forEach(p => {
      console.log(`   ${p.name}: eligible=${p.is_auction_eligible}, sold=${p.is_sold}, season=${p.season_id}`);
    });
    
    // Check auction_settings table
    console.log('\n📊 Checking auction_settings...');
    const settings = await sql`SELECT id, season_id FROM auction_settings LIMIT 1`;
    if (settings.length > 0) {
      console.log(`   Found auction settings with season_id: ${settings[0].season_id}`);
      
      // Now check players for that specific season
      const seasonStats = await sql`
        SELECT 
          COUNT(*) as total_players,
          COUNT(*) FILTER (WHERE is_auction_eligible = true) as eligible_players,
          COUNT(*) FILTER (WHERE is_sold = false) as unsold_players,
          COUNT(*) FILTER (WHERE is_auction_eligible = true AND is_sold = false) as eligible_and_unsold
        FROM footballplayers
        WHERE season_id = ${settings[0].season_id}
      `;
      
      console.log(`\n📊 Player Statistics for season ${settings[0].season_id}:`);
      console.log(`   Total players: ${seasonStats[0].total_players}`);
      console.log(`   Auction eligible: ${seasonStats[0].eligible_players}`);
      console.log(`   Unsold: ${seasonStats[0].unsold_players}`);
      console.log(`   Eligible & Unsold: ${seasonStats[0].eligible_and_unsold}`);
    }
    
    // Check the bulk round that was created
    console.log('\n📊 Checking bulk round...');
    const bulkRounds = await sql`
      SELECT id, round_number, status, season_id 
      FROM rounds 
      WHERE round_type = 'bulk' 
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    
    if (bulkRounds.length > 0) {
      const roundId = bulkRounds[0].id;
      console.log(`   Latest bulk round: ${roundId} (Round #${bulkRounds[0].round_number}, Status: ${bulkRounds[0].status})`);
      
      // Check how many players are in this round
      const roundPlayerCount = await sql`
        SELECT COUNT(*) as count
        FROM round_players
        WHERE round_id = ${roundId}
      `;
      
      console.log(`   Players in round_players table: ${roundPlayerCount[0].count}`);
      
      if (roundPlayerCount[0].count > 0) {
        // Show sample players
        const sampleRoundPlayers = await sql`
          SELECT player_id, player_name, status
          FROM round_players
          WHERE round_id = ${roundId}
          LIMIT 5
        `;
        console.log('\n   Sample players in round:');
        sampleRoundPlayers.forEach(p => {
          console.log(`      ${p.player_name} (${p.player_id}): ${p.status}`);
        });
      }
    } else {
      console.log('   No bulk rounds found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkPlayers();
