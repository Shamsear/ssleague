import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env.local') });
const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

(async () => {
  const cols = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'bulk_tiebreakers' 
    ORDER BY ordinal_position
  `;
  
  console.log('\nColumns in bulk_tiebreakers table:');
  console.log('='.repeat(50));
  cols.forEach(c => console.log(`  ${c.column_name.padEnd(30)} ${c.data_type}`));
  console.log('='.repeat(50) + '\n');
})();
