import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const sql = neon(process.env.NEON_DATABASE_URL!);

async function dropConstraint() {
  console.log('🗑️  Dropping old season_id unique constraint...\n');
  
  await sql`
    ALTER TABLE auction_settings 
    DROP CONSTRAINT IF EXISTS auction_settings_season_id_key
  `;
  
  console.log('✅ Dropped old constraint');
}

dropConstraint().catch(console.error);
