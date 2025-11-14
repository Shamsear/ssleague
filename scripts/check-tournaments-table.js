require('dotenv').config({ path: '.env.local' });
const { Pool } = require('@neondatabase/serverless');

async function checkTable() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const client = await pool.connect();
    
    console.log('Checking tournaments table structure...\n');
    
    // Check if table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'tournaments'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('❌ tournaments table does not exist!');
      client.release();
      await pool.end();
      return;
    }
    
    console.log('✅ tournaments table exists\n');
    
    // Get column information
    const columns = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'tournaments'
      ORDER BY ordinal_position;
    `);
    
    console.log('Columns:');
    columns.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
    // Check specifically for rewards and number_of_teams
    const hasRewards = columns.rows.some(col => col.column_name === 'rewards');
    const hasNumberOfTeams = columns.rows.some(col => col.column_name === 'number_of_teams');
    
    console.log('\nMigration status:');
    console.log(`  rewards column: ${hasRewards ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`  number_of_teams column: ${hasNumberOfTeams ? '✅ EXISTS' : '❌ MISSING'}`);
    
    client.release();
    await pool.end();
    
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

checkTable();
