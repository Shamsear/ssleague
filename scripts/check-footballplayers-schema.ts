import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = neon(process.env.NEON_AUCTION_DB_URL!);

async function checkSchema() {
  const columns = await sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns 
    WHERE table_name = 'footballplayers' 
    ORDER BY ordinal_position
  `;
  
  console.log('Footballplayers table columns:');
  console.log(JSON.stringify(columns, null, 2));
}

checkSchema().catch(console.error);
