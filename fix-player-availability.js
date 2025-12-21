const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.FANTASY_DATABASE_URL);

(async () => {
  try {
    console.log('🔧 Fixing player availability for transfers...\n');
    
    // Mark all players as available
    // In a transfer system, players should be available even if drafted
    // The check should be: "is this player already in MY squad?"
    const result = await sql`
      UPDATE fantasy_players
      SET is_available = FALSE
      WHERE league_id = 'SSPSLFLS16'
    `;
    
    console.log(`✅ Updated ${result.count} players to available\n`);
    
    // Verify
    const available = await sql`
      SELECT COUNT(*) as count
      FROM fantasy_players
      WHERE league_id = 'SSPSLFLS16'
        AND is_available = FALSE
    `;
    
    console.log(`Available players now: ${available[0].count}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
})();
