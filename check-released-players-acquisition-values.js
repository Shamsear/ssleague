const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

const releasedPlayers = [
  'Jackson Tchatchoua',
  'Nicola Zalewski',
  'Andrej Kramarić',
  'Jacob Ramsey',
  'Leon Bailey',
  'Paulinho',
  'Ander Barrenetxea',
  'Julio Enciso',
  'Iliman Ndiaye',
  'Simon Adingra',
  'Pedro Porro',
  'Giacomo Raspadori',
  'Kevin Danso',
  'Dwight McNeil',
  'Francisco Conceição',
  'Kim Min-Jae',
  'Pablo Barrios',
  'Noussair Mazraoui',
  'Nico González'
];

async function checkAcquisitionValues() {
  console.log('Checking acquisition values for released players...\n');
  
  for (const playerName of releasedPlayers) {
    const searchName = playerName.toLowerCase();
    
    const players = await sql`
      SELECT 
        player_id,
        name,
        team_name,
        season_id,
        acquisition_value
      FROM footballplayers
      WHERE LOWER(name) LIKE ${`%${searchName}%`}
      ORDER BY season_id DESC
    `;
    
    if (players.length > 0) {
      console.log(`\n${playerName}:`);
      players.forEach(p => {
        console.log(`  Season: ${p.season_id}, Team: ${p.team_name}`);
        console.log(`  Acquisition: ${p.acquisition_value || 'NULL'}`);
      });
    } else {
      console.log(`\n${playerName}: NOT FOUND`);
    }
  }
}

checkAcquisitionValues().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
