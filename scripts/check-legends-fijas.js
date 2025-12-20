require('dotenv').config({path:'.env.local'});
const {neon}=require('@neondatabase/serverless');
const sql=neon(process.env.FANTASY_DATABASE_URL);

sql`SELECT fixture_id, round_number, points_multiplier, base_points, total_points FROM fantasy_player_points WHERE team_id='SSPSLT0015' AND real_player_id='sspslpsl0020' ORDER BY round_number`
  .then(r=>{
    console.log('Muhammed Fijas in Legends FC:');
    console.table(r);
    console.log(`\nTotal: ${r.reduce((sum, row) => sum + Number(row.total_points), 0)} pts`);
  })
  .catch(e=>console.error(e));
