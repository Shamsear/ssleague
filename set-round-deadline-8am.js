const { neon } = require('@neondatabase/serverless');

// Get the tournament database connection
const sql = neon(process.env.TOURNAMENT_DATABASE_URL);

async function setRoundDeadlineTo8AM() {
  try {
    console.log('🔧 Setting round deadlines to 8:00 AM...\n');

    // Get all active round deadlines
    const rounds = await sql`
      SELECT 
        id,
        tournament_id,
        round_number,
        leg,
        deadline,
        status
      FROM round_deadlines
      WHERE status IN ('active', 'pending')
      ORDER BY tournament_id, round_number, leg
    `;

    console.log(`📋 Found ${rounds.length} active/pending rounds\n`);

    if (rounds.length === 0) {
      console.log('✅ No active rounds to update');
      return;
    }

    let updatedCount = 0;

    for (const round of rounds) {
      // Get current deadline
      const currentDeadline = round.deadline ? new Date(round.deadline) : null;
      
      if (!currentDeadline) {
        console.log(`⚠️  Round ${round.round_number} (${round.leg}) - No deadline set, skipping`);
        continue;
      }

      // Create new deadline with same date but 8:00 AM time
      const newDeadline = new Date(currentDeadline);
      newDeadline.setHours(8, 0, 0, 0);

      // Update the deadline
      await sql`
        UPDATE round_deadlines
        SET 
          deadline = ${newDeadline.toISOString()},
          updated_at = NOW()
        WHERE id = ${round.id}
      `;

      updatedCount++;
      
      console.log(`✅ Round ${round.round_number} (${round.leg})`);
      console.log(`   Old: ${currentDeadline.toLocaleString()}`);
      console.log(`   New: ${newDeadline.toLocaleString()}\n`);
    }

    console.log(`\n🎉 Successfully updated ${updatedCount} round deadlines to 8:00 AM`);

  } catch (error) {
    console.error('❌ Error updating round deadlines:', error);
    throw error;
  }
}

// Run the script
setRoundDeadlineTo8AM()
  .then(() => {
    console.log('\n✨ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });
