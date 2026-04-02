const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);

async function checkStructure() {
  try {
    console.log('Checking teamstats table structure...\n');
    
    // Check teamstats table
    const teamstatsColumns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'teamstats'
      ORDER BY ordinal_position
    `;
    
    console.log('teamstats columns:');
    teamstatsColumns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    console.log('\nChecking tournaments table structure...\n');
    
    // Check tournaments table
    const tournamentsColumns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'tournaments'
      ORDER BY ordinal_position
    `;
    
    console.log('tournaments columns:');
    tournamentsColumns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    console.log('\nSample teamstats data (first 3 rows):');
    const sampleStats = await sql`
      SELECT * FROM teamstats LIMIT 3
    `;
    console.log(JSON.stringify(sampleStats, null, 2));
    
    console.log('\nSample tournaments data (first 3 rows):');
    const sampleTournaments = await sql`
      SELECT * FROM tournaments LIMIT 3
    `;
    console.log(JSON.stringify(sampleTournaments, null, 2));
    
    console.log('\nChecking if SSPSLT0016 has stats:');
    const teamStats = await sql`
      SELECT COUNT(*) as count, season_id
      FROM teamstats
      WHERE team_id = 'SSPSLT0016'
      GROUP BY season_id
    `;
    console.log(JSON.stringify(teamStats, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkStructure();
