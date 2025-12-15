const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const tournamentSql = neon(process.env.NEON_TOURNAMENT_DB_URL);

async function updateRoundStartTimes() {
  try {
    console.log('🔄 Updating round start times and away fixture deadlines...\n');
    
    // Check current rounds with 14:00
    const currentRounds = await tournamentSql`
      SELECT tournament_id, round_number, leg, round_start_time, away_fixture_deadline_time, status
      FROM round_deadlines
      WHERE round_start_time = '14:00' OR away_fixture_deadline_time != '20:00'
      ORDER BY tournament_id, round_number, leg
    `;
    
    console.log(`📊 Found ${currentRounds.length} rounds to update\n`);
    
    if (currentRounds.length === 0) {
      console.log('✅ No rounds to update!');
      return;
    }
    
    // Show what will be updated
    console.log('Rounds to update:');
    currentRounds.forEach(round => {
      console.log(`  - Tournament: ${round.tournament_id}, Round: ${round.round_number}, Leg: ${round.leg}`);
      console.log(`    Current: Start=${round.round_start_time}, Away Deadline=${round.away_fixture_deadline_time}`);
      console.log(`    New: Start=08:00, Away Deadline=20:00`);
    });
    
    console.log('\n⚠️  This will update:');
    console.log('   - Round start times to 08:00');
    console.log('   - Away fixture deadlines to 20:00');
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Update all rounds
    const result = await tournamentSql`
      UPDATE round_deadlines
      SET 
        round_start_time = '08:00',
        away_fixture_deadline_time = '20:00',
        updated_at = NOW()
      WHERE round_start_time = '14:00' OR away_fixture_deadline_time != '20:00'
    `;
    
    console.log(`\n✅ Successfully updated ${currentRounds.length} rounds!`);
    console.log('Changes applied:');
    console.log('  - Round start times: 14:00 → 08:00');
    console.log('  - Away fixture deadlines: → 20:00\n');
    
    // Verify the update
    const verification = await tournamentSql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE round_start_time = '08:00') as start_08,
        COUNT(*) FILTER (WHERE away_fixture_deadline_time = '20:00') as away_20
      FROM round_deadlines
    `;
    
    console.log(`📊 Verification:`);
    console.log(`   Total rounds: ${verification[0].total}`);
    console.log(`   Rounds with 08:00 start: ${verification[0].start_08}`);
    console.log(`   Rounds with 20:00 away deadline: ${verification[0].away_20}`);
    
  } catch (error) {
    console.error('❌ Error updating round times:', error.message);
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
