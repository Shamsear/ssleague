require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.NEON_DATABASE_URL);

async function checkColumns() {
  const columns = await sql`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name='player_history' 
    ORDER BY ordinal_position
  `;
  
  console.log('player_history columns:', columns.map(c => c.column_name).join(', '));
  
  const hasOverallRating = columns.some(c => c.column_name === 'overall_rating');
  console.log('\noverall_rating exists:', hasOverallRating);
}

checkColumns().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
