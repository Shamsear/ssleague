/**
 * Sync Tournament Awards to Fantasy Bonus Points
 * 
 * Awards Points:
 * - TOD (Team of the Day): 5 points
 * - TOW (Team of the Week): 10 points
 * - POTD (Player of the Day): 5 points
 * - POTW (Player of the Week): 10 points
 * 
 * Considers transfers:
 * - Player transfers: After Round 7 and Round 13
 * - Passive team changes: After Round 13
 * 
 * Period Logic:
 * - Period 0: Rounds 1-7
 * - Period 1: Rounds 8-13
 * - Period 2: Rounds 14-20
 * - Period 3: Rounds 21-26
 * - Period 4: Rounds 27+
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

const AWARD_POINTS = {
  'TOD': 5,   // Team of the Day
  'TOW': 10,  // Team of the Week
  'POTD': 5,  // Player of the Day
  'POTW': 10  // Player of the Week
};

const SEASON_ID = 'SSPSLS16';
const LEAGUE_ID = 'SSPSLFLS16';
const TOURNAMENT_ID = 'SSPSLS16L';

// Transfer windows that mark period boundaries
const PERIOD_WINDOWS = [
  ['tw_SSPSLFLS16_1766410531769', 'tw_SSPSLFLS16_1766328244409'], // After Round 7 -> Period 1
  ['tw_SSPSLFLS16_1767458224465'],                                // After Round 13 -> Period 2
  ['tw_SSPSLFLS16_1768451156004'],                                 // After Round 20 -> Period 3
];

// Get period based on round number
function getPeriod(roundNumber) {
  if (roundNumber <= 7) return 0;
  if (roundNumber <= 13) return 1;
  if (roundNumber <= 20) return 2;
  if (roundNumber <= 26) return 3;
  return 4;
}

async function syncAwards() {
  const tournamentDb = neon(process.env.NEON_TOURNAMENT_DB_URL);
  const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);

  console.log('🏆 Syncing Tournament Awards to Fantasy Bonus Points\n');
  console.log('=' .repeat(80));

  try {
    // 1. Get all awards for the season
    console.log('\n📋 STEP 1: Loading awards from tournament DB...');
    const awards = await tournamentDb`
      SELECT 
        id,
        award_type,
        tournament_id,
        season_id,
        round_number,
        week_number,
        player_id,
        player_name,
        team_id,
        team_name,
        performance_stats,
        created_at
      FROM awards
      WHERE season_id = ${SEASON_ID}
        AND tournament_id = ${TOURNAMENT_ID}
        AND award_type IN ('TOD', 'TOW', 'POTD', 'POTW')
      ORDER BY created_at DESC
    `;
    console.log(`Found ${awards.length} awards\n`);

    // Group by type
    const byType = {};
    awards.forEach(a => {
      if (!byType[a.award_type]) byType[a.award_type] = [];
      byType[a.award_type].push(a);
    });
    Object.entries(byType).forEach(([type, list]) => {
      console.log(`  ${type}: ${list.length} awards`);
    });

    // 2. Get fantasy teams and their current squads
    console.log('\n\n📋 STEP 2: Loading fantasy teams and squads...');
    const fantasyTeams = await fantasyDb`
      SELECT team_id, team_name, supported_team_id, supported_team_name
      FROM fantasy_teams
      WHERE league_id = ${LEAGUE_ID}
    `;
    console.log(`Found ${fantasyTeams.length} fantasy teams`);
    
    const currentSquad = await fantasyDb`
      SELECT team_id, real_player_id, player_name
      FROM fantasy_squad
      WHERE league_id = ${LEAGUE_ID}
    `;
    console.log(`Found ${currentSquad.length} squad members\n`);

    // 3. Get player transfers to reconstruct ownership by period
    console.log('📋 STEP 3: Loading player transfers...');
    const transfers = await fantasyDb`
      SELECT team_id, window_id, player_out_id, player_in_id, transferred_at
      FROM fantasy_transfers
      WHERE league_id = ${LEAGUE_ID}
      ORDER BY transferred_at DESC
    `;
    console.log(`Found ${transfers.length} transfers\n`);

    // 4. Reconstruct player ownership by period (same logic as recalculation script)
    console.log('📋 STEP 4: Reconstructing player ownership by period...');
    const playerOwnership = new Map(); // team_id -> Array(5) of Set<player_id>
    
    fantasyTeams.forEach(t => {
      const periods = [];
      for (let i = 0; i < 5; i++) periods.push(new Set());
      playerOwnership.set(t.team_id, periods);
    });

    // Initialize Period 4 (current) with current squad
    currentSquad.forEach(s => {
      if (playerOwnership.has(s.team_id)) {
        playerOwnership.get(s.team_id)[4].add(s.real_player_id);
      }
    });

    // Rollback ownership from Period 4 to Period 0
    for (let p = 4; p > 0; p--) {
      // Copy state from p to p-1
      for (const [tid, periods] of playerOwnership.entries()) {
        periods[p - 1] = new Set(periods[p]);
      }

      // Apply inverse transfers for this period
      const milestoneWindows = PERIOD_WINDOWS[p - 1] || [];
      const milestoneTransfers = transfers.filter(t => {
        if (p <= 3) return milestoneWindows.includes(t.window_id);
        const allListed = [].concat(...PERIOD_WINDOWS);
        return !allListed.includes(t.window_id);
      });

      for (const t of milestoneTransfers) {
        if (!playerOwnership.has(t.team_id)) continue;
        const setBefore = playerOwnership.get(t.team_id)[p - 1];
        
        // Rollback: Remove signed player, add back released player
        if (t.player_in_id) setBefore.delete(t.player_in_id);
        if (t.player_out_id) setBefore.add(t.player_out_id);
      }
    }
    console.log('Player ownership reconstructed for all periods\n');

    // 5. Get supported team changes
    console.log('📋 STEP 5: Loading supported team changes...');
    const teamChanges = await fantasyDb`
      SELECT team_id, old_supported_team_id, new_supported_team_id
      FROM supported_team_changes
    `;
    console.log(`Found ${teamChanges.length} team changes\n`);

    // Build passive team support by period
    const teamPassiveSupport = new Map();
    for (const t of fantasyTeams) {
      const periods = new Array(5).fill(t.supported_team_id);
      const change = teamChanges.find(c => c.team_id === t.team_id);
      if (change) {
        // Periods 0-1 use old team, periods 2-4 use new team
        periods[0] = change.old_supported_team_id;
        periods[1] = change.old_supported_team_id;
      }
      teamPassiveSupport.set(t.team_id, periods);
    }
    console.log('Passive team support reconstructed for all periods\n');

    // 6. Get existing bonus points to avoid duplicates
    console.log('📋 STEP 6: Checking existing bonus points...');
    const existingBonuses = await fantasyDb`
      SELECT target_type, target_id, reason
      FROM bonus_points
      WHERE league_id = ${LEAGUE_ID}
    `;
    console.log(`Found ${existingBonuses.length} existing bonus records\n`);

    const existingKeys = new Set(
      existingBonuses.map(b => `${b.target_type}_${b.target_id}_${b.reason}`)
    );

    // 7. Clear existing award bonuses first
    console.log('📋 STEP 7: Clearing existing award bonuses...');
    await fantasyDb`
      DELETE FROM bonus_points
      WHERE league_id = ${LEAGUE_ID}
        AND (reason LIKE 'TOD%' OR reason LIKE 'TOW%' OR reason LIKE 'POTD%' OR reason LIKE 'POTW%')
    `;
    console.log('Cleared old award bonuses\n');

    // 8. Process awards and create bonus points
    console.log('📊 STEP 8: Processing awards...\n');
    
    const bonusesToAdd = [];

    for (const award of awards) {
      const points = AWARD_POINTS[award.award_type];
      if (!points) continue;

      const roundNumber = award.round_number || (award.week_number ? award.week_number * 7 : 999);
      const period = getPeriod(roundNumber);
      
      if (award.award_type === 'TOD' || award.award_type === 'TOW') {
        // Team award - give to fantasy teams supporting this real team in this period
        for (const ft of fantasyTeams) {
          const supportedTeamInPeriod = teamPassiveSupport.get(ft.team_id)[period];
          
          if (supportedTeamInPeriod && supportedTeamInPeriod.startsWith(award.team_id + '_')) {
            const reason = `${award.award_type} - ${award.team_name} - Round ${roundNumber}`;
            
            bonusesToAdd.push({
              target_type: 'team',
              target_id: supportedTeamInPeriod,
              points: points,
              reason: reason,
              league_id: LEAGUE_ID,
              awarded_by: 'system',
              awarded_at: award.created_at,
              created_at: new Date(),
              updated_at: new Date()
            });
            
            console.log(`✓ ${award.award_type} (${points}pts): ${award.team_name} -> ${ft.team_name} (Round ${roundNumber}, Period ${period})`);
          }
        }
        
      } else if (award.award_type === 'POTD' || award.award_type === 'POTW') {
        // Player award - give to fantasy team that owned this player in this period
        let awarded = false;
        
        for (const [teamId, periods] of playerOwnership.entries()) {
          if (periods[period].has(award.player_id)) {
            const reason = `${award.award_type} - ${award.player_name} - Round ${roundNumber}`;
            
            bonusesToAdd.push({
              target_type: 'player',
              target_id: award.player_id,
              points: points,
              reason: reason,
              league_id: LEAGUE_ID,
              awarded_by: 'system',
              awarded_at: award.created_at,
              created_at: new Date(),
              updated_at: new Date()
            });
            
            const ft = fantasyTeams.find(t => t.team_id === teamId);
            console.log(`✓ ${award.award_type} (${points}pts): ${award.player_name} -> ${ft.team_name} (Round ${roundNumber}, Period ${period})`);
            awarded = true;
          }
        }
        
        if (!awarded) {
          console.log(`⚠️  ${award.award_type}: ${award.player_name} - Not owned by any fantasy team in period ${period} (Round ${roundNumber})`);
        }
      }
    }

    // 9. Insert bonus points
    console.log(`\n\n📊 STEP 9: Inserting bonus points...`);
    console.log(`  New bonuses: ${bonusesToAdd.length}\n`);

    if (bonusesToAdd.length > 0) {
      for (const bonus of bonusesToAdd) {
        await fantasyDb`
          INSERT INTO bonus_points (target_type, target_id, points, reason, league_id, awarded_by, awarded_at, created_at, updated_at)
          VALUES (${bonus.target_type}, ${bonus.target_id}, ${bonus.points}, ${bonus.reason}, ${bonus.league_id}, ${bonus.awarded_by}, ${bonus.awarded_at}, ${bonus.created_at}, ${bonus.updated_at})
        `;
      }
      console.log(`✅ Successfully inserted ${bonusesToAdd.length} bonus points`);
    } else {
      console.log('ℹ️  No new bonus points to add');
    }

    // 10. Summary
    console.log('\n\n' + '='.repeat(80));
    console.log('📊 SUMMARY\n');
    console.log(`Total awards processed: ${awards.length}`);
    console.log(`New bonus points added: ${bonusesToAdd.length}`);
    
    const totalPoints = bonusesToAdd.reduce((sum, b) => sum + b.points, 0);
    console.log(`Total points distributed: ${totalPoints}`);
    
    console.log('\n✅ Sync complete!');
    console.log('\n⚠️  Remember to run recalculation script to update fantasy team totals:');
    console.log('   node scripts/recalculate-fantasy-player-points.js');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
  process.exit(0);
}

syncAwards();
