/**
 * Diagnose Passive Team Transfer Issue
 * Check if passive team changes are being applied correctly
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function diagnose() {
  const tournamentDb = neon(process.env.NEON_TOURNAMENT_DB_URL);
  const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);

  console.log('🔍 Diagnosing Passive Team Transfer Issue\n');
  console.log('='.repeat(80));

  try {
    const LEAGUE_ID = 'SSPSLFLS16';
    
    // Get fantasy teams
    const teams = await fantasyDb`
      SELECT team_id, team_name, supported_team_id, supported_team_name
      FROM fantasy_teams
      WHERE league_id = ${LEAGUE_ID}
    `;
    
    // Get team changes
    const teamChanges = await fantasyDb`
      SELECT team_id, old_supported_team_id, new_supported_team_id
      FROM supported_team_changes
    `;
    
    console.log('\n📊 Team Changes:\n');
    for (const change of teamChanges) {
      const team = teams.find(t => t.team_id === change.team_id);
      console.log(`${team.team_name}:`);
      console.log(`  Old: ${change.old_supported_team_id}`);
      console.log(`  New: ${change.new_supported_team_id}`);
      console.log(`  Current: ${team.supported_team_id}`);
      console.log('');
    }
    
    // Reconstruct passive support by period (current logic)
    console.log('📊 Passive Support by Period (Current Logic):\n');
    const teamPassiveSupport = new Map();
    for (const t of teams) {
      const pArray = new Array(5).fill(t.supported_team_id);
      const change = teamChanges.find(c => c.team_id === t.team_id);
      if (change) {
        pArray[0] = change.old_supported_team_id;
        pArray[1] = change.old_supported_team_id;
      }
      teamPassiveSupport.set(t.team_id, pArray);
      
      console.log(`${t.team_name}:`);
      console.log(`  Period 0 (R1-7):   ${pArray[0]}`);
      console.log(`  Period 1 (R8-13):  ${pArray[1]}`);
      console.log(`  Period 2 (R14-20): ${pArray[2]}`);
      console.log(`  Period 3 (R21-26): ${pArray[3]}`);
      console.log(`  Period 4 (R27+):   ${pArray[4]}`);
      console.log('');
    }
    
    // Get fixtures and check passive points calculation
    const fixtures = await tournamentDb`
      SELECT id, tournament_id, round_number, home_team_id, away_team_id, home_score, away_score
      FROM fixtures 
      WHERE status = 'completed' AND tournament_id = 'SSPSLS16L'
      ORDER BY round_number
    `;
    
    console.log('\n📊 Sample Fixtures by Period:\n');
    
    const getPeriod = (f) => {
      if (f.tournament_id === 'SSPSLS16L') {
        if (f.round_number <= 7) return 0;
        if (f.round_number <= 13) return 1;
        if (f.round_number <= 20) return 2;
        if (f.round_number <= 26) return 3;
        return 4;
      }
      return 4;
    };
    
    // Sample fixtures from each period
    const sampleFixtures = [
      fixtures.find(f => f.round_number === 5),   // Period 0
      fixtures.find(f => f.round_number === 10),  // Period 1
      fixtures.find(f => f.round_number === 15),  // Period 2
      fixtures.find(f => f.round_number === 22),  // Period 3
      fixtures.find(f => f.round_number === 28),  // Period 4
    ].filter(f => f);
    
    for (const fix of sampleFixtures) {
      const period = getPeriod(fix);
      console.log(`Round ${fix.round_number} (Period ${period}):`);
      console.log(`  Home: ${fix.home_team_id} (${fix.home_score})`);
      console.log(`  Away: ${fix.away_team_id} (${fix.away_score})`);
      
      // Check which fantasy teams would get points
      for (const ft of teams) {
        const supportedInPeriod = teamPassiveSupport.get(ft.team_id)[period];
        const homeMatch = supportedInPeriod && supportedInPeriod.startsWith(fix.home_team_id + '_');
        const awayMatch = supportedInPeriod && supportedInPeriod.startsWith(fix.away_team_id + '_');
        
        if (homeMatch || awayMatch) {
          console.log(`    -> ${ft.team_name} gets points (supporting ${supportedInPeriod})`);
        }
      }
      console.log('');
    }
    
    // Check fantasy_team_bonus_points table
    console.log('\n📊 Checking fantasy_team_bonus_points records:\n');
    const bonusPoints = await fantasyDb`
      SELECT team_id, real_team_id, round_number, total_bonus
      FROM fantasy_team_bonus_points
      WHERE league_id = ${LEAGUE_ID}
      ORDER BY team_id, round_number
      LIMIT 20
    `;
    
    console.log('Sample bonus point records:');
    for (const bp of bonusPoints) {
      const team = teams.find(t => t.team_id === bp.team_id);
      const fixture = fixtures.find(f => f.round_number === bp.round_number && 
        (f.home_team_id === bp.real_team_id || f.away_team_id === bp.real_team_id));
      const period = fixture ? getPeriod(fixture) : '?';
      console.log(`  ${team.team_name} - Round ${bp.round_number} (P${period}) - Team ${bp.real_team_id} - ${bp.total_bonus} pts`);
    }
    
    console.log('\n✅ Diagnosis complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
  process.exit(0);
}

diagnose();
