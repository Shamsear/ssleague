import * as dotenv from 'dotenv';
import * as path from 'path';
import { getTournamentDb } from '../lib/neon/tournament-config';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function fixMatchupsTournamentId() {
    console.log('🔧 Fixing matchups tournament_id...\n');

    const sql = getTournamentDb();

    try {
        // Get all matchups without tournament_id
        const matchupsWithoutTournament = await sql`
      SELECT m.id, m.fixture_id, f.tournament_id
      FROM matchups m
      JOIN fixtures f ON m.fixture_id = f.id
      WHERE m.tournament_id IS NULL
    `;

        console.log(`Found ${matchupsWithoutTournament.length} matchups without tournament_id\n`);

        if (matchupsWithoutTournament.length === 0) {
            console.log('✅ All matchups already have tournament_id!');
            return;
        }

        // Update each matchup
        let updated = 0;
        for (const matchup of matchupsWithoutTournament) {
            await sql`
        UPDATE matchups
        SET tournament_id = ${matchup.tournament_id}
        WHERE id = ${matchup.id}
      `;
            updated++;

            if (updated % 10 === 0) {
                console.log(`  Updated ${updated}/${matchupsWithoutTournament.length}...`);
            }
        }

        console.log(`\n✅ Successfully updated ${updated} matchups with tournament_id!`);

        // Verify
        const remaining = await sql`
      SELECT COUNT(*) as count
      FROM matchups
      WHERE tournament_id IS NULL
    `;

        console.log(`\n📊 Verification:`);
        console.log(`  - Matchups without tournament_id: ${remaining[0].count}`);

        if (remaining[0].count === 0) {
            console.log('\n🎉 All matchups now have tournament_id!');
        } else {
            console.log(`\n⚠️  Warning: ${remaining[0].count} matchups still missing tournament_id`);
        }

    } catch (error) {
        console.error('❌ Error fixing matchups:', error);
        throw error;
    }
}

fixMatchupsTournamentId()
    .then(() => {
        console.log('\n✅ Script completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Script failed:', error);
        process.exit(1);
    });
