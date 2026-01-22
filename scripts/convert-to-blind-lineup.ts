import { getTournamentDb } from '../lib/neon/tournament-config';

/**
 * Convert existing Champions League and Pro League fixtures to blind lineup mode
 */

async function convertToBlindLineup() {
    const sql = getTournamentDb();

    try {
        console.log('🚀 Starting conversion to blind lineup mode...\n');

        // Tournament IDs
        const CHAMPIONS_LEAGUE = 'SSPSLS16CH';
        const PRO_LEAGUE = 'SSPSLS16EL';

        // 1. Show current status
        console.log('📊 Current status:');
        const currentStatus = await sql`
      SELECT 
        tournament_id,
        COUNT(*) as total_fixtures,
        SUM(CASE WHEN matchup_mode = 'blind_lineup' THEN 1 ELSE 0 END) as blind_lineup_count,
        SUM(CASE WHEN matchup_mode = 'manual' OR matchup_mode IS NULL THEN 1 ELSE 0 END) as manual_count
      FROM fixtures
      WHERE tournament_id IN (${CHAMPIONS_LEAGUE}, ${PRO_LEAGUE})
      GROUP BY tournament_id
    `;

        currentStatus.forEach(row => {
            const tournamentName = row.tournament_id === CHAMPIONS_LEAGUE ? 'Champions League' : 'Pro League';
            console.log(`  ${tournamentName} (${row.tournament_id}):`);
            console.log(`    Total fixtures: ${row.total_fixtures}`);
            console.log(`    Blind lineup: ${row.blind_lineup_count}`);
            console.log(`    Manual: ${row.manual_count}`);
        });

        // 2. Update Champions League
        console.log('\n🔄 Updating Champions League fixtures...');
        const clResult = await sql`
      UPDATE fixtures
      SET matchup_mode = 'blind_lineup'
      WHERE tournament_id = ${CHAMPIONS_LEAGUE}
        AND (matchup_mode IS NULL OR matchup_mode = 'manual')
    `;
        console.log(`  ✅ Updated ${clResult.count} fixtures`);

        // 3. Update Pro League
        console.log('\n🔄 Updating Pro League fixtures...');
        const plResult = await sql`
      UPDATE fixtures
      SET matchup_mode = 'blind_lineup'
      WHERE tournament_id = ${PRO_LEAGUE}
        AND (matchup_mode IS NULL OR matchup_mode = 'manual')
    `;
        console.log(`  ✅ Updated ${plResult.count} fixtures`);

        // 4. Verify conversion
        console.log('\n✅ Verification:');
        const verification = await sql`
      SELECT 
        tournament_id,
        matchup_mode,
        COUNT(*) as fixture_count,
        SUM(CASE WHEN home_lineup_submitted THEN 1 ELSE 0 END) as home_submitted,
        SUM(CASE WHEN away_lineup_submitted THEN 1 ELSE 0 END) as away_submitted,
        SUM(CASE WHEN lineups_locked THEN 1 ELSE 0 END) as locked
      FROM fixtures
      WHERE tournament_id IN (${CHAMPIONS_LEAGUE}, ${PRO_LEAGUE})
      GROUP BY tournament_id, matchup_mode
      ORDER BY tournament_id, matchup_mode
    `;

        verification.forEach(row => {
            const tournamentName = row.tournament_id === CHAMPIONS_LEAGUE ? 'Champions League' : 'Pro League';
            console.log(`  ${tournamentName} - ${row.matchup_mode}:`);
            console.log(`    Fixtures: ${row.fixture_count}`);
            console.log(`    Home submitted: ${row.home_submitted}`);
            console.log(`    Away submitted: ${row.away_submitted}`);
            console.log(`    Locked: ${row.locked}`);
        });

        // 5. Show sample fixtures
        console.log('\n📋 Sample fixtures:');
        const samples = await sql`
      SELECT 
        tournament_id,
        round_number,
        leg,
        home_team_name,
        away_team_name,
        matchup_mode
      FROM fixtures
      WHERE tournament_id IN (${CHAMPIONS_LEAGUE}, ${PRO_LEAGUE})
      ORDER BY tournament_id, round_number, match_number
      LIMIT 5
    `;

        samples.forEach(fixture => {
            const tournamentName = fixture.tournament_id === CHAMPIONS_LEAGUE ? 'CL' : 'PL';
            console.log(`  [${tournamentName}] R${fixture.round_number} ${fixture.leg}: ${fixture.home_team_name} vs ${fixture.away_team_name} (${fixture.matchup_mode})`);
        });

        console.log('\n🎉 Conversion complete!');
        console.log('\n📝 Next steps:');
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
    convertToBlindLineup()
        .then(() => {
            console.log('✅ Script completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Script failed:', error);
            process.exit(1);
        });
}

export { convertToBlindLineup };
