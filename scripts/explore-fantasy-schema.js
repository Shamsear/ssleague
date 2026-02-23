require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

const db = neon(process.env.FANTASY_DATABASE_URL);

async function exploreSchema() {
  // Get all tables
  const tables = await db`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY table_name
  `;
  
  console.log('=== AVAILABLE TABLES ===');
  tables.forEach(t => console.log(`  - ${t.table_name}`));
  
  // Check round_players structure
  console.log('\n=== ROUND_PLAYERS COLUMNS ===');
  const rpCols = await db`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'round_players'
    ORDER BY ordinal_position
  `;
  console.log(JSON.stringify(rpCols, null, 2));
  
  // Sample round_players
  console.log('\n=== SAMPLE ROUND_PLAYERS ===');
  const sampleRP = await db`
    SELECT * FROM round_players 
    WHERE fantasy_points > 0
    LIMIT 3
  `;
  console.log(JSON.stringify(sampleRP, null, 2));
  
  // Check rounds structure
  console.log('\n=== ROUNDS COLUMNS ===');
  const roundsCols = await db`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'rounds'
    ORDER BY ordinal_position
  `;
  console.log(JSON.stringify(roundsCols, null, 2));
  
  // Sample rounds
  console.log('\n=== SAMPLE ROUNDS ===');
  const sampleRounds = await db`
    SELECT * FROM rounds LIMIT 3
  `;
  console.log(JSON.stringify(sampleRounds, null, 2));
}

exploreSchema().catch(console.error);
