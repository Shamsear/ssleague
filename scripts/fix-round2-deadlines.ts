import { getTournamentDb } from '../lib/neon/tournament-config';

/**
 * Fix Round 2 deadlines for Champions League to enable blind lineup submission
 */

async function fixRound2Deadlines() {
    const sql = getTournamentDb();

    try {
        console.log('🔧 Fixing Round 2 deadlines for Champions League...\n');

        // Get current Round 2 deadlines
        const rounds = await sql`
      SELECT *
      FROM round_deadlines
      WHERE tournament_id = 'SSPSLS16CH'
        AND round_number = 2
        AND leg = 'first'
    `;

        if (rounds.length === 0) {
            console.log('❌ Round 2 not found!');
            return;
        }

        const round = rounds[0];
        console.log('Current Round 2 deadlines:');
        console.log('  Scheduled date:', round.scheduled_date);
        console.log('  Lineup deadline:', round.lineup_deadline);
        console.log('  Home fixture deadline:', round.home_fixture_deadline);
        console.log('  Fixture entry deadline:', round.fixture_entry_deadline);
        console.log('  Result entry deadline:', round.result_entry_deadline);
        console.log('  Status:', round.status);

        // Calculate new deadlines
        const now = new Date();
        console.log('\n📅 Current time:', now.toISOString());
        console.log('   Current time IST:', now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));

        // Set new deadlines:
        // - Lineup deadline: 1 hour ago (so we're past it)
        // - Home fixture deadline: 24 hours from now (plenty of time to submit)
        // - Fixture entry deadline: 48 hours from now
        // - Result entry deadline: 72 hours from now

        const newLineupDeadline = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
        const newHomeFixtureDeadline = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now
        const newFixtureEntryDeadline = new Date(now.getTime() + 48 * 60 * 60 * 1000); // 48 hours from now
        const newResultEntryDeadline = new Date(now.getTime() + 72 * 60 * 60 * 1000); // 72 hours from now

        console.log('\n✨ New deadlines:');
        console.log('  Lineup deadline:', newLineupDeadline.toISOString());
        console.log('    IST:', newLineupDeadline.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
        console.log('  Home fixture deadline:', newHomeFixtureDeadline.toISOString());
        console.log('    IST:', newHomeFixtureDeadline.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
        console.log('  Fixture entry deadline:', newFixtureEntryDeadline.toISOString());
        console.log('    IST:', newFixtureEntryDeadline.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
        console.log('  Result entry deadline:', newResultEntryDeadline.toISOString());
        console.log('    IST:', newResultEntryDeadline.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));

        // Update the deadlines
        await sql`
      UPDATE round_deadlines
      SET 
        lineup_deadline = ${newLineupDeadline.toISOString()},
        home_fixture_deadline = ${newHomeFixtureDeadline.toISOString()},
        fixture_entry_deadline = ${newFixtureEntryDeadline.toISOString()},
        result_entry_deadline = ${newResultEntryDeadline.toISOString()},
        status = 'active'
      WHERE tournament_id = 'SSPSLS16CH'
        AND round_number = 2
        AND leg = 'first'
    `;

        console.log('\n✅ Round 2 deadlines updated!');
        console.log('\n🎯 Current phase should now be: home_fixture');
        console.log('   Teams have 24 hours to submit blind lineups!');
        console.log('\n📝 Refresh the fixture page to see the blind lineup UI.\n');

    } catch (error) {
        console.error('❌ Error:', error);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    fixRound2Deadlines()
        .then(() => {
            console.log('✅ Script completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Script failed:', error);
            process.exit(1);
        });
}

export { fixRound2Deadlines };
