require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');

async function runMigration() {
  const dbUrl = process.env.NEON_TOURNAMENT_DB_URL;
  
  if (!dbUrl) {
    console.error('❌ NEON_TOURNAMENT_DB_URL not found in environment');
    process.exit(1);
  }

  const sql = neon(dbUrl);
  
  try {
    console.log('📋 Running substitution deadline migration...');
    
    const migration = fs.readFileSync('migrations/add_substitution_deadlines.sql', 'utf8');
    
    // Execute the migration using tagged template
    await sql`
      ALTER TABLE round_deadlines
      ADD COLUMN IF NOT EXISTS home_substitution_deadline_time TIME DEFAULT '21:00',
      ADD COLUMN IF NOT EXISTS away_substitution_deadline_time TIME DEFAULT '21:00',
      ADD COLUMN IF NOT EXISTS home_substitution_deadline_day_offset INTEGER DEFAULT 1,
      ADD COLUMN IF NOT EXISTS away_substitution_deadline_day_offset INTEGER DEFAULT 0
    `;
    
    console.log('✅ Substitution deadline columns added successfully');
    
    // Verify the columns were added
    const result = await sql`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'round_deadlines'
        AND column_name LIKE '%substitution%'
      ORDER BY column_name
    `;
    
    console.log('\n📊 New columns:');
    result.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}): ${col.column_default || 'no default'}`);
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
