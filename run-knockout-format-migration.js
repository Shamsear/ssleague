const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function runMigration() {
  try {
    console.log('Running knockout_format migration...');
    
    const migration = fs.readFileSync('migrations/add_knockout_format_to_fixtures.sql', 'utf8');
    await sql(migration);
    
    console.log('✓ Migration completed successfully');
    
    // Verify the column was added
    const result = await sql`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'fixtures'
      AND column_name = 'knockout_format'
    `;
    
    if (result.length > 0) {
      console.log('✓ Column verified:', result[0]);
    } else {
      console.log('✗ Column not found after migration');
    }
    
  } catch (error) {
    console.error('✗ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
