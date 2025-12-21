const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

(async () => {
  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name LIKE '%player%' 
    ORDER BY table_name
  `;
  
  console.log('Player tables in tournament database:');
  tables.forEach(t => console.log('  ' + t.table_name));
})();
