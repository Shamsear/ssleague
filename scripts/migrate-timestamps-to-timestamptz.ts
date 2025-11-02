/**
 * Migrate timestamp columns to timestamptz for timezone-aware storage
 * This fixes the timezone conversion issue
 */

import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const sql = neon(process.env.NEON_AUCTION_DB_URL || process.env.NEON_DATABASE_URL!);

async function migrate() {
  console.log('🔄 Migrating timestamp columns to timestamptz...\n');
  
  try {
    // First, check current database timezone
    const tzResult = await sql`SHOW timezone`;
    console.log('📍 Current database timezone:', tzResult[0].timezone);
    
    // Migrate rounds table - THE KEY FIX
    console.log('\n📝 Migrating rounds table...');
    await sql`
      ALTER TABLE rounds 
      ALTER COLUMN start_time TYPE timestamptz USING start_time AT TIME ZONE 'UTC',
      ALTER COLUMN end_time TYPE timestamptz USING end_time AT TIME ZONE 'UTC',
      ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC',
      ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC'
    `;
    console.log('✅ Rounds table migrated');
    
    // Migrate bids table
    console.log('\n📝 Migrating bids table...');
    await sql`
      ALTER TABLE bids 
      ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC',
      ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC'
    `;
    console.log('✅ Bids table migrated');
    
    // Migrate round_bids table
    console.log('\n📝 Migrating round_bids table...');
    await sql`
      ALTER TABLE round_bids 
      ALTER COLUMN bid_time TYPE timestamptz USING bid_time AT TIME ZONE 'UTC'
    `;
    console.log('✅ Round_bids table migrated');
    
    // Migrate tiebreakers table
    console.log('\n📝 Migrating tiebreakers table...');
    await sql`
      ALTER TABLE tiebreakers 
      ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC',
      ALTER COLUMN resolved_at TYPE timestamptz USING resolved_at AT TIME ZONE 'UTC'
    `;
    console.log('✅ Tiebreakers table migrated');
    
    // Migrate bulk_tiebreakers table
    console.log('\n📝 Migrating bulk_tiebreakers table...');
    await sql`
      ALTER TABLE bulk_tiebreakers 
      ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC',
      ALTER COLUMN resolved_at TYPE timestamptz USING resolved_at AT TIME ZONE 'UTC'
    `;
    console.log('✅ Bulk_tiebreakers table migrated');
    
    // Migrate other tables with timestamps
    console.log('\n📝 Migrating other tables...');
    await sql`
      ALTER TABLE footballplayers 
      ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC',
      ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC'
    `;
    
    await sql`
      ALTER TABLE round_players 
      ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC'
    `;
    
    await sql`
      ALTER TABLE auction_settings 
      ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC',
      ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC'
    `;
    console.log('✅ All other tables migrated');
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('\n💡 All timestamp columns are now timezone-aware (timestamptz)');
    console.log('   Existing timestamps were interpreted as UTC and converted correctly.');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
