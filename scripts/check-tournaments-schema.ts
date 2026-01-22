import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });

const sql = neon(process.env.NEON_TOURNAMENT_DB_URL!);

async function checkTournamentsSchema() {
    let output = '🔍 Checking tournaments table schema...\n\n';

    try {
        // Get table schema
        const columns = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'tournaments'
      ORDER BY ordinal_position
    `;

        output += '📋 Columns in tournaments table:\n';
        output += '================================\n';
        columns.forEach((col: any) => {
            output += `  ${col.column_name.padEnd(25)} ${col.data_type.padEnd(20)} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}\n`;
        });

        output += '\n📊 Sample data (first row):\n';
        const sample = await sql`
      SELECT * FROM tournaments LIMIT 1
    `;
        if (sample.length > 0) {
            output += JSON.stringify(sample[0], null, 2) + '\n';
        }

        // Write to file
        fs.writeFileSync('tournaments-schema.txt', output);
        console.log(output);
        console.log('\n✅ Output written to tournaments-schema.txt');

    } catch (error: any) {
        console.error('❌ Error:', error.message);
        console.error(error);
    }
}

checkTournamentsSchema();
