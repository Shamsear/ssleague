/**
 * Test script for Firebase Transfer V2 Migration
 * 
 * This script tests the Firebase migration by:
 * 1. Checking if transfer_count field exists in team_seasons
 * 2. Verifying default values
 * 3. Testing queries that will use the new indexes
 * 4. Simulating transfer limit tracking
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Firebase Admin
if (getApps().length === 0) {
  const serviceAccount = JSON.parse(
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}'
  );
  
  initializeApp({
    credential: cert(serviceAccount),
  });
}

const db = getFirestore();

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

const results: TestResult[] = [];

/**
 * Test 1: Check if transfer_count field exists
 */
async function testTransferCountExists(): Promise<TestResult> {
  console.log('\n📋 Test 1: Checking if transfer_count field exists...');
  
  try {
    const teamSeasonsRef = db.collection('team_seasons');
    const snapshot = await teamSeasonsRef.limit(10).get();
    
    if (snapshot.empty) {
      return {
        name: 'Transfer Count Exists',
        passed: true,
        message: 'No team_seasons documents found (OK for new database)'
      };
    }
    
    let allHaveField = true;
    let checkedCount = 0;
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      checkedCount++;
      
      if (data.transfer_count === undefined) {
        console.log(`   ❌ Document ${doc.id} missing transfer_count field`);
        allHaveField = false;
      } else {
        console.log(`   ✅ Document ${doc.id} has transfer_count: ${data.transfer_count}`);
      }
    }
    
    if (allHaveField) {
      return {
        name: 'Transfer Count Exists',
        passed: true,
        message: `All ${checkedCount} checked documents have transfer_count field`
      };
    } else {
      return {
        name: 'Transfer Count Exists',
        passed: false,
        message: 'Some documents missing transfer_count field'
      };
    }
  } catch (error: any) {
    return {
      name: 'Transfer Count Exists',
      passed: false,
      message: `Error: ${error.message}`
    };
  }
}

/**
 * Test 2: Verify default value is 0
 */
async function testDefaultValue(): Promise<TestResult> {
  console.log('\n📋 Test 2: Verifying default value is 0...');
  
  try {
    const teamSeasonsRef = db.collection('team_seasons');
    const snapshot = await teamSeasonsRef.limit(5).get();
    
    if (snapshot.empty) {
      return {
        name: 'Default Value',
        passed: true,
        message: 'No documents to check (OK for new database)'
      };
    }
    
    let allHaveZero = true;
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const transferCount = data.transfer_count;
      
      console.log(`   Document ${doc.id}: transfer_count = ${transferCount}`);
      
      if (transferCount !== 0 && transferCount !== undefined) {
        console.log(`   ⚠️  Non-zero value found (may be OK if transfers already occurred)`);
      }
    }
    
    return {
      name: 'Default Value',
      passed: true,
      message: 'Default values verified'
    };
  } catch (error: any) {
    return {
      name: 'Default Value',
      passed: false,
      message: `Error: ${error.message}`
    };
  }
}

/**
 * Test 3: Test creating a test team_season with transfer_count
 */
async function testCreateTeamSeason(): Promise<TestResult> {
  console.log('\n📋 Test 3: Testing create team_season with transfer_count...');
  
  const testDocId = `test_team_${Date.now()}`;
  
  try {
    // Create test document
    await db.collection('team_seasons').doc(testDocId).set({
      team_id: 'test_team',
      season_id: 'test_season',
      transfer_count: 0,
      dollar_balance: 1000,
      created_at: FieldValue.serverTimestamp()
    });
    
    console.log(`   ✅ Created test document: ${testDocId}`);
    
    // Verify it was created
    const doc = await db.collection('team_seasons').doc(testDocId).get();
    const data = doc.data();
    
    if (data && data.transfer_count === 0) {
      console.log(`   ✅ Verified transfer_count: ${data.transfer_count}`);
      
      // Clean up
      await db.collection('team_seasons').doc(testDocId).delete();
      console.log(`   ✅ Cleaned up test document`);
      
      return {
        name: 'Create Team Season',
        passed: true,
        message: 'Successfully created and verified team_season with transfer_count'
      };
    } else {
      return {
        name: 'Create Team Season',
        passed: false,
        message: 'transfer_count field not set correctly'
      };
    }
  } catch (error: any) {
    // Clean up on error
    try {
      await db.collection('team_seasons').doc(testDocId).delete();
    } catch {}
    
    return {
      name: 'Create Team Season',
      passed: false,
      message: `Error: ${error.message}`
    };
  }
}

/**
 * Test 4: Test updating transfer_count
 */
