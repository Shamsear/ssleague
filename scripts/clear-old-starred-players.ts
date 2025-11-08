import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const sql = neon(process.env.NEON_DATABASE_URL!);

async function clearOldStarredPlayers() {
  console.log('🧹 Clearing old starred_players entries with Firebase UIDs...');
  
  try {
    // Delete all existing entries (they have Firebase UIDs which don't match Neon team_ids)
    const result = await sql`DELETE FROM starred_players`;
    console.log(`✅ Deleted ${result.length || 0} old entries`);
    
    // Update the comment to reflect the correct usage
    await sql`COMMENT ON COLUMN starred_players.team_id IS 'Neon team_id (e.g., SSPSLT0001) - NOT Firebase UID'`;
    console.log('✅ Updated column comment');
    
    console.log('\n✨ Migration complete!');
    console.log('👉 Teams will need to re-star their players');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

clearOldStarredPlayers();
