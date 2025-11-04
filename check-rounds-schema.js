const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);

(async () => {
  try {
    console.log('Checking rounds table schema...\n');
    
    // Check column type
    const columns = await sql`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns 
      WHERE table_name = 'rounds' 
      AND column_name = 'id'
    `;
    
    console.log('ID Column Info:', JSON.stringify(columns, null, 2));
    
    // Check existing rounds
    const rounds = await sql`SELECT id, season_id, position, status, created_at FROM rounds LIMIT 5`;
    console.log('\nExisting rounds:', JSON.stringify(rounds, null, 2));
    
  } catch(e) {
    console.error('Error:', e.message);
  }
})();
