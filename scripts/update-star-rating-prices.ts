import { fantasySql } from '../lib/neon/fantasy-config';

async function updateStarRatingPrices() {
  try {
    console.log('Updating star_rating_prices to 3-10 system...');

    // Update all leagues to use 3-10 star pricing
    await fantasySql`
      UPDATE fantasy_leagues 
      SET star_rating_prices = '[
        {"stars": 3, "price": 5},
        {"stars": 4, "price": 7},
        {"stars": 5, "price": 10},
        {"stars": 6, "price": 13},
        {"stars": 7, "price": 16},
        {"stars": 8, "price": 20},
        {"stars": 9, "price": 25},
        {"stars": 10, "price": 30}
      ]'::jsonb,
      updated_at = CURRENT_TIMESTAMP
    `;

    console.log('✅ All leagues updated to 3-10 star pricing system!');

    // Verify
    const result = await fantasySql`
      SELECT league_id, star_rating_prices 
      FROM fantasy_leagues 
      LIMIT 3
    `;

    console.log('\nSample leagues:');
    result.forEach(league => {
      console.log(`  ${league.league_id}:`, league.star_rating_prices);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

updateStarRatingPrices();
