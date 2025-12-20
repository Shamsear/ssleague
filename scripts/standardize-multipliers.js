/**
 * Standardize Points Multipliers
 * Convert all multipliers to consistent format: 100, 150, 200
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function standardizeMultipliers() {
  const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);

  console.log('🔧 Standardizing Points Multipliers...\n');

  try {
    // Check current state
    const current = await fantasyDb`
      SELECT points_multiplier, COUNT(*) as count
      FROM fantasy_player_points
      GROUP BY points_multiplier
      ORDER BY points_multiplier
    `;

    console.log('Current state:');
    console.table(current);

    // Update multiplier = 1 to 100
    const update1 = await fantasyDb`
      UPDATE fantasy_player_points
      SET points_multiplier = 100
      WHERE points_multiplier = 1
    `;
    console.log(`\n✅ Updated ${update1.length} records: 1 → 100`);

    // Update multiplier = 2 to 200
    const update2 = await fantasyDb`
      UPDATE fantasy_player_points
      SET points_multiplier = 200
      WHERE points_multiplier = 2
    `;
    console.log(`✅ Updated ${update2.length} records: 2 → 200`);

    // Verify new state
    const after = await fantasyDb`
      SELECT points_multiplier, COUNT(*) as count
      FROM fantasy_player_points
      GROUP BY points_multiplier
      ORDER BY points_multiplier
    `;

    console.log('\nNew state:');
    console.table(after);

    console.log('\n📊 Summary:');
    after.forEach(row => {
      const type = row.points_multiplier === 200 ? 'Captain (2x)' : 
                   row.points_multiplier === 150 ? 'Vice-Captain (1.5x)' : 
                   row.points_multiplier === 100 ? 'Regular (1x)' : 'Unknown';
      console.log(`  ${row.points_multiplier}: ${row.count} records (${type})`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

standardizeMultipliers()
  .then(() => {
    console.log('\n✅ Standardization complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Standardization failed:', error);
    process.exit(1);
  });
