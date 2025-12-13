const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const tournamentSql = neon(process.env.NEON_TOURNAMENT_DB_URL);

async function updateRoundStartTimes() {
  try {
    console.log('🔄 Updating round start times from 14:00 to 08:00...\n');
    
    // Check current rounds with 14:00
    const currentRounds = await tournamentSql`
      SELECT tournament_id, round_number, leg, round_start_time, status
      FROM round_deadlines
      WHERE round_start_time = '14:00'
      ORDER BY tournament_id, round_number, leg
    `;
    
    console.log(`📊 Found ${currentRounds.length} rounds with start time 14:00\n`);
    
    if (currentRounds.length === 0) {
      console.log('✅ No rounds to update!');
      return;
    }
    
    // Show what will be updated
    console.log('Rounds to update:');
    currentRounds.forEach(round => {
      console.log(`  - Tournament: ${round.tournament_id}, Round: ${round.round_number}, Leg: ${round.leg}, Status: ${round.status}`);
    });
    
    console.log('\n⚠️  This will update all these rounds to start at 08:00');
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Update all rounds
    const result = await tournamentSql`
      UPDATE round_deadlines
      SET 
        round_start_time = '08:00',
        updated_at = NOW()
      WHERE round_start_time = '14:00'
    `;
    
    console.log(`\n✅ Successfully updated ${currentRounds.length} rounds!`);
    console.log('All round start times have been changed from 14:00 to 08:00\n');
    
    // Verify the update
    const verification = await tournamentSql`
      SELECT COUNT(*) as count
      FROM round_deadlines
      WHERE round_start_time = '08:00'
    `;
    
    console.log(`📊 Total rounds now with 08:00 start time: ${verification[0].count}`);
    
  } catch (error) {
    console.error('❌ Error updating round start times:', error.message);
    throw error;
  }
}

updateRoundStartTimes()
  .then(() => {
    console.log('\n✅ Update complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Update failed:', error);
    process.exit(1);
  });
