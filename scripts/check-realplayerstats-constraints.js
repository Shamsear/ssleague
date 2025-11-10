require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);

async function checkConstraints() {
  try {
    const constraints = await sql`
      SELECT constraint_name, constraint_type 
      FROM information_schema.table_constraints 
      WHERE table_name = 'realplayerstats'
    `;
    
    console.log('Constraints on realplayerstats:');
    console.log(JSON.stringify(constraints, null, 2));
    
    // Also check the unique constraint details
    const uniqueConstraints = await sql`
      SELECT
        tc.constraint_name,
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = 'realplayerstats'
        AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
      ORDER BY tc.constraint_name, kcu.ordinal_position
    `;
    
    console.log('\nDetailed constraints:');
    console.log(JSON.stringify(uniqueConstraints, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

checkConstraints();
