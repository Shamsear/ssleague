/**
 * Check for old passive points records without breakdown data
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);

async function checkOldRecords() {
  console.log('🔍 Checking for Old Passive Points Records...\n');

  try {
    // Check for records with null or empty breakdown
    const recordsWithoutBreakdown = await fantasyDb`
      SELECT 
        id,
        team_id,
        round_number,
        total_bonus,
        bonus_breakdown,
        calculated_at
      FROM fantasy_team_bonus_points
      WHERE bonus_breakdown IS NULL 
         OR bonus_breakdown::text = '{}'
         OR bonus_breakdown::text = 'null'
      ORDER BY calculated_at DESC
    `;

    console.log(`Found ${recordsWithoutBreakdown.length} records without breakdown data\n`);

    if (recordsWithoutBreakdown.length > 0) {
      console.log('Sample records:');
      recordsWithoutBreakdown.slice(0, 5).forEach((record, idx) => {
        console.log(`  ${idx + 1}. Round ${record.round_number}: ${record.total_bonus} pts, breakdown: ${JSON.stringify(record.bonus_breakdown)}`);
      });

      console.log('\n⚠️  These records need to be recalculated to have proper breakdown');
      console.log('   Run: node scripts/recalculate-all-fantasy-points.js');
    } else {
      console.log('✅ All records have breakdown data!');
    }

    // Check total count
    const totalCount = await fantasyDb`
      SELECT COUNT(*) as total
      FROM fantasy_team_bonus_points
    `;

    console.log(`\nTotal passive points records: ${totalCount[0].total}`);
    console.log(`Records with breakdown: ${totalCount[0].total - recordsWithoutBreakdown.length}`);
    console.log(`Records without breakdown: ${recordsWithoutBreakdown.length}`);

    const percentage = totalCount[0].total > 0 
      ? ((totalCount[0].total - recordsWithoutBreakdown.length) / totalCount[0].total * 100).toFixed(1)
      : 0;
    console.log(`Coverage: ${percentage}%`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

checkOldRecords()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
