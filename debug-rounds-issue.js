require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);

(async () => {
  try {
    console.log('🔍 Debugging rounds issue...\n');
    
    // Check existing rounds
    console.log('=== Existing Rounds ===');
    const rounds = await sql`SELECT id, season_id, position, status, round_type, created_at FROM rounds ORDER BY created_at DESC`;
    console.log(`Found ${rounds.length} round(s):`);
    rounds.forEach((r, i) => {
      console.log(`  ${i + 1}. ID: "${r.id}", Position: ${r.position}, Status: ${r.status}, Type: ${r.round_type}`);
    });
    
    // Check the ID column type
    console.log('\n=== ID Column Type ===');
    const columns = await sql`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns 
      WHERE table_name = 'rounds' 
      AND column_name = 'id'
    `;
    console.log(columns[0]);
    
    // Simulate ID generation
    console.log('\n=== ID Generation Test ===');
    const lastRound = rounds[0];
    if (lastRound) {
      const lastId = lastRound.id;
      const numericPart = lastId.replace(/\D/g, '');
      const lastCounter = parseInt(numericPart, 10);
      const nextCounter = lastCounter + 1;
      console.log(`Last ID: "${lastId}"`);
      console.log(`Numeric part: ${numericPart}`);
      console.log(`Last counter: ${lastCounter}`);
      console.log(`Next counter should be: ${nextCounter}`);
      console.log(`Next ID should be: R-${String(nextCounter).padStart(3, '0')}`);
    } else {
      console.log('No existing rounds, next ID should be: R-001');
    }
    
  } catch(e) {
    console.error('❌ Error:', e.message);
    console.error(e);
  }
})();
