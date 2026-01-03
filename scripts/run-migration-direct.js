require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function runMigration() {
    const sql = neon(process.env.FANTASY_DATABASE_URL);

    console.log('🔧 Running Migration Directly...\n');

    try {
        // Step 1: Add columns to transfer_windows
        console.log('1️⃣ Adding columns to transfer_windows...');
        await sql`
      ALTER TABLE transfer_windows
      ADD COLUMN IF NOT EXISTS window_type VARCHAR(50) DEFAULT 'player_transfer',
      ADD COLUMN IF NOT EXISTS allow_supported_team_change BOOLEAN DEFAULT false
    `;
        console.log('   ✅ Columns added\n');

        // Step 2: Create supported_team_changes table
        console.log('2️⃣ Creating supported_team_changes table...');
        await sql`
      CREATE TABLE IF NOT EXISTS supported_team_changes (
        id SERIAL PRIMARY KEY,
        change_id VARCHAR(100) UNIQUE NOT NULL,
        league_id VARCHAR(100) NOT NULL,
        team_id VARCHAR(100) NOT NULL,
        window_id VARCHAR(100) NOT NULL,
        old_supported_team_id VARCHAR(100),
        old_supported_team_name VARCHAR(255),
        new_supported_team_id VARCHAR(100) NOT NULL,
        new_supported_team_name VARCHAR(255) NOT NULL,
        changed_by VARCHAR(100) NOT NULL,
        changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reason TEXT,
        FOREIGN KEY (league_id) REFERENCES fantasy_leagues(league_id) ON DELETE CASCADE,
        FOREIGN KEY (team_id) REFERENCES fantasy_teams(team_id) ON DELETE CASCADE,
        FOREIGN KEY (window_id) REFERENCES transfer_windows(window_id) ON DELETE CASCADE
      )
    `;
        console.log('   ✅ Table created\n');

        // Step 3: Create indexes
        console.log('3️⃣ Creating indexes...');
        await sql`CREATE INDEX IF NOT EXISTS idx_supported_team_changes_team ON supported_team_changes(team_id)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_supported_team_changes_window ON supported_team_changes(window_id)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_supported_team_changes_league ON supported_team_changes(league_id)`;
        console.log('   ✅ Indexes created\n');

        console.log('✅ Migration completed successfully!\n');

        // Verify
        console.log('🔍 Verifying...');
        const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'supported_team_changes'
      ) as exists
    `;

        const columns = await sql`
      SELECT column_name
      FROM information_schema.columns 
      WHERE table_name = 'transfer_windows'
      AND column_name IN ('window_type', 'allow_supported_team_change')
    `;

        console.log(`   Table exists: ${tableCheck[0].exists ? '✅' : '❌'}`);
        console.log(`   Columns added: ${columns.length}/2 ${columns.length === 2 ? '✅' : '❌'}`);

        if (tableCheck[0].exists && columns.length === 2) {
            console.log('\n🎉 Everything is ready to use!');
        }

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error('Full error:', error);
    }
}

runMigration();
