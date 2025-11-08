import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const sql = neon(process.env.NEON_DATABASE_URL!);

async function check() {
  const cols = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'footballplayers' 
    AND column_name IN ('id', 'player_id')
    ORDER BY ordinal_position
  `;
  console.table(cols);
}

check().catch(console.error);
