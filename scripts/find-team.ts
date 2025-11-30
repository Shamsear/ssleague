/**
 * Find Team by ID or Name
 * Usage: npx tsx scripts/find-team.ts
 */

import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

async function findTeam() {
  const searchTerm = 'SSPSLT0005';
  
  console.log(`\n🔍 Searching for team: ${searchTerm}\n`);
  console.log('='.repeat(80));
  
  try {
    // Search in teams table
    console.log(`\n📋 Searching in teams table...\n`);
    
    const teams = await sql`
      SELECT id, name, season_id, football_budget, football_spent, football_players_count
      FROM teams
      WHERE id ILIKE ${'%' + searchTerm + '%'} 
         OR name ILIKE ${'%' + searchTerm + '%'}
      LIMIT 20
    `;

    if (teams.length > 0) {
      console.log(`✅ Found ${teams.length} matching teams:\n`);
      teams.forEach((team, index) => {
        console.log(`${index + 1}. ${team.name} (${team.id})`);
        console.log(`   Season: ${team.season_id}`);
        console.log(`   Budget: €${team.football_budget}, Spent: €${team.football_spent}`);
        console.log(`   Players: ${team.football_players_count}`);
        console.log('');
      });
    } else {
      console.log(`❌ No teams found matching "${searchTerm}"`);
      
      // Show all teams
      console.log(`\n📋 Showing all teams in database:\n`);
      const allTeams = await sql`
        SELECT id, name, season_id, football_players_count
        FROM teams
        ORDER BY name ASC
        LIMIT 50
      `;
      
      if (allTeams.length > 0) {
        allTeams.forEach((team, index) => {
          console.log(`${index + 1}. ${team.name} (${team.id}) - Season: ${team.season_id} - Players: ${team.football_players_count || 0}`);
        });
      } else {
        console.log(`⚠️  No teams found in database`);
      }
    }

    // Also check team_players table for any references
    console.log(`\n\n📋 Checking team_players table for team references...\n`);
    const teamPlayerRefs = await sql`
      SELECT DISTINCT team_id, COUNT(*) as player_count
      FROM team_players
      GROUP BY team_id
      ORDER BY player_count DESC
      LIMIT 20
    `;

    if (teamPlayerRefs.length > 0) {
      console.log(`✅ Found ${teamPlayerRefs.length} teams with players:\n`);
      teamPlayerRefs.forEach((ref, index) => {
        console.log(`${index + 1}. Team ID: ${ref.team_id} - Players: ${ref.player_count}`);
      });
    } else {
      console.log(`⚠️  No team references found in team_players table`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Search Complete!\n');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

findTeam();
