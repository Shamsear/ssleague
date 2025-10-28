import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';

dotenv.config({ path: '.env.local' });

async function checkSchema() {
  const sql = neon(process.env.NEON_TOURNAMENT_DB_URL!);
  
  console.log('Checking teamstats table schema...\n');
  
  const columns = await sql`
    SELECT 
      column_name,
      data_type,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_name = 'teamstats'
    ORDER BY ordinal_position
  `;
  
  console.log('Columns:');
  console.log(JSON.stringify(columns, null, 2));
}

checkSchema().catch(console.error);
