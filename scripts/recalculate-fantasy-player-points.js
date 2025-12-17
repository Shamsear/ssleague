/**
 * Recalculate Fantasy Player Points Table
 * 
 * Populates/updates the fantasy_player_points table with match-by-match points
 * Applies captain (2x) and vice-captain (1.5x) multipliers
 * Creates one record per player per team per fixture
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function recalculateFantasyPlayerPoints() {
  // Connect to both databases
  const tournamentDb = neon(process.env.NEON_TOURNAMENT_DB_URL);
  const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);

  console.log('🔄 Starting fantasy_player_points recalculation...\n');

  // Fetch scoring rules from database
  console.log('📋 Fetching scoring rules from database...');
  const scoringRulesData = await fantasyDb`
    SELECT rule_type, rule_name, points_value, applies_to
    FROM fantasy_scoring_rules
    WHERE is_active = true
  `;

  if (scoringRulesData.length === 0) {
    throw new Error('❌ No active scoring rules found in database!');
  }

  const SCORING_RULES = {};
  scoringRulesData.forEach(rule => {
    const key = rule.rule_type.toLowerCase();
    if (rule.applies_to === 'player') {
      SCORING_RULES[key] = rule.points_value;
    }
  });

  console.log('✅ Loaded scoring rules from database\n');

  try {
    // 1. Get all completed fixtures with matchups
    console.log('📊 Fetching all completed fixtures from tournament database...');
    const fixtures = await tournamentDb`
      SELECT 
        f.id as fixture_id,
        f.season_id,
        f.tournament_id,
        f.round_number,
        f.leg,
        f.motm_player_id,
        f.scheduled_date
      FROM fixtures f
      WHERE f.status = 'completed'
      ORDER BY f.scheduled_date, f.round_number
    `;

    console.log(`  Found ${fixtures.length} completed fixtures\n`);

    // 2. Get all matchups for these fixtures
    console.log('🎮 Fetching matchups...');
    const matchups = await tournamentDb`
      SELECT 
        m.fixture_id,
        m.home_player_id,
        m.home_player_name,
        m.away_player_id,
        m.away_player_name,
        m.home_goals,
        m.away_goals
      FROM matchups m
      JOIN fixtures f ON m.fixture_id = f.id
      WHERE f.status = 'completed'
        AND m.home_goals IS NOT NULL
        AND m.away_goals IS NOT NULL
    `;

    console.log(`  Found ${matchups.length} completed matchups\n`);

    // 3. Get all fantasy squad data
    console.log('👥 Fetching fantasy squad data...');
    const squadData = await fantasyDb`
      SELECT 
        real_player_id,
        team_id,
        player_name,
        is_captain,
        is_vice_captain
      FROM fantasy_squad
    `;

    // Create map: player_id -> array of teams
    const playerTeamsMap = new Map();
    squadData.forEach(row => {
      if (!playerTeamsMap.has(row.real_player_id)) {
        playerTeamsMap.set(row.real_player_id, []);
      }
      playerTeamsMap.get(row.real_player_id).push({
        teamId: row.team_id,
        isCaptain: row.is_captain || false,
        isViceCaptain: row.is_vice_captain || false,
        playerName: row.player_name
      });
    });

    console.log(`  Found ${squadData.length} squad entries\n`);

    // 4. Clear existing fantasy_player_points
    console.log('🗑️  Clearing existing fantasy_player_points...');
    await fantasyDb`DELETE FROM fantasy_player_points`;
    console.log('  ✓ Cleared\n');

    // 5. Calculate and insert points for each player in each team for each fixture
    console.log('💯 Calculating and inserting fantasy_player_points...\n');
    
    let insertedCount = 0;
    let errorCount = 0;

    // Create fixture map for quick lookup
    const fixtureMap = new Map();
    fixtures.forEach(f => {
      fixtureMap.set(f.fixture_id, f);
    });

    for (const matchup of matchups) {
      const fixture = fixtureMap.get(matchup.fixture_id);
      if (!fixture) continue;

      // Process home player
      const homeWon = matchup.home_goals > matchup.away_goals;
      const homeDraw = matchup.home_goals === matchup.away_goals;
      const homeCleanSheet = matchup.away_goals === 0;
      const homeIsMotm = fixture.motm_player_id === matchup.home_player_id;

      const homeBasePoints = 
        (matchup.home_goals || 0) * SCORING_RULES.goals_scored +
        (homeCleanSheet ? SCORING_RULES.clean_sheet : 0) +
        (homeIsMotm ? SCORING_RULES.motm : 0) +
        (homeWon ? SCORING_RULES.win : homeDraw ? SCORING_RULES.draw : 0) +
        SCORING_RULES.match_played +
        (matchup.home_goals >= 3 && SCORING_RULES.hat_trick ? SCORING_RULES.hat_trick : 0) +
        (matchup.away_goals >= 4 && SCORING_RULES.concedes_4_plus_goals ? SCORING_RULES.concedes_4_plus_goals : 0);

      // Insert for each team this player is in
      const homePlayerTeams = playerTeamsMap.get(matchup.home_player_id) || [];
      
      for (const teamInfo of homePlayerTeams) {
        let multiplier = 1;
        let multiplierValue = 1;
        if (teamInfo.isCaptain) {
          multiplier = 2;
          multiplierValue = 2;
        } else if (teamInfo.isViceCaptain) {
          multiplier = 1.5;
          multiplierValue = 2; // Store as 2 for VC (1.5x) in integer column
        }
        
        const totalPoints = Math.round(homeBasePoints * multiplier);

        try {
          // Get league_id from team
          const teamInfo_full = await fantasyDb`
            SELECT league_id FROM fantasy_teams WHERE team_id = ${teamInfo.teamId} LIMIT 1
          `;
          const league_id = teamInfo_full[0]?.league_id;

          await fantasyDb`
            INSERT INTO fantasy_player_points (
              team_id,
              league_id,
              real_player_id,
              player_name,
              fixture_id,
              round_number,
              goals_scored,
              goals_conceded,
              clean_sheet,
              motm,
              result,
              total_points,
              is_captain,
              points_multiplier
            ) VALUES (
              ${teamInfo.teamId},
              ${league_id},
              ${matchup.home_player_id},
              ${matchup.home_player_name},
              ${matchup.fixture_id},
              ${fixture.round_number},
              ${matchup.home_goals},
              ${matchup.away_goals},
              ${homeCleanSheet},
              ${homeIsMotm},
              ${homeWon ? 'win' : homeDraw ? 'draw' : 'loss'},
              ${totalPoints},
              ${teamInfo.isCaptain || teamInfo.isViceCaptain},
              ${multiplierValue}
            )
          `;
          insertedCount++;
        } catch (error) {
          errorCount++;
          console.error(`  ✗ Failed to insert ${matchup.home_player_name}:`, error.message);
        }
      }

      // Process away player
      const awayWon = matchup.away_goals > matchup.home_goals;
      const awayDraw = matchup.away_goals === matchup.home_goals;
      const awayCleanSheet = matchup.home_goals === 0;
      const awayIsMotm = fixture.motm_player_id === matchup.away_player_id;

      const awayBasePoints = 
        (matchup.away_goals || 0) * SCORING_RULES.goals_scored +
        (awayCleanSheet ? SCORING_RULES.clean_sheet : 0) +
        (awayIsMotm ? SCORING_RULES.motm : 0) +
        (awayWon ? SCORING_RULES.win : awayDraw ? SCORING_RULES.draw : 0) +
        SCORING_RULES.match_played +
        (matchup.away_goals >= 3 && SCORING_RULES.hat_trick ? SCORING_RULES.hat_trick : 0) +
        (matchup.home_goals >= 4 && SCORING_RULES.concedes_4_plus_goals ? SCORING_RULES.concedes_4_plus_goals : 0);

      // Insert for each team this player is in
      const awayPlayerTeams = playerTeamsMap.get(matchup.away_player_id) || [];
      
      for (const teamInfo of awayPlayerTeams) {
        let multiplier = 1;
        let multiplierValue = 1;
        if (teamInfo.isCaptain) {
          multiplier = 2;
          multiplierValue = 2;
        } else if (teamInfo.isViceCaptain) {
          multiplier = 1.5;
          multiplierValue = 2; // Store as 2 for VC (1.5x) in integer column
        }
        
        const totalPoints = Math.round(awayBasePoints * multiplier);

        try {
          // Get league_id from team
          const teamInfo_full = await fantasyDb`
            SELECT league_id FROM fantasy_teams WHERE team_id = ${teamInfo.teamId} LIMIT 1
          `;
          const league_id = teamInfo_full[0]?.league_id;

          await fantasyDb`
            INSERT INTO fantasy_player_points (
              team_id,
              league_id,
              real_player_id,
              player_name,
              fixture_id,
              round_number,
              goals_scored,
              goals_conceded,
              clean_sheet,
              motm,
              result,
              total_points,
              is_captain,
              points_multiplier
            ) VALUES (
              ${teamInfo.teamId},
              ${league_id},
              ${matchup.away_player_id},
              ${matchup.away_player_name},
              ${matchup.fixture_id},
              ${fixture.round_number},
              ${matchup.away_goals},
              ${matchup.home_goals},
              ${awayCleanSheet},
              ${awayIsMotm},
              ${awayWon ? 'win' : awayDraw ? 'draw' : 'loss'},
              ${totalPoints},
              ${teamInfo.isCaptain || teamInfo.isViceCaptain},
              ${multiplierValue}
            )
          `;
          insertedCount++;
        } catch (error) {
          errorCount++;
          console.error(`  ✗ Failed to insert ${matchup.away_player_name}:`, error.message);
        }
      }
    }

    console.log('\n' + '='.repeat(100));
    console.log('\n📊 Summary:\n');
    console.log(`  ✅ Successfully Inserted: ${insertedCount}`);
    console.log(`  ❌ Failed Inserts: ${errorCount}`);
    console.log(`  Total Fixtures Processed: ${fixtures.length}`);
    console.log(`  Total Matchups Processed: ${matchups.length}`);
    console.log('\n' + '='.repeat(100));
    
    if (errorCount > 0) {
      console.log(`\n⚠️  Warning: ${errorCount} inserts failed.`);
    } else {
      console.log('\n✅ All fantasy_player_points successfully inserted!');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Run the script
recalculateFantasyPlayerPoints()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
