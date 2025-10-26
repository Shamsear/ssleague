import { getFantasyDb } from '../lib/neon/fantasy-config';

async function migrateTeams() {
  try {
    const sql = getFantasyDb();

    console.log('Migrating fantasy teams to new league format...\n');

    // Update teams to use new league ID FIRST (before deleting old league)
    console.log('1. Updating teams to use new league ID (SSPSLFLS16)...');
    const result = await sql`
      UPDATE fantasy_teams 
      SET league_id = 'SSPSLFLS16' 
      WHERE league_id = 'fantasy-SSPSLS16'
      RETURNING *
    `;
    
    console.log(`✅ Updated ${result.length} teams:\n`);
    result.forEach((team: any) => {
      console.log(`- ${team.team_name} (${team.team_id}) -> League: ${team.league_id}`);
    });

    // Now delete the old league with wrong format
    console.log('\n2. Deleting old league format (fantasy-SSPSLS16)...');
    await sql`DELETE FROM fantasy_leagues WHERE league_id = 'fantasy-SSPSLS16'`;
    console.log('✅ Old league deleted');

    console.log('\n✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('Error migrating teams:', error);
    throw error;
  }
}

migrateTeams()
  .then(() => {
    console.log('\nMigration finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nMigration failed:', error);
    process.exit(1);
  });
