import { getFantasyDb } from '../lib/neon/fantasy-config';

async function migrateAllReferences() {
  try {
    const sql = getFantasyDb();

    console.log('Migrating all references to new league ID format (SSPSLFLS16)...\n');

    // 1. Fantasy Teams
    console.log('1. Updating fantasy_teams...');
    const teams = await sql`
      UPDATE fantasy_teams 
      SET league_id = 'SSPSLFLS16' 
      WHERE league_id = 'fantasy-SSPSLS16'
      RETURNING team_id, team_name
    `;
    console.log(`✅ Updated ${teams.length} teams`);

    // 2. Fantasy Players
    console.log('\n2. Updating fantasy_players...');
    const players = await sql`
      UPDATE fantasy_players 
      SET league_id = 'SSPSLFLS16' 
      WHERE league_id = 'fantasy-SSPSLS16'
      RETURNING player_name
    `;
    console.log(`✅ Updated ${players.length} players`);

    // 3. Fantasy Drafts
    console.log('\n3. Updating fantasy_drafts...');
    const drafts = await sql`
      UPDATE fantasy_drafts 
      SET league_id = 'SSPSLFLS16' 
      WHERE league_id = 'fantasy-SSPSLS16'
      RETURNING player_name
    `;
    console.log(`✅ Updated ${drafts.length} drafts`);

    // 4. Fantasy Squad
    console.log('\n4. Updating fantasy_squad...');
    const squad = await sql`
      UPDATE fantasy_squad 
      SET league_id = 'SSPSLFLS16' 
      WHERE league_id = 'fantasy-SSPSLS16'
      RETURNING player_name
    `;
    console.log(`✅ Updated ${squad.length} squad entries`);

    // 5. Transfer Windows
    console.log('\n5. Updating transfer_windows...');
    const windows = await sql`
      UPDATE transfer_windows 
      SET league_id = 'SSPSLFLS16' 
      WHERE league_id = 'fantasy-SSPSLS16'
      RETURNING window_name
    `;
    console.log(`✅ Updated ${windows.length} transfer windows`);

    // 6. Fantasy Transfers
    console.log('\n6. Updating fantasy_transfers...');
    const transfers = await sql`
      UPDATE fantasy_transfers 
      SET league_id = 'SSPSLFLS16' 
      WHERE league_id = 'fantasy-SSPSLS16'
      RETURNING player_in_name
    `;
    console.log(`✅ Updated ${transfers.length} transfers`);

    // 7. Fantasy Player Points
    console.log('\n7. Updating fantasy_player_points...');
    const points = await sql`
      UPDATE fantasy_player_points 
      SET league_id = 'SSPSLFLS16' 
      WHERE league_id = 'fantasy-SSPSLS16'
      RETURNING player_name
    `;
    console.log(`✅ Updated ${points.length} player points records`);

    // 8. Fantasy Leaderboard
    console.log('\n8. Updating fantasy_leaderboard...');
    const leaderboard = await sql`
      UPDATE fantasy_leaderboard 
      SET league_id = 'SSPSLFLS16' 
      WHERE league_id = 'fantasy-SSPSLS16'
      RETURNING team_name
    `;
    console.log(`✅ Updated ${leaderboard.length} leaderboard entries`);

    // 9. Fantasy Scoring Rules
    console.log('\n9. Updating fantasy_scoring_rules...');
    const rules = await sql`
      UPDATE fantasy_scoring_rules 
      SET league_id = 'SSPSLFLS16' 
      WHERE league_id = 'fantasy-SSPSLS16'
      RETURNING rule_type
    `;
    console.log(`✅ Updated ${rules.length} scoring rules`);

    // 10. Delete old league
    console.log('\n10. Deleting old league format (fantasy-SSPSLS16)...');
    try {
      await sql`DELETE FROM fantasy_leagues WHERE league_id = 'fantasy-SSPSLS16'`;
      console.log('✅ Old league deleted');
    } catch (error) {
      console.log('⚠️  Old league already deleted or doesn\'t exist');
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('\nSummary:');
    console.log(`- Teams: ${teams.length}`);
    console.log(`- Players: ${players.length}`);
    console.log(`- Drafts: ${drafts.length}`);
    console.log(`- Squad: ${squad.length}`);
    console.log(`- Windows: ${windows.length}`);
    console.log(`- Transfers: ${transfers.length}`);
    console.log(`- Points: ${points.length}`);
    console.log(`- Leaderboard: ${leaderboard.length}`);
    console.log(`- Rules: ${rules.length}`);
    
  } catch (error) {
    console.error('Error migrating references:', error);
    throw error;
  }
}

migrateAllReferences()
  .then(() => {
    console.log('\nMigration finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nMigration failed:', error);
    process.exit(1);
  });
