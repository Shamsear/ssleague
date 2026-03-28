/**
 * APPLY: Fix contracts for players signed mid-season 16
 * These players should have contracts from SSPSLS16.5 to SSPSLS18.5 (mid-season 16 to mid-season 18)
 * Currently incorrectly saved as SSPSLS16 to SSPSLS17
 * 
 * Usage: node scripts/apply-contract-fix.js
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

async function applyContractFix() {
  const sql = neon(process.env.DATABASE_URL);

  console.log('🔧 APPLYING: Contract Fix for Mid-Season Players\n');
  console.log('='.repeat(70));
  console.log(`Total players to process: ${PLAYERS_TO_FIX.length}\n`);

  try {
    let updatedCount = 0;
    let alreadyCorrectCount = 0;
    let notFoundCount = 0;
    const updated = [];

    console.log('⏳ Processing contracts...\n');

    for (const playerName of PLAYERS_TO_FIX) {
      // Find players with SSPSLS16 to SSPSLS17
      const players = await sql`
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

      if (players.length === 0) {
        // Check if already correct
        const correctPlayers = await sql`
          SELECT id
          FROM footballplayers
          WHERE name = ${playerName}
          AND contract_start_season = 'SSPSLS16.5'
          AND contract_end_season = 'SSPSLS18.5'
          LIMIT 1
        `;

        if (correctPlayers.length > 0) {
          console.log(`✓ ${playerName} - Already correct (SSPSLS16.5-SSPSLS18.5)`);
          alreadyCorrectCount++;
        } else {
          console.log(`✗ ${playerName} - No contract found with SSPSLS16-SSPSLS17`);
          notFoundCount++;
        }
        continue;
      }

      const player = players[0];

      // Update the contract
      await sql`
        UPDATE footballplayers
        SET 
          contract_start_season = 'SSPSLS16.5',
          contract_end_season = 'SSPSLS18.5'
        WHERE id = ${player.id}
      `;

      console.log(`✅ ${playerName} - Updated from SSPSLS16-SSPSLS17 to SSPSLS16.5-SSPSLS18.5`);
      updatedCount++;
      updated.push(player);
    }

    console.log('\n' + '='.repeat(70));
    console.log('\n📊 SUMMARY:\n');
    console.log(`  ✅ Updated: ${updatedCount}`);
    console.log(`  ✓  Already correct: ${alreadyCorrectCount}`);
    console.log(`  ✗  Not found: ${notFoundCount}`);
    console.log(`  📝 Total processed: ${PLAYERS_TO_FIX.length}\n`);

    if (updatedCount > 0) {
      console.log('='.repeat(70));
      console.log('\n🔍 Verifying changes...\n');

      for (const player of updated) {
        const verified = await sql`
          SELECT 
            name,
            contract_start_season,
            contract_end_season
          FROM footballplayers
          WHERE id = ${player.id}
        `;

        if (verified.length > 0) {
          const v = verified[0];
          const isCorrect = v.contract_start_season === 'SSPSLS16.5' && v.contract_end_season === 'SSPSLS18.5';
          console.log(`${isCorrect ? '✅' : '❌'} ${v.name}: ${v.contract_start_season} to ${v.contract_end_season}`);
        }
      }

      console.log('\n' + '='.repeat(70));
      console.log('\n✅ Contract fix completed successfully!\n');
    } else {
      console.log('\n✅ No contracts needed updating!\n');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.code === 'ENOTFOUND') {
      console.error('\n💡 Network error. Make sure you have internet connection.');
    }
    process.exit(1);
  }
}

applyContractFix();
