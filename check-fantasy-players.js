const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.FANTASY_DATABASE_URL);

(async () => {
  try {
    console.log('Checking fantasy_players table...\n');
    
    // Check total players
    const total = await sql`
      SELECT COUNT(*) as count
      FROM fantasy_players
      WHERE league_id = 'SSPSLFLS16'
    `;
    
    console.log(`Total players in league: ${total[0].count}`);
    
    // Check available players
    const available = await sql`
      SELECT COUNT(*) as count
      FROM fantasy_players
      WHERE league_id = 'SSPSLFLS16'
        AND is_available = true
    `;
    
    console.log(`Available players: ${available[0].count}`);
    
    // Check drafted players
    const drafted = await sql`
      SELECT COUNT(*) as count
      FROM fantasy_players
      WHERE league_id = 'SSPSLFLS16'
        AND is_available = false
    `;
    
    console.log(`Drafted players: ${drafted[0].count}\n`);
    
    // Show sample available players
    const samples = await sql`
      SELECT 
        real_player_id,
        player_name,
        position,
        real_team_name,
        star_rating,
        draft_price,
        current_price,
        is_available,
        times_drafted
      FROM fantasy_players
      WHERE league_id = 'SSPSLFLS16'
        AND is_available = true
      LIMIT 10
    `;
    
    if (samples.length > 0) {
      console.log('Sample available players:');
      samples.forEach(p => {
        console.log(`  ${p.player_name} (${p.position}) - ${p.real_team_name} - €${p.current_price || p.draft_price}M - ${p.star_rating}⭐`);
      });
    } else {
      console.log('❌ No available players found!');
      
      // Check if players exist but are marked as unavailable
      const allPlayers = await sql`
        SELECT 
          real_player_id,
          player_name,
          is_available,
          times_drafted
        FROM fantasy_players
        WHERE league_id = 'SSPSLFLS16'
        LIMIT 5
      `;
      
      console.log('\nSample of all players (regardless of availability):');
      allPlayers.forEach(p => {
        console.log(`  ${p.player_name} - Available: ${p.is_available} - Times drafted: ${p.times_drafted}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
})();
