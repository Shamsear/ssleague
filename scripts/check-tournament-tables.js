const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);

async function checkTables() {
  try {
    console.log('🔍 Checking tournament database tables...\n');

    // Get all tables
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;

    console.log('📊 Available tables:');
    tables.forEach(t => console.log(`  - ${t.table_name}`));

    // Check if there's a table that might have team assignments for old seasons
    console.log('\n🔎 Checking for tables with team_id and season_id columns...\n');

    for (const table of tables) {
      const columns = await sql`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = ${table.table_name}
          AND (column_name LIKE '%team%' OR column_name LIKE '%season%' OR column_name LIKE '%player%')
        ORDER BY ordinal_position
      `;

      if (columns.length > 0) {
        console.log(`\n📋 ${table.table_name}:`);
        columns.forEach(c => console.log(`  - ${c.column_name} (${c.data_type})`));
      }
    }

    // Check if footballplayers table exists and has the data
    console.log('\n\n🔍 Checking footballplayers table for SSPSLS15 players...\n');
    
    const footballPlayers = await sql`
      SELECT player_id, team_id, contract_start_season, contract_end_season
      FROM footballplayers
      WHERE player_id IN ('sspslpsl0091', 'sspslpsl0004', 'sspslpsl0071')
      LIMIT 10
    `;

    if (footballPlayers.length > 0) {
      console.log('✅ Found data in footballplayers table:');
      footballPlayers.forEach(p => {
        console.log(`  ${p.player_id}: team=${p.team_id}, contract=${p.contract_start_season}-${p.contract_end_season}`);
      });
    } else {
      console.log('❌ No matching records in footballplayers table');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

checkTables();
