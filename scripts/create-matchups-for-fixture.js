/**
 * Manually create matchups for a specific fixture
 * Usage: node scripts/create-matchups-for-fixture.js <fixture_id>
 */

const fixtureId = process.argv[2] || 'SSPSLS16CH_grpB_leg1_r3_m2';

async function createMatchups() {
    const appUrl = 'http://localhost:3000';

    console.log(`🎯 Creating matchups for fixture: ${fixtureId}\n`);

    try {
        const response = await fetch(`${appUrl}/api/fixtures/${fixtureId}/auto-create-matchups`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (response.ok && data.success) {
            console.log('✅ Success!');
            console.log(`   Matchups created: ${data.matchups_created}`);
            console.log(`   Message: ${data.message}`);
            console.log('\n📋 Matchups:');
            data.matchups.forEach((m, i) => {
                console.log(`   ${i + 1}. ${m.home_player_name} vs ${m.away_player_name}`);
            });
        } else {
            console.log('❌ Failed!');
            console.log(`   Error: ${data.error}`);
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

createMatchups().catch(console.error);
