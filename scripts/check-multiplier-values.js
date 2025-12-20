require('dotenv').config({path:'.env.local'});
const {neon}=require('@neondatabase/serverless');
const sql=neon(process.env.FANTASY_DATABASE_URL);

sql`SELECT DISTINCT points_multiplier, COUNT(*) as count FROM fantasy_player_points GROUP BY points_multiplier ORDER BY points_multiplier`
  .then(r=>{
    console.log('Points Multiplier Values in Database:');
    r.forEach(row=>console.log(`  ${row.points_multiplier}: ${row.count} records`));
  })
  .catch(e=>console.error(e));
