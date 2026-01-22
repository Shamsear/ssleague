require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

const tournamentSql = neon(process.env.NEON_TOURNAMENT_DB_URL);

(async () => {
  try {
    console.log('Fixing group assignments for Champions League and Pro League...\n');
    
    // Champions League - 2 groups of 4 teams
    // Group A: Legends, Blue Strikers, Skill 555, FC Barcelona
    // Group B: La Masia FC, Varsity Soccers, Psychoz, Los Galacticos
    
    const clGroupA = ['Legends', 'Blue Strikers', 'Skill 555', 'FC Barcelona'];
    const clGroupB = ['La Masia FC', 'Varsity Soccers', 'Psychoz', 'Los Galacticos'];
    
    console.log('Champions League Groups:');
    console.log('Group A:', clGroupA.join(', '));
    console.log('Group B:', clGroupB.join(', '));
    console.log('');
    
    // Get all CL fixtures
    const clFixtures = await tournamentSql`
      SELECT id, home_team_name, away_team_name, knockout_round
      FROM fixtures
      WHERE tournament_id = 'SSPSLS16CH'
      AND knockout_round IS NULL
    `;
    
    console.log(`Updating ${clFixtures.length} Champions League fixtures...`);
    
    for (const fixture of clFixtures) {
      const homeInA = clGroupA.includes(fixture.home_team_name);
      const awayInA = clGroupA.includes(fixture.away_team_name);
      const homeInB = clGroupB.includes(fixture.home_team_name);
      const awayInB = clGroupB.includes(fixture.away_team_name);
      
      let group = null;
      if (homeInA && awayInA) {
        group = 'A';
      } else if (homeInB && awayInB) {
        group = 'B';
      }
      
      if (group) {
        await tournamentSql`
          UPDATE fixtures
          SET group_name = ${group}
          WHERE id = ${fixture.id}
        `;
        console.log(`  ✓ ${fixture.home_team_name} vs ${fixture.away_team_name} → Group ${group}`);
      } else {
        console.log(`  ⚠️  ${fixture.home_team_name} vs ${fixture.away_team_name} → Likely knockout fixture`);
      }
    }
    
    console.log('\n=== Pro League ===');
    // Pro League - 1 group of 6 teams (round robin)
    const plTeams = ['Portland Timbers', 'Kopites', 'Manchester United', 'Qatar Gladiators', 'Red Hawks Fc', 'Los Blancos'];
    
    console.log('Group A:', plTeams.join(', '));
    console.log('');
    
    const plFixtures = await tournamentSql`
      SELECT id, home_team_name, away_team_name, knockout_round
      FROM fixtures
      WHERE tournament_id = 'SSPSLS16EL'
      AND knockout_round IS NULL
    `;
    
    console.log(`Updating ${plFixtures.length} Pro League fixtures...`);
    
    for (const fixture of plFixtures) {
      const homeInGroup = plTeams.includes(fixture.home_team_name);
      const awayInGroup = plTeams.includes(fixture.away_team_name);
      
      if (homeInGroup && awayInGroup) {
        await tournamentSql`
          UPDATE fixtures
          SET group_name = 'A'
          WHERE id = ${fixture.id}
        `;
        console.log(`  ✓ ${fixture.home_team_name} vs ${fixture.away_team_name} → Group A`);
      } else {
        console.log(`  ⚠️  ${fixture.home_team_name} vs ${fixture.away_team_name} → Likely knockout fixture`);
      }
    }
    
    console.log('\n✅ Group assignments updated!');
    
  } catch (error) {
    console.error('Error:', error);
  }
})();
