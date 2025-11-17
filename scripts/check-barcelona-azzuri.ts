import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';

dotenv.config({ path: '.env.local' });

async function checkTeamNames() {
  const sql = neon(process.env.NEON_TOURNAMENT_DB_URL!);
  
  console.log('🔍 Checking for Barcelona and Azzuri team names...\n');
  
  // Check for Barcelona variants
  const barcelonaTeams = await sql`
    SELECT DISTINCT team_id, team_name, season_id
    FROM teamstats 
    WHERE LOWER(team_name) LIKE '%barcelona%' OR LOWER(team_name) LIKE '%barca%'
    ORDER BY team_id, season_id
  `;
  
  console.log('Teams with Barcelona/Barca:');
  if (barcelonaTeams.length === 0) {
    console.log('  (none found)');
  } else {
    barcelonaTeams.forEach((t: any) => {
      console.log(`  ${t.team_id} - ${t.season_id}: "${t.team_name}"`);
    });
  }
  
  // Check for Azzuri variants
  const azzuriTeams = await sql`
    SELECT DISTINCT team_id, team_name, season_id
    FROM teamstats 
    WHERE LOWER(team_name) LIKE '%azzuri%' OR LOWER(team_name) LIKE '%azzurri%'
    ORDER BY team_id, season_id
  `;
  
  console.log('\nTeams with Azzuri/Azzurri:');
  if (azzuriTeams.length === 0) {
    console.log('  (none found)');
  } else {
    azzuriTeams.forEach((t: any) => {
      console.log(`  ${t.team_id} - ${t.season_id}: "${t.team_name}"`);
    });
  }
  
  // Check all unique team names for the Azzuri team
  if (azzuriTeams.length > 0) {
    const azzuriTeamId = azzuriTeams[0].team_id;
    console.log(`\n📋 All historical names for ${azzuriTeamId}:`);
    
    const allNames = await sql`
      SELECT season_id, team_name
      FROM teamstats 
      WHERE team_id = ${azzuriTeamId}
      ORDER BY season_id
    `;
    
    allNames.forEach((t: any) => {
      console.log(`  ${t.season_id}: "${t.team_name}"`);
    });
  }
}

checkTeamNames().catch(console.error);
