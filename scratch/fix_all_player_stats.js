const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
          value = value.substring(1, value.length - 1);
        }
        if (value.length > 0 && value.charAt(0) === "'" && value.charAt(value.length - 1) === "'") {
          value = value.substring(1, value.length - 1);
        }
        process.env[key] = value;
      }
    });
  }
}

loadEnvLocal();
const connectionString = process.env.NEON_TOURNAMENT_DB_URL;

if (!connectionString) {
  console.error('NEON_TOURNAMENT_DB_URL is not defined');
  process.exit(1);
}

const sql = neon(connectionString);

const STAR_RATING_BASE_POINTS = {
  3: 100,
  4: 120,
  5: 145,
  6: 175,
  7: 210,
  8: 250,
  9: 300,
  10: 375,
};

function calculateStarRating(points) {
  if (points >= 350) return 10;
  if (points >= 300) return 9;
  if (points >= 250) return 8;
  if (points >= 210) return 7;
  if (points >= 175) return 6;
  if (points >= 145) return 5;
  if (points >= 120) return 4;
  return 3;
}

async function run() {
  const seasonId = 'SSPSLS17';
  try {
    console.log(`Fetching completed matchups and player seasons...`);
    
    const allMatchups = await sql`
      SELECT 
        m.fixture_id,
        f.round_number,
        f.leg,
        f.home_team_name,
        f.away_team_name,
        m.home_player_id,
        m.home_player_name,
        m.away_player_id,
        m.away_player_name,
        m.home_goals,
        m.away_goals,
        m.is_null,
        f.motm_player_id,
        f.status
      FROM matchups m
      JOIN fixtures f ON m.fixture_id = f.id
      WHERE f.season_id = ${seasonId}
        AND f.status = 'completed'
      ORDER BY f.round_number ASC, f.leg ASC
    `;

    const playerSeasons = await sql`
      SELECT * 
      FROM player_seasons 
      WHERE season_id = ${seasonId}
    `;

    console.log(`Analyzing and fixing stats for ${playerSeasons.length} players...\n`);
    
    let fixCount = 0;

    for (const dbStats of playerSeasons) {
      const playerId = dbStats.player_id;
      const playerName = dbStats.player_name;
      
      const playerMatchups = allMatchups.filter(m => m.home_player_id === playerId || m.away_player_id === playerId);
      
      let calcMatchesPlayed = 0;
      let calcGoalsScored = 0;
      let calcGoalsConceded = 0;
      let calcWins = 0;
      let calcDraws = 0;
      let calcLosses = 0;
      let calcCleanSheets = 0;
      let calcMotmAwards = 0;
      
      // Determine starting base points
      let basePoints = dbStats.base_points;
      if (!basePoints || basePoints === 0) {
        basePoints = STAR_RATING_BASE_POINTS[dbStats.star_rating || 3] || 100;
      }
      
      let currentPoints = basePoints;
      const processedFixtures = [];

      playerMatchups.forEach((m) => {
        if (m.is_null) return;
        if (m.home_goals === null || m.away_goals === null) return;

        processedFixtures.push(m.fixture_id);

        const isHome = m.home_player_id === playerId;
        const playerGoals = isHome ? (m.home_goals || 0) : (m.away_goals || 0);
        const opponentGoals = isHome ? (m.away_goals || 0) : (m.home_goals || 0);
        
        calcMatchesPlayed++;
        calcGoalsScored += playerGoals;
        calcGoalsConceded += opponentGoals;
        
        if (playerGoals > opponentGoals) {
          calcWins++;
        } else if (playerGoals === opponentGoals) {
          calcDraws++;
        } else {
          calcLosses++;
        }
        
        if (opponentGoals === 0) {
          calcCleanSheets++;
        }
        
        if (m.motm_player_id === playerId) {
          calcMotmAwards++;
        }
        
        const gd = playerGoals - opponentGoals;
        const pointsChange = Math.max(-5, Math.min(5, gd));
        currentPoints = Math.max(100, currentPoints + pointsChange);
      });

      const calcStarRating = calculateStarRating(currentPoints);

      // Check if db stats differ from calculated stats
      if (
        dbStats.matches_played !== calcMatchesPlayed ||
        dbStats.goals_scored !== calcGoalsScored ||
        dbStats.goals_conceded !== calcGoalsConceded ||
        dbStats.wins !== calcWins ||
        dbStats.draws !== calcDraws ||
        dbStats.losses !== calcLosses ||
        dbStats.clean_sheets !== calcCleanSheets ||
        dbStats.motm_awards !== calcMotmAwards ||
        dbStats.points !== currentPoints ||
        dbStats.star_rating !== calcStarRating ||
        dbStats.base_points !== basePoints
      ) {
        console.log(`Updating "${playerName}" (${playerId}):`);
        console.log(`   Matches:  ${dbStats.matches_played} -> ${calcMatchesPlayed}`);
        console.log(`   Goals Scored:   ${dbStats.goals_scored} -> ${calcGoalsScored}`);
        console.log(`   Goals Conceded: ${dbStats.goals_conceded} -> ${calcGoalsConceded}`);
        console.log(`   Wins/Draws/Losses: ${dbStats.wins}/${dbStats.draws}/${dbStats.losses} -> ${calcWins}/${calcDraws}/${calcLosses}`);
        console.log(`   Points:   ${dbStats.points} -> ${currentPoints} (Star: ${dbStats.star_rating} -> ${calcStarRating})`);
        
        await sql`
          UPDATE player_seasons
          SET
            matches_played = ${calcMatchesPlayed},
            goals_scored = ${calcGoalsScored},
            goals_conceded = ${calcGoalsConceded},
            wins = ${calcWins},
            draws = ${calcDraws},
            losses = ${calcLosses},
            clean_sheets = ${calcCleanSheets},
            motm_awards = ${calcMotmAwards},
            points = ${currentPoints},
            star_rating = ${calcStarRating},
            base_points = ${basePoints},
            processed_fixtures = ${JSON.stringify(processedFixtures)},
            updated_at = NOW()
          WHERE player_id = ${playerId} AND season_id = ${seasonId}
        `;
        
        fixCount++;
      }
    }

    console.log(`\nSuccessfully updated/fixed stats for ${fixCount} players.`);

  } catch (error) {
    console.error('Error running fix script:', error);
  }
  process.exit(0);
}

run();
