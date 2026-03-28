/**
 * PREVIEW: Check contracts that will be updated
 * These players should have contracts from SSPSLS16.5 to SSPSLS18.5 (mid-season 16 to mid-season 18)
 * Currently showing as SSPSLS16 to SSPSLS17
 * 
 * Usage: node scripts/preview-contract-fix.js
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

const PLAYERS_TO_FIX = [
  'Yeray Álvarez',
  'Eric García',
  'Jordan Pickford',
  'Dominik Livaković',
  'Pierre Kalulu',
  'Stefan Savić',
  'Danilo',
  'Federico Gatti',
  'Morten Hjulmand',
  'Y. Ndayishimiye',
  'Franck Kessié',
  'Khéphren Thuram',
  'Ángel Correa',
  'Karim Adeyemi',
  'Karim Benzema',
  'Nick Woltemade',
  'Callum Wilson',
  'D. Calvert-Lewin',
  'Evann Guessand',
  'Fábio Silva',
  'Martin Braithwaite',
  'Kaio Jorge'
];

async function previewContractFix() {
  const sql = neon(process.env.DATABASE_URL);

  console.log('🔍 PREVIEW: Contract Fix for Mid-Season Players\n');
  console.log('='.repeat(70));
  console.log(`Total players to check: ${PLAYERS_TO_FIX.length}\n`);

  try {
    let foundCount = 0;
    let alreadyCorrectCount = 0;
    let notFoundCount = 0;
    const toUpdate = [];

    console.log('📋 Checking each player...\n');

    for (const playerName of PLAYERS_TO_FIX) {
      // Check for contracts with SSPSLS16 to SSPSLS17
      const wrongContracts = await sql`
        SELECT 
          id,
          name,
          contract_start_season,
          contract_end_season
        FROM footballplayers
        WHERE name = ${playerName}
        AND contract_start_season = 'SSPSLS16'
        AND contract_end_season = 'SSPSLS17'
        LIMIT 1
      `;

      if (wrongContracts.length > 0) {
        const player = wrongContracts[0];
        console.log(`✅ ${playerName}`);
        console.log(`   Current: ${player.contract_start_season} to ${player.contract_end_season}`);
        console.log(`   Will change to: SSPSLS16.5 to SSPSLS18.5`);
        console.log(`   Player ID: ${player.id}\n`);
        foundCount++;
        toUpdate.push(player);
        continue;
      }

      // Check if already correct
      const correctContracts = await sql`
        SELECT id
        FROM footballplayers
        WHERE name = ${playerName}
        AND contract_start_season = 'SSPSLS16.5'
        AND contract_end_season = 'SSPSLS18.5'
        LIMIT 1
      `;

      if (correctContracts.length > 0) {
        console.log(`✓ ${playerName} - Already correct (SSPSLS16.5-SSPSLS18.5)\n`);
        alreadyCorrectCount++;
        continue;
      }

      // Not found
      console.log(`❌ ${playerName} - No contract found\n`);
      notFoundCount++;
    }

    console.log('='.repeat(70));
    console.log('\n📊 SUMMARY:\n');
    console.log(`  ✅ Will be updated: ${foundCount}`);
    console.log(`  ✓  Already correct: ${alreadyCorrectCount}`);
    console.log(`  ❌ Not found: ${notFoundCount}`);
    console.log(`  📝 Total checked: ${PLAYERS_TO_FIX.length}\n`);

    if (foundCount > 0) {
      console.log('='.repeat(70));
      console.log('\n🔄 CONTRACTS TO UPDATE:\n');
      toUpdate.forEach((player, index) => {
        console.log(`${index + 1}. ${player.name}`);
        console.log(`   Player ID: ${player.id}`);
        console.log(`   Change: ${player.contract_start_season} to ${player.contract_end_season}`);
        console.log(`        → SSPSLS16.5 to SSPSLS18.5\n`);
      });

      console.log('='.repeat(70));
      console.log('\n✅ Preview complete!');
      console.log('\n💡 To apply these changes, run:');
      console.log('   node scripts/apply-contract-fix.js\n');
    } else {
      console.log('\n✅ No contracts need updating!\n');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.code === 'ENOTFOUND') {
      console.error('\n💡 Network error. Make sure you have internet connection.');
    }
    process.exit(1);
  }
}

previewContractFix();
