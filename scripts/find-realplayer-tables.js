/**
 * Find Real Player Tables
 * Check what tables exist for real players (SSCoin players)
 */

require('dotenv').config({ path: '.env.local' });

const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.NEON_DATABASE_URL);

async function findTables() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║           FIND REAL PLAYER TABLES                         ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    // List all tables
    console.log('1️⃣  ALL TABLES IN DATABASE\n');
    
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    
    console.log('Tables:');
    tables.forEach(t => {
      console.log(`   - ${t.table_name}`);
    });
    console.log('');

    // Look for player-related tables
    console.log('2️⃣  PLAYER-RELATED TABLES\n');
    
    const playerTables = tables.filter(t => 
      t.table_name.includes('player') || 
      t.table_name.includes('real')
    );
    
    console.log('Player-related tables:');
    playerTables.forEach(t => {
      console.log(`   - ${t.table_name}`);
    });
    console.log('');

    // Check realplayers table
    console.log('3️⃣  REALPLAYERS TABLE\n');
    
    const realplayersExists = tables.find(t => t.table_name === 'realplayers');
    
    if (realplayersExists) {
      const structure = await sql`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'realplayers'
        ORDER BY ordinal_position
      `;
      
      console.log('Columns:');
      structure.forEach(col => {
        console.log(`   - ${col.column_name} (${col.data_type})`);
      });
      console.log('');

      // Check Kopites real players
      const kopitesRealPlayers = await sql`
        SELECT *
        FROM realplayers
        WHERE team_id = 'SSPSLT0023'
        LIMIT 5
      `;
      
      console.log(`Sample Kopites real players: ${kopitesRealPlayers.length}\n`);
      
      kopitesRealPlayers.forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.name || p.player_name}`);
        console.log(`      Team: ${p.team_id}, Season: ${p.season_id || 'N/A'}`);
        console.log(`      Value: ${p.acquisition_value || p.value || 'N/A'}`);
      });
    } else {
      console.log('❌ realplayers table not found\n');
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  }
}

findTables()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
