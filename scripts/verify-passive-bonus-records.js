/**
 * Verify Passive Bonus Records
 * Check if fantasy_team_bonus_points records match the period-based passive support
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function verify() {
  const tournamentDb = neon(process.env.NEON_TOURNAMENT_DB_URL);
  const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);

  console.log('🔍 Verifying Passive Bonus Records\n');
  console.log('='.repeat(80));

  try {
    const LEAGUE_ID = 'SSPSLFLS16';
    
    // Get data
    const teams = await fantasyDb`
      SELECT team_id, team_name, supported_team_id
      FROM fantasy_teams
      WHERE league_id = ${LEAGUE_ID}
    `;
    
    const teamChanges = await fantasyDb`
      SELECT team_id, old_supported_team_id, new_supported_team_id
      FROM supported_team_changes
    `;
    
    // Reconstruct passive support
    const teamPassiveSupport = new Map();
    for (const t of teams) {
      const pArray = new Array(5).fill(t.supported_team_id);
      const change = teamChanges.find(c => c.team_id === t.team_id);
      if (change) {
        pArray[0] = change.old_supported_team_id;
        pArray[1] = change.old_supported_team_id;
      }
      teamPassiveSupport.set(t.team_id, pArray);
    }
    
    const getPeriod = (roundNumber) => {
      if (roundNumber <= 7) return 0;
      if (roundNumber <= 13) return 1;
      if (roundNumber <= 20) return 2;
      if (roundNumber <= 26) return 3;
      return 4;
    };
    
    // Get bonus records for teams that changed
    const teamsWithChanges = teamChanges.map(c => c.team_id);
    
    for (const teamId of teamsWithChanges) {
      const team = teams.find(t => t.team_id === teamId);
      const change = teamChanges.find(c => c.team_id === teamId);
      
      console.log(`\n${'='.repeat(80)}`);
      console.log(`\n🏆 ${team.team_name}`);
      console.log(`   Old Team: ${change.old_supported_team_id}`);
      console.log(`   New Team: ${change.new_supported_team_id}\n`);
      
      const bonusRecords = await fantasyDb`
        SELECT round_number, real_team_id, total_bonus
        FROM fantasy_team_bonus_points
        WHERE league_id = ${LEAGUE_ID} AND team_id = ${teamId}
        ORDER BY round_number
      `;
      
      console.log('Bonus Records:');
      console.log('-'.repeat(80));
      
      let errors = 0;
      for (const record of bonusRecords) {
        const period = getPeriod(record.round_number);
        const expectedTeam = teamPassiveSupport.get(teamId)[period];
        const actualTeam = record.real_team_id + '_SSPSLS16';
        const match = expectedTeam === actualTeam;
        
        if (!match) {
          console.log(`❌ Round ${record.round_number} (P${period}): Expected ${expectedTeam}, Got ${actualTeam} (${record.total_bonus} pts)`);
          errors++;
        } else {
          console.log(`✓  Round ${record.round_number} (P${period}): ${actualTeam} (${record.total_bonus} pts)`);
        }
      }
      
      if (errors > 0) {
        console.log(`\n⚠️  Found ${errors} mismatched records!`);
      } else {
        console.log(`\n✅ All records match expected passive support!`);
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Verification complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
  process.exit(0);
}

verify();
