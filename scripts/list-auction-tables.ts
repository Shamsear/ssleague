import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const sql = neon(process.env.NEON_AUCTION_DB_URL || process.env.NEON_DATABASE_URL!);

async function listTables() {
  console.log('📋 Tables in Auction Database:\n');
  
  const tables = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `;
  
  tables.forEach((table, index) => {
    console.log(`${index + 1}. ${table.table_name}`);
  });
  
  console.log(`\nTotal: ${tables.length} tables`);
}

listTables();
