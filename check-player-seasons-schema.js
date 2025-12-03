const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const tournamentSql = neon(process.env.NEON_TOURNAMENT_DB_URL);

async function checkSchema() {
  try {
    console.log('Checking player_seasons table schema...\n');
    
    const columns = await tournamentSql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'player_seasons'
      ORDER BY ordinal_position
    `;
    
    console.log('📋 player_seasons columns:');
    columns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(required)' : '(optional)'}`);
    });
    
    console.log('\n📊 Sample data:');
    const sample = await tournamentSql`
      SELECT *
      FROM player_seasons
      LIMIT 3
    `;
    
    console.log(JSON.stringify(sample, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkSchema();
