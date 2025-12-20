/**
 * Comprehensive verification of breakdown display
 * Checks if admin bonuses are included in totals or shown separately
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);

async function verify() {
  console.log('🔍 BREAKDOWN DISPLAY VERIFICATION\n');
  console.log('='.repeat(70));

  try {
    // 1. Check Team Breakdown
    console.log('\n📊 TEAM BREAKDOWN VERIFICATION\n');
    
    const teamsWithBonuses = await fantasyDb`
      SELECT DISTINCT 
        ft.team_id,
        ft.team_name,
        ft.total_points,
        ft.player_points,
        ft.passive_points,
        ft.supported_team_id,
        ft.league_id
      FROM fantasy_teams ft
      JOIN bonus_points bp ON bp.target_id = ft.supported_team_id
      WHERE bp.target_type = 'team'
    `;

    console.log(`Found ${teamsWithBonuses.length} teams with admin bonuses:\n`);

    for (const team of teamsWithBonuses) {
      console.log(`Team: ${team.team_name}`);
      console.log(`  team_id: ${team.team_id}`);
      console.log(`  supported_team_id: ${team.supported_team_id}`);
      console.log(`  league_id: ${team.league_id}`);
      
      // Get passive points from rounds
      const passiveRounds = await fantasyDb`
        SELECT SUM(total_bonus) as total
        FROM fantasy_team_bonus_points
        WHERE team_id = ${team.team_id}
      `;
      const passiveFromRounds = Number(passiveRounds[0]?.total || 0);

      // Get admin bonuses
      const adminBonuses = await fantasyDb`
        SELECT 
          id,
          points,
          reason,
          target_id
        FROM bonus_points
        WHERE target_type = 'team'
          AND target_id = ${team.supported_team_id}
          AND league_id = ${team.league_id}
      `;
      const adminTotal = adminBonuses.reduce((sum, b) => sum + b.points, 0);

      console.log(`  Breakdown:`);
      console.log(`    Player Points: ${team.player_points}`);
      console.log(`    Passive Points (DB): ${team.passive_points}`);
      console.log(`    Passive from Rounds: ${passiveFromRounds}`);
      console.log(`    Admin Bonuses: ${adminTotal}`);
      console.log(`    Total Points (DB): ${team.total_points}`);
      console.log(`  Calculation Check:`);
      console.log(`    player + passive: ${team.player_points + team.passive_points}`);
      console.log(`    player + passive + admin: ${team.player_points + team.passive_points + adminTotal}`);
      console.log(`    Matches total_points? ${team.total_points === (team.player_points + team.passive_points + adminTotal) ? '✅' : '❌'}`);
      
      if (adminBonuses.length > 0) {
        console.log(`  Admin Bonuses Details:`);
        adminBonuses.forEach(b => {
          console.log(`    - ${b.reason}: ${b.points > 0 ? '+' : ''}${b.points} pts (target_id: ${b.target_id})`);
        });
      }

      console.log(`  ⚠️  IMPORTANT:`);
      console.log(`    Admin bonuses should be ADDED to total_points`);
      console.log(`    But shown SEPARATELY in breakdown UI`);
      console.log(`    passive_points should only contain automatic bonuses from rounds`);
      console.log('');
    }

    // 2. Check Player Breakdown
    console.log('\n📊 PLAYER BREAKDOWN VERIFICATION\n');
    
    const playersWithBonuses = await fantasyDb`
      SELECT DISTINCT 
        bp.target_id as player_id,
        bp.points,
        bp.reason,
        bp.league_id
      FROM bonus_points bp
      WHERE bp.target_type = 'player'
    `;

    console.log(`Found ${playersWithBonuses.length} players with admin bonuses:\n`);

    for (const playerBonus of playersWithBonuses) {
      console.log(`Player ID: ${playerBonus.player_id}`);
      console.log(`  league_id: ${playerBonus.league_id}`);
      console.log(`  Admin Bonus: ${playerBonus.points > 0 ? '+' : ''}${playerBonus.points} pts (${playerBonus.reason})`);
      
      // Get player squad info
      const squadInfo = await fantasyDb`
        SELECT 
          fs.squad_id,
          fs.player_name,
          fs.team_id,
          fs.total_points,
          ft.team_name,
          ft.league_id
        FROM fantasy_squad fs
        JOIN fantasy_teams ft ON fs.team_id = ft.team_id
        WHERE fs.real_player_id = ${playerBonus.player_id}
          AND ft.league_id = ${playerBonus.league_id}
      `;

      if (squadInfo.length > 0) {
        squadInfo.forEach(squad => {
          console.log(`  In Team: ${squad.team_name}`);
          console.log(`    Player Name: ${squad.player_name}`);
          console.log(`    Total Points (DB): ${squad.total_points}`);
          
          // Get points from matches
          const matchPoints = fantasyDb`
            SELECT SUM(total_points) as total
            FROM fantasy_player_points
            WHERE real_player_id = ${playerBonus.player_id}
              AND team_id = ${squad.team_id}
          `.then(r => {
            const matchTotal = Number(r[0]?.total || 0);
            console.log(`    Points from Matches: ${matchTotal}`);
            console.log(`    Admin Bonus: ${playerBonus.points}`);
            console.log(`    Expected Total: ${matchTotal + playerBonus.points}`);
            console.log(`    Matches DB? ${squad.total_points === (matchTotal + playerBonus.points) ? '✅' : '❌'}`);
          });
        });
      } else {
        console.log(`  ⚠️  Player not found in any squad for league ${playerBonus.league_id}`);
      }
      console.log('');
    }

    // 3. Summary
    console.log('\n' + '='.repeat(70));
    console.log('📋 SUMMARY\n');
    console.log('Admin bonuses should be:');
    console.log('  ✅ ADDED to total_points in database');
    console.log('  ✅ SHOWN SEPARATELY in breakdown UI');
    console.log('  ✅ NOT included in passive_points (teams) or match points (players)');
    console.log('');
    console.log('Breakdown Display:');
    console.log('  Teams: passive_points (automatic) + admin_bonuses (manual) = part of total');
    console.log('  Players: match_points (automatic) + admin_bonuses (manual) = total');
    console.log('');
    console.log('To test in browser:');
    console.log('  1. Open Fantasy Teams page');
    console.log('  2. Click on a team');
    console.log('  3. Click "Supported Team (Passive Points)"');
    console.log('  4. Check browser console for debug logs');
    console.log('  5. Verify admin bonuses shown in yellow section');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

verify()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
