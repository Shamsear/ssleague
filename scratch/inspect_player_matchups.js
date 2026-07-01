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
const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);

async function run() {
  const playerId = 'sspslpsl0194'; // Gautham Krishna
  try {
    const matchups = await sql`
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
        f.status,
        f.played_date,
        f.result
      FROM matchups m
      JOIN fixtures f ON m.fixture_id = f.id
      WHERE (m.home_player_id = ${playerId} OR m.away_player_id = ${playerId})
        AND f.season_id = 'SSPSLS17'
        AND f.status = 'completed'
      ORDER BY f.round_number ASC, f.leg ASC
    `;
    console.log(JSON.stringify(matchups, null, 2));
  } catch (error) {
    console.error(error);
  }
  process.exit(0);
}
run();
