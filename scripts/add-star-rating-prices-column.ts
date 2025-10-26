import { fantasySql } from '../lib/neon/fantasy-config';

async function addStarRatingPricesColumn() {
  try {
    console.log('Adding star_rating_prices column to fantasy_leagues table...');

    // Add the JSONB column
    await fantasySql`
      ALTER TABLE fantasy_leagues 
      ADD COLUMN IF NOT EXISTS star_rating_prices JSONB DEFAULT '[
        {"stars": 1, "price": 5},
        {"stars": 2, "price": 10},
        {"stars": 3, "price": 15},
        {"stars": 4, "price": 20},
        {"stars": 5, "price": 25}
      ]'::jsonb
    `;

    console.log('✅ Column added successfully!');

    // Update existing rows to have default pricing
    await fantasySql`
      UPDATE fantasy_leagues 
      SET star_rating_prices = '[
        {"stars": 1, "price": 5},
        {"stars": 2, "price": 10},
        {"stars": 3, "price": 15},
        {"stars": 4, "price": 20},
        {"stars": 5, "price": 25}
      ]'::jsonb
      WHERE star_rating_prices IS NULL
    `;

    console.log('✅ Default pricing set for existing leagues!');

    // Verify the column
    const result = await fantasySql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'fantasy_leagues' 
      AND column_name = 'star_rating_prices'
    `;

    console.log('✅ Column verified:', result);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding column:', error);
    process.exit(1);
  }
}

addStarRatingPricesColumn();
