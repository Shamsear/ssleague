/**
 * Diagnostic script to check round statuses in the database
 * Run with: node check-round-statuses.js
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkRoundStatuses() {
  try {
    console.log('🔍 Checking round statuses...\n');

    const sql = neon(process.env.DATABASE_URL);

    // Get all rounds with their statuses
    const rounds = await sql`
      SELECT 
        id,
        position,
        round_number,
        status,
        season_id,
        created_at,
        end_time,
        finalization_mode
      FROM rounds
      ORDER BY created_at DESC
      LIMIT 50
    `;

    console.log(`Found ${rounds.length} rounds:\n`);

    // Group by status
    const byStatus = {};
    rounds.forEach(round => {
      if (!byStatus[round.status]) {
        byStatus[round.status] = [];
      }
      byStatus[round.status].push(round);
    });

    // Display grouped results
    Object.keys(byStatus).forEach(status => {
      console.log(`\n📊 Status: "${status}" (${byStatus[status].length} rounds)`);
      console.log('─'.repeat(60));
      byStatus[status].forEach(round => {
        console.log(`  Round ${round.id} - ${round.position} - Season: ${round.season_id} - Created: ${new Date(round.created_at).toLocaleDateString()}`);
      });
    });

    console.log('\n\n✅ Summary:');
    Object.keys(byStatus).forEach(status => {
      console.log(`  ${status}: ${byStatus[status].length} rounds`);
    });

    // Check active season
    console.log('\n\n🔍 Checking active season...');
    const activeSeasons = await sql`
      SELECT id, name, "isActive"
      FROM seasons
      WHERE "isActive" = true
    `;
    
    if (activeSeasons.length > 0) {
      console.log(`\n✅ Active Season: ${activeSeasons[0].id} - ${activeSeasons[0].name}`);
      
      // Count rounds for active season
      const activeSeasonRounds = rounds.filter(r => r.season_id === activeSeasons[0].id);
      console.log(`   Rounds in active season: ${activeSeasonRounds.length}`);
      console.log(`   Completed rounds in active season: ${activeSeasonRounds.filter(r => r.status === 'completed').length}`);
    } else {
      console.log('\n⚠️ No active season found!');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkRoundStatuses();
