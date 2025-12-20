/**
 * Check which real teams have fantasy team affiliations
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);
const tournamentDb = neon(process.env.NEON_TOURNAMENT_DB_URL);

async function checkAffiliations() {
  console.log('🔍 Checking Fantasy Team Affiliations...\n');

  try {
    // 1. Get all fantasy teams with their supported teams
    console.log('1️⃣ Fantasy teams and their affiliations:');
    const fantasyTeams = await fantasyDb`
      SELECT 
        team_id,
        team_name,
        owner_name,
        supported_team_id,
        supported_team_name,
        passive_points,
        league_id
      FROM fantasy_teams
      WHERE supported_team_id IS NOT NULL
      ORDER BY team_name
    `;

    console.log(`Found ${fantasyTeams.length} fantasy teams with affiliations:\n`);
    fantasyTeams.forEach(team => {
      console.log(`  ${team.team_name} (${team.owner_name})`);
      console.log(`    → Supports: ${team.supported_team_name} (${team.supported_team_id})`);
      console.log(`    → Passive Points: ${team.passive_points}`);
      console.log('');
    });

    // 2. Get all real teams in the tournament
    console.log('2️⃣ Real teams in tournament:');
    const realTeams = await tournamentDb`
      SELECT DISTINCT
        id,
        team_name
      FROM teams
      WHERE season_id = 'SSPSLS16'
      ORDER BY team_name
    `;

    console.log(`Found ${realTeams.length} real teams:\n`);
    
    // Check which have fantasy affiliations
    const supportedTeamIds = new Set(fantasyTeams.map(t => t.supported_team_id));
    
    realTeams.forEach(team => {
      const hasAffiliation = supportedTeamIds.has(team.id);
      const fantasyCount = fantasyTeams.filter(ft => ft.supported_team_id === team.id).length;
      console.log(`  ${hasAffiliation ? '✅' : '❌'} ${team.team_name} (${team.id}) - ${fantasyCount} fantasy team(s)`);
    });

    // 3. Check team scoring rules
    console.log('\n3️⃣ Checking team scoring rules:');
    const teamRules = await fantasyDb`
      SELECT 
        rule_type,
        points_value,
        applies_to,
        is_active
      FROM fantasy_scoring_rules
      WHERE league_id = 'SSPSLFLS16'
        AND applies_to = 'team'
      ORDER BY rule_type
    `;

    if (teamRules.length === 0) {
      console.log('❌ No team scoring rules configured!');
      console.log('   This is why passive points are not being awarded');
    } else {
      console.log(`✅ Found ${teamRules.length} team scoring rules:\n`);
      teamRules.forEach(rule => {
        console.log(`  ${rule.rule_type}: ${rule.points_value > 0 ? '+' : ''}${rule.points_value} pts (${rule.is_active ? 'active' : 'inactive'})`);
      });
    }

    // 4. Summary
    console.log('\n4️⃣ Summary:');
    console.log(`  Fantasy teams: ${fantasyTeams.length}`);
    console.log(`  Real teams: ${realTeams.length}`);
    console.log(`  Real teams with affiliations: ${supportedTeamIds.size}`);
    console.log(`  Team scoring rules: ${teamRules.length}`);

    if (fantasyTeams.length > 0 && teamRules.length > 0) {
      console.log('\n✅ System is configured for passive points!');
    } else {
      console.log('\n⚠️  System is NOT fully configured:');
      if (fantasyTeams.length === 0) {
        console.log('   - No fantasy teams have selected supported teams');
      }
      if (teamRules.length === 0) {
        console.log('   - No team scoring rules configured');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

checkAffiliations()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
