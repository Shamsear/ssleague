import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';

dotenv.config({ path: '.env.local' });

async function checkConstraints() {
  const sql = neon(process.env.NEON_TOURNAMENT_DB_URL!);
  
  console.log('Checking constraints for teamstats and realplayerstats tables...\n');
  
  const constraints = await sql`
    SELECT 
      tc.table_name,
      tc.constraint_name,
      tc.constraint_type,
      kcu.column_name
    FROM information_schema.table_constraints tc
    LEFT JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.table_name IN ('teamstats', 'realplayerstats')
      AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
    ORDER BY tc.table_name, tc.constraint_type
  `;
  
  console.log('Constraints found:');
  console.log(JSON.stringify(constraints, null, 2));
}

checkConstraints().catch(console.error);
