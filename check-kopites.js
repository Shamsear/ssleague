require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkKopites() {
  const mainSql = neon(process.env.DATABASE_URL);
  
  console.log('🔍 Checking Kopites team...\n');
  
  // Check teams table
  const teams = await mainSql`
    SELECT id, name
    FROM teams 
    WHERE id = 'SSPSLT0023' OR name ILIKE '%kopite%'
  `;
  
  console.log('Teams table:');
  console.log(JSON.stringify(teams, null, 2));
  console.log('\n');
  
  if (teams.length > 0) {
    const teamId = teams[0].id;
    
    // Check players for this team
    const players = await mainSql`
      SELECT player_id, player_name, team, team_id
      FROM realplayerstats
      WHERE team_id = ${teamId}
      ORDER BY player_name
    `;
    
    console.log(`Players for team ${teamId}:`);
    console.log(JSON.stringify(players, null, 2));
    console.log(`\nTotal players: ${players.length}`);
    
    // Check how many have null team names
    const nullTeams = players.filter(p => !p.team);
    if (nullTeams.length > 0) {
      console.log(`\n⚠️  ${nullTeams.length} players have NULL team name:`);
      nullTeams.forEach(p => console.log(`  - ${p.player_name} (${p.player_id})`));
    }
  }
}

checkKopites()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
