require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkTeamsSchema() {
  const sql = neon(process.env.NEON_DATABASE_URL);

  const columns = await sql`
    SELECT column_name, data_type
    FROM information_schema.columns 
    WHERE table_name = 'teams'
    ORDER BY ordinal_position
  `;

  console.log('Teams table columns:');
  columns.forEach(col => {
    console.log(`  - ${col.column_name} (${col.data_type})`);
  });

  // Also check for Blue Strikers
  const teams = await sql`SELECT * FROM teams WHERE team_name LIKE '%Blue%' LIMIT 1`;
  if (teams.length > 0) {
    console.log('\nBlue Strikers sample data:');
    console.log(teams[0]);
  }
}

checkTeamsSchema();