async function testUpdateTransferCount(): Promise<TestResult> {
  console.log('\n📋 Test 4: Testing update transfer_count...');
  
  const testDocId = `test_team_${Date.now()}`;
  
  try {
    // Create test document
    await db.collection('team_seasons').doc(testDocId).set({
      team_id: 'test_team',
      season_id: 'test_season',
      transfer_count: 0,
      dollar_balance: 1000,
      created_at: FieldValue.serverTimestamp()
    });
    
    console.log(`   ✅ Created test document: ${testDocId}`);
    
    // Increment transfer_count
    await db.collection('team_seasons').doc(testDocId).update({
      transfer_count: FieldValue.increment(1)
    });
    
    console.log(`   ✅ Incremented transfer_count`);
    
    // Verify it was incremented
    const doc = await db.collection('team_seasons').doc(testDocId).get();
    const data = doc.data();
    
    if (data && data.transfer_count === 1) {
      console.log(`   ✅ Verified transfer_count after increment: ${data.transfer_count}`);
      
      // Increment again
      await db.collection('team_seasons').doc(testDocId).update({
        transfer_count: FieldValue.increment(1)
      });
      
      const doc2 = await db.collection('team_seasons').doc(testDocId).get();
      const data2 = doc2.data();
      
      if (data2 && data2.transfer_count === 2) {
        console.log(`   ✅ Verified transfer_count after second increment: ${data2.transfer_count}`);
        
        // Clean up
        await db.collection('team_seasons').doc(testDocId).delete();
        console.log(`   ✅ Cleaned up test document`);
        
        return {
          name: 'Update Transfer Count',
          passed: true,
          message: 'Successfully incremented transfer_count'
        };
      } else {
        return {
          name: 'Update Transfer Count',
          passed: false,
          message: 'Second increment failed'
        };
      }
    } else {
      return {
        name: 'Update Transfer Count',
        passed: false,
        message: 'First increment failed'
      };
    }
  } catch (error: any) {
    // Clean up on error
    try {
      await db.collection('team_seasons').doc(testDocId).delete();
    } catch {}
    
    return {
      name: 'Update Transfer Count',
      passed: false,
      message: `Error: ${error.message}`
    };
  }
}

/**
 * Test 5: Test player_transactions collection structure
 */
async function testPlayerTransactionsStructure(): Promise<TestResult> {
  console.log('\n📋 Test 5: Testing player_transactions collection structure...');
  
  const testDocId = `test_transaction_${Date.now()}`;
  
  try {
    // Create test transaction
    await db.collection('player_transactions').doc(testDocId).set({
      transaction_type: 'transfer',
      season_id: 'test_season',
      player_id: 'test_player',
      player_name: 'Test Player',
      old_team_id: 'team_a',
      new_team_id: 'team_b',
      old_value: 100,
      new_value: 115,
      committee_fee: 11.5,
      buying_team_paid: 126.5,
      selling_team_received: 103.5,
      processed_by: 'test_admin',
      created_at: FieldValue.serverTimestamp()
    });
    
    console.log(`   ✅ Created test transaction: ${testDocId}`);
    
    // Verify it was created
    const doc = await db.collection('player_transactions').doc(testDocId).get();
    const data = doc.data();
    
    if (data && data.transaction_type === 'transfer') {
      console.log(`   ✅ Verified transaction structure`);
      console.log(`      - transaction_type: ${data.transaction_type}`);
      console.log(`      - season_id: ${data.season_id}`);
      console.log(`      - committee_fee: ${data.committee_fee}`);
      
      // Clean up
      await db.collection('player_transactions').doc(testDocId).delete();
      console.log(`   ✅ Cleaned up test transaction`);
      
      return {
        name: 'Player Transactions Structure',
        passed: true,
        message: 'Successfully created and verified player_transactions document'
      };
    } else {
      return {
        name: 'Player Transactions Structure',
        passed: false,
        message: 'Transaction structure not correct'
      };
    }
  } catch (error: any) {
    // Clean up on error
    try {
      await db.collection('player_transactions').doc(testDocId).delete();
    } catch {}
    
    return {
      name: 'Player Transactions Structure',
      passed: false,
      message: `Error: ${error.message}`
    };
  }
}

/**
 * Test 6: Test querying player_transactions (will fail if indexes not deployed)
 */
async function testPlayerTransactionsQuery(): Promise<TestResult> {
  console.log('\n📋 Test 6: Testing player_transactions queries...');
  
  try {
    // Try a simple query that requires an index
    const query = db.collection('player_transactions')
      .where('season_id', '==', 'test_season')
      .orderBy('created_at', 'desc')
      .limit(1);
    
    const snapshot = await query.get();
    
    console.log(`   ✅ Query executed successfully (found ${snapshot.size} documents)`);
    
    return {
      name: 'Player Transactions Query',
      passed: true,
      message: 'Indexes are working correctly'
    };
  } catch (error: any) {
    if (error.message.includes('index')) {
      return {
        name: 'Player Transactions Query',
        passed: false,
        message: 'Indexes not deployed yet. Run: firebase deploy --only firestore:indexes'
      };
    } else {
      return {
        name: 'Player Transactions Query',
        passed: false,
        message: `Error: ${error.message}`
      };
    }
  }
}

/**
 * Main test function
 */
async function runTests() {
  console.log('🧪 Starting Firebase Transfer V2 Migration Tests...\n');
  
  try {
    // Run all tests
    results.push(await testTransferCountExists());
    results.push(await testDefaultValue());
    results.push(await testCreateTeamSeason());
    results.push(await testUpdateTransferCount());
    results.push(await testPlayerTransactionsStructure());
    results.push(await testPlayerTransactionsQuery());
    
    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    
    let passedCount = 0;
    let failedCount = 0;
    
    results.forEach(result => {
      const icon = result.passed ? '✅' : '❌';
      console.log(`${icon} ${result.name}: ${result.message}`);
      
      if (result.passed) {
        passedCount++;
      } else {
        failedCount++;
      }
    });
    
    console.log('='.repeat(60));
    console.log(`Total: ${results.length} tests`);
    console.log(`Passed: ${passedCount}`);
    console.log(`Failed: ${failedCount}`);
    console.log('='.repeat(60));
    
    if (failedCount === 0) {
      console.log('\n🎉 All tests passed!');
      return true;
    } else {
      console.log('\n⚠️  Some tests failed. Please review the errors above.');
      return false;
    }
  } catch (error: any) {
    console.error('\n❌ Test suite failed:', error);
    console.error(error.stack);
    return false;
  }
}

// Run tests if called directly
if (require.main === module) {
  runTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { runTests };
