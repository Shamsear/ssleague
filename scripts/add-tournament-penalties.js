/**
 * Tournament Penalties System Migration - Fixed
 * Updates teamstats table and verifies tournament_penalties
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function runMigration() {
  const databaseUrl = process.env.NEON_TOURNAMENT_DB_URL;

  if (!databaseUrl) {
    console.error('❌ Error: NEON_TOURNAMENT_DB_URL not found');
    process.exit(1);
  }

  console.log('🚀 Starting migration: Tournament Penalties System (Fixed)...\n');

  const sql = neon(databaseUrl);

  try {
    // Step 1: Check if tournament_penalties exists
    console.log('📝 Step 1: Checking tournament_penalties table...');
    const penaltiesExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'tournament_penalties'
      )
    `;

    if (penaltiesExists[0].exists) {
      console.log('✅ tournament_penalties table already exists\n');

      // Show current structure
      const columns = await sql`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'tournament_penalties'
        ORDER BY ordinal_position
      `;
      console.log('Current columns:');
      columns.forEach(col => {
        console.log(`  - ${col.column_name} (${col.data_type})`);
      });
      console.log('');
    } else {
      console.log('⚠️  tournament_penalties table does not exist - creating it...\n');
      // Create it if it doesn't exist
      await sql`
        CREATE TABLE tournament_penalties (
          id SERIAL PRIMARY KEY,
          tournament_id VARCHAR(50) NOT NULL,
          season_id VARCHAR(50) NOT NULL,
          team_id VARCHAR(50) NOT NULL,
          team_name VARCHAR(255) NOT NULL,
          points_deducted INTEGER NOT NULL CHECK (points_deducted > 0),
          reason TEXT NOT NULL,
          applied_by_id VARCHAR(50) NOT NULL,
          applied_by_name VARCHAR(255) NOT NULL,
          applied_at TIMESTAMP DEFAULT NOW(),
          is_active BOOLEAN DEFAULT TRUE,
          removed_by_id VARCHAR(50),
          removed_by_name VARCHAR(255),
          removed_at TIMESTAMP,
          removal_reason TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          
          CONSTRAINT fk_tournament FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
        )
      `;
      console.log('✅ tournament_penalties table created\n');
    }

    // Step 2: Add points_deducted to teamstats (note: no underscore!)
    console.log('📝 Step 2: Adding points_deducted column to teamstats...');
    try {
      await sql`
        ALTER TABLE teamstats
        ADD COLUMN IF NOT EXISTS points_deducted INTEGER DEFAULT 0
      `;
      console.log('✅ points_deducted column added to teamstats\n');
    } catch (error) {
      if (error.code === '42701') {
        console.log('✅ points_deducted column already exists in teamstats\n');
      } else {
        throw error;
      }
    }

    // Step 3: Create indexes if they don't exist
    console.log('📝 Step 3: Creating indexes...');
    await sql`CREATE INDEX IF NOT EXISTS idx_tournament_penalties_tournament ON tournament_penalties(tournament_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_tournament_penalties_team ON tournament_penalties(team_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_tournament_penalties_active ON tournament_penalties(is_active)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_tournament_penalties_season ON tournament_penalties(season_id)`;
    console.log('✅ Indexes created\n');

    // Step 4: Verify teamstats column
    console.log('🔍 Step 4: Verifying teamstats columns...');
    const teamstatsColumns = await sql`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'teamstats' AND column_name = 'points_deducted'
    `;

    if (teamstatsColumns.length > 0) {
      console.log('✅ teamstats.points_deducted verified:');
      teamstatsColumns.forEach(col => {
        console.log(`  - ${col.column_name} (${col.data_type}) DEFAULT ${col.column_default}`);
      });
    } else {
      console.log('❌ points_deducted column not found in teamstats');
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📝 Summary:');
    console.log('  - tournament_penalties table ready');
    console.log('  - teamstats.points_deducted column added');
    console.log('  - Indexes created for fast lookups');
    console.log('\n🎯 Ready to implement penalty APIs and UI!');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('\nError details:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    process.exit(1);
  }
}

runMigration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
