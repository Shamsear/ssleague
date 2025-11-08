import { getTournamentDb } from '../../lib/neon/tournament-config';

async function addTournamentFormatColumns() {
  try {
    const sql = getTournamentDb();
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
    console.log('Columns added:', result.rows);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
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
