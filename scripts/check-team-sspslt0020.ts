import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';

dotenv.config({ path: '.env.local' });

async function checkTeam() {
  const sql = neon(process.env.NEON_TOURNAMENT_DB_URL!);
  
  console.log('📊 Checking team SSPSLT0020 historical names...\n');
  
  const teamData = await sql`
    SELECT team_id, team_name, season_id, matches_played, points
    FROM teamstats 
    WHERE team_id = 'SSPSLT0020' 
    ORDER BY season_id
  `;
  
  console.log('Historical team names:');
  teamData.forEach((row: any) => {
    console.log(`  ${row.season_id}: "${row.team_name}" (${row.matches_played} matches, ${row.points} points)`);
  });
}

checkTeam().catch(console.error);
