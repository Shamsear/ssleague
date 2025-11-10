require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);

async function fixPrimaryKey() {
  try {
    console.log('🔧 Fixing realplayerstats primary key...\n');
    
    // Step 1: Drop the old primary key constraint
    console.log('1️⃣ Dropping old primary key constraint...');
    await sql`
      ALTER TABLE realplayerstats 
      DROP CONSTRAINT realplayerstats_pkey
    `;
    console.log('   ✅ Dropped old primary key\n');
    
    // Step 2: Add new composite primary key with season_id included
    console.log('2️⃣ Adding new primary key (player_id, tournament_id, season_id)...');
    await sql`
      ALTER TABLE realplayerstats 
      ADD CONSTRAINT realplayerstats_pkey 
      PRIMARY KEY (player_id, tournament_id, season_id)
    `;
    console.log('   ✅ Added new primary key\n');
    
    // Step 3: Drop the old unique constraint if it exists
    console.log('3️⃣ Dropping old unique constraint...');
    try {
      await sql`
        ALTER TABLE realplayerstats 
        DROP CONSTRAINT realplayerstats_player_id_season_id_key
      `;
      console.log('   ✅ Dropped old unique constraint\n');
    } catch (err) {
      console.log('   ℹ️  No old unique constraint to drop\n');
    }
    
    console.log('✅ Primary key successfully updated!');
    console.log('\nNew primary key: (player_id, tournament_id, season_id)');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixPrimaryKey();
