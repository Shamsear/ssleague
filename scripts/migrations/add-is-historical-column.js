require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function addIsHistoricalColumn() {
  const connectionString = process.env.NEON_TOURNAMENT_DB_URL;
  
  if (!connectionString) {
    console.error('❌ NEON_TOURNAMENT_DB_URL not found in environment');
    process.exit(1);
  }

  const sql = neon(connectionString);

  try {
    console.log('Adding is_historical column to tournaments table...');

    // Add is_historical column
    await sql`
      ALTER TABLE tournaments 
      ADD COLUMN IF NOT EXISTS is_historical BOOLEAN DEFAULT false
    `;
    console.log('✓ Added is_historical column');

    // Add comment
    await sql`
      COMMENT ON COLUMN tournaments.is_historical IS 'Marks historical/archived tournaments that should be preserved during cleanup'
    `;
    console.log('✓ Added column comment');

    // Create index
    await sql`
      CREATE INDEX IF NOT EXISTS idx_tournaments_is_historical 
      ON tournaments(is_historical) 
      WHERE is_historical = true
    `;
    console.log('✓ Created index');

    // Verify column
    const result = await sql`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'tournaments'
      AND column_name = 'is_historical'
    `;
    
    console.log('\n✅ Migration completed successfully!');
    console.log('Column added:');
    result.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type}, default: ${row.column_default})`);
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  }
}

addIsHistoricalColumn()
  .then(() => {
    console.log('\n🎉 All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
