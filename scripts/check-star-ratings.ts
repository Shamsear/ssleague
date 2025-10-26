import { fantasySql } from '../lib/neon/fantasy-config';

async function checkStarRatings() {
  try {
    console.log('Checking player star rating ranges...\n');

    const result = await fantasySql`
      SELECT 
        MIN(star_rating) as min_rating,
        MAX(star_rating) as max_rating,
        COUNT(*) as total_players
      FROM fantasy_players
      WHERE star_rating IS NOT NULL
    `;

    console.log('Star Rating Range:', result[0]);

    const distribution = await fantasySql`
      SELECT 
        star_rating,
        COUNT(*) as count
      FROM fantasy_players
      WHERE star_rating IS NOT NULL
      GROUP BY star_rating
      ORDER BY star_rating
    `;

    console.log('\nDistribution:');
    distribution.forEach(row => {
      console.log(`  ${row.star_rating}★: ${row.count} players`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkStarRatings();
