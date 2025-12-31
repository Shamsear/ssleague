require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkFixturesSchema() {
    const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);

    console.log('🔍 Checking fixtures table schema...\n');

    try {
        const result = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'fixtures'
      ORDER BY ordinal_position
    `;

        console.log('Columns in fixtures table:');
        result.forEach(col => {
            console.log(`  - ${col.column_name}: ${col.data_type}`);
        });

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

checkFixturesSchema();
