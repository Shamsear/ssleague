import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const sql = neon(process.env.NEON_AUCTION_DB_URL!);

async function addTiebreakerBidColumns() {
  console.log('🔧 Adding columns to team_tiebreakers table...');
  
  try {
    // Add old_bid_amount column
    await sql`
      ALTER TABLE team_tiebreakers 
      ADD COLUMN IF NOT EXISTS old_bid_amount INTEGER DEFAULT 0
    `;
    console.log('✅ Added old_bid_amount column');
    
    // Add new_bid_amount column
    await sql`
      ALTER TABLE team_tiebreakers 
      ADD COLUMN IF NOT EXISTS new_bid_amount INTEGER DEFAULT 0
    `;
    console.log('✅ Added new_bid_amount column');
    
    // Add submitted column
    await sql`
      ALTER TABLE team_tiebreakers 
      ADD COLUMN IF NOT EXISTS submitted BOOLEAN DEFAULT false
    `;
    console.log('✅ Added submitted column');
    
    // Add submitted_at column
    await sql`
      ALTER TABLE team_tiebreakers 
      ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP
    `;
    console.log('✅ Added submitted_at column');
    
    // Verify columns exist
    const result = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'team_tiebreakers' 
      AND column_name IN ('old_bid_amount', 'new_bid_amount', 'submitted', 'submitted_at')
      ORDER BY column_name
    `;
    
    console.log('\n📊 Columns added:');
    result.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type}`);
    });
    
    console.log('\n✅ Migration complete!');
  } catch (error) {
    console.error('❌ Error adding columns:', error);
    throw error;
  }
}

addTiebreakerBidColumns()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
