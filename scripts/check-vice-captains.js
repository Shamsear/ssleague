require('dotenv').config({path:'.env.local'});
const {neon}=require('@neondatabase/serverless');
const sql=neon(process.env.FANTASY_DATABASE_URL);

sql`SELECT team_id, player_name, is_captain, is_vice_captain FROM fantasy_squad WHERE is_vice_captain = true LIMIT 10`
  .then(r=>{
    console.log(`Found ${r.length} Vice-Captains:`);
    console.table(r);
  })
  .catch(e=>console.error(e));
