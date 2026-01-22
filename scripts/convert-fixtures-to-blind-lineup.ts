import { getTournamentDb } from '@/lib/neon/tournament-config';

/**
 * Script to convert existing fixtures to blind lineup mode
 * Usage: node scripts/convert-fixtures-to-blind-lineup.js
 */

async function convertFixturesToBlindLineup() {
    const sql = getTournamentDb();

    try {
        console.log('🔍 Finding tournaments to convert...\n');

        // Get all tournaments
        const tournaments = await sql`
      SELECT id, tournament_name, status
      FROM tournaments
      ORDER BY tournament_name
    `;

        console.log('Available tournaments:');
        tournaments.forEach((t, idx) => {
            console.log(`  ${idx + 1}. ${t.tournament_name} (${t.status})`);
        });

        // Tournaments to convert (you can modify this list)
        const tournamentsToConvert = [
            'Pro League',
            'Champions League'
        ];

        console.log(`\n📝 Converting these tournaments to blind lineup mode:`);
        tournamentsToConvert.forEach(name => console.log(`  - ${name}`));

        // Get tournament IDs
        const tournamentIds = tournaments
            .filter(t => tournamentsToConvert.includes(t.tournament_name))
            .map(t => t.id);

        if (tournamentIds.length === 0) {
            console.log('\n❌ No matching tournaments found!');
            return;
        }

        console.log(`\n🔍 Found ${tournamentIds.length} tournament(s) to convert\n`);

        // Check existing fixtures
        for (const tournamentId of tournamentIds) {
            const tournament = tournaments.find(t => t.id === tournamentId);

            console.log(`\n📊 ${tournament?.tournament_name}:`);

            // Count fixtures by current mode
            const fixtureCounts = await sql`
        SELECT 
          COALESCE(matchup_mode, 'NULL') as mode,
          COUNT(*) as count
        FROM fixtures
        WHERE tournament_id = ${tournamentId}
        GROUP BY matchup_mode
      `;

            console.log('  Current fixture modes:');
            fixtureCounts.forEach(fc => {
                console.log(`    ${fc.mode}: ${fc.count} fixtures`);
            });

            // Check if any fixtures have matchups already
            const fixturesWithMatchups = await sql`
        SELECT COUNT(DISTINCT f.id) as count
        FROM fixtures f
        INNER JOIN matchups m ON m.fixture_id = f.id
        WHERE f.tournament_id = ${tournamentId}
      `;

            const matchupCount = fixturesWithMatchups[0]?.count || 0;

            if (matchupCount > 0) {
                console.log(`  ⚠️  Warning: ${matchupCount} fixtures already have matchups created`);
                console.log(`     These will be converted but existing matchups will remain`);
            }

            // Update fixtures to blind_lineup mode
            const result = await sql`
        UPDATE fixtures
        SET matchup_mode = 'blind_lineup'
        WHERE tournament_id = ${tournamentId}
          AND (matchup_mode IS NULL OR matchup_mode = 'manual')
      `;

            console.log(`  ✅ Updated ${result.count} fixtures to blind_lineup mode`);
        }

        // Verify the conversion
        console.log('\n\n✅ Conversion complete! Verification:\n');

        for (const tournamentId of tournamentIds) {
            const tournament = tournaments.find(t => t.id === tournamentId);

            const verification = await sql`
        SELECT 
          matchup_mode,
          COUNT(*) as count,
          SUM(CASE WHEN home_lineup_submitted THEN 1 ELSE 0 END) as home_submitted,
          SUM(CASE WHEN away_lineup_submitted THEN 1 ELSE 0 END) as away_submitted,
          SUM(CASE WHEN lineups_locked THEN 1 ELSE 0 END) as locked
        FROM fixtures
        WHERE tournament_id = ${tournamentId}
        GROUP BY matchup_mode
      `;

            console.log(`${tournament?.tournament_name}:`);
            verification.forEach(v => {
                console.log(`  Mode: ${v.matchup_mode || 'NULL'}`);
                console.log(`    Total fixtures: ${v.count}`);
                console.log(`    Home submitted: ${v.home_submitted}`);
                console.log(`    Away submitted: ${v.away_submitted}`);
                console.log(`    Locked: ${v.locked}`);
            });
            console.log('');
        }

        console.log('🎉 All done!\n');
        console.log('Next steps:');
        console.log('  1. Teams can now submit lineups during home fixture phase');
        console.log('  2. Matchups will auto-create when phase ends');
        console.log('  3. Or manually trigger: POST /api/admin/create-blind-matchups\n');

    } catch (error) {
        console.error('❌ Error:', error);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    convertFixturesToBlindLineup()
        .then(() => {
            console.log('✅ Script completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Script failed:', error);
            process.exit(1);
        });
}

export { convertFixturesToBlindLineup };
