require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function addTournamentFormatColumns() {
  const connectionString = process.env.NEON_TOURNAMENT_DB_URL;
  
  if (!connectionString) {
    console.error('❌ NEON_TOURNAMENT_DB_URL not found in environment');
    process.exit(1);
  }

  const sql = neon(connectionString);

  try {
    console.log('Adding tournament format columns to fixtures table...');

    // Add group_name column
    await sql`
      ALTER TABLE fixtures 
      ADD COLUMN IF NOT EXISTS group_name VARCHAR(10)
    `;
    console.log('✓ Added group_name column');

    // Add knockout_round column
    await sql`
      ALTER TABLE fixtures 
      ADD COLUMN IF NOT EXISTS knockout_round VARCHAR(50)
    `;
    console.log('✓ Added knockout_round column');

    // Add comments
    await sql`
      COMMENT ON COLUMN fixtures.group_name IS 'Group identifier for group stage fixtures (e.g., A, B, C, D)'
    `;
    await sql`
      COMMENT ON COLUMN fixtures.knockout_round IS 'Knockout round name (e.g., Final, Semi-Final, Quarter-Final, Round of 16)'
    `;
    console.log('✓ Added column comments');

    // Create indexes
    await sql`
      CREATE INDEX IF NOT EXISTS idx_fixtures_group_name 
      ON fixtures(group_name) 
      WHERE group_name IS NOT NULL
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_fixtures_knockout_round 
      ON fixtures(knockout_round) 
      WHERE knockout_round IS NOT NULL
    `;
    console.log('✓ Created indexes');

    // Verify columns
    const result = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'fixtures'
      AND column_name IN ('group_name', 'knockout_round')
    `;
    
    console.log('\n✅ Migration completed successfully!');
    console.log('Columns added:');
    result.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type}, nullable: ${row.is_nullable})`);
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  }
}

addTournamentFormatColumns()
  .then(() => {
    console.log('\n🎉 All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
