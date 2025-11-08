import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const sql = neon(process.env.NEON_DATABASE_URL!);

async function checkColumns() {
  console.log('📋 Checking auction_settings columns...\n');
  
  const result = await sql`
    SELECT column_name, data_type, column_default 
    FROM information_schema.columns 
    WHERE table_name = 'auction_settings' 
    ORDER BY ordinal_position
  `;
  
  console.log(JSON.stringify(result, null, 2));
}

checkColumns().catch(console.error);
