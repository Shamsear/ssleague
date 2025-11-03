import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

async function addOriginalBidIdColumn() {
  try {
    console.log('🔍 Checking team_tiebreakers table structure...');
    
    // Check if column exists
    const checkColumn = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'team_tiebreakers' 
      AND column_name = 'original_bid_id'
    `;
    
    if (checkColumn.length > 0) {
      console.log('✅ Column original_bid_id already exists');
      return;
    }
    
    console.log('➕ Adding original_bid_id column...');
    
    // Add the column (nullable initially to allow existing records)
    await sql`
      ALTER TABLE team_tiebreakers 
      ADD COLUMN original_bid_id VARCHAR(255) NULL
    `;
    
    console.log('✅ Column original_bid_id added successfully');
    
    // Add comment
    await sql`
      COMMENT ON COLUMN team_tiebreakers.original_bid_id IS 'The original bid ID that was tied and triggered this tiebreaker'
    `;
    
    console.log('✅ Column comment added');
    
    // Verify
    const verify = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'team_tiebreakers' 
      AND column_name = 'original_bid_id'
    `;
    
    console.log('\n📋 Column details:', verify[0]);
    console.log('\n🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

addOriginalBidIdColumn();
