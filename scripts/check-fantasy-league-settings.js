const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.FANTASY_DATABASE_URL || process.env.DATABASE_URL);

async function checkSettings() {
  try {
    console.log('🔍 Checking fantasy league settings...\n');

    const league = await sql`
      SELECT 
        league_id,
        league_name,
        min_squad_size,
        max_squad_size,
        budget_per_team
      FROM fantasy_leagues
      WHERE league_id = 'SSPSLFLS16'
    `;

    if (league.length > 0) {
      console.log('League Settings:');
      console.log(`  League ID: ${league[0].league_id}`);
      console.log(`  League Name: ${league[0].league_name}`);
      console.log(`  Min Squad Size: ${league[0].min_squad_size}`);
      console.log(`  Max Squad Size: ${league[0].max_squad_size}`);
      console.log(`  Budget per Team: €${league[0].budget_per_team}M`);
    } else {
      console.log('❌ League not found');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkSettings();
