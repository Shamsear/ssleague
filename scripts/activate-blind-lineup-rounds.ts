import { getTournamentDb } from '../lib/neon/tournament-config';

/**
 * Activate rounds for blind lineup tournaments
 * Sets round status to 'active' so teams can submit lineups
 */

async function activateBlindLineupRounds() {
    const sql = getTournamentDb();

    try {
        console.log('🔍 Finding rounds for blind lineup tournaments...\n');

        // Get all rounds for Champions League and Pro League
        const rounds = await sql`
      SELECT 
        rd.id,
        rd.tournament_id,
        rd.season_id,
        rd.round_number,
        rd.leg,
        rd.status,
        rd.scheduled_date,
        rd.home_fixture_deadline_time,
        t.tournament_name
      FROM round_deadlines rd
      JOIN tournaments t ON t.id = rd.tournament_id
      WHERE rd.tournament_id IN ('SSPSLS16CH', 'SSPSLS16EL')
      ORDER BY rd.tournament_id, rd.round_number, rd.leg
    `;

        console.log(`Found ${rounds.length} rounds\n`);

        for (const round of rounds) {
            console.log(`${round.tournament_name} - Round ${round.round_number} (${round.leg}):`);
            console.log(`  Current status: ${round.status}`);
            console.log(`  Scheduled date: ${round.scheduled_date}`);

            if (round.status !== 'active' && round.status !== 'in_progress') {
                console.log(`  ⚠️  Status is not active. Updating to 'active'...`);

                await sql`
          UPDATE round_deadlines
          SET status = 'active'
          WHERE id = ${round.id}
        `;

                console.log(`  ✅ Status updated to 'active'`);
            } else {
                console.log(`  ✅ Already active`);
            }

            console.log('');
        }

        console.log('🎉 All rounds activated!\n');
        console.log('📝 Teams can now access the blind lineup submission UI.\n');
        console.log('💡 Make sure the current time is within the home_fixture phase:\n');
        console.log('   - After lineup_deadline');
        console.log('   - Before home_fixture_deadline\n');

    } catch (error) {
        console.error('❌ Error:', error);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    activateBlindLineupRounds()
        .then(() => {
            console.log('✅ Script completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Script failed:', error);
            process.exit(1);
        });
}

export { activateBlindLineupRounds };
