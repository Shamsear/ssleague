import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const sql = neon(process.env.NEON_DATABASE_URL!);

async function addEncryptedBidColumn() {
  try {
    console.log('Adding encrypted_bid_data column to bids table...\n');

    // Add the encrypted_bid_data column
    await sql`
      ALTER TABLE bids 
      ADD COLUMN IF NOT EXISTS encrypted_bid_data TEXT
    `;
    console.log('✅ Added encrypted_bid_data column to bids table');

    // Add phase column for tracking incomplete bids
    await sql`
      ALTER TABLE bids 
      ADD COLUMN IF NOT EXISTS phase VARCHAR(20) DEFAULT 'regular'
    `;
    console.log('✅ Added phase column to bids table');

    // Add actual_bid_amount column for incomplete bids
    await sql`
      ALTER TABLE bids 
      ADD COLUMN IF NOT EXISTS actual_bid_amount INTEGER
    `;
    console.log('✅ Added actual_bid_amount column to bids table');

    console.log('\n📋 Updated Bids Table Schema:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Existing columns:');
    console.log('  - id: UUID (Primary Key)');
    console.log('  - team_id: VARCHAR(255)');
    console.log('  - player_id: VARCHAR(255)');
    console.log('  - round_id: UUID (Foreign Key)');
    console.log('  - amount: INTEGER');
    console.log('  - status: VARCHAR(50)');
    console.log('  - created_at: TIMESTAMP');
    console.log('  - updated_at: TIMESTAMP');
    console.log('\nNew columns added:');
    console.log('  - encrypted_bid_data: TEXT (stores encrypted player_id and amount)');
    console.log('  - phase: VARCHAR(20) (regular or incomplete)');
    console.log('  - actual_bid_amount: INTEGER (original bid for incomplete bids)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('✨ Migration Complete!');
    console.log('\nNote: The existing player_id and amount columns are kept for backward compatibility.');
    console.log('New bids will use encrypted_bid_data for blind bidding.\n');

  } catch (error) {
    console.error('❌ Error adding encrypted_bid_data column:', error);
    process.exit(1);
  }
}

addEncryptedBidColumn();
