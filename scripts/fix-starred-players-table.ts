import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const sql = neon(process.env.NEON_DATABASE_URL!);

async function fix() {
  console.log('🔧 Fixing starred_players table...\n');

  try {
    // Make user_id nullable
    console.log('1️⃣  Making user_id nullable...');
    await sql`
      ALTER TABLE starred_players 
      ALTER COLUMN user_id DROP NOT NULL
    `;
    console.log('✅ user_id is now nullable\n');

    // Check table structure
    console.log('2️⃣  Verifying table structure...');
    const columns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'starred_players'
      ORDER BY ordinal_position
    `;
    console.table(columns);

    console.log('\n✅ Fix complete! Teams can now star players.');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

fix().catch(console.error);
