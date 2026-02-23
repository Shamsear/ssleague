const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function checkCategories() {
  console.log('🔍 Checking player categories in player_seasons...\n');
  
  // Check distinct categories
  const categories = await sql`
    SELECT DISTINCT category, COUNT(*) as count 
    FROM player_seasons 
    WHERE season_id = 'SSPSLS16'
    GROUP BY category 
    ORDER BY count DESC
  `;
  
  console.log('Categories found:');
  categories.forEach(c => {
    console.log(`  ${c.category || 'NULL'}: ${c.count} players`);
  });
  
  // Check if there's a position field instead
  console.log('\n🔍 Checking for position field...');
  const positions = await sql`
    SELECT DISTINCT position, COUNT(*) as count 
    FROM player_seasons 
    WHERE season_id = 'SSPSLS16'
    GROUP BY position 
    ORDER BY count DESC
  `;
  
  if (positions.length > 0) {
    console.log('Positions found:');
    positions.forEach(p => {
      console.log(`  ${p.position || 'NULL'}: ${p.count} players`);
    });
  } else {
    console.log('No position field found');
  }
  
  // Sample some players to see their data
  console.log('\n🔍 Sample player data:');
  const sample = await sql`
    SELECT player_id, player_name, category, position
    FROM player_seasons 
    WHERE season_id = 'SSPSLS16'
    LIMIT 5
  `;
  
  console.table(sample);
}

checkCategories().catch(console.error);
