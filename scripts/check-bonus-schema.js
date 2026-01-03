const { fantasySql } = require('../lib/neon/fantasy-config');

async function checkSchema() {
    const sql = fantasySql;

    const result = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'fantasy_team_bonus_points' 
    ORDER BY ordinal_position
  `;

    console.log('Columns in fantasy_team_bonus_points:');
    console.log(JSON.stringify(result, null, 2));
}

checkSchema().catch(console.error);
