/**
 * Show Fantasy Points Breakdown by Match
 * 
 * Displays detailed match-by-match performance showing how points were earned
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

// Fantasy scoring rules
const SCORING_RULES = {
  goal: 5,              // Points per goal scored
  clean_sheet: 4,       // Points for clean sheet (0 goals conceded)
  motm: 3,              // Points for Man of the Match
  win: 2,               // Points for winning the match
  draw: 1,              // Points for drawing the match
  appearance: 1,        // Points just for playing
};

async function showFantasyPointsBreakdown() {
  const tournamentDb = neon(process.env.NEON_TOURNAMENT_DB_URL);
  const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);

  console.log('🔍 Fantasy Points Breakdown - Match by Match\n');
  console.log('=' .repeat(120));

  try {
    // Get all completed matchups with fixture info
    const matchups = await tournamentDb`
      SELECT 
        m.fixture_id,
        m.home_player_id,
        m.home_player_name,
        m.away_player_id,
        m.away_player_name,
        m.home_goals,
        m.away_goals,
        f.motm_player_id,
        f.round_number,
        f.status
      FROM matchups m
      JOIN fixtures f ON m.fixture_id = f.id
      WHERE f.status = 'completed'
        AND m.home_goals IS NOT NULL
        AND m.away_goals IS NOT NULL
      ORDER BY f.round_number, m.fixture_id
    `;

    // Get fantasy squad data for captain/VC info
    const squadData = await fantasyDb`
      SELECT 
        real_player_id,
        team_id,
        player_name,
        is_captain,
        is_vice_captain
      FROM fantasy_squad
    `;

    // Create player-team map
    const playerTeamsMap = new Map();
    squadData.forEach(row => {
      if (!playerTeamsMap.has(row.real_player_id)) {
        playerTeamsMap.set(row.real_player_id, []);
      }
      playerTeamsMap.get(row.real_player_id).push({
        teamId: row.team_id,
        isCaptain: row.is_captain || false,
        isViceCaptain: row.is_vice_captain || false,
      });
    });

    console.log(`\nFound ${matchups.length} completed matches\n`);

    // Group by round
    const roundGroups = new Map();
    matchups.forEach(m => {
      const round = m.round_number || 'Unknown';
      if (!roundGroups.has(round)) {
        roundGroups.set(round, []);
      }
      roundGroups.get(round).push(m);
    });

    // Process each round
    for (const [round, matches] of Array.from(roundGroups.entries()).sort((a, b) => a[0] - b[0])) {
      console.log(`\n${'='.repeat(120)}`);
      console.log(`ROUND ${round}`);
      console.log('='.repeat(120));

      for (const matchup of matches) {
        console.log(`\n📍 Match: ${matchup.home_player_name} vs ${matchup.away_player_name}`);
        console.log(`   Score: ${matchup.home_goals} - ${matchup.away_goals}`);
        
        // Process home player
        const homeWon = matchup.home_goals > matchup.away_goals;
        const homeDraw = matchup.home_goals === matchup.away_goals;
        const homeCleanSheet = matchup.away_goals === 0;
        const homeIsMotm = matchup.motm_player_id === matchup.home_player_id;

        console.log(`\n   🏠 ${matchup.home_player_name}:`);
        
        const homeBreakdown = [];
        let homeBase = 0;
        
        if (matchup.home_goals > 0) {
          const pts = matchup.home_goals * SCORING_RULES.goal;
          homeBreakdown.push(`${matchup.home_goals} Goals × ${SCORING_RULES.goal} = ${pts}pts`);
          homeBase += pts;
        }
        
        if (homeCleanSheet) {
          homeBreakdown.push(`Clean Sheet = ${SCORING_RULES.clean_sheet}pts`);
          homeBase += SCORING_RULES.clean_sheet;
        }
        
        if (homeIsMotm) {
          homeBreakdown.push(`MOTM = ${SCORING_RULES.motm}pts`);
          homeBase += SCORING_RULES.motm;
        }
        
        if (homeWon) {
          homeBreakdown.push(`Win = ${SCORING_RULES.win}pts`);
          homeBase += SCORING_RULES.win;
        } else if (homeDraw) {
          homeBreakdown.push(`Draw = ${SCORING_RULES.draw}pt`);
          homeBase += SCORING_RULES.draw;
        } else {
          homeBreakdown.push(`Loss = 0pts`);
        }
        
        homeBreakdown.push(`Appearance = ${SCORING_RULES.appearance}pt`);
        homeBase += SCORING_RULES.appearance;

        homeBreakdown.forEach(line => console.log(`      • ${line}`));
        console.log(`      ─────────────────────────`);
        console.log(`      Base Points: ${homeBase}pts`);

        // Show multipliers for each team
        const homeTeams = playerTeamsMap.get(matchup.home_player_id) || [];
        if (homeTeams.length > 0) {
          console.log(`      Multipliers:`);
          homeTeams.forEach(team => {
            const mult = team.isCaptain ? '2x (C)' : team.isViceCaptain ? '1.5x (VC)' : '1x';
            const multiplier = team.isCaptain ? 2 : team.isViceCaptain ? 1.5 : 1;
            const finalPts = Math.round(homeBase * multiplier);
            console.log(`      • Team ${team.teamId.substring(0, 8)}: ${mult} → ${finalPts}pts`);
          });
        }

        // Process away player
        const awayWon = matchup.away_goals > matchup.home_goals;
        const awayDraw = matchup.away_goals === matchup.home_goals;
        const awayCleanSheet = matchup.home_goals === 0;
        const awayIsMotm = matchup.motm_player_id === matchup.away_player_id;

        console.log(`\n   ✈️  ${matchup.away_player_name}:`);
        
        const awayBreakdown = [];
        let awayBase = 0;
        
        if (matchup.away_goals > 0) {
          const pts = matchup.away_goals * SCORING_RULES.goal;
          awayBreakdown.push(`${matchup.away_goals} Goals × ${SCORING_RULES.goal} = ${pts}pts`);
          awayBase += pts;
        }
        
        if (awayCleanSheet) {
          awayBreakdown.push(`Clean Sheet = ${SCORING_RULES.clean_sheet}pts`);
          awayBase += SCORING_RULES.clean_sheet;
        }
        
        if (awayIsMotm) {
          awayBreakdown.push(`MOTM = ${SCORING_RULES.motm}pts`);
          awayBase += SCORING_RULES.motm;
        }
        
        if (awayWon) {
          awayBreakdown.push(`Win = ${SCORING_RULES.win}pts`);
          awayBase += SCORING_RULES.win;
        } else if (awayDraw) {
          awayBreakdown.push(`Draw = ${SCORING_RULES.draw}pt`);
          awayBase += SCORING_RULES.draw;
        } else {
          awayBreakdown.push(`Loss = 0pts`);
        }
        
        awayBreakdown.push(`Appearance = ${SCORING_RULES.appearance}pt`);
        awayBase += SCORING_RULES.appearance;

        awayBreakdown.forEach(line => console.log(`      • ${line}`));
        console.log(`      ─────────────────────────`);
        console.log(`      Base Points: ${awayBase}pts`);

        // Show multipliers for each team
        const awayTeams = playerTeamsMap.get(matchup.away_player_id) || [];
        if (awayTeams.length > 0) {
          console.log(`      Multipliers:`);
          awayTeams.forEach(team => {
            const mult = team.isCaptain ? '2x (C)' : team.isViceCaptain ? '1.5x (VC)' : '1x';
            const multiplier = team.isCaptain ? 2 : team.isViceCaptain ? 1.5 : 1;
            const finalPts = Math.round(awayBase * multiplier);
            console.log(`      • Team ${team.teamId.substring(0, 8)}: ${mult} → ${finalPts}pts`);
          });
        }
      }
    }

    console.log(`\n${'='.repeat(120)}\n`);
    console.log('✅ Breakdown complete!\n');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Run the script
showFantasyPointsBreakdown()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
