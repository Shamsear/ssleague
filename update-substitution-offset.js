require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function updateOffset() {
  const dbUrl = process.env.NEON_TOURNAMENT_DB_URL;
  
  if (!dbUrl) {
    console.error('❌ NEON_TOURNAMENT_DB_URL not found in environment');
    process.exit(1);
  }

  const sql = neon(dbUrl);
  
  try {
    console.log('📋 Updating home_substitution_deadline_day_offset default...');
    
    // Update the default value for the column
    await sql`
      ALTER TABLE round_deadlines
      ALTER COLUMN home_substitution_deadline_day_offset SET DEFAULT 1
    `;
    
    // Update existing rows that have -1 to 1
    const result = await sql`
      UPDATE round_deadlines
      SET home_substitution_deadline_day_offset = 1
      WHERE home_substitution_deadline_day_offset = -1
      RETURNING tournament_id, round_number, leg
    `;
    
    console.log(`✅ Updated ${result.length} rows`);
    if (result.length > 0) {
      console.log('Updated rounds:');
      result.forEach(r => {
        console.log(`  - Tournament ${r.tournament_id}, Round ${r.round_number}, Leg ${r.leg}`);
      });
    }
    
    // Verify the change
    const check = await sql`
      SELECT column_default
      FROM information_schema.columns
      WHERE table_name = 'round_deadlines'
        AND column_name = 'home_substitution_deadline_day_offset'
    `;
    
    console.log('\n📊 New default value:', check[0]?.column_default);
    
  } catch (error) {
    console.error('❌ Update failed:', error.message);
    process.exit(1);
  }
}

updateOffset();
