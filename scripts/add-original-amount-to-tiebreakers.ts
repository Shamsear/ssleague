import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

async function addOriginalAmountColumn() {
  try {
    console.log('🔍 Checking tiebreakers table structure...');
    
    // Check if column exists
    const checkColumn = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'tiebreakers' 
      AND column_name = 'original_amount'
    `;
    
    if (checkColumn.length > 0) {
      console.log('✅ Column original_amount already exists');
      return;
    }
    
    console.log('➕ Adding original_amount column...');
    
    // Add the column
    await sql`
      ALTER TABLE tiebreakers 
      ADD COLUMN original_amount INTEGER NOT NULL DEFAULT 0
    `;
    
    console.log('✅ Column original_amount added successfully');
    
    // Add comment
    await sql`
      COMMENT ON COLUMN tiebreakers.original_amount IS 'The original tied bid amount that triggered this tiebreaker'
    `;
    
    console.log('✅ Column comment added');
    
    // Verify
    const verify = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'tiebreakers' 
      AND column_name = 'original_amount'
    `;
    
    console.log('\n📋 Column details:', verify[0]);
    console.log('\n🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

addOriginalAmountColumn();
