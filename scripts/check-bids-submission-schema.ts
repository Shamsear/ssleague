/**
 * Check bids_submission table schema
 * 
 * Usage: npx tsx scripts/check-bids-submission-schema.ts
 */

import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const connectionString = process.env.NEON_AUCTION_DB_URL || process.env.NEON_DATABASE_URL;

if (!connectionString) {
  console.error('❌ Database URL not set');
  process.exit(1);
}

const sql = neon(connectionString);

async function checkSchema() {
  console.log('🔍 Checking bid_submissions table schema...\n');

  try {
    // Check if table exists
    const tableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'bid_submissions'
      ) as exists
    `;

    if (!tableExists[0].exists) {
      console.log('❌ bid_submissions table does not exist');
      return;
    }

    console.log('✅ bid_submissions table exists\n');

    // Get table schema
    const columns = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'bid_submissions'
      ORDER BY ordinal_position
    `;

    console.log('📋 Table Schema:');
    console.log('─'.repeat(80));
    columns.forEach((col: any) => {
      console.log(`${col.column_name.padEnd(25)} ${col.data_type.padEnd(20)} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    console.log('─'.repeat(80));

    // Get sample data
    const sampleData = await sql`
      SELECT * FROM bid_submissions
      LIMIT 5
    `;

    console.log(`\n📊 Sample Data (${sampleData.length} records):`);
    if (sampleData.length > 0) {
      console.log(JSON.stringify(sampleData, null, 2));
    } else {
      console.log('No data found');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkSchema();
