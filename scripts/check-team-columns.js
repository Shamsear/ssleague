require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkSchema() {
    const sql = neon(process.env.NEON_DATABASE_URL);

    const teams = await sql`SELECT * FROM teams LIMIT 1`;

    if (teams.length > 0) {
        console.log('Teams table columns:');
        Object.keys(teams[0]).forEach(key => {
            console.log(`  - ${key}: ${teams[0][key]}`);
        });
    }
}

checkSchema();
