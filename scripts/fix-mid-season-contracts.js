/**
 * Fix contracts for players signed mid-season 16
 * These players should have contracts from 16.5 to 18.5 (mid-season 16 to mid-season 18)
 * Currently incorrectly saved as 16-17
 * 
 * Usage:
 * node scripts/fix-mid-season-contracts.js preview  - Preview changes only
 * node scripts/fix-mid-season-contracts.js apply    - Apply the changes
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

const MODE = process.argv[2] || 'preview'; // 'preview' or 'apply'

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

async function fixMidSeasonContracts() {
  const sql = neon(process.env.DATABASE_URL);

  console.log('🔧 Fixing mid-season contracts...\n');
  console.log(`Players to fix: ${PLAYERS_TO_FIX.length}\n`);

  try {
    // First, let's check current contract status
    console.log('📊 Current contract status:\n');
    
    for (const playerName of PLAYERS_TO_FIX) {
      const contracts = await sql`
        SELECT 
          pc.id,
          pc.player_id,
          fp.name as player_name,
          pc.team_id,
          pc.contract_start,
          pc.contract_end,
          pc.season_id,
          pc.created_at
        FROM player_contracts pc
        JOIN footballplayers fp ON pc.player_id = fp.id
        WHERE fp.name = ${playerName}
        ORDER BY pc.created_at DESC
        LIMIT 1
      `;

      if (contracts.length > 0) {
        const contract = contracts[0];
        console.log(`✓ ${playerName}`);
        console.log(`  Current: ${contract.contract_start} to ${contract.contract_end}`);
        console.log(`  Team: ${contract.team_id}, Season: ${contract.season_id}`);
        console.log(`  Contract ID: ${contract.id}\n`);
      } else {
        console.log(`✗ ${playerName} - No contract found\n`);
      }
    }

    // Ask for confirmation
    console.log('\n⚠️  This will update contracts from "16-17" to "16.5-18.5"');
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
    
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('🔄 Updating contracts...\n');

    let updatedCount = 0;
    let notFoundCount = 0;
    let alreadyCorrectCount = 0;

    for (const playerName of PLAYERS_TO_FIX) {
      // Find the player's contract
      const contracts = await sql`
        SELECT 
          pc.id,
          pc.player_id,
          fp.name as player_name,
          pc.contract_start,
          pc.contract_end
        FROM player_contracts pc
        JOIN footballplayers fp ON pc.player_id = fp.id
        WHERE fp.name = ${playerName}
        AND pc.contract_start = '16'
        AND pc.contract_end = '17'
        ORDER BY pc.created_at DESC
        LIMIT 1
      `;

      if (contracts.length === 0) {
        // Check if already correct
        const correctContracts = await sql`
          SELECT pc.id
          FROM player_contracts pc
          JOIN footballplayers fp ON pc.player_id = fp.id
          WHERE fp.name = ${playerName}
          AND pc.contract_start = '16.5'
          AND pc.contract_end = '18.5'
          LIMIT 1
        `;

        if (correctContracts.length > 0) {
          console.log(`✓ ${playerName} - Already correct (16.5-18.5)`);
          alreadyCorrectCount++;
        } else {
          console.log(`✗ ${playerName} - No contract found with 16-17`);
          notFoundCount++;
        }
        continue;
      }

      const contract = contracts[0];

      // Update the contract
      await sql`
        UPDATE player_contracts
        SET 
          contract_start = '16.5',
          contract_end = '18.5',
          updated_at = NOW()
        WHERE id = ${contract.id}
      `;

      console.log(`✅ ${playerName} - Updated from 16-17 to 16.5-18.5`);
      updatedCount++;
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Summary:');
    console.log(`  ✅ Updated: ${updatedCount}`);
    console.log(`  ✓ Already correct: ${alreadyCorrectCount}`);
    console.log(`  ✗ Not found: ${notFoundCount}`);
    console.log(`  📝 Total processed: ${PLAYERS_TO_FIX.length}`);
    console.log('='.repeat(60));

    // Verify the changes
    console.log('\n🔍 Verifying changes...\n');
    
    for (const playerName of PLAYERS_TO_FIX) {
      const contracts = await sql`
        SELECT 
          pc.contract_start,
          pc.contract_end
        FROM player_contracts pc
        JOIN footballplayers fp ON pc.player_id = fp.id
        WHERE fp.name = ${playerName}
        ORDER BY pc.created_at DESC
        LIMIT 1
      `;

      if (contracts.length > 0) {
        const contract = contracts[0];
        const isCorrect = contract.contract_start === '16.5' && contract.contract_end === '18.5';
        console.log(`${isCorrect ? '✅' : '❌'} ${playerName}: ${contract.contract_start}-${contract.contract_end}`);
      }
    }

    console.log('\n✅ Contract fix completed!');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixMidSeasonContracts();
