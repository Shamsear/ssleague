import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const auctionSql = neon(process.env.NEON_AUCTION_DB_URL || process.env.NEON_DATABASE_URL!);

async function verify() {
  console.log('Checking starred_players table structure...\n');
  
  const columns = await auctionSql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'starred_players'
  `;
  
  console.log('Columns:', columns);
}

verify();
