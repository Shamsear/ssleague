/**
 * Script to add registration_type column to player_seasons table in Neon
 * Run with: node scripts/migrate-neon-registration-type.js
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

// Use TOURNAMENT database (Season 16+ data)
const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);

async function migrateNeonDatabase() {
  try {
    console.log('🔄 Starting Neon database migration for registration_type...\n');

    // Add registration_type column (default to 'confirmed' for existing records)
    console.log('📝 Adding registration_type column...');
    await sql`
      ALTER TABLE player_seasons 
      ADD COLUMN IF NOT EXISTS registration_type VARCHAR(20) DEFAULT 'confirmed'
    `;
    console.log('✅ Added registration_type column\n');

    // Update existing NULL values to 'confirmed'
    console.log('📝 Updating NULL values to confirmed...');
    const updateResult = await sql`
      UPDATE player_seasons 
      SET registration_type = 'confirmed' 
      WHERE registration_type IS NULL
    `;
    console.log(`✅ Updated ${updateResult.length} rows\n`);

    // Create index for faster queries filtering by registration_type
    console.log('📝 Creating registration_type index...');
    await sql`
      CREATE INDEX IF NOT EXISTS idx_player_seasons_registration_type 
      ON player_seasons(registration_type)
    `;
    console.log('✅ Created registration_type index\n');

    // Create composite index for season + registration_type queries
    console.log('📝 Creating composite index...');
    await sql`
      CREATE INDEX IF NOT EXISTS idx_player_seasons_season_reg_type 
      ON player_seasons(season_id, registration_type)
    `;
    console.log('✅ Created composite index\n');

    // Verify the migration
    console.log('📊 Verifying migration...');
    const stats = await sql`
      SELECT 
        COUNT(*) as total_records,
        COUNT(CASE WHEN registration_type = 'confirmed' THEN 1 END) as confirmed_count,
        COUNT(CASE WHEN registration_type = 'unconfirmed' THEN 1 END) as unconfirmed_count
      FROM player_seasons
    `;

    const verification = stats[0];
    console.log('📊 Migration Results:');
    console.log('   Total records:', verification.total_records);
    console.log('   Confirmed:', verification.confirmed_count);
    console.log('   Unconfirmed:', verification.unconfirmed_count);
    console.log('\n✨ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration error:', error);
    
    // Check if error is because column already exists
    if (error.message?.includes('already exists')) {
      console.log('✅ Migration already applied - registration_type column exists');
    } else {
      throw error;
    }
  }
}

// Run the migration
migrateNeonDatabase()
  .then(() => {
    console.log('\n👋 Exiting...');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
