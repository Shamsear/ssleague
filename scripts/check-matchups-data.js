require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkMatchups() {
  const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);
  
  console.log('🔍 Checking matchups data...\n');
  
  // Check sample matchups
  const matchups = await sql`
    SELECT * FROM matchups 
    WHERE home_player_id IS NOT NULL 
      AND result IS NOT NULL
    LIMIT 5
  `;
  
  console.log('📊 Sample matchups with results:');
  console.log(JSON.stringify(matchups, null, 2));
  
  // Count matchups by tournament
  const counts = await sql`
    SELECT 
      tournament_id,
      COUNT(*) as total,
      COUNT(CASE WHEN result IS NOT NULL THEN 1 END) as with_results
    FROM matchups
    WHERE home_player_id IS NOT NULL
    GROUP BY tournament_id
    ORDER BY tournament_id
  `;
  
  console.log('\n📈 Matchups by tournament:');
  counts.forEach(c => {
    console.log(`  ${c.tournament_id}: ${c.total} total, ${c.with_results} with results`);
  });
  
  // Check if there's a season_id column
  const cols = await sql`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'matchups' 
      AND column_name IN ('season_id', 'tournament_id')
  `;
  
  console.log('\n📋 Season/Tournament columns in matchups:');
  cols.forEach(c => console.log(`  - ${c.column_name}`));
}

checkMatchups().catch(console.error);
