const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.NEON_DATABASE_URL);

async function addFootballPlayersCount() {
  console.log('🔧 Adding football_players_count column to teams table...\n');

  try {
    // Step 1: Check if column already exists
    const columnsCheck = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'teams' 
      AND column_name = 'football_players_count'
    `;

    if (columnsCheck.length > 0) {
      console.log('✅ Column football_players_count already exists');
    } else {
      console.log('➕ Adding football_players_count column...');
      
      // Add the column
      await sql`
        ALTER TABLE teams 
        ADD COLUMN football_players_count INTEGER NOT NULL DEFAULT 0
      `;
      
      console.log('✅ Column football_players_count added successfully!');
    }

    // Step 2: Initialize counts for existing teams
    console.log('\n📊 Initializing football_players_count for existing teams...');
    
    // Get all teams
    const teams = await sql`
      SELECT id, name 
      FROM teams
    `;
    
    console.log(`Found ${teams.length} teams to update`);
    
    let updatedCount = 0;
    for (const team of teams) {
      // Count football players for this team
      const playerCount = await sql`
        SELECT COUNT(*) as count
        FROM footballplayers
        WHERE team_id = ${team.id}
        AND is_sold = true
      `;
      
      const count = parseInt(playerCount[0].count);
      
      if (count > 0) {
        // Update the team's counter
        await sql`
          UPDATE teams
          SET football_players_count = ${count}
          WHERE id = ${team.id}
        `;
        
        console.log(`  ✓ ${team.name}: ${count} players`);
        updatedCount++;
      }
    }
    
    console.log(`\n✅ Updated ${updatedCount} teams with player counts`);

    // Step 3: Verify the results
    console.log('\n📋 Verification - Teams with players:');
    const teamsWithPlayers = await sql`
      SELECT name, football_players_count
      FROM teams
      WHERE football_players_count > 0
      ORDER BY football_players_count DESC
      LIMIT 10
    `;
    
    teamsWithPlayers.forEach(team => {
      console.log(`  - ${team.name}: ${team.football_players_count} players`);
    });

    // Step 4: Show summary statistics
    const stats = await sql`
      SELECT 
        COUNT(*) as total_teams,
        SUM(football_players_count) as total_players,
        AVG(football_players_count) as avg_players_per_team,
        MAX(football_players_count) as max_players
      FROM teams
    `;
    
    console.log('\n📊 Summary:');
    console.log(`  Total teams: ${stats[0].total_teams}`);
    console.log(`  Total football players: ${stats[0].total_players}`);
    console.log(`  Average players per team: ${parseFloat(stats[0].avg_players_per_team).toFixed(2)}`);
    console.log(`  Max players in a team: ${stats[0].max_players}`);

    console.log('\n🎉 Migration complete!');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

addFootballPlayersCount();
