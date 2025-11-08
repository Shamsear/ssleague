import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const sql = neon(process.env.NEON_DATABASE_URL!);

async function migrate() {
  console.log('🔄 Starting auction settings structure migration...\n');

  try {
    // Step 1: Add auction_window to auction_settings
    console.log('1️⃣ Adding auction_window column to auction_settings...');
    await sql`
      ALTER TABLE auction_settings 
      ADD COLUMN IF NOT EXISTS auction_window VARCHAR(50) DEFAULT 'season_start'
    `;
    console.log('✅ Added auction_window to auction_settings\n');

    // Step 2: Add auction_settings_id to rounds
    console.log('2️⃣ Adding auction_settings_id column to rounds...');
    await sql`
      ALTER TABLE rounds 
      ADD COLUMN IF NOT EXISTS auction_settings_id INTEGER
    `;
    console.log('✅ Added auction_settings_id to rounds\n');

    // Step 3: Create foreign key constraint
    console.log('3️⃣ Creating foreign key constraint...');
    await sql`
      ALTER TABLE rounds 
      ADD CONSTRAINT fk_rounds_auction_settings 
      FOREIGN KEY (auction_settings_id) 
      REFERENCES auction_settings(id)
      ON DELETE SET NULL
    `;
    console.log('✅ Created FK constraint\n');

    // Step 4: Create index on auction_window
    console.log('4️⃣ Creating index on auction_settings(auction_window)...');
    await sql`
      CREATE INDEX IF NOT EXISTS idx_auction_settings_window 
      ON auction_settings(season_id, auction_window)
    `;
    console.log('✅ Created index\n');

    // Step 5: Migrate existing rounds to link with their season's auction_settings
    console.log('5️⃣ Migrating existing rounds to link with auction_settings...');
    const migratedRounds = await sql`
      UPDATE rounds r
      SET auction_settings_id = (
        SELECT id 
        FROM auction_settings 
        WHERE season_id = r.season_id 
        LIMIT 1
      )
      WHERE auction_settings_id IS NULL
      RETURNING id, auction_settings_id
    `;
    console.log(`✅ Migrated ${migratedRounds.length} rounds\n`);

    // Step 6: Show current state
    console.log('6️⃣ Current auction_settings:');
    const settings = await sql`
      SELECT id, season_id, auction_window, max_rounds, 
             phase_1_end_round, phase_2_end_round
      FROM auction_settings
      ORDER BY season_id, auction_window
    `;
    console.table(settings);

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Update auction settings UI to select auction_window');
    console.log('   2. Update round creation to select auction_settings_id');
    console.log('   3. Create different settings for transfer_window, mid_season, etc.');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

migrate().catch(console.error);
