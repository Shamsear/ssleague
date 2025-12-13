const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const tournamentSql = neon(process.env.NEON_TOURNAMENT_DB_URL);

async function checkSchema() {
  try {
    console.log('📋 tournaments table columns:');
    const tournamentsColumns = await tournamentSql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'tournaments'
      ORDER BY ordinal_position
    `;
    
    tournamentsColumns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });
    
    console.log('\n📋 tournament_settings table columns:');
    const settingsColumns = await tournamentSql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'tournament_settings'
      ORDER BY ordinal_position
    `;
    
    settingsColumns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkSchema();
