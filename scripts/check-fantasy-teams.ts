import { getFantasyDb } from '../lib/neon/fantasy-config';

async function checkFantasyTeams() {
  try {
    const sql = getFantasyDb();

    console.log('Checking fantasy teams...\n');

    const teams = await sql`SELECT * FROM fantasy_teams`;
    
    console.log(`Found ${teams.length} fantasy teams:\n`);
    
    teams.forEach((team: any) => {
      console.log(`Team ID: ${team.team_id}`);
      console.log(`Team Name: ${team.team_name}`);
      console.log(`League ID: ${team.league_id}`);
      console.log(`Owner: ${team.owner_name}`);
      console.log('---');
    });

    console.log('\nChecking fantasy leagues...\n');
    
    const leagues = await sql`SELECT * FROM fantasy_leagues`;
    
    console.log(`Found ${leagues.length} fantasy leagues:\n`);
    
    leagues.forEach((league: any) => {
      console.log(`League ID: ${league.league_id}`);
      console.log(`Season ID: ${league.season_id}`);
      console.log(`League Name: ${league.league_name}`);
      console.log('---');
    });
    
  } catch (error) {
    console.error('Error checking teams:', error);
    throw error;
  }
}

checkFantasyTeams()
  .then(() => {
    console.log('Check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Check failed:', error);
    process.exit(1);
  });
