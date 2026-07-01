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
  const name = 'Gautham Krishna ';
  const expectedBase = 212;
  
  console.log(`Updating "${name}" using TRIM...`);
  const result = await sql`
    UPDATE player_seasons
    SET base_points = ${expectedBase}
    WHERE TRIM(LOWER(player_name)) = TRIM(LOWER(${name})) AND season_id = 'SSPSLS17'
    RETURNING player_name, base_points, points
  `;
  
  if (result.length > 0) {
    console.log(`✅ Success: ${result[0].player_name} updated to base_points = ${result[0].base_points}`);
  } else {
    console.warn(`❌ Failed to update Gautham Krishna.`);
  }
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
