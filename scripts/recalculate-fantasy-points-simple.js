/**
 * Recalculate Fantasy Player Points (Simple Version)
 * 
 * Calculates fantasy points for all players based on their matchup performances
 * Applies captain (2x) and vice-captain (1.5x) multipliers
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

async function recalculateFantasyPoints() {
  // Connect to both databases
  const tournamentDb = neon(process.env.NEON_TOURNAMENT_DB_URL);
  const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);

  console.log('🔄 Starting fantasy points recalculation...\n');

  try {
    // 1. Get all completed matchups with fixture info from tournament database
    console.log('📊 Fetching all completed matchups from tournament database...');
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
        f.season_id,
        f.tournament_id
      FROM matchups m
      JOIN fixtures f ON m.fixture_id = f.id
      WHERE f.status = 'completed'
        AND m.home_goals IS NOT NULL
        AND m.away_goals IS NOT NULL
      ORDER BY f.id
    `;

    console.log(`  Found ${matchups.length} completed matchups\n`);

    // 2. Get all fantasy squad data (player can be in multiple teams)
    console.log('👥 Fetching all fantasy squad data from fantasy database...');
    const squadData = await fantasyDb`
      SELECT 
        real_player_id,
        team_id,
        player_name,
        is_captain,
        is_vice_captain
      FROM fantasy_squad
    `;

    // Create a map: player_id -> array of {teamId, isCaptain, isViceCaptain}
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

    console.log(`  Found ${squadData.length} squad entries for ${playerTeamsMap.size} unique players\n`);

    // 3. Calculate points for each player in each team (player can be in multiple teams)
    console.log('💯 Calculating points per player per team with captain/VC multipliers...');
    
    // Map: "playerId_teamId" -> points data
    const playerTeamPoints = new Map();

    for (const matchup of matchups) {
      // Process home player
      const homeWon = matchup.home_goals > matchup.away_goals;
      const homeDraw = matchup.home_goals === matchup.away_goals;
      const homeCleanSheet = matchup.away_goals === 0;
      const homeIsMotm = matchup.motm_player_id === matchup.home_player_id;

      const homeBasePoints = 
        (matchup.home_goals || 0) * SCORING_RULES.goal +
        (homeCleanSheet ? SCORING_RULES.clean_sheet : 0) +
        (homeIsMotm ? SCORING_RULES.motm : 0) +
        (homeWon ? SCORING_RULES.win : homeDraw ? SCORING_RULES.draw : 0) +
        SCORING_RULES.appearance;

      // Get all teams this player is in
      const homePlayerTeams = playerTeamsMap.get(matchup.home_player_id) || [];
      
      for (const teamInfo of homePlayerTeams) {
        // Apply multiplier based on captain/VC status in this team
        let multiplier = 1;
        if (teamInfo.isCaptain) multiplier = 2;
        else if (teamInfo.isViceCaptain) multiplier = 1.5;
        
        const points = Math.round(homeBasePoints * multiplier);
        const key = `${matchup.home_player_id}_${teamInfo.teamId}`;

        if (!playerTeamPoints.has(key)) {
          playerTeamPoints.set(key, {
            player_id: matchup.home_player_id,
            player_name: matchup.home_player_name,
            team_id: teamInfo.teamId,
            total_points: 0,
            base_points: 0,
            goals: 0,
            clean_sheets: 0,
            motm_count: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            appearances: 0,
            is_captain: teamInfo.isCaptain,
            is_vice_captain: teamInfo.isViceCaptain,
          });
        }

        const data = playerTeamPoints.get(key);
        data.total_points += points;
        data.base_points += homeBasePoints;
        data.goals += matchup.home_goals || 0;
        data.clean_sheets += homeCleanSheet ? 1 : 0;
        data.motm_count += homeIsMotm ? 1 : 0;
        data.wins += homeWon ? 1 : 0;
        data.draws += homeDraw ? 1 : 0;
        data.losses += (!homeWon && !homeDraw) ? 1 : 0;
        data.appearances += 1;
      }

      // Process away player
      const awayWon = matchup.away_goals > matchup.home_goals;
      const awayDraw = matchup.away_goals === matchup.home_goals;
      const awayCleanSheet = matchup.home_goals === 0;
      const awayIsMotm = matchup.motm_player_id === matchup.away_player_id;

      const awayBasePoints = 
        (matchup.away_goals || 0) * SCORING_RULES.goal +
        (awayCleanSheet ? SCORING_RULES.clean_sheet : 0) +
        (awayIsMotm ? SCORING_RULES.motm : 0) +
        (awayWon ? SCORING_RULES.win : awayDraw ? SCORING_RULES.draw : 0) +
        SCORING_RULES.appearance;

      // Get all teams this player is in
      const awayPlayerTeams = playerTeamsMap.get(matchup.away_player_id) || [];
      
      for (const teamInfo of awayPlayerTeams) {
        // Apply multiplier based on captain/VC status in this team
        let multiplier = 1;
        if (teamInfo.isCaptain) multiplier = 2;
        else if (teamInfo.isViceCaptain) multiplier = 1.5;
        
        const points = Math.round(awayBasePoints * multiplier);
        const key = `${matchup.away_player_id}_${teamInfo.teamId}`;

        if (!playerTeamPoints.has(key)) {
          playerTeamPoints.set(key, {
            player_id: matchup.away_player_id,
            player_name: matchup.away_player_name,
            team_id: teamInfo.teamId,
            total_points: 0,
            base_points: 0,
            goals: 0,
            clean_sheets: 0,
            motm_count: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            appearances: 0,
            is_captain: teamInfo.isCaptain,
            is_vice_captain: teamInfo.isViceCaptain,
          });
        }

        const data = playerTeamPoints.get(key);
        data.total_points += points;
        data.base_points += awayBasePoints;
        data.goals += matchup.away_goals || 0;
        data.clean_sheets += awayCleanSheet ? 1 : 0;
        data.motm_count += awayIsMotm ? 1 : 0;
        data.wins += awayWon ? 1 : 0;
        data.draws += awayDraw ? 1 : 0;
        data.losses += (!awayWon && !awayDraw) ? 1 : 0;
        data.appearances += 1;
      }
    }

    console.log(`  Calculated points for ${playerTeamPoints.size} player-team combinations\n`);

    // 4. Update database with calculated points
    console.log('💾 Updating fantasy_squad table with calculated points...\n');
    
    const allEntries = Array.from(playerTeamPoints.values());
    let updatedCount = 0;
    let errorCount = 0;

    for (const entry of allEntries) {
      try {
        await fantasyDb`
          UPDATE fantasy_squad
          SET total_points = ${entry.total_points}
          WHERE real_player_id = ${entry.player_id}
            AND team_id = ${entry.team_id}
        `;
        updatedCount++;
        
        const captainBadge = entry.is_captain ? '(C)' : entry.is_vice_captain ? '(VC)' : '';
        console.log(
          `  ✓ ${entry.player_name.padEnd(25)} ` +
          `Team:${entry.team_id.substring(0, 8)} ${captainBadge.padEnd(4)} ` +
          `→ ${entry.total_points}pts`
        );
      } catch (error) {
        errorCount++;
        console.error(`  ✗ Failed to update ${entry.player_name} (${entry.team_id}):`, error.message);
      }
    }

    console.log('\n' + '='.repeat(100));
    console.log('\n📊 Update Summary:\n');
    
    const totalPoints = allEntries.reduce((sum, p) => sum + p.total_points, 0);
    const totalBasePoints = allEntries.reduce((sum, p) => sum + p.base_points, 0);
    const avgPoints = totalPoints / allEntries.length;
    
    // Count unique players and teams
    const uniquePlayers = new Set(allEntries.map(e => e.player_id)).size;
    const uniqueTeams = new Set(allEntries.map(e => e.team_id)).size;
    const captains = allEntries.filter(e => e.is_captain).length;
    const viceCaptains = allEntries.filter(e => e.is_vice_captain).length;

    console.log(`  ✅ Successfully Updated: ${updatedCount}`);
    console.log(`  ❌ Failed Updates: ${errorCount}`);
    console.log(`  Total Player-Team Combinations: ${allEntries.length}`);
    console.log(`  Unique Players: ${uniquePlayers}`);
    console.log(`  Unique Fantasy Teams: ${uniqueTeams}`);
    console.log(`  Captains: ${captains}`);
    console.log(`  Vice-Captains: ${viceCaptains}`);
    console.log(`  Total Points (with multipliers): ${totalPoints}`);
    console.log(`  Total Base Points (no multipliers): ${totalBasePoints}`);
    console.log(`  Average Points per Entry: ${avgPoints.toFixed(2)}`);
    
    console.log('\n' + '='.repeat(100));
    
    if (errorCount > 0) {
      console.log(`\n⚠️  Warning: ${errorCount} updates failed. Please check the errors above.`);
    } else {
      console.log('\n✅ All points successfully updated in the database!');
    }

  } catch (error) {
    console.error('❌ Error recalculating fantasy points:', error);
    throw error;
  }
}

// Run the script
recalculateFantasyPoints()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
