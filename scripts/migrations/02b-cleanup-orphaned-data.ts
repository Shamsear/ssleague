/**
 * PHASE 2B: Cleanup Orphaned Data
 * 
 * Remove or fix data that references tournaments that don't exist
 */

import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

// Load environment variables
config({ path: '.env.local' });

async function cleanupOrphanedData() {
  const sql = neon(process.env.NEON_TOURNAMENT_DB_URL!);

  console.log('🧹 Starting Orphaned Data Cleanup');
  console.log('==================================\n');

  try {
    // Find all unique tournament_ids in use
    const usedTournaments = await sql`
      SELECT DISTINCT tournament_id FROM (
        SELECT tournament_id FROM fixtures WHERE tournament_id IS NOT NULL
        UNION
        SELECT tournament_id FROM realplayerstats WHERE tournament_id IS NOT NULL
        UNION
        SELECT tournament_id FROM teamstats WHERE tournament_id IS NOT NULL
        UNION
        SELECT tournament_id FROM tournament_settings WHERE tournament_id IS NOT NULL
      ) as used
    `;

    console.log(`Found ${usedTournaments.length} unique tournament_ids in use:\n`);
    usedTournaments.forEach((t: any) => console.log(`  - ${t.tournament_id}`));
    console.log('');

    // Check which tournaments exist
    const existingTournaments = await sql`
      SELECT id FROM tournaments
    `;

    const existingIds = new Set(existingTournaments.map((t: any) => t.id));
    console.log(`\nExisting tournaments in database:`);
    existingTournaments.forEach((t: any) => console.log(`  - ${t.id}`));
    console.log('');

    // Find orphaned tournament_ids
    const orphaned = usedTournaments.filter((t: any) => !existingIds.has(t.tournament_id));
    
    if (orphaned.length > 0) {
      console.log(`⚠️  Found ${orphaned.length} orphaned tournament_ids:\n`);
      orphaned.forEach((t: any) => console.log(`  - ${t.tournament_id}`));
      console.log('');

      // Create missing tournaments
      for (const t of orphaned) {
        const tournamentId = t.tournament_id;
        const seasonId = tournamentId.replace('-LEAGUE', '').replace('-CUP', '').replace('-UCL', '').replace('-UEL', '');
        
        console.log(`Creating missing tournament: ${tournamentId}`);
        
        await sql`
          INSERT INTO tournaments (
            id,
            season_id,
            tournament_type,
            tournament_name,
            tournament_code,
            status,
            is_primary,
            display_order
          ) VALUES (
            ${tournamentId},
            ${seasonId},
            'league',
            ${seasonId} || ' League',
            'PL',
            'completed',
            true,
            1
          )
          ON CONFLICT (season_id, tournament_type) DO NOTHING
        `;
        
        console.log(`✅ Created tournament: ${tournamentId}\n`);
      }
    } else {
      console.log('✅ No orphaned data found!\n');
    }

    console.log('==================================');
    console.log('✨ Cleanup Complete!');
    console.log('==================================\n');

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    throw error;
  }
}

// Run the cleanup
cleanupOrphanedData()
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Failed:', error);
    process.exit(1);
  });
