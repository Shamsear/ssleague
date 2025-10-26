import { getFantasyDb } from '../lib/neon/fantasy-config';

async function deleteFantasyLeague() {
  try {
    const sql = getFantasyDb();

    console.log('Deleting all fantasy league data...');

    // Delete in reverse order of dependencies to avoid foreign key constraints
    
    console.log('1. Deleting fantasy_leaderboard...');
    await sql`DELETE FROM fantasy_leaderboard`;
    
    console.log('2. Deleting fantasy_player_points...');
    await sql`DELETE FROM fantasy_player_points`;
    
    console.log('3. Deleting fantasy_transfers...');
    await sql`DELETE FROM fantasy_transfers`;
    
    console.log('4. Deleting transfer_windows...');
    await sql`DELETE FROM transfer_windows`;
    
    console.log('5. Deleting fantasy_squad...');
    await sql`DELETE FROM fantasy_squad`;
    
    console.log('6. Deleting fantasy_drafts...');
    await sql`DELETE FROM fantasy_drafts`;
    
    console.log('7. Deleting fantasy_players...');
    await sql`DELETE FROM fantasy_players`;
    
    console.log('8. Deleting fantasy_teams...');
    await sql`DELETE FROM fantasy_teams`;
    
    console.log('9. Deleting fantasy_scoring_rules...');
    await sql`DELETE FROM fantasy_scoring_rules`;
    
    console.log('10. Deleting fantasy_leagues...');
    await sql`DELETE FROM fantasy_leagues`;

    console.log('✅ All fantasy league data deleted successfully!');
    console.log('You can now create a fresh fantasy league.');
    
  } catch (error) {
    console.error('Error deleting fantasy league data:', error);
    throw error;
  }
}

// Run the deletion
deleteFantasyLeague()
  .then(() => {
    console.log('Deletion finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Deletion failed:', error);
    process.exit(1);
  });
