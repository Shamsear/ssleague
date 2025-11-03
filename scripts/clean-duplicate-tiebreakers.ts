import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

async function cleanDuplicateTiebreakers() {
  try {
    console.log('🔍 Finding duplicate tiebreakers...\n');
    
    // Find duplicates (same round_id + player_id)
    const duplicates = await sql`
      SELECT 
        round_id,
        player_id,
        COUNT(*) as count,
        ARRAY_AGG(id ORDER BY created_at ASC) as ids,
        MIN(created_at) as first_created
      FROM tiebreakers
      WHERE status = 'active'
      GROUP BY round_id, player_id
      HAVING COUNT(*) > 1
    `;
    
    if (duplicates.length === 0) {
      console.log('✅ No duplicate tiebreakers found');
      return;
    }
    
    console.log(`⚠️  Found ${duplicates.length} set(s) of duplicates:\n`);
    
    for (const dup of duplicates) {
      console.log(`Player ${dup.player_id} in Round ${dup.round_id}:`);
      console.log(`  Total: ${dup.count} tiebreakers`);
      console.log(`  IDs: ${dup.ids.join(', ')}`);
      console.log('');
      
      // Keep the first one (oldest), delete the rest
      const [keepId, ...deleteIds] = dup.ids;
      
      console.log(`  Keeping: ${keepId} (first created)`);
      console.log(`  Deleting: ${deleteIds.join(', ')}`);
      
      // Delete team_tiebreakers for duplicates
      for (const deleteId of deleteIds) {
        await sql`
          DELETE FROM team_tiebreakers
          WHERE tiebreaker_id = ${deleteId}
        `;
        
        await sql`
          DELETE FROM tiebreakers
          WHERE id = ${deleteId}
        `;
        
        console.log(`  ✅ Deleted tiebreaker ${deleteId}`);
      }
      
      console.log('');
    }
    
    console.log('🎉 Cleanup completed!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

cleanDuplicateTiebreakers();
