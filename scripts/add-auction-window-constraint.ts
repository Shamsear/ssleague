import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const sql = neon(process.env.NEON_DATABASE_URL!);

async function addConstraint() {
  console.log('🔧 Adding unique constraint to auction_settings...\n');

  try {
    // Add unique constraint on (season_id, auction_window)
    console.log('Adding UNIQUE constraint on (season_id, auction_window)...');
    await sql`
      ALTER TABLE auction_settings
      ADD CONSTRAINT unique_season_auction_window 
      UNIQUE (season_id, auction_window)
    `;
    console.log('✅ Constraint added successfully!\n');

    // Verify the constraint
    const constraints = await sql`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'auction_settings'::regclass
      AND contype = 'u'
    `;
    
    console.log('📋 Current unique constraints on auction_settings:');
    console.table(constraints);

  } catch (error: any) {
    if (error.code === '42P07') {
      console.log('ℹ️  Constraint already exists');
    } else {
      console.error('❌ Error:', error);
      throw error;
    }
  }
}

addConstraint().catch(console.error);
