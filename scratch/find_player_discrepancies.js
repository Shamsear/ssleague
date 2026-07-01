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

    const discrepancies = [];

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

      // Fix base points: fallback to STAR_RATING_BASE_POINTS if base_points is 0
      let basePoints = dbStats.base_points;
      if (!basePoints || basePoints === 0) {
        basePoints = STAR_RATING_BASE_POINTS[dbStats.star_rating || 3] || 100;
      }
      
      let currentPoints = basePoints;

      playerMatchups.forEach((m) => {
        if (m.is_null) return;
        if (m.home_goals === null || m.away_goals === null) return;

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

      const diffMatches = calcMatchesPlayed - dbStats.matches_played;
      const diffGoalsScored = calcGoalsScored - dbStats.goals_scored;
      const diffGoalsConceded = calcGoalsConceded - dbStats.goals_conceded;
      const diffWins = calcWins - dbStats.wins;
      const diffDraws = calcDraws - dbStats.draws;
      const diffLosses = calcLosses - dbStats.losses;
      const diffCleanSheets = calcCleanSheets - dbStats.clean_sheets;
      const diffMotm = calcMotmAwards - dbStats.motm_awards;
      const diffPoints = currentPoints - dbStats.points;

      if (
        diffMatches !== 0 ||
        diffGoalsScored !== 0 ||
        diffGoalsConceded !== 0 ||
        diffWins !== 0 ||
        diffDraws !== 0 ||
        diffLosses !== 0 ||
        diffCleanSheets !== 0 ||
        diffMotm !== 0 ||
        diffPoints !== 0
      ) {
        discrepancies.push({
          player_id: playerId,
          player_name: playerName,
          team: dbStats.team,
          db: {
            matches: dbStats.matches_played,
            goals_scored: dbStats.goals_scored,
            goals_conceded: dbStats.goals_conceded,
            wins: dbStats.wins,
            draws: dbStats.draws,
            losses: dbStats.losses,
            clean_sheets: dbStats.clean_sheets,
            motm: dbStats.motm_awards,
            points: dbStats.points
          },
          calc: {
            matches: calcMatchesPlayed,
            goals_scored: calcGoalsScored,
            goals_conceded: calcGoalsConceded,
            wins: calcWins,
            draws: calcDraws,
            losses: calcLosses,
            clean_sheets: calcCleanSheets,
            motm: calcMotmAwards,
            points: currentPoints
          },
          diff: {
            matches: diffMatches,
            goals_scored: diffGoalsScored,
            goals_conceded: diffGoalsConceded,
            wins: diffWins,
            draws: diffDraws,
            losses: diffLosses,
            clean_sheets: diffCleanSheets,
            motm: diffMotm,
            points: diffPoints
          }
        });
      }
    }

    const outputPath = path.resolve(process.cwd(), 'scratch/discrepancies.json');
    fs.writeFileSync(outputPath, JSON.stringify(discrepancies, null, 2), 'utf8');
    console.log(`Saved ${discrepancies.length} discrepancies to scratch/discrepancies.json`);

  } catch (error) {
    console.error('Error running search:', error);
  }
  process.exit(0);
}

run();
