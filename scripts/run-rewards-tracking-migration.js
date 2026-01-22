require('dotenv').config();
require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function runMigration() {
    const connectionString = process.env.NEON_TOURNAMENT_DB_URL;

    if (!connectionString) {
        console.error('❌ NEON_TOURNAMENT_DB_URL environment variable is not set');
        process.exit(1);
    }

    const sql = neon(connectionString);

    console.log('🚀 Running tournament rewards tracking migration...\n');

    try {
        // Create table
        console.log('📋 Creating tournament_rewards_distributed table...');
        await sql`
      CREATE TABLE IF NOT EXISTS tournament_rewards_distributed (
        id SERIAL PRIMARY KEY,
        tournament_id VARCHAR(255) NOT NULL,
        team_id VARCHAR(255) NOT NULL,
        season_id VARCHAR(255) NOT NULL,
        reward_type VARCHAR(50) NOT NULL,
        reward_details JSONB,
        ecoin_amount INTEGER DEFAULT 0,
        sscoin_amount INTEGER DEFAULT 0,
        distributed_by VARCHAR(255),
        distributed_at TIMESTAMP DEFAULT NOW(),
        notes TEXT
      )
    `;
        console.log('✅ Table created!');

        // Create unique index
        console.log('📊 Creating unique index...');
        await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_reward 
      ON tournament_rewards_distributed(tournament_id, team_id, reward_type, (reward_details::text))
    `;
        console.log('✅ Unique index created!');

        // Create performance indexes
        console.log('📊 Creating performance indexes...');
        await sql`CREATE INDEX IF NOT EXISTS idx_rewards_tournament ON tournament_rewards_distributed(tournament_id)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_rewards_team ON tournament_rewards_distributed(team_id)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_rewards_type ON tournament_rewards_distributed(reward_type)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_rewards_season ON tournament_rewards_distributed(season_id)`;
        console.log('✅ Performance indexes created!');

        // Add comments
        console.log('💬 Adding table comments...');
        await sql`
      COMMENT ON TABLE tournament_rewards_distributed IS 'Tracks tournament rewards distributed to teams to prevent duplicate distributions'
    `;
        await sql`
      COMMENT ON COLUMN tournament_rewards_distributed.reward_type IS 'Type of reward: position, knockout, or completion'
    `;
        await sql`
      COMMENT ON COLUMN tournament_rewards_distributed.reward_details IS 'JSON details like {"position": 1} or {"stage": "final", "result": "winner"}'
    `;
        console.log('✅ Comments added!');

        // Verify the table
        console.log('\n🔍 Verifying migration...');
        const tableCheck = await sql`
      SELECT COUNT(*) as count FROM tournament_rewards_distributed
    `;

        console.log('✅ Table verified! Current records:', tableCheck[0].count);

        // Get table structure
        const columns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'tournament_rewards_distributed'
      ORDER BY ordinal_position
    `;

        console.log('\n📊 Table structure:');
        columns.forEach(col => {
            console.log(`   - ${col.column_name} (${col.data_type})`);
        });

        // Get indexes
        const indexes = await sql`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'tournament_rewards_distributed'
    `;

        console.log('\n🔍 Indexes:');
        indexes.forEach(idx => {
            console.log(`   - ${idx.indexname}`);
        });

        console.log('\n✅ Migration completed successfully!');
        console.log('🎉 You can now use the tournament rewards tracking system!');

    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        if (error.message.includes('already exists')) {
            console.log('\n💡 Table or index already exists! Migration has been run before.');
            console.log('   The system is ready to use.');
        } else {
            console.error('\nFull error:', error);
        }
        process.exit(1);
    }
}

runMigration();
