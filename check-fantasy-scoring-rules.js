require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkScoringRules() {
  const sql = neon(process.env.FANTASY_DATABASE_URL);
  
  console.log('🔍 Checking fantasy_leagues table structure...\n');
  
  try {
    // Get table columns
    const columns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'fantasy_leagues'
      ORDER BY ordinal_position
    `;
    
    console.log('📊 fantasy_leagues columns:');
    columns.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type})`);
    });
    
    // Check if there's a scoring_rules column
    const hasScoringRules = columns.some(col => col.column_name === 'scoring_rules');
    
    if (hasScoringRules) {
      console.log('\n✅ scoring_rules column exists!');
      
      // Get a sample league to see the scoring rules format
      const leagues = await sql`
        SELECT league_id, league_name, scoring_rules
        FROM fantasy_leagues
        LIMIT 1
      `;
      
      if (leagues.length > 0) {
        console.log('\n📋 Sample scoring rules:');
        console.log(JSON.stringify(leagues[0].scoring_rules, null, 2));
      }
    } else {
      console.log('\n⚠️ No scoring_rules column found in fantasy_leagues table');
      console.log('The script will need to use hardcoded rules or we need to add this column.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkScoringRules();
