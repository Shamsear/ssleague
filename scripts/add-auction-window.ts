import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

async function addAuctionWindow() {
  console.log('🔧 Adding auction_window column to rounds...\n');

  try {
    // Add auction_window column
    await sql`
      ALTER TABLE rounds
      ADD COLUMN IF NOT EXISTS auction_window VARCHAR(50) DEFAULT 'season_start'
    `;
    console.log('✅ Added auction_window column\n');

    // Update existing rounds
    await sql`
      UPDATE rounds
      SET auction_window = 'season_start'
      WHERE auction_window IS NULL
    `;
    console.log('✅ Updated existing rounds\n');

    // Create index
    await sql`
      CREATE INDEX IF NOT EXISTS idx_rounds_auction_window 
      ON rounds(season_id, auction_window)
    `;
    console.log('✅ Created index\n');

    // Check results
    const rounds = await sql`
      SELECT id, position, auction_window, created_at
      FROM rounds
      ORDER BY created_at DESC
      LIMIT 5
    `;
    
    console.log('📋 Recent rounds:');
    rounds.forEach(r => {
      console.log(`   - ${r.id} (${r.position}) - Window: ${r.auction_window}`);
    });

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

addAuctionWindow()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
