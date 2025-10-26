/**
 * Check what data exists in Neon
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.NEON_DATABASE_URL);

async function checkData() {
  console.log('🔍 Checking Neon Database Data...\n');
  console.log('Connection:', process.env.NEON_DATABASE_URL?.substring(0, 50) + '...\n');
  
  try {
    // Get all tables
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;
    
    console.log(`Found ${tables.length} tables\n`);
    console.log('='.repeat(60) + '\n');
    
    for (const table of tables) {
      const tableName = table.table_name;
      const result = await sql.unsafe(`SELECT COUNT(*) as count FROM ${tableName}`);
      const count = parseInt(result[0]?.count || 0);
      
      const icon = count > 0 ? '📊' : '⚪';
      console.log(`${icon} ${tableName}: ${count} records`);
      
      // For tables with data, show first few records
      if (count > 0 && count <= 10) {
        const sample = await sql.unsafe(`SELECT * FROM ${tableName} LIMIT 3`);
        console.log(`   Sample data:`, JSON.stringify(sample[0], null, 2).substring(0, 200) + '...');
      }
    }
    
    console.log('\n' + '='.repeat(60));
    
    // Specifically check footballplayers
    const playerCount = await sql`SELECT COUNT(*) as count FROM footballplayers`;
    const count = parseInt(playerCount[0]?.count || 0);
    
    console.log(`\n🎯 FOOTBALLPLAYERS TABLE: ${count} records`);
    
    if (count > 0) {
      const sample = await sql`SELECT player_id, name, position, team_name, overall_rating FROM footballplayers LIMIT 5`;
      console.log('\nSample players:');
      sample.forEach(p => {
        console.log(`  - ${p.name} (${p.position}) - ${p.team_name || 'No team'} - Rating: ${p.overall_rating}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
  }
}

checkData();
