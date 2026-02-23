require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');
const db = neon(process.env.FANTASY_DATABASE_URL);

async function checkSquadSizes() {
    const res = await db`SELECT team_id, count(*) as count FROM fantasy_squad GROUP BY team_id`;
    console.log('Squad Sizes:', res);
}
checkSquadSizes();
