import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env.local') });

const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);

(async () => {
  try {
    const result = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'player_seasons' 
      ORDER BY ordinal_position
    `;
    console.log('player_seasons columns:');
    console.log(JSON.stringify(result, null, 2));
    
    const sampleData = await sql`SELECT * FROM player_seasons LIMIT 3`;
    console.log('\nSample data:');
    console.log(JSON.stringify(sampleData, null, 2));
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
