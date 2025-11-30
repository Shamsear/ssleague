/**
 * Fetch Football Players for a Specific Team
 * Usage: npx tsx scripts/fetch-team-players.ts
 */

import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

async function fetchTeamPlayers() {
  // Get team ID from command line argument or use default
  const teamId = process.argv[2] || 'SSPSLT0002';
  
  console.log(`\n🔍 Fetching football players for team: ${teamId}\n`);
  console.log('='.repeat(80));
  
  try {
    // First, check if team exists
    const teamCheck = await sql`
      SELECT id, name, season_id, football_budget, football_spent, football_players_count
      FROM teams
      WHERE id = ${teamId}
      LIMIT 1
    `;

    if (teamCheck.length === 0) {
      console.log(`❌ Team ${teamId} not found in teams table`);
      return;
    }

    const team = teamCheck[0];
    console.log(`\n✅ Team Found:`);
    console.log(`   Name: ${team.name}`);
    console.log(`   Season ID: ${team.season_id}`);
    console.log(`   Football Budget: €${team.football_budget}`);
    console.log(`   Football Spent: €${team.football_spent}`);
    console.log(`   Players Count: ${team.football_players_count}`);
    console.log('\n' + '='.repeat(80));

    // Fetch players from team_players table (junction table)
    console.log(`\n📋 Fetching players from team_players table...\n`);
    
    const teamPlayers = await sql`
      SELECT 
        tp.id as team_player_id,
        tp.player_id,
        tp.purchase_price,
        tp.acquired_at,
        tp.round_id,
        tp.season_id,
        fp.name as player_name,
        fp.position,
        fp.position_group,
        fp.team_name as club,
        fp.overall_rating,
        fp.nationality,
        fp.age,
        fp.playing_style,
        fp.speed,
        fp.acceleration,
        fp.ball_control,
        fp.dribbling,
        fp.finishing
      FROM team_players tp
      INNER JOIN footballplayers fp ON tp.player_id = fp.id
      WHERE tp.team_id = ${teamId}
      ORDER BY tp.acquired_at DESC
    `;

    if (teamPlayers.length === 0) {
      console.log(`⚠️  No players found in team_players table for team ${teamId}`);
      console.log(`\n💡 Checking if there are any players in footballplayers table with team_id = ${teamId}...\n`);
      
      // Alternative: Check footballplayers table directly (legacy approach)
      const directPlayers = await sql`
        SELECT 
          id,
          player_id,
          name,
          position,
          position_group,
          team_id,
          team_name as club,
          overall_rating,
          nationality,
          age,
          playing_style,
          is_sold,
          acquisition_value
        FROM footballplayers
        WHERE team_id = ${teamId}
        ORDER BY name ASC
      `;

      if (directPlayers.length > 0) {
        console.log(`✅ Found ${directPlayers.length} players in footballplayers table:\n`);
        directPlayers.forEach((player, index) => {
          console.log(`${index + 1}. ${player.name}`);
          console.log(`   Position: ${player.position} (${player.position_group})`);
          console.log(`   Rating: ${player.overall_rating}`);
          console.log(`   Club: ${player.club || 'N/A'}`);
          console.log(`   Nationality: ${player.nationality || 'N/A'}`);
          console.log(`   Age: ${player.age || 'N/A'}`);
          console.log(`   Playing Style: ${player.playing_style || 'N/A'}`);
          console.log(`   Is Sold: ${player.is_sold}`);
          console.log(`   Acquisition Value: €${player.acquisition_value || 'N/A'}`);
          console.log('');
        });
      } else {
        console.log(`❌ No players found in footballplayers table either`);
      }
    } else {
      console.log(`✅ Found ${teamPlayers.length} players:\n`);
      
      teamPlayers.forEach((player, index) => {
        console.log(`${index + 1}. ${player.player_name}`);
        console.log(`   Player ID: ${player.player_id}`);
        console.log(`   Position: ${player.position} (${player.position_group})`);
        console.log(`   Rating: ${player.overall_rating}`);
        console.log(`   Club: ${player.club || 'N/A'}`);
        console.log(`   Nationality: ${player.nationality || 'N/A'}`);
        console.log(`   Age: ${player.age || 'N/A'}`);
        console.log(`   Playing Style: ${player.playing_style || 'N/A'}`);
        console.log(`   Purchase Price: €${player.purchase_price}`);
        console.log(`   Acquired At: ${player.acquired_at}`);
        console.log(`   Round ID: ${player.round_id || 'N/A'}`);
        console.log(`   Season ID: ${player.season_id}`);
        console.log(`   Stats: SPD ${player.speed}, ACC ${player.acceleration}, BC ${player.ball_control}, DRI ${player.dribbling}, FIN ${player.finishing}`);
        console.log('');
      });

      // Summary
      console.log('='.repeat(80));
      console.log(`\n📊 Summary:`);
      console.log(`   Total Players: ${teamPlayers.length}`);
      console.log(`   Total Spent: €${teamPlayers.reduce((sum, p) => sum + (p.purchase_price || 0), 0)}`);
      
      // Position breakdown
      const positionCounts = teamPlayers.reduce((acc, p) => {
        acc[p.position_group || 'Unknown'] = (acc[p.position_group || 'Unknown'] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.log(`\n   Position Breakdown:`);
      Object.entries(positionCounts).forEach(([pos, count]) => {
        console.log(`     ${pos}: ${count}`);
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Fetch Complete!\n');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fetchTeamPlayers();
