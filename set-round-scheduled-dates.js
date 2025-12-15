const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const tournamentSql = neon(process.env.NEON_TOURNAMENT_DB_URL);

async function setRoundScheduledDates() {
  try {
    console.log('📅 Setting scheduled dates for rounds 1-13...\n');
    
    // Starting date: December 15, 2025
    const startDate = new Date('2025-12-15');
    
    // Get all rounds 1-13 for all tournaments
    const rounds = await tournamentSql`
      SELECT id, tournament_id, round_number, leg, scheduled_date
      FROM round_deadlines
      WHERE round_number BETWEEN 1 AND 13
      ORDER BY tournament_id, round_number, leg
    `;
    
    console.log(`📊 Found ${rounds.length} rounds to update\n`);
    
    if (rounds.length === 0) {
      console.log('✅ No rounds found!');
      return;
    }
    
    // Group rounds by round_number to assign same date to all tournaments
    const roundsByNumber = {};
    rounds.forEach(round => {
      if (!roundsByNumber[round.round_number]) {
        roundsByNumber[round.round_number] = [];
      }
      roundsByNumber[round.round_number].push(round);
    });
    
    console.log('Scheduled dates to be set:');
    for (let roundNum = 1; roundNum <= 13; roundNum++) {
      const roundDate = new Date(startDate);
      roundDate.setDate(startDate.getDate() + (roundNum - 1));
      console.log(`  Round ${roundNum}: ${roundDate.toDateString()}`);
    }
    
    console.log('\n⚠️  This will update scheduled dates for all rounds 1-13');
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    let updatedCount = 0;
    
    // Update each round
    for (let roundNum = 1; roundNum <= 13; roundNum++) {
      const roundDate = new Date(startDate);
      roundDate.setDate(startDate.getDate() + (roundNum - 1));
      
      // Update all rounds with this round number
      const result = await tournamentSql`
        UPDATE round_deadlines
        SET 
          scheduled_date = ${roundDate.toISOString()},
          updated_at = NOW()
        WHERE round_number = ${roundNum}
      `;
      
      const roundsInThisNumber = roundsByNumber[roundNum]?.length || 0;
      updatedCount += roundsInThisNumber;
      
      console.log(`✅ Round ${roundNum}: ${roundDate.toDateString()} (${roundsInThisNumber} rounds updated)`);
    }
    
    console.log(`\n🎉 Successfully updated ${updatedCount} rounds!\n`);
    
    // Verify the update
    const verification = await tournamentSql`
      SELECT 
        round_number,
        scheduled_date,
        COUNT(*) as count
      FROM round_deadlines
      WHERE round_number BETWEEN 1 AND 13
      GROUP BY round_number, scheduled_date
      ORDER BY round_number
    `;
    
    console.log('📊 Verification:');
    verification.forEach(v => {
      const date = new Date(v.scheduled_date);
      console.log(`   Round ${v.round_number}: ${date.toDateString()} (${v.count} rounds)`);
    });
    
  } catch (error) {
    console.error('❌ Error setting scheduled dates:', error.message);
    throw error;
  }
}

setRoundScheduledDates()
  .then(() => {
    console.log('\n✅ Update complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Update failed:', error);
    process.exit(1);
  });
