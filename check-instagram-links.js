// Check what instagram_link URLs look like in the database
require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkLinks() {
  console.log('Checking instagram_link URLs...\n');
  
  try {
    const sql = neon(process.env.NEON_TOURNAMENT_DB_URL, {
      fetchConnectionTimeout: 30000,
    });
    
    // Check awards
    console.log('=== AWARDS ===');
    const awards = await sql`
      SELECT id, award_type, player_name, instagram_link 
      FROM awards 
      WHERE instagram_link IS NOT NULL 
      LIMIT 3
    `;
    awards.forEach(a => {
      console.log(`ID: ${a.id}`);
      console.log(`Award: ${a.award_type} - ${a.player_name}`);
      console.log(`URL: ${a.instagram_link}`);
      console.log('---');
    });
    
    // Check player_awards
    console.log('\n=== PLAYER AWARDS ===');
    const playerAwards = await sql`
      SELECT id, award_type, player_name, instagram_link 
      FROM player_awards 
      WHERE instagram_link IS NOT NULL 
      LIMIT 3
    `;
    playerAwards.forEach(a => {
      console.log(`ID: ${a.id}`);
      console.log(`Award: ${a.award_type} - ${a.player_name}`);
      console.log(`URL: ${a.instagram_link}`);
      console.log('---');
    });
    
    // Check trophies
    console.log('\n=== TROPHIES ===');
    const trophies = await sql`
      SELECT id, trophy_name, team_name, instagram_link 
      FROM team_trophies 
      WHERE instagram_link IS NOT NULL 
      LIMIT 3
    `;
    trophies.forEach(t => {
      console.log(`ID: ${t.id}`);
      console.log(`Trophy: ${t.trophy_name} - ${t.team_name}`);
      console.log(`URL: ${t.instagram_link}`);
      console.log('---');
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkLinks();
