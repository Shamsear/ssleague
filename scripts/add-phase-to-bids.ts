import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const sql = neon(process.env.NEON_DATABASE_URL!);

async function addPhaseColumn() {
  try {
    console.log('Adding phase and actual_bid_amount columns to bids table...');

    // Add phase column
    await sql`
      ALTER TABLE bids 
      ADD COLUMN IF NOT EXISTS phase VARCHAR(20),
      ADD COLUMN IF NOT EXISTS actual_bid_amount INTEGER;
    `;

    console.log('✅ Columns added successfully!');
    console.log('\nColumn descriptions:');
    console.log('- phase: "regular" for normal wins, "incomplete" for teams with fewer than required bids');
    console.log('- actual_bid_amount: stores the original bid amount when phase is "incomplete" (before average price adjustment)');

  } catch (error) {
    console.error('❌ Error adding columns:', error);
    process.exit(1);
  }
}

addPhaseColumn();
