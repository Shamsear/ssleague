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
    const [dbStats] = await sql`
      SELECT processed_fixtures 
      FROM player_seasons 
      WHERE player_id = ${playerId} AND season_id = 'SSPSLS17'
    `;
    
    const matchups = await sql`
      SELECT m.fixture_id
      FROM matchups m
      JOIN fixtures f ON m.fixture_id = f.id
      WHERE (m.home_player_id = ${playerId} OR m.away_player_id = ${playerId})
        AND f.season_id = 'SSPSLS17'
        AND f.status = 'completed'
    `;

    const dbFixtures = dbStats.processed_fixtures || [];
    const calcFixtures = matchups.map(m => m.fixture_id);

    console.log('DB Processed Fixtures:', dbFixtures.length);
    console.log('Calc Matchups Fixtures:', calcFixtures.length);
    
    const missingInDb = calcFixtures.filter(f => !dbFixtures.includes(f));
    const extraInDb = dbFixtures.filter(f => !calcFixtures.includes(f));

    console.log('\nFixtures completed but missing from Gautham\'s processed_fixtures in DB:');
    console.log(missingInDb);

    console.log('\nFixtures in Gautham\'s processed_fixtures in DB but not in matchups:');
    console.log(extraInDb);
  } catch (error) {
    console.error(error);
  }
  process.exit(0);
}
run();
