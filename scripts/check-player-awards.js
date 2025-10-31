const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);

async function checkPlayerAwards() {
  console.log('\n🏆 Checking Player Awards Table\n');
  
  try {
    // Get all awards
    const awards = await sql`
      SELECT 
        id, player_id, player_name, season_id,
        award_category, award_type, award_position,
        player_category, created_at
      FROM player_awards
      ORDER BY season_id, award_category, award_type
    `;
    
    console.log(`Found ${awards.length} player awards:\n`);
    
    if (awards.length === 0) {
      console.log('❌ No awards found in player_awards table!');
      console.log('\nPossible issues:');
      console.log('1. Awards were not inserted during import');
      console.log('2. Excel file has no trophy columns');
      console.log('3. Trophy column names are not recognized\n');
      return;
    }
    
    // Group by season
    const bySeason = awards.reduce((acc, award) => {
      if (!acc[award.season_id]) {
        acc[award.season_id] = [];
      }
      acc[award.season_id].push(award);
      return acc;
    }, {});
    
    Object.entries(bySeason).forEach(([seasonId, seasonAwards]) => {
      console.log(`\n📅 Season: ${seasonId}`);
      console.log(`   Total Awards: ${seasonAwards.length}\n`);
      
      // Group by category
      const byCategory = seasonAwards.reduce((acc, award) => {
        if (!acc[award.award_category]) {
          acc[award.award_category] = [];
        }
        acc[award.award_category].push(award);
        return acc;
      }, {});
      
      Object.entries(byCategory).forEach(([category, categoryAwards]) => {
        console.log(`   ${category.toUpperCase()} Awards (${categoryAwards.length}):`);
        categoryAwards.forEach(award => {
          console.log(`      - ${award.award_type}: ${award.player_name} (${award.player_category || 'N/A'})`);
        });
        console.log('');
      });
    });
    
    console.log('\n✅ Check complete!\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkPlayerAwards().then(() => process.exit(0));
