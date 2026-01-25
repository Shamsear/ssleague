/**
 * Script to manually trigger blind lineup matchup creation
 * 
 * Run this with: node scripts/create-blind-matchups.js
 * 
 * This will check all blind_lineup fixtures where both teams have submitted
 * and automatically create the matchups.
 */

require('dotenv').config({ path: '.env.local' });

async function createBlindMatchups() {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    console.log('🔍 Checking for blind lineup fixtures ready for matchup creation...\n');
    console.log('='.repeat(70));

    try {
        const response = await fetch(`${appUrl}/api/admin/create-blind-matchups`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            console.error('❌ Failed to call API:', response.status, response.statusText);
            const errorText = await response.text();
            console.error('Error details:', errorText);
            return;
        }

        const data = await response.json();

        console.log('\n📊 Results:');
        console.log(`   Fixtures processed: ${data.fixtures_processed}`);
        console.log(`   ✅ Success: ${data.success_count}`);
        console.log(`   ❌ Errors: ${data.error_count}`);

        if (data.results && data.results.length > 0) {
            console.log('\n📋 Details:');
            data.results.forEach(result => {
                if (result.status === 'success') {
                    console.log(`   ✅ ${result.home_team} vs ${result.away_team}`);
                    console.log(`      Round ${result.round} (${result.leg})`);
                    console.log(`      Created ${result.matchups_created} matchups`);
                } else {
                    console.log(`   ❌ Fixture ${result.fixture_id}`);
                    console.log(`      Error: ${result.error}`);
                }
            });
        }

        console.log('\n' + '='.repeat(70));
        console.log('✅ Done!');

    } catch (error) {
        console.error('❌ Error:', error);
        console.error(error.stack);
    }
}

// Run the script
createBlindMatchups().catch(console.error);
