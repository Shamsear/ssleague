require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.NEON_DATABASE_URL);

async function checkStructure() {
  // Check constraints
  const constraints = await sql`
    SELECT constraint_name, constraint_type 
    FROM information_schema.table_constraints 
    WHERE table_name='footballplayers'
  `;
  
  console.log('Constraints on footballplayers:');
  constraints.forEach(c => console.log(`  ${c.constraint_type}: ${c.constraint_name}`));
  
  // Check if same player can exist in multiple seasons
  const duplicates = await sql`
    SELECT player_id, COUNT(*) as count, 
           STRING_AGG(DISTINCT season_id, ', ') as seasons,
           STRING_AGG(DISTINCT team_id, ', ') as teams
    FROM footballplayers 
    GROUP BY player_id 
    HAVING COUNT(*) > 1
    LIMIT 5
  `;
  
  console.log('\nPlayers with multiple records:');
  if (duplicates.length > 0) {
    duplicates.forEach(d => {
      console.log(`  ${d.player_id}: ${d.count} records across seasons: ${d.seasons}`);
    });
  } else {
    console.log('  None found - player_id is unique');
  }
}

checkStructure().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
