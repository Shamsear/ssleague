require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function fixDuplicateOwners() {
  // Use NEON_TOURNAMENT_DB_URL for owners table
  const dbUrl = process.env.NEON_TOURNAMENT_DB_URL;
  if (!dbUrl) {
    throw new Error('NEON_TOURNAMENT_DB_URL not found in environment variables');
  }
  console.log(`Connecting to tournament database...\n`);
  const sql = neon(dbUrl);

  console.log('🔍 Step 1: Identifying duplicate owners...\n');

  // Step 1: Identify duplicates
  const duplicates = await sql`
    SELECT 
      registered_user_id,
      COUNT(*) as count,
      ARRAY_AGG(owner_id) as owner_ids,
      ARRAY_AGG(team_id) as team_ids,
      ARRAY_AGG(id) as internal_ids
    FROM owners
    WHERE registered_user_id IS NOT NULL
    GROUP BY registered_user_id
    HAVING COUNT(*) > 1
  `;

  if (duplicates.length === 0) {
    console.log('✅ No duplicate owners found!\n');
  } else {
    console.log(`⚠️  Found ${duplicates.length} users with duplicate owner records:\n`);
    duplicates.forEach(dup => {
      console.log(`User: ${dup.registered_user_id}`);
      console.log(`  - Owner IDs: ${dup.owner_ids.join(', ')}`);
      console.log(`  - Team IDs: ${dup.team_ids.join(', ')}`);
      console.log(`  - Will keep ID: ${Math.max(...dup.internal_ids)} (latest)\n`);
    });

    // Step 2: Delete duplicates
    console.log('🗑️  Step 2: Removing duplicate owners (keeping latest)...\n');

    const deleteResult = await sql`
      WITH ranked_owners AS (
        SELECT 
          id,
          owner_id,
          registered_user_id,
          ROW_NUMBER() OVER (
            PARTITION BY registered_user_id 
            ORDER BY id DESC
          ) as rn
        FROM owners
        WHERE registered_user_id IS NOT NULL
      )
      DELETE FROM owners
      WHERE id IN (
        SELECT id FROM ranked_owners WHERE rn > 1
      )
      RETURNING id, owner_id
    `;

    console.log(`✅ Deleted ${deleteResult.length} duplicate owner record(s)\n`);
    if (deleteResult.length > 0) {
      console.log('Deleted records:');
      deleteResult.forEach(rec => {
        console.log(`  - ID ${rec.id}: ${rec.owner_id}`);
      });
      console.log();
    }
  }

  // Step 3: Add unique constraint
  console.log('🔒 Step 3: Adding unique constraint on registered_user_id...\n');

  try {
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_owners_registered_user_id_unique 
      ON owners (registered_user_id) 
      WHERE registered_user_id IS NOT NULL
    `;
    console.log('✅ Unique constraint added successfully\n');
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('ℹ️  Unique constraint already exists\n');
    } else {
      throw error;
    }
  }

  // Step 4: Verify no duplicates remain
  console.log('✔️  Step 4: Verifying cleanup...\n');

  const remainingDuplicates = await sql`
    SELECT 
      registered_user_id,
      COUNT(*) as count
    FROM owners
    WHERE registered_user_id IS NOT NULL
    GROUP BY registered_user_id
    HAVING COUNT(*) > 1
  `;

  if (remainingDuplicates.length === 0) {
    console.log('✅ SUCCESS! No duplicate owners remain.\n');
    console.log('📊 Final stats:');
    const stats = await sql`
      SELECT 
        COUNT(*) as total_owners,
        COUNT(DISTINCT registered_user_id) as unique_users
      FROM owners
      WHERE registered_user_id IS NOT NULL
    `;
    console.log(`   - Total owners: ${stats[0].total_owners}`);
    console.log(`   - Unique users: ${stats[0].unique_users}\n`);
  } else {
    console.log('❌ WARNING: Some duplicates still remain:');
    console.log(remainingDuplicates);
  }

  console.log('🎉 Migration complete!\n');
}

// Run the migration
fixDuplicateOwners()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error running migration:', error);
    process.exit(1);
  });
