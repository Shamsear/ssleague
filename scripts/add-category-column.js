const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.NEON_DATABASE_URL);

async function addCategoryColumn() {
  console.log('\n================================================================================');
  console.log('ADDING CATEGORY COLUMN TO PLAYER_AWARDS');
  console.log('================================================================================\n');

  try {
    // Add category column
    await sql`
      ALTER TABLE player_awards 
      ADD COLUMN IF NOT EXISTS category VARCHAR(50)
    `;
    console.log('✅ Added category column');

    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_player_awards_category ON player_awards(category)`;
    console.log('✅ Created index on category');

    await sql`CREATE INDEX IF NOT EXISTS idx_player_awards_category_award ON player_awards(category, award_name)`;
    console.log('✅ Created composite index on category + award_name');

    // Verify
    const result = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'player_awards' AND column_name = 'category'
    `;

    if (result.length > 0) {
      console.log('\n✅ Verification: category column exists');
      console.log(`   Type: ${result[0].data_type}, Nullable: ${result[0].is_nullable}`);
    }

    console.log('\n================================================================================');
    console.log('SUCCESS! Category column added to player_awards table');
    console.log('================================================================================\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

addCategoryColumn();
