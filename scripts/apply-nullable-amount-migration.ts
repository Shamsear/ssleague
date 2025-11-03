import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

async function applyMigration() {
  try {
    console.log('🔍 Checking current bids table structure...');
    
    // Check current structure
    const currentStructure = await sql`
      SELECT column_name, is_nullable, data_type
      FROM information_schema.columns
      WHERE table_name = 'bids' AND column_name = 'amount'
    `;
    
    console.log('Current amount column:', currentStructure[0]);
    
    if (currentStructure[0]?.is_nullable === 'NO') {
      console.log('⚠️  Amount column is NOT NULL - applying migration...');
      
      // Make amount column nullable
      await sql`ALTER TABLE bids ALTER COLUMN amount DROP NOT NULL`;
      console.log('✅ Amount column is now nullable');
      
      // Add comments
      await sql`COMMENT ON COLUMN bids.amount IS 'Plain-text bid amount. NULL during active bidding (blind), populated after round finalization.'`;
      await sql`COMMENT ON COLUMN bids.encrypted_bid_data IS 'Encrypted bid data containing player_id and amount. Used for blind bidding.'`;
      console.log('✅ Added column comments');
      
    } else {
      console.log('✅ Amount column is already nullable - no migration needed');
    }
    
    // Verify final structure
    const finalStructure = await sql`
      SELECT column_name, is_nullable, data_type
      FROM information_schema.columns
      WHERE table_name = 'bids' AND column_name = 'amount'
    `;
    
    console.log('\n✅ Final structure:', finalStructure[0]);
    console.log('\n🎉 Migration complete! Blind bidding is now properly configured.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

applyMigration();
