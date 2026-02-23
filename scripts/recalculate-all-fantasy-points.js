/**
 * Definitive Fantasy Points Recalculation Script (V6 - Correct Ownership Logic)
 * 
 * Logic Fix:
 * 1. Transfers are "Ownership Transitions".
 * 2. If a transfer says: Team A released Player X and signed Player Y.
 *    - Before the transfer, Team A owned Player X.
 *    - After the transfer, Team A owns Player Y.
 * 3. We process transfers in REVERSE (Latest to Oldest) to roll back ownership.
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function recalculate() {
  const tournamentDb = neon(process.env.NEON_TOURNAMENT_DB_URL);
  const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);

  console.log('🎮 Starting Definitive Fantasy Points Recalculation (V6)...\n');
  const startTime = Date.now();

  try {
    // 1. DATA LOADING
    console.log('⏳ Loading master data...');
    const leagues = await fantasyDb`SELECT league_id FROM fantasy_leagues WHERE is_active = true`;
    const scoringRules = await fantasyDb`SELECT league_id, rule_type, points_value, applies_to FROM fantasy_scoring_rules WHERE is_active = true`;
    const rulesMap = new Map(); // league_id -> { player: Map, team: Map }
    scoringRules.forEach(r => {
      if (!rulesMap.has(r.league_id)) rulesMap.set(r.league_id, { player: new Map(), team: new Map() });
      const leagueRules = rulesMap.get(r.league_id);
      if (r.applies_to === 'player') leagueRules.player.set(r.rule_type, r.points_value);
      else if (r.applies_to === 'team') leagueRules.team.set(r.rule_type, r.points_value);
    });

    const teams = await fantasyDb`SELECT team_id, league_id, supported_team_id, team_name, supported_team_name FROM fantasy_teams`;
    const squad = await fantasyDb`SELECT team_id, real_player_id, player_name, is_captain, is_vice_captain FROM fantasy_squad`;
    const transfers = await fantasyDb`SELECT team_id, window_id, player_out_id, player_in_id, transferred_at FROM fantasy_transfers ORDER BY transferred_at DESC`;
    const teamChanges = await fantasyDb`SELECT team_id, old_supported_team_id, new_supported_team_id FROM supported_team_changes`;
    const adminBonuses = await fantasyDb`SELECT league_id, target_type, target_id, points FROM bonus_points`;
    const existingPoints = await fantasyDb`SELECT team_id, real_player_id, fixture_id, points_multiplier, is_captain, is_vice_captain FROM fantasy_player_points`;

    // Multiplier Cache
    const metaCache = new Map();
    existingPoints.forEach(p => metaCache.set(`${p.team_id}_${p.real_player_id}_${p.fixture_id}`, p));

    const fixtures = await tournamentDb`SELECT id, tournament_id, round_number, home_team_id, away_team_id, home_score, away_score, motm_player_id FROM fixtures WHERE status = 'completed'`;
    const fixtureMap = new Map();
    fixtures.forEach(f => fixtureMap.set(f.id, f));

    const matchups = await tournamentDb`
      SELECT m.fixture_id, m.home_player_id, m.home_player_name, m.away_player_id, m.away_player_name, m.home_goals, m.away_goals
      FROM matchups m JOIN fixtures f ON m.fixture_id = f.id
      WHERE f.status = 'completed' AND m.home_goals IS NOT NULL AND m.away_goals IS NOT NULL
    `;

    // 2. RECONSTRUCT PLAYER OWNERSHIP BY PERIOD
    // Period 0: R1-7, P1: R8-13, P2: R14-20, P3: R21-26, P4: R27+
    const PERIOD_WINDOWS = [
      ['tw_SSPSLFLS16_1766410531769', 'tw_SSPSLFLS16_1766328244409'], // Milestone into Period 1 (After R7)
      ['tw_SSPSLFLS16_1767458224465'],                                // Milestone into Period 2 (After R13)
      ['tw_SSPSLFLS16_1768451156004'],                                // Milestone into Period 3 (After R20)
    ];

    console.log('📊 Reconstructing team ownership states by period...');

    // teamOwnershipByPeriod: team_id -> Array(5) of Set<real_player_id>
    const teamOwnership = new Map();
    teams.forEach(t => {
      const pArray = [];
      for (let i = 0; i < 5; i++) pArray.push(new Set());
      teamOwnership.set(t.team_id, pArray);
    });

    // Initialize the FINAL state (Period 4) with current squad
    for (const s of squad) {
      if (teamOwnership.has(s.team_id)) {
        teamOwnership.get(s.team_id)[4].add(s.real_player_id);
      }
    }

    // Rollback ownership from P4 to P0
    for (let p = 4; p > 0; p--) {
      // Step 1: Copy state from p to p-1
      for (const [tid, pSets] of teamOwnership.entries()) {
        pSets[p - 1] = new Set(pSets[p]);
      }

      // Step 2: Apply inverse transfers for milestone into Period p
      const milestoneWindows = PERIOD_WINDOWS[p - 1] || [];
      const milestoneTransfers = transfers.filter(t => {
        if (p <= 3) return milestoneWindows.includes(t.window_id);
        const allListed = [].concat(...PERIOD_WINDOWS);
        return !allListed.includes(t.window_id); // Catch late season milestone (into P4)
      });

      for (const t of milestoneTransfers) {
        if (!teamOwnership.has(t.team_id)) continue;
        const setBefore = teamOwnership.get(t.team_id)[p - 1];

        // Rollback: Undo the signed player (they weren't here)
        if (t.player_in_id) setBefore.delete(t.player_in_id);
        // Rollback: Put back the released player (they were here)
        if (t.player_out_id) setBefore.add(t.player_out_id);
      }
    }

    // 3. RECONSTRUCT PASSIVE TEAM BY PERIOD
    console.log('📊 Reconstructing passive support by period...');
    console.log(`   Found ${teamChanges.length} team changes in database`);
    teamChanges.forEach(tc => {
      const team = teams.find(t => t.team_id === tc.team_id);
      console.log(`   - ${team?.team_name}: ${tc.old_supported_team_id} → ${tc.new_supported_team_id}`);
    });
    
    const teamPassiveSupport = new Map();
    for (const t of teams) {
      const pArray = new Array(5).fill(t.supported_team_id);
      const change = teamChanges.find(c => c.team_id === t.team_id);
      if (change) {
        // HARDCODED: Assumes change happened after P1 (after R13)
        // This needs to be fixed to use actual change date/period
        pArray[0] = change.old_supported_team_id;
        pArray[1] = change.old_supported_team_id;
        console.log(`   ⚠️  ${t.team_name}: Using HARDCODED change at P2 (after R13)`);
        console.log(`      P0-P1: ${change.old_supported_team_id}`);
        console.log(`      P2-P4: ${t.supported_team_id}`);
      }
      teamPassiveSupport.set(t.team_id, pArray);
    }

    // 4. PERIOD MAPPING HELPER
    const getPeriod = (f) => {
      if (f.tournament_id === 'SSPSLS16L') {
        if (f.round_number <= 7) return 0;
        if (f.round_number <= 13) return 1;
        if (f.round_number <= 20) return 2;
        if (f.round_number <= 26) return 3;
        return 4;
      }
      return 4; // Other cups are late season
    };

    // 5. CALCULATE POINTS
    console.log('\n📊 STEP 1: Recalculating Player Points...');
    await fantasyDb`DELETE FROM fantasy_player_points`;

    const fppRecords = [];
    const totals = new Map(); // team_id -> { player, passive }
    teams.forEach(t => totals.set(t.team_id, { player: 0, passive: 0 }));

    for (const m of matchups) {
      const fix = fixtureMap.get(m.fixture_id);
      if (!fix) continue;
      const period = getPeriod(fix);

      const matchPlayers = [
        { id: m.home_player_id, name: m.home_player_name, g: m.home_goals, c: m.away_goals },
        { id: m.away_player_id, name: m.away_player_name, g: m.away_goals, c: m.home_goals }
      ];

      for (const p of matchPlayers) {
        // Who owned this player in this period?
        for (const [tid, pSets] of teamOwnership.entries()) {
          if (pSets[period].has(p.id)) {
            const fTeam = teams.find(t => t.team_id === tid);
            const leagueRules = rulesMap.get(fTeam.league_id);
            if (!leagueRules) continue;
            const rules = leagueRules.player;

            const won = p.g > p.c; const draw = p.g === p.c; const clean = p.c === 0;
            const base = (p.g || 0) * (rules.get('goals_scored') || 0) +
              (clean ? (rules.get('clean_sheet') || 0) : 0) +
              (fix.motm_player_id === p.id ? (rules.get('motm') || 0) : 0) +
              (won ? (rules.get('win') || 0) : draw ? (rules.get('draw') || 0) : 0) +
              (rules.get('match_played') || 0);

            const cached = metaCache.get(`${tid}_${p.id}_${fix.id}`);
            const inCurrentSquad = squad.find(s => s.team_id === tid && s.real_player_id === p.id);

            let mult = 100;
            if (cached) mult = cached.points_multiplier;
            else if (inCurrentSquad) {
              if (inCurrentSquad.is_captain) mult = 200;
              else if (inCurrentSquad.is_vice_captain) mult = 150;
            }

            const total = Math.round(base * (mult / 100));
            totals.get(tid).player += total;

            fppRecords.push({
              team_id: tid, league_id: fTeam.league_id, real_player_id: p.id, player_name: p.name,
              fixture_id: fix.id, round_number: fix.round_number, goals_scored: p.g, goals_conceded: p.c,
              is_clean_sheet: clean, is_motm: (fix.motm_player_id === p.id), result: won ? 'win' : draw ? 'draw' : 'loss',
              total_points: total, is_captain: (cached?.is_captain || inCurrentSquad?.is_captain || false),
              is_vice_captain: (cached?.is_vice_captain || inCurrentSquad?.is_vice_captain || false),
              points_multiplier: mult, base_points: base, calculated_at: new Date()
            });
          }
        }
      }
    }

    console.log(`📡 Inserting ${fppRecords.length} performance records...`);
    const chunkSize = 25;
    for (let i = 0; i < fppRecords.length; i += chunkSize) {
      const chunk = fppRecords.slice(i, i + chunkSize);
      await Promise.all(chunk.map(r => fantasyDb`
        INSERT INTO fantasy_player_points (team_id, league_id, real_player_id, player_name, fixture_id, round_number, goals_scored, goals_conceded, is_clean_sheet, is_motm, result, total_points, is_captain, is_vice_captain, points_multiplier, base_points, calculated_at)
        VALUES (${r.team_id}, ${r.league_id}, ${r.real_player_id}, ${r.player_name}, ${r.fixture_id}, ${r.round_number}, ${r.goals_scored}, ${r.goals_conceded}, ${r.is_clean_sheet}, ${r.is_motm}, ${r.result}, ${r.total_points}, ${r.is_captain}, ${r.is_vice_captain}, ${r.points_multiplier}, ${r.base_points}, ${r.calculated_at})
      `));
      process.stdout.write('.');
    }

    console.log('\n📊 STEP 2: Passive Team Bonus Points...');
    await fantasyDb`DELETE FROM fantasy_team_bonus_points`;
    const bonusRecords = [];
    
    // Track bonuses by fantasy team for detailed logging
    const teamBonusTracking = new Map(); // fantasy_team_id -> { teamName, bonuses: [] }
    teams.forEach(t => {
      teamBonusTracking.set(t.team_id, { 
        teamName: t.team_name, 
        supportedTeam: t.supported_team_name,
        bonuses: [],
        totalPoints: 0,
        periodBreakdown: [] // Track which team was supported in each period
      });
    });
    
    for (const lid of Array.from(rulesMap.keys())) {
      const leagueRules = rulesMap.get(lid);
      const teamRules = leagueRules.team;
      const lTeams = teams.filter(t => t.league_id === lid);
      
      console.log(`\n  League: ${lid}`);
      console.log(`  Processing ${fixtures.length} fixtures for ${lTeams.length} fantasy teams...`);
      
      for (const f of fixtures) {
        const period = getPeriod(f);
        const sides = [{ tid: f.home_team_id, g: f.home_score, c: f.away_score }, { tid: f.away_team_id, g: f.away_score, c: f.home_score }];
        for (const s of sides) {
          const won = s.g > s.c; const draw = s.g === s.c; const lost = s.g < s.c;
          const clean = s.c === 0;
          const highScoring = s.g >= 6;
          const heavyConceded = s.c >= 15;
          
          let val = (won ? (teamRules.get('win') || 0) : draw ? (teamRules.get('draw') || 0) : (teamRules.get('loss') || 0)) +
            (clean ? (teamRules.get('clean_sheet') || 0) : 0) +
            (highScoring ? (teamRules.get('scored_6_plus_goals') || 0) : 0) +
            (heavyConceded ? (teamRules.get('concedes_15_plus_goals') || 0) : 0);
          
          if (val === 0) continue;
          
          for (const ft of lTeams) {
            const currentSupported = teamPassiveSupport.get(ft.team_id)[period];
            const isMatch = currentSupported && currentSupported.startsWith(s.tid + '_');
            
            if (isMatch) {
              totals.get(ft.team_id).passive += val;
              
              // Track this bonus for logging
              const tracking = teamBonusTracking.get(ft.team_id);
              tracking.bonuses.push({
                fixture: f.id,
                round: f.round_number,
                tournament: f.tournament_id,
                period: period,
                realTeam: s.tid,
                supportedTeamId: currentSupported,
                score: `${s.g}-${s.c}`,
                result: won ? 'W' : draw ? 'D' : 'L',
                points: val,
                awarded: true
              });
              tracking.totalPoints += val;
              
              bonusRecords.push({ 
                league_id: lid, 
                team_id: ft.team_id, 
                real_team_id: s.tid, 
                real_team_name: ft.supported_team_name, 
                fixture_id: f.id, 
                round_number: f.round_number, 
                total_bonus: val, 
                calculated_at: new Date() 
              });
            }
          }
        }
      }
    }
    
    // Log detailed bonus breakdown with period information
    console.log('\n  📋 PASSIVE BONUS BREAKDOWN BY FANTASY TEAM:');
    console.log('  ' + '='.repeat(100));
    for (const [teamId, tracking] of teamBonusTracking.entries()) {
      if (tracking.bonuses.length > 0) {
        console.log(`\n  🏆 ${tracking.teamName}`);
        console.log(`     Current Supported Team: ${tracking.supportedTeam}`);
        console.log(`     Total Passive Points: ${tracking.totalPoints}`);
        console.log(`     Bonuses from ${tracking.bonuses.length} matches:`);
        
        // Show period-by-period breakdown
        const periodMap = new Map();
        tracking.bonuses.forEach(b => {
          if (!periodMap.has(b.period)) {
            periodMap.set(b.period, {
              supportedTeam: b.supportedTeamId,
              bonuses: []
            });
          }
          periodMap.get(b.period).bonuses.push(b);
        });
        
        for (let p = 0; p <= 4; p++) {
          if (periodMap.has(p)) {
            const periodData = periodMap.get(p);
            const periodTotal = periodData.bonuses.reduce((sum, b) => sum + b.points, 0);
            const periodName = p === 0 ? 'P0 (R1-7)' : p === 1 ? 'P1 (R8-13)' : p === 2 ? 'P2 (R14-20)' : p === 3 ? 'P3 (R21-26)' : 'P4 (R27+)';
            
            console.log(`\n     ${periodName} - Supporting: ${periodData.supportedTeam}`);
            console.log(`       Total: ${periodTotal} pts from ${periodData.bonuses.length} matches`);
            
            // Group by tournament within period
            const byTournament = new Map();
            periodData.bonuses.forEach(b => {
              if (!byTournament.has(b.tournament)) {
                byTournament.set(b.tournament, []);
              }
              byTournament.get(b.tournament).push(b);
            });
            
            for (const [tournament, bonuses] of byTournament.entries()) {
              const tournamentTotal = bonuses.reduce((sum, b) => sum + b.points, 0);
              console.log(`       - ${tournament}: ${tournamentTotal} pts from ${bonuses.length} matches`);
            }
          }
        }
      } else {
        console.log(`\n  🏆 ${tracking.teamName}`);
        console.log(`     Current Supported Team: ${tracking.supportedTeam}`);
        console.log(`     ⚠️  No passive points earned (no matches found for supported team)`);
      }
    }
    console.log('  ' + '='.repeat(100));
    
    console.log(`\n  💾 Inserting ${bonusRecords.length} bonus records...`);
    for (let i = 0; i < bonusRecords.length; i += chunkSize) {
      const chunk = bonusRecords.slice(i, i + chunkSize);
      await Promise.all(chunk.map(r => fantasyDb`
        INSERT INTO fantasy_team_bonus_points (league_id, team_id, real_team_id, real_team_name, fixture_id, round_number, total_bonus, calculated_at)
        VALUES (${r.league_id}, ${r.team_id}, ${r.real_team_id}, ${r.real_team_name}, ${r.fixture_id}, ${r.round_number}, ${r.total_bonus}, ${r.calculated_at})
      `));
    }

    console.log('\n📊 STEP 3: Finalizing totals...');
    
    // Update squad totals
    for (const s of squad) {
      const score = fppRecords.filter(r => r.team_id === s.team_id && r.real_player_id === s.real_player_id).reduce((sum, r) => sum + r.total_points, 0);
      const bonus = adminBonuses.filter(b => b.target_type === 'player' && b.target_id === s.real_player_id).reduce((sum, b) => sum + Number(b.points), 0);
      await fantasyDb`UPDATE fantasy_squad SET total_points = ${score + bonus} WHERE team_id=${s.team_id} AND real_player_id=${s.real_player_id}`;
    }
    
    console.log('\n  💰 FINAL TEAM TOTALS:');
    console.log('  ' + '='.repeat(100));
    
    for (const t of teams) {
      // Get ONLY team bonuses (TOD/TOW awards) - NOT player bonuses
      const teamBonuses = adminBonuses.filter(b => b.target_type === 'team' && b.target_id === t.supported_team_id);
      const teamBonusTotal = teamBonuses.reduce((sum, b) => sum + Number(b.points), 0);
      
      // Get player bonuses (POTD/POTW awards) for players in this team's squad - ADD TO PLAYER POINTS
      const teamPlayerIds = squad.filter(s => s.team_id === t.team_id).map(s => s.real_player_id);
      const playerBonuses = adminBonuses.filter(b => b.target_type === 'player' && teamPlayerIds.includes(b.target_id));
      const playerBonusTotal = playerBonuses.reduce((sum, b) => sum + Number(b.points), 0);
      
      const basePlayerPts = totals.get(t.team_id).player;
      const basePassivePts = totals.get(t.team_id).passive;
      
      const playerPts = basePlayerPts + playerBonusTotal; // Add player bonuses to active points
      const passivePts = basePassivePts + teamBonusTotal; // Add only team bonuses to passive points
      
      console.log(`\n  🏆 ${t.team_name} (${t.owner_name})`);
      console.log(`     Supporting: ${t.supported_team_name}`);
      console.log(`     ─────────────────────────────────────────────────────────────`);
      console.log(`     PLAYER POINTS (Active):`);
      console.log(`       Base Performance:     ${basePlayerPts.toString().padStart(6)} pts`);
      if (playerBonusTotal > 0) {
        console.log(`       Player Awards (POTD/POTW):`);
        playerBonuses.forEach(b => {
          console.log(`         - ${b.reason}: +${b.points}`);
        });
        console.log(`       Player Bonus Total:   ${playerBonusTotal.toString().padStart(6)} pts`);
      }
      console.log(`       Total Player Points:  ${playerPts.toString().padStart(6)} pts`);
      console.log(`     ─────────────────────────────────────────────────────────────`);
      console.log(`     PASSIVE POINTS:`);
      console.log(`       Match Bonuses:        ${basePassivePts.toString().padStart(6)} pts`);
      if (teamBonusTotal > 0) {
        console.log(`       Team Awards (TOD/TOW):`);
        teamBonuses.forEach(b => {
          console.log(`         - ${b.reason}: +${b.points}`);
        });
        console.log(`       Team Bonus Total:     ${teamBonusTotal.toString().padStart(6)} pts`);
      }
      console.log(`       Total Passive Points: ${passivePts.toString().padStart(6)} pts`);
      console.log(`     ─────────────────────────────────────────────────────────────`);
      console.log(`     GRAND TOTAL:          ${(playerPts + passivePts).toString().padStart(6)} pts`);
      
      await fantasyDb`UPDATE fantasy_teams SET player_points=${playerPts}, passive_points=${passivePts}, total_points=${playerPts + passivePts}, updated_at=NOW() WHERE team_id=${t.team_id}`;
    }
    
    console.log('  ' + '='.repeat(100));

    // Ranks
    for (const lid of Array.from(rulesMap.keys())) {
      await fantasyDb`
        WITH Ranked AS (SELECT team_id, ROW_NUMBER() OVER (ORDER BY total_points DESC, team_name ASC) as r FROM fantasy_teams WHERE league_id=${lid})
        UPDATE fantasy_teams ft SET rank = rt.r FROM Ranked rt WHERE ft.team_id = rt.team_id
      `;
    }

    console.log(`\n🎉 Done! V6 Recalculation took ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  } catch (error) { console.error('❌ Error:', error); process.exit(1); }
  process.exit(0);
}

recalculate();
