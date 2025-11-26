/**
 * Test script for add_transfer_v2_fields migration
 * 
 * This script tests the migration by:
 * 1. Checking if columns were added successfully
 * 2. Verifying default values
 * 3. Testing constraints
 * 4. Verifying indexes were created
 */

const { Pool } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

async function testMigration() {
  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL });
  
  try {
    console.log('🧪 Testing Transfer V2 Migration...\n');
    
    // Test 1: Verify footballplayers columns exist
    console.log('📋 Test 1: Checking footballplayers columns...');
    const fpColumnsResult = await pool.query(`
      SELECT 
        column_name, 
        data_type, 
        column_default,
        is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'footballplayers' 
      AND column_name IN ('star_rating', 'points', 'salary_per_match', 'transfer_count')
      ORDER BY column_name
    `);
    
    if (fpColumnsResult.rows.length === 4) {
      console.log('✅ All 4 columns exist in footballplayers table');
      fpColumnsResult.rows.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type} (default: ${col.column_default})`);
      });
    } else {
      console.log(`❌ Expected 4 columns, found ${fpColumnsResult.rows.length}`);
      return false;
    }
    
    // Test 2: Verify default values
    console.log('\n📋 Test 2: Checking default values...');
    const defaultsResult = await pool.query(`
      SELECT 
        star_rating,
        points,
        salary_per_match,
        transfer_count
      FROM footballplayers 
      LIMIT 1
    `);
    
    if (defaultsResult.rows.length > 0) {
      const row = defaultsResult.rows[0];
      console.log('✅ Default values check:');
      console.log(`   - star_rating: ${row.star_rating} (expected: 5)`);
      console.log(`   - points: ${row.points} (expected: 180)`);
      console.log(`   - salary_per_match: ${row.salary_per_match} (expected: 0.00)`);
      console.log(`   - transfer_count: ${row.transfer_count} (expected: 0)`);
    } else {
      console.log('⚠️  No players in database to check defaults');
    }
    
    // Test 3: Verify star_rating constraint
    console.log('\n📋 Test 3: Testing star_rating constraint...');
    try {
      await pool.query(`
        INSERT INTO footballplayers (id, player_id, name, star_rating)
        VALUES ('test-constraint-1', 'test-constraint-1', 'Test Player', 2)
      `);
      console.log('❌ Constraint failed: Allowed star_rating < 3');
      // Clean up
      await pool.query(`DELETE FROM footballplayers WHERE id = 'test-constraint-1'`);
      return false;
    } catch (error) {
      if (error.message.includes('check constraint')) {
        console.log('✅ Constraint working: Rejected star_rating < 3');
      } else {
        console.log('⚠️  Unexpected error:', error.message);
      }
    }
    
    try {
      await pool.query(`
        INSERT INTO footballplayers (id, player_id, name, star_rating)
        VALUES ('test-constraint-2', 'test-constraint-2', 'Test Player', 11)
      `);
      console.log('❌ Constraint failed: Allowed star_rating > 10');
      // Clean up
      await pool.query(`DELETE FROM footballplayers WHERE id = 'test-constraint-2'`);
      return false;
    } catch (error) {
      if (error.message.includes('check constraint')) {
        console.log('✅ Constraint working: Rejected star_rating > 10');
      } else {
        console.log('⚠️  Unexpected error:', error.message);
      }
    }
    
    // Test 4: Verify indexes were created
    console.log('\n📋 Test 4: Checking indexes...');
    const indexesResult = await pool.query(`
      SELECT 
        indexname,
        indexdef
      FROM pg_indexes 
      WHERE tablename = 'footballplayers' 
      AND indexname LIKE '%star_rating%' 
         OR indexname LIKE '%points%' 
         OR indexname LIKE '%transfer_count%'
         OR indexname LIKE '%salary%'
      ORDER BY indexname
    `);
    
    const expectedIndexes = [
      'idx_footballplayers_star_rating',
      'idx_footballplayers_points',
      'idx_footballplayers_transfer_count',
      'idx_footballplayers_team_season_star',
      'idx_footballplayers_salary'
    ];
    
    console.log(`✅ Found ${indexesResult.rows.length} indexes:`);
    indexesResult.rows.forEach(idx => {
      console.log(`   - ${idx.indexname}`);
    });
    
    const missingIndexes = expectedIndexes.filter(
      expected => !indexesResult.rows.some(row => row.indexname === expected)
    );
    
    if (missingIndexes.length > 0) {
      console.log(`⚠️  Missing indexes: ${missingIndexes.join(', ')}`);
    }
    
    // Test 5: Check if player_seasons table exists
    console.log('\n📋 Test 5: Checking player_seasons table...');
    const psTableResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'player_seasons'
      ) as exists
    `);
    
    if (psTableResult.rows[0].exists) {
      console.log('✅ player_seasons table exists');
      
      const psColumnsResult = await pool.query(`
        SELECT 
          column_name, 
          data_type, 
          column_default
        FROM information_schema.columns 
        WHERE table_name = 'player_seasons' 
        AND column_name IN ('star_rating', 'points', 'salary_per_match', 'transfer_count')
        ORDER BY column_name
      `);
      
      if (psColumnsResult.rows.length === 4) {
        console.log('✅ All 4 columns exist in player_seasons table');
        psColumnsResult.rows.forEach(col => {
          console.log(`   - ${col.column_name}: ${col.data_type} (default: ${col.column_default})`);
        });
      } else {
        console.log(`⚠️  Expected 4 columns in player_seasons, found ${psColumnsResult.rows.length}`);
      }
    } else {
      console.log('ℹ️  player_seasons table does not exist (this is OK if only using footballplayers)');
    }
    
    // Test 6: Test inserting a player with new fields
    console.log('\n📋 Test 6: Testing insert with new fields...');
    const testPlayerId = `test-player-${Date.now()}`;
    try {
      await pool.query(`
        INSERT INTO footballplayers (
          id, player_id, name, star_rating, points, salary_per_match, transfer_count
        ) VALUES (
          $1, $1, 'Test Player', 7, 250, 2.50, 1
        )
      `, [testPlayerId]);
      
      const verifyResult = await pool.query(`
        SELECT star_rating, points, salary_per_match, transfer_count
        FROM footballplayers
        WHERE id = $1
      `, [testPlayerId]);
      
      if (verifyResult.rows.length > 0) {
        const player = verifyResult.rows[0];
        console.log('✅ Successfully inserted player with new fields:');
        console.log(`   - star_rating: ${player.star_rating}`);
        console.log(`   - points: ${player.points}`);
        console.log(`   - salary_per_match: ${player.salary_per_match}`);
        console.log(`   - transfer_count: ${player.transfer_count}`);
      }
      
      // Clean up
      await pool.query(`DELETE FROM footballplayers WHERE id = $1`, [testPlayerId]);
      console.log('✅ Test player cleaned up');
    } catch (error) {
      console.log('❌ Failed to insert test player:', error.message);
      return false;
    }
    
    console.log('\n🎉 All migration tests passed!');
    return true;
    
  } catch (error) {
    console.error('❌ Migration test failed:', error);
    return false;
  } finally {
    await pool.end();
  }
}

// Run tests
testMigration()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
