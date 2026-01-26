const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  try {
    // Read NEON_TOURNAMENT_DB_URL from .env.local (tournament database with fixtures)
    const envContent = fs.readFileSync('.env.local', 'utf8');
    const dbUrlMatch = envContent.match(/^NEON_TOURNAMENT_DB_URL=(.+)$/m);
    
    if (!dbUrlMatch) {
      throw new Error('NEON_TOURNAMENT_DB_URL not found in .env.local');
    }
    
    const databaseUrl = dbUrlMatch[1].trim();
    console.log('📊 Connecting to tournament database (fixtures)...');
    
    const sql = neon(databaseUrl);
    
    // First, check what tables exist
    console.log('🔍 Checking available tables...');
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;
    
    console.log('📋 Available tables:');
    tables.forEach(t => console.log(`  - ${t.table_name}`));
    
    // Check if fixtures table exists
    const hasFixtures = tables.some(t => t.table_name === 'fixtures');
    
    if (!hasFixtures) {
      console.log('\n⚠️  Fixtures table not found in this database!');
      console.log('This might be the wrong database. Fixtures might be in Firebase or another Neon database.');
      return;
    }
    
    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', 'add_knockout_scoring_system.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('🔄 Running migration: add_knockout_scoring_system.sql');
    console.log('---');
    console.log(migrationSQL);
    console.log('---');
    
    // Execute migration statements using template literals
    console.log('Executing: ALTER TABLE fixtures ADD COLUMN...');
    await sql`
      ALTER TABLE fixtures 
      ADD COLUMN IF NOT EXISTS scoring_system VARCHAR(20) DEFAULT 'goals'
    `;
    
    console.log('Executing: COMMENT ON COLUMN...');
    await sql`
      COMMENT ON COLUMN fixtures.scoring_system IS 'Scoring system for knockout: goals (sum of goals) or wins (3 for win, 1 for draw)'
    `;
    
    console.log('Executing: UPDATE fixtures...');
    await sql`
      UPDATE fixtures 
      SET scoring_system = 'goals' 
      WHERE scoring_system IS NULL
    `;
    
    console.log('✅ Migration completed successfully!');
    
    // Verify the column was added
    console.log('\n🔍 Verifying column...');
    const result = await sql`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'fixtures'
        AND column_name IN ('scoring_system', 'knockout_format')
      ORDER BY column_name;
    `;
    
    console.log('📋 Columns found:');
    result.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (default: ${col.column_default || 'none'})`);
    });
    
    // Check existing fixtures
    console.log('\n📊 Checking existing knockout fixtures...');
    const fixtures = await sql`
      SELECT id, knockout_round, scoring_system
      FROM fixtures
      WHERE knockout_round IS NOT NULL
      LIMIT 5;
    `;
    
    if (fixtures.length > 0) {
      console.log(`Found ${fixtures.length} knockout fixtures (showing first 5):`);
      fixtures.forEach(f => {
        console.log(`  - ${f.id}: round=${f.knockout_round}, scoring=${f.scoring_system || 'NULL'}`);
      });
    } else {
      console.log('No knockout fixtures found yet.');
    }
    
    console.log('\n🎉 All done! Knockout scoring system is ready to use.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
