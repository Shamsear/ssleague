/**
 * Check if admin bonus points are being integrated into fantasy totals
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);

async function checkIntegration() {
  console.log('🔍 Checking Bonus Points Integration\n');

  try {
    // 1. Check bonus_points table
    const bonusRecords = await fantasyDb`
      SELECT 
        id,
        target_type,
        target_id,
        points,
        reason,
        league_id,
        awarded_at
      FROM bonus_points
      ORDER BY awarded_at DESC
    `;

    console.log(`📋 Admin Bonus Points Records: ${bonusRecords.length}\n`);
    
    if (bonusRecords.length > 0) {
      console.log('Sample records:');
      bonusRecords.forEach((b, idx) => {
        console.log(`${idx + 1}. ${b.target_type} ${b.target_id}: ${b.points > 0 ? '+' : ''}${b.points} pts`);
        console.log(`   Reason: ${b.reason}`);
        console.log(`   Awarded: ${new Date(b.awarded_at).toLocaleString()}`);
        console.log('');
      });

      // 2. Check if these bonuses are reflected in totals
      console.log('🔍 Checking if bonuses are included in totals...\n');

      for (const bonus of bonusRecords) {
        if (bonus.target_type === 'player') {
          // Check fantasy_player_points or fantasy_squad
          const squadRecords = await fantasyDb`
            SELECT 
              fs.squad_id,
              fs.team_id,
              fs.player_name,
              fs.total_points,
              ft.team_name
            FROM fantasy_squad fs
            JOIN fantasy_teams ft ON fs.team_id = ft.team_id
            WHERE fs.real_player_id = ${bonus.target_id}
              AND ft.league_id = ${bonus.league_id}
          `;

          if (squadRecords.length > 0) {
            console.log(`Player ${bonus.target_id} (${squadRecords[0].player_name}):`);
            squadRecords.forEach(s => {
              console.log(`  Team: ${s.team_name}, Total Points: ${s.total_points}`);
            });
            console.log(`  Admin Bonus: ${bonus.points > 0 ? '+' : ''}${bonus.points} pts`);
            console.log(`  ❓ Is bonus included in total? Need to verify\n`);
          }
        } else if (bonus.target_type === 'team') {
          // Check fantasy_teams
          const teamRecord = await fantasyDb`
            SELECT 
              team_id,
              team_name,
              total_points,
              player_points,
              passive_points
            FROM fantasy_teams
            WHERE team_id = ${bonus.target_id}
          `;

          if (teamRecord.length > 0) {
            const team = teamRecord[0];
            console.log(`Team ${team.team_name}:`);
            console.log(`  Total Points: ${team.total_points}`);
            console.log(`  Player Points: ${team.player_points}`);
            console.log(`  Passive Points: ${team.passive_points}`);
            console.log(`  Admin Bonus: ${bonus.points > 0 ? '+' : ''}${bonus.points} pts`);
            console.log(`  ❓ Is bonus included in total? Need to verify\n`);
          }
        }
      }

      // 3. Check if there's a mechanism to add bonuses
      console.log('⚠️  FINDINGS:');
      console.log('-'.repeat(60));
      console.log('The bonus_points table exists and has records,');
      console.log('but there is NO automatic mechanism to add these');
      console.log('bonuses to fantasy_squad or fantasy_teams totals.');
      console.log('');
      console.log('💡 RECOMMENDATION:');
      console.log('Need to implement a system that:');
      console.log('1. Sums bonus_points for each player/team');
      console.log('2. Adds them to the calculated totals');
      console.log('3. Updates fantasy_squad.total_points or fantasy_teams.total_points');

    } else {
      console.log('✅ No admin bonus points awarded yet');
      console.log('   System is ready to integrate them when needed');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

checkIntegration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
