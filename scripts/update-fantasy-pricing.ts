/**
 * Update Fantasy League Pricing from 1-5 stars to 3-10 stars
 * Run with: npx tsx scripts/update-fantasy-pricing.ts
 */

import { getFantasyDb } from '../lib/neon/fantasy-config';

const newPricing = [
  { stars: 3, price: 5 },
  { stars: 4, price: 7 },
  { stars: 5, price: 10 },
  { stars: 6, price: 13 },
  { stars: 7, price: 16 },
  { stars: 8, price: 20 },
  { stars: 9, price: 25 },
  { stars: 10, price: 30 },
];

async function updatePricing() {
  try {
    const sql = getFantasyDb();
    
    console.log('🔄 Updating fantasy league pricing to 3-10 star system...\n');
    
    // Get all fantasy leagues
    const leagues = await sql`
      SELECT league_id, league_name, star_rating_prices 
      FROM fantasy_leagues
    `;
    
    console.log(`Found ${leagues.length} fantasy league(s)\n`);
    
    for (const league of leagues) {
      console.log(`📝 Updating ${league.league_name} (${league.league_id})`);
      console.log(`   Old pricing:`, league.star_rating_prices);
      
      await sql`
        UPDATE fantasy_leagues
        SET star_rating_prices = ${JSON.stringify(newPricing)},
            updated_at = CURRENT_TIMESTAMP
        WHERE league_id = ${league.league_id}
      `;
      
      console.log(`   New pricing:`, newPricing);
      console.log(`   ✅ Updated\n`);
    }
    
    console.log('✅ All fantasy leagues updated to 3-10 star pricing system!');
    
  } catch (error) {
    console.error('❌ Error updating pricing:', error);
    process.exit(1);
  }
}

updatePricing();
