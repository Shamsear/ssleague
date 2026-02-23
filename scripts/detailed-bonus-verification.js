/**
 * Detailed Bonus Verification
 * Shows exactly how award bonuses contribute to each team's passive points
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function detailedVerification() {
  const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);

  console.log('🔍 Detailed Award Bonus Verification\n');
  console.log('='.repeat(80));

  try {
    const LEAGUE_ID = 'SSPSLFLS16';
    
    // Get all data
    const teams = await fantasyDb`
      SELECT team_id, team_name, supported_team_id, player_points, passive_points, total_points
      FROM fantasy_teams
      WHERE league_id = ${LEAGUE_ID}
      ORDER BY total_points DESC
    `;
    
    const squad = await fantasyDb`
      SELECT team_id, real_player_id, player_name
      FROM fantasy_squad
      WHERE league_id = ${LEAGUE_ID}
    `;
    
    const teamBonusPoints = await fantasyDb`
      SELECT team_id, SUM(total_bonus) as base_passive
      FROM fantasy_team_bonus_points
      WHERE league_id = ${LEAGUE_ID}
      GROUP BY team_id
    `;
    
    const bonuses = await fantasyDb`
      SELECT target_type, target_id, points, reason
      FROM bonus_points
      WHERE league_id = ${LEAGUE_ID}
      ORDER BY reason
    `;
    
    const basePassiveMap = new Map();
    teamBonusPoints.forEach(t => basePassiveMap.set(t.team_id, Number(t.base_passive)));
    
    console.log('\n📊 Detailed Breakdown by Team:\n');
    
    for (const team of teams) {
      console.log('='.repeat(80));
      console.log(`\n🏆 ${team.team_name}`);
      console.log(`   Supported Team: ${team.supported_team_id}`);
      console.log(`   Total Points: ${team.total_points} (Player: ${team.player_points}, Passive: ${team.passive_points})`);
      
      // Base passive from match results
      const basePassive = basePassiveMap.get(team.team_id) || 0;
      console.log(`\n   Base Passive (from matches): ${basePassive}`);
      
      // Team award bonuses (TOD, TOW)
      const teamAwardBonuses = bonuses.filter(b => 
        b.target_type === 'team' && 
        b.target_id === team.supported_team_id &&
        (b.reason.includes('TOD') || b.reason.includes('TOW'))
      );
      
      const teamAwardPoints = teamAwardBonuses.reduce((sum, b) => sum + Number(b.points), 0);
      console.log(`   Team Award Bonuses (TOD/TOW): ${teamAwardPoints}`);
      if (teamAwardBonuses.length > 0) {
        teamAwardBonuses.forEach(b => {
          console.log(`     - ${b.reason}: ${b.points} pts`);
        });
      }
      
      // Player award bonuses (POTD, POTW)
      const teamSquad = squad.filter(s => s.team_id === team.team_id);
      const playerIds = teamSquad.map(s => s.real_player_id);
      
      const playerAwardBonuses = bonuses.filter(b => 
        b.target_type === 'player' && 
        playerIds.includes(b.target_id) &&
        (b.reason.includes('POTD') || b.reason.includes('POTW'))
      );
      
      const playerAwardPoints = playerAwardBonuses.reduce((sum, b) => sum + Number(b.points), 0);
      console.log(`   Player Award Bonuses (POTD/POTW): ${playerAwardPoints}`);
      if (playerAwardBonuses.length > 0) {
        playerAwardBonuses.forEach(b => {
          console.log(`     - ${b.reason}: ${b.points} pts`);
        });
      }
      
      // Calculate expected vs actual
      const expectedPassive = basePassive + teamAwardPoints + playerAwardPoints;
      const actualPassive = team.passive_points;
      const match = expectedPassive === actualPassive;
      
      console.log(`\n   Expected Passive: ${basePassive} + ${teamAwardPoints} + ${playerAwardPoints} = ${expectedPassive}`);
      console.log(`   Actual Passive: ${actualPassive}`);
      console.log(`   ${match ? '✅ MATCH' : '❌ MISMATCH'}`);
      console.log('');
    }
    
    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('\n📊 SUMMARY\n');
    
    const totalTeamAwards = bonuses.filter(b => b.target_type === 'team').length;
    const totalPlayerAwards = bonuses.filter(b => b.target_type === 'player').length;
    const totalTeamPoints = bonuses.filter(b => b.target_type === 'team').reduce((sum, b) => sum + Number(b.points), 0);
    const totalPlayerPoints = bonuses.filter(b => b.target_type === 'player').reduce((sum, b) => sum + Number(b.points), 0);
    
    console.log(`Total Team Awards (TOD/TOW): ${totalTeamAwards} bonuses, ${totalTeamPoints} points`);
    console.log(`Total Player Awards (POTD/POTW): ${totalPlayerAwards} bonuses, ${totalPlayerPoints} points`);
    console.log(`Grand Total: ${totalTeamAwards + totalPlayerAwards} bonuses, ${totalTeamPoints + totalPlayerPoints} points`);
    
    console.log('\n✅ Verification complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
  process.exit(0);
}

detailedVerification();
