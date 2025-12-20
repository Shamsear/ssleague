/**
 * Fix Star Ratings and Salaries for Season 16 Players
 * Updates 9 players with incorrect star ratings and recalculates their salaries
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

// Players that need fixing (with correct IDs and auction values)
const PLAYERS_TO_FIX = [
  { player_id: 'sspslpsl0021', name: 'RAHUL KL', currentStar: 3, newStar: 4, points: 120, team: 'Psychoz', auctionValue: 70 },
  { player_id: 'sspslpsl0039', name: 'Safar', currentStar: 4, newStar: 5, points: 145, team: 'Skill 555', auctionValue: 150 },
  { player_id: 'sspslpsl0042', name: 'Anu Anshin', currentStar: 7, newStar: 6, points: 202, team: 'Skill 555', auctionValue: 245 },
  { player_id: 'sspslpsl0032', name: 'Hyder', currentStar: 5, newStar: 6, points: 174, team: 'Manchester United', auctionValue: 225 },
  { player_id: 'sspslpsl0024', name: 'Shamsear', currentStar: 5, newStar: 6, points: 170, team: 'Los Galacticos', auctionValue: 220 },
  { player_id: 'sspslpsl0078', name: 'Umar', currentStar: 6, newStar: 7, points: 215, team: 'Qatar Gladiators', auctionValue: 305 },
  { player_id: 'sspslpsl0050', name: 'Abid Rizwan', currentStar: 6, newStar: 7, points: 206, team: 'Los Galacticos', auctionValue: 245 },
  { player_id: 'sspslpsl0018', name: 'SIRAJ', currentStar: 6, newStar: 7, points: 205, team: 'Manchester United', auctionValue: 260 },
  { player_id: 'sspslpsl0081', name: 'Amjad', currentStar: 6, newStar: 7, points: 205, team: 'FC Barcelona', auctionValue: 285 },
];

async function fixStarRatingsAndSalaries() {
  const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);

  console.log('🔧 Fixing Star Ratings and Salaries for Season 16 Players\n');
  console.log('='.repeat(100));

  try {
    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const player of PLAYERS_TO_FIX) {
      console.log(`\n📝 Processing: ${player.name} (${player.team})`);
      console.log(`   Current: ${player.currentStar}⭐ → New: ${player.newStar}⭐`);
      console.log(`   Points: ${player.points}`);

      try {
        // Get current player data
        const currentData = await sql`
          SELECT 
            player_id,
            player_name,
            auction_value,
            star_rating,
            salary_per_match,
            points,
            team
          FROM player_seasons
          WHERE player_id = ${player.player_id} 
            AND season_id = 'SSPSLS16'
        `;

        if (currentData.length === 0) {
          console.log(`   ❌ Player not found in database`);
          errorCount++;
          results.push({
            player: player.name,
            status: 'ERROR',
            message: 'Player not found',
          });
          continue;
        }

        const current = currentData[0];
        const auctionValue = current.auction_value || 0;
        const oldSalary = parseFloat(current.salary_per_match) || 0;

        // Calculate new salary using formula: (auction_value / 100) * star_rating / 10
        const newSalary = (auctionValue / 100) * player.newStar / 10;

        console.log(`   Auction Value: ${auctionValue} SSCoin`);
        console.log(`   Old Salary: ${oldSalary.toFixed(2)} SSCoin/match`);
        console.log(`   New Salary: ${newSalary.toFixed(2)} SSCoin/match`);
        console.log(`   Salary Change: ${(newSalary - oldSalary > 0 ? '+' : '')}${(newSalary - oldSalary).toFixed(2)} SSCoin/match`);

        // Update the player
        const updateResult = await sql`
          UPDATE player_seasons
          SET 
            star_rating = ${player.newStar},
            salary_per_match = ${newSalary},
            updated_at = NOW()
          WHERE player_id = ${player.player_id} 
            AND season_id = 'SSPSLS16'
          RETURNING player_id, player_name, star_rating, salary_per_match
        `;

        if (updateResult.length > 0) {
          console.log(`   ✅ Successfully updated!`);
          successCount++;
          results.push({
            player: player.name,
            team: player.team,
            status: 'SUCCESS',
            oldStar: player.currentStar,
            newStar: player.newStar,
            auctionValue: auctionValue,
            oldSalary: oldSalary.toFixed(2),
            newSalary: newSalary.toFixed(2),
            salaryChange: (newSalary - oldSalary).toFixed(2),
          });
        } else {
          console.log(`   ❌ Update failed - no rows affected`);
          errorCount++;
          results.push({
            player: player.name,
            status: 'ERROR',
            message: 'No rows updated',
          });
        }

      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        errorCount++;
        results.push({
          player: player.name,
          status: 'ERROR',
          message: error.message,
        });
      }
    }

    // Summary
    console.log('\n\n📊 UPDATE SUMMARY\n');
    console.log('='.repeat(100));
    console.log(`Total Players: ${PLAYERS_TO_FIX.length}`);
    console.log(`✅ Successfully Updated: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);

    // Detailed results
    console.log('\n\n📋 DETAILED RESULTS\n');
    console.log('='.repeat(100));

    const successful = results.filter(r => r.status === 'SUCCESS');
    const failed = results.filter(r => r.status === 'ERROR');

    if (successful.length > 0) {
      console.log('\n✅ Successfully Updated Players:\n');
      successful.forEach((r, idx) => {
        const arrow = r.oldStar < r.newStar ? '↑' : '↓';
        const salaryArrow = parseFloat(r.salaryChange) > 0 ? '↑' : '↓';
        console.log(`${idx + 1}. ${r.player} (${r.team})`);
        console.log(`   Star Rating: ${r.oldStar}⭐ → ${r.newStar}⭐ ${arrow}`);
        console.log(`   Auction Value: ${r.auctionValue} SSCoin`);
        console.log(`   Salary: ${r.oldSalary} → ${r.newSalary} SSCoin/match ${salaryArrow} (${r.salaryChange > 0 ? '+' : ''}${r.salaryChange})`);
        console.log('');
      });
    }

    if (failed.length > 0) {
      console.log('\n❌ Failed Updates:\n');
      failed.forEach((r, idx) => {
        console.log(`${idx + 1}. ${r.player}: ${r.message}`);
      });
    }

    // Calculate total salary impact
    if (successful.length > 0) {
      const totalSalaryChange = successful.reduce((sum, r) => sum + parseFloat(r.salaryChange), 0);
      console.log('\n💰 TOTAL SALARY IMPACT\n');
      console.log('='.repeat(100));
      console.log(`Total Salary Change: ${totalSalaryChange > 0 ? '+' : ''}${totalSalaryChange.toFixed(2)} SSCoin per match`);
      console.log(`\nIf 10 matches remaining:`);
      console.log(`  Total Impact: ${totalSalaryChange > 0 ? '+' : ''}${(totalSalaryChange * 10).toFixed(2)} SSCoin`);
      console.log(`\nIf 5 matches remaining:`);
      console.log(`  Total Impact: ${totalSalaryChange > 0 ? '+' : ''}${(totalSalaryChange * 5).toFixed(2)} SSCoin`);
    }

    // Verify the updates
    console.log('\n\n🔍 VERIFICATION\n');
    console.log('='.repeat(100));
    console.log('Checking updated players...\n');

    for (const player of PLAYERS_TO_FIX) {
      const verified = await sql`
        SELECT player_name, star_rating, salary_per_match, points
        FROM player_seasons
        WHERE player_id = ${player.player_id} AND season_id = 'SSPSLS16'
      `;

      if (verified.length > 0) {
        const v = verified[0];
        const isCorrect = v.star_rating === player.newStar;
        console.log(`${isCorrect ? '✅' : '❌'} ${v.player_name}: ${v.star_rating}⭐ (Salary: ${parseFloat(v.salary_per_match).toFixed(2)})`);
      }
    }

  } catch (error) {
    console.error('\n❌ Fatal Error:', error);
    process.exit(1);
  }
}

// Run the fix
fixStarRatingsAndSalaries()
  .then(() => {
    console.log('\n\n✅ All updates completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
