import { fantasySql } from '../lib/neon/fantasy-config';

async function checkAllFantasyTeams() {
  try {
    console.log('Checking all fantasy teams in database...\n');

    const teams = await fantasySql`
      SELECT 
        team_id, 
        real_team_name, 
        owner_uid,
        owner_name, 
        league_id,
        is_enabled,
        budget_remaining,
        created_at
      FROM fantasy_teams
      ORDER BY created_at DESC
    `;

    if (teams.length === 0) {
      console.log('❌ No fantasy teams found in database!');
      process.exit(0);
    }

    console.log(`Found ${teams.length} fantasy team(s):\n`);
    
    teams.forEach((t, idx) => {
      const status = t.is_enabled ? '✅ ENABLED ' : '❌ DISABLED';
      console.log(`${idx + 1}. ${status}`);
      console.log(`   Team: ${t.real_team_name}`);
      console.log(`   Owner: ${t.owner_name}`);
      console.log(`   Owner UID: ${t.owner_uid}`);
      console.log(`   Team ID: ${t.team_id}`);
      console.log(`   League: ${t.league_id}`);
      console.log(`   Budget: ${t.budget_remaining}`);
      console.log(`   Created: ${t.created_at}`);
      console.log('');
    });

    // Count squad members
    console.log('Checking squad sizes...\n');
    for (const team of teams) {
      const squad = await fantasySql`
        SELECT COUNT(*) as count
        FROM fantasy_squad
        WHERE team_id = ${team.team_id}
      `;
      console.log(`  ${team.real_team_name}: ${squad[0].count} players`);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkAllFantasyTeams();
