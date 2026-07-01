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
  try {
    const [row] = await sql`
      SELECT * 
      FROM player_seasons 
      WHERE player_id = 'sspslpsl0194' AND season_id = 'SSPSLS17'
    `;
    console.log(JSON.stringify(row, null, 2));
  } catch (error) {
    console.error(error);
  }
  process.exit(0);
}
run();
