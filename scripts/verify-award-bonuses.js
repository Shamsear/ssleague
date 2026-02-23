/**
 * Verify Award Bonuses Integration
 * 
 * Checks that award bonuses are properly stored and included in fantasy team totals
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function verifyAwardBonuses() {
  const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);

  console.log('🔍 Verifying Award Bonuses Integration\n');
  console.log('='.repeat(80));

  try {
    // 1. Check bonus_points table
    console.log('\n📊 STEP 1: Checking bonus_points table...\n');
    
    const allBonuses = await fantasyDb`
      SELECT target_type, target_id, points, reason, awarded_by, awarded_at
      FROM bonus_points
      WHERE league_id = 'SSPSLFLS16'
      ORDER BY awarded_at DESC
    `;
    
    console.log(`Total bonus records: ${allBonuses.length}`);
    
    // Group by award type
    const awardBonuses = allBonuses.filter(b => 
      b.reason.includes('TOD') || b.reason.includes('TOW') || 
      b.reason.includes('POTD') || b.reason.includes('POTW')
    );
    
    console.log(`Award bonuses: ${awardBonuses.length}`);
    
    const byType = {};
    awardBonuses.forEach(b => {
      const type = b.reason.split(' ')[0];
      if (!byType[type]) byType[type] = { count: 0, points: 0 };
      byType[type].count++;
      byType[type].points += Number(b.points);
    });
    
    console.log('\nBreakdown by award type:');
    Object.entries(byType).forEach(([type, data]) => {
      console.log(`  ${type}: ${data.count} bonuses, ${data.points} total points`);
    });
    
    // 2. Check fantasy_teams totals
    console.log('\n\n📊 STEP 2: Checking fantasy_teams totals...\n');
    
    const teams = await fantasyDb`
      SELECT team_id, team_name, player_points, passive_points, total_points, rank
      FROM fantasy_teams
      WHERE league_id = 'SSPSLFLS16'
      ORDER BY rank ASC
    `;
    
    console.log('Fantasy Team Standings:');
    console.log('-'.repeat(80));
    teams.forEach(t => {
      console.log(`${t.rank}. ${t.team_name.padEnd(20)} | Player: ${String(t.player_points).padStart(4)} | Passive: ${String(t.passive_points).padStart(4)} | Total: ${String(t.total_points).padStart(4)}`);
    });
    
    // 3. Calculate expected passive points with bonuses
    console.log('\n\n📊 STEP 3: Verifying bonus integration...\n');
    
    const teamBonusPoints = await fantasyDb`
      SELECT team_id, SUM(total_bonus) as total_bonus
      FROM fantasy_team_bonus_points
      WHERE league_id = 'SSPSLFLS16'
      GROUP BY team_id
    `;
    
    const teamBonusMap = new Map();
    teamBonusPoints.forEach(t => teamBonusMap.set(t.team_id, Number(t.total_bonus)));
    
    console.log('Passive Points Breakdown:');
    console.log('-'.repeat(80));
    
    for (const t of teams) {
      const basePassive = teamBonusMap.get(t.team_id) || 0;
      
      // Get award bonuses for this team
      const teamAwardBonuses = awardBonuses.filter(b => {
        if (b.target_type === 'team') {
          // Team awards - check if this team supports the awarded team
          return b.target_id === t.supported_team_id;
        } else if (b.target_type === 'player') {
          // Player awards - check if this team owns the player
          // We need to check fantasy_squad
          return false; // Will calculate separately
        }
        return false;
      });
      
      const awardPoints = teamAwardBonuses.reduce((sum, b) => sum + Number(b.points), 0);
      const expected = basePassive + awardPoints;
      const actual = t.passive_points;
      const match = expected === actual ? '✓' : '✗';
      
      console.log(`${match} ${t.team_name.padEnd(20)} | Base: ${String(basePassive).padStart(4)} | Awards: ${String(awardPoints).padStart(4)} | Expected: ${String(expected).padStart(4)} | Actual: ${String(actual).padStart(4)}`);
    }
    
    // 4. Sample award bonuses
    console.log('\n\n📊 STEP 4: Sample award bonuses...\n');
    
    const sampleAwards = awardBonuses.slice(0, 10);
    console.log('First 10 award bonuses:');
    console.log('-'.repeat(80));
    sampleAwards.forEach(b => {
      console.log(`${b.reason.padEnd(50)} | ${b.target_type.padEnd(6)} | ${String(b.points).padStart(3)} pts`);
    });
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Verification complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
  process.exit(0);
}

verifyAwardBonuses();
