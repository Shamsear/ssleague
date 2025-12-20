/**
 * Diagnose Fantasy Points Issues
 * Check for duplicates, incorrect calculations, etc.
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function diagnoseFantasyPoints() {
  const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);

  console.log('🔍 Diagnosing Fantasy Points Issues...\n');

  try {
    // Check Muhammed Fijas in both teams
    const playerName = 'Muhammed Fijas ';
    
    console.log(`\n📊 Checking player: ${playerName} across all teams\n`);
    
    // Find all teams that have this player
    const teamsWithPlayer = await fantasyDb`
      SELECT 
        ft.team_id,
        ft.team_name,
        fs.player_name,
        fs.total_points,
        fs.is_captain,
        fs.is_vice_captain
      FROM fantasy_squad fs
      JOIN fantasy_teams ft ON fs.team_id = ft.team_id
      WHERE fs.player_name = ${playerName}
      ORDER BY ft.team_name
    `;
    
    console.log(`Found player in ${teamsWithPlayer.length} team(s):\n`);
    teamsWithPlayer.forEach(t => {
      const role = t.is_captain ? '(Captain)' : t.is_vice_captain ? '(Vice-Captain)' : '';
      console.log(`  - ${t.team_name} ${role}: ${t.total_points} pts`);
    });
    
    // Check each team
    for (const teamData of teamsWithPlayer) {
      const teamName = teamData.team_name;

    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 Analyzing: ${teamName}\n`);

    // Get the team
    const teams = await fantasyDb`
      SELECT team_id, team_name, total_points, player_points, passive_points
      FROM fantasy_teams
      WHERE team_name = ${teamName}
    `;

    if (teams.length === 0) {
      console.log('❌ Team not found');
      continue;
    }

    const team = teams[0];
    console.log('Team Info:');
    console.log(`  Team ID: ${team.team_id}`);
    console.log(`  Total Points: ${team.total_points}`);
    console.log(`  Player Points: ${team.player_points}`);
    console.log(`  Passive Points: ${team.passive_points}`);

    // Get player from squad
    const squadPlayers = await fantasyDb`
      SELECT 
        squad_id,
        real_player_id,
        player_name,
        total_points,
        is_captain,
        is_vice_captain
      FROM fantasy_squad
      WHERE team_id = ${team.team_id}
        AND player_name = ${playerName}
    `;

    if (squadPlayers.length === 0) {
      console.log('\n❌ Player not found in this team squad');
      continue;
    }

    const player = squadPlayers[0];
    console.log('\nSquad Info:');
    console.log(`  Player ID: ${player.real_player_id}`);
    console.log(`  Total Points in Squad: ${player.total_points}`);
    console.log(`  Is Captain: ${player.is_captain}`);
    console.log(`  Is Vice Captain: ${player.is_vice_captain}`);

    // Get all fantasy_player_points records for this player in this team
    const playerPoints = await fantasyDb`
      SELECT 
        fixture_id,
        round_number,
        goals_scored,
        goals_conceded,
        result,
        is_motm,
        is_clean_sheet,
        is_captain,
        points_multiplier,
        base_points,
        total_points,
        points_breakdown
      FROM fantasy_player_points
      WHERE team_id = ${team.team_id}
        AND real_player_id = ${player.real_player_id}
      ORDER BY round_number
    `;

    console.log(`\n📋 Fantasy Player Points Records: ${playerPoints.length} records\n`);

    let calculatedTotal = 0;
    playerPoints.forEach((record, index) => {
      console.log(`Record ${index + 1}:`);
      console.log(`  Fixture: ${record.fixture_id}`);
      console.log(`  Round: ${record.round_number}`);
      console.log(`  Goals: ${record.goals_scored}, Conceded: ${record.goals_conceded}`);
      console.log(`  Result: ${record.result}, MOTM: ${record.is_motm}, Clean Sheet: ${record.is_clean_sheet}`);
      console.log(`  Is Captain: ${record.is_captain}, Multiplier: ${record.points_multiplier}`);
      console.log(`  Base Points: ${record.base_points}`);
      console.log(`  Total Points: ${record.total_points}`);
      console.log(`  Breakdown: ${JSON.stringify(record.points_breakdown)}`);
      console.log('');
      calculatedTotal += Number(record.total_points);
    });

    console.log(`\n📊 Summary:`);
    console.log(`  Records in fantasy_player_points: ${playerPoints.length}`);
    console.log(`  Sum of total_points from records: ${calculatedTotal}`);
    console.log(`  Total in fantasy_squad: ${player.total_points}`);
    console.log(`  Difference: ${Number(player.total_points) - calculatedTotal}`);

    // Check for duplicates
    const duplicateCheck = await fantasyDb`
      SELECT 
        fixture_id,
        COUNT(*) as count
      FROM fantasy_player_points
      WHERE team_id = ${team.team_id}
        AND real_player_id = ${player.real_player_id}
      GROUP BY fixture_id
      HAVING COUNT(*) > 1
    `;

    if (duplicateCheck.length > 0) {
      console.log(`\n⚠️  DUPLICATES FOUND:`);
      duplicateCheck.forEach(dup => {
        console.log(`  Fixture ${dup.fixture_id}: ${dup.count} records`);
      });
    } else {
      console.log(`\n✅ No duplicates found`);
    }

    // Check all players in the team
    console.log(`\n📊 All Players in ${teamName}:\n`);
    
    const allSquadPlayers = await fantasyDb`
      SELECT 
        player_name,
        total_points,
        is_captain,
        is_vice_captain
      FROM fantasy_squad
      WHERE team_id = ${team.team_id}
      ORDER BY total_points DESC
    `;

    let squadTotalSum = 0;
    allSquadPlayers.forEach((p, i) => {
      const role = p.is_captain ? '(C)' : p.is_vice_captain ? '(VC)' : '';
      console.log(`  ${i + 1}. ${p.player_name} ${role}: ${p.total_points} pts`);
      squadTotalSum += Number(p.total_points);
    });

    console.log(`\n  Sum of all squad player points: ${squadTotalSum}`);
    console.log(`  Team player_points field: ${team.player_points}`);
    console.log(`  Difference: ${Number(team.player_points) - squadTotalSum}`);
    
    } // End of team loop

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

diagnoseFantasyPoints()
  .then(() => {
    console.log('\n✅ Diagnosis complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Diagnosis failed:', error);
    process.exit(1);
  });
