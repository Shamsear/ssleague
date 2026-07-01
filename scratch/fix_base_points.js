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

const updates = [
  { name: 'Fayaz', points: 284, adjustment: 44, expectedBase: 240 },
  { name: 'Gautham Krishna ', points: 245, adjustment: 33, expectedBase: 212 },
  { name: 'Gokul Krishna', points: 242, adjustment: 15, expectedBase: 227 },
  { name: 'Hemin', points: 228, adjustment: -1, expectedBase: 229 },
  { name: 'Afsal pa', points: 207, adjustment: -4, expectedBase: 211 },
  { name: 'Fazi', points: 184, adjustment: 6, expectedBase: 178 },
  { name: 'Nidhul', points: 168, adjustment: -3, expectedBase: 171 },
  { name: 'Prajith', points: 156, adjustment: 36, expectedBase: 120 },
  { name: 'Akhinesh', points: 151, adjustment: -14, expectedBase: 165 },
  { name: 'Tijo', points: 142, adjustment: -27, expectedBase: 169 },
  { name: 'Midhun Martin', points: 128, adjustment: 4, expectedBase: 124 },
  { name: 'Salsabeel', points: 100, adjustment: -42, expectedBase: 142 },
  { name: 'Joyal K Ittoop', points: 100, adjustment: -38, expectedBase: 138 }
];

async function run() {
  console.log("Starting player base_points updates...");
  
  for (const item of updates) {
    console.log(`Updating "${item.name}": setting base_points = ${item.expectedBase}...`);
    
    const result = await sql`
      UPDATE player_seasons
      SET base_points = ${item.expectedBase}
      WHERE LOWER(player_name) = LOWER(${item.name.trim()}) AND season_id = 'SSPSLS17'
      RETURNING player_name, base_points, points
    `;
    
    if (result.length > 0) {
      console.log(`   Success: ${result[0].player_name} updated to base_points = ${result[0].base_points} (Points: ${result[0].points})`);
    } else {
      console.warn(`   Warning: No player found matching name "${item.name}" in season SSPSLS17.`);
    }
  }
  
  console.log("\nChecking final results in DB...");
  const currentStatus = await sql`
    SELECT player_name, base_points, points
    FROM player_seasons
    WHERE season_id = 'SSPSLS17' AND LOWER(player_name) IN (
      'fayaz', 'gautham krishna', 'gokul krishna', 'hemin', 'afsal pa', 'fazi',
      'nidhul', 'prajith', 'akhinesh', 'tijo', 'midhun martin', 'salsabeel', 'joyal k ittoop'
    )
    ORDER BY points DESC
  `;
  
  console.log(JSON.stringify(currentStatus, null, 2));
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
