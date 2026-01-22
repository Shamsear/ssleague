import { getTournamentDb } from '../lib/neon/tournament-config';

/**
 * Update round deadlines to enable blind lineup submission
 * Sets the home_fixture phase to be active (current time between lineup_deadline and home_fixture_deadline)
 */

async function updateRoundDeadlines() {
    const sql = getTournamentDb();

    try {
        console.log('🔍 Checking round deadlines for blind lineup fixtures...\n');

        // Get all rounds for Champions League and Pro League
        const rounds = await sql`
      SELECT 
        rd.id,
        rd.tournament_id,
        rd.round_number,
        rd.leg,
        rd.lineup_deadline,
        rd.home_fixture_deadline,
        rd.fixture_entry_deadline,
        rd.result_entry_deadline,
        t.tournament_name,
        NOW() as current_time
      FROM round_deadlines rd
      JOIN tournaments t ON t.id = rd.tournament_id
      WHERE rd.tournament_id IN ('SSPSLS16CH', 'SSPSLS16EL')
      ORDER BY rd.tournament_id, rd.round_number, rd.leg
    `;

        console.log(`Found ${rounds.length} rounds\n`);

        for (const round of rounds) {
            const now = new Date();
            const lineupDeadline = new Date(round.lineup_deadline);
            const homeFixtureDeadline = new Date(round.home_fixture_deadline);
            const fixtureEntryDeadline = new Date(round.fixture_entry_deadline);
            const resultEntryDeadline = new Date(round.result_entry_deadline);

            console.log(`${round.tournament_name} - Round ${round.round_number} (${round.leg}):`);
            console.log(`  Lineup deadline: ${lineupDeadline.toISOString()}`);
            console.log(`  Home fixture deadline: ${homeFixtureDeadline.toISOString()}`);
            console.log(`  Current time: ${now.toISOString()}`);

            // Check current phase
            let currentPhase = '';
            if (now < lineupDeadline) {
                currentPhase = 'lineup_setting';
            } else if (now < homeFixtureDeadline) {
                currentPhase = 'home_fixture';
            } else if (now < fixtureEntryDeadline) {
                currentPhase = 'fixture_entry';
            } else if (now < resultEntryDeadline) {
                currentPhase = 'result_entry';
            } else {
                currentPhase = 'completed';
            }

            console.log(`  Current phase: ${currentPhase}`);

            // If not in home_fixture phase, update deadlines to make it active
            if (currentPhase !== 'home_fixture') {
                console.log(`  ⚠️  Not in home_fixture phase. Updating deadlines...`);

                // Set deadlines to:
                // - lineup_deadline: 1 hour ago
                // - home_fixture_deadline: 7 days from now
                // - fixture_entry_deadline: 14 days from now
                // - result_entry_deadline: 21 days from now

                const newLineupDeadline = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
                const newHomeFixtureDeadline = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
                const newFixtureEntryDeadline = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days from now
                const newResultEntryDeadline = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000); // 21 days from now

                await sql`
          UPDATE round_deadlines
          SET 
            lineup_deadline = ${newLineupDeadline.toISOString()},
            home_fixture_deadline = ${newHomeFixtureDeadline.toISOString()},
            fixture_entry_deadline = ${newFixtureEntryDeadline.toISOString()},
            result_entry_deadline = ${newResultEntryDeadline.toISOString()}
          WHERE id = ${round.id}
        `;

                console.log(`  ✅ Updated deadlines:`);
                console.log(`     Lineup deadline: ${newLineupDeadline.toISOString()}`);
                console.log(`     Home fixture deadline: ${newHomeFixtureDeadline.toISOString()}`);
                console.log(`     Phase is now: home_fixture`);
            } else {
                console.log(`  ✅ Already in home_fixture phase`);
            }

            console.log('');
        }

        console.log('🎉 All rounds updated!\n');
        console.log('📝 Teams can now submit blind lineups during the home_fixture phase.\n');

    } catch (error) {
        console.error('❌ Error:', error);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    updateRoundDeadlines()
        .then(() => {
            console.log('✅ Script completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Script failed:', error);
            process.exit(1);
        });
}

export { updateRoundDeadlines };
