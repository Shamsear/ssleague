/**
 * Comprehensive Cleanup Script
 * Clears ALL data from Firebase and Neon Database
 * Preserves: Super Admin user/auth and Firebase rules/indexes
 * 
 * Usage: node scripts/clear-all-keep-superadmin.js
 */

const admin = require('firebase-admin');
const readline = require('readline');
const path = require('path');
const { neon } = require('@neondatabase/serverless');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Initialize Firebase Admin
if (!admin.apps.length) {
  if (process.env.FIREBASE_ADMIN_PROJECT_ID && 
      process.env.FIREBASE_ADMIN_CLIENT_EMAIL && 
      process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n')
      })
    });
    console.log('✅ Firebase Admin initialized');
  } else {
    console.error('❌ Error: Firebase Admin credentials not found!');
    process.exit(1);
  }
}

// Initialize Neon - Main Database
const neonSql = process.env.NEON_DATABASE_URL ? neon(process.env.NEON_DATABASE_URL) : null;
if (!neonSql) {
  console.warn('⚠️  Warning: NEON_DATABASE_URL not found. Main Neon cleanup will be skipped.');
}

// Initialize Neon - Tournament Database
const tournamentSql = process.env.NEON_TOURNAMENT_DB_URL ? neon(process.env.NEON_TOURNAMENT_DB_URL) : null;
if (!tournamentSql) {
  console.warn('⚠️  Warning: NEON_TOURNAMENT_DB_URL not found. Tournament DB cleanup will be skipped.');
}

// Initialize Neon - Fantasy Database
const fantasySql = process.env.NEON_FANTASY_DB_URL ? neon(process.env.NEON_FANTASY_DB_URL) : null;
if (!fantasySql) {
  console.warn('⚠️  Warning: NEON_FANTASY_DB_URL not found. Fantasy DB cleanup will be skipped.');
}

// Initialize Neon - Auction Database
const auctionSql = process.env.NEON_AUCTION_DB_URL ? neon(process.env.NEON_AUCTION_DB_URL) : null;
if (!auctionSql) {
  console.warn('⚠️  Warning: NEON_AUCTION_DB_URL not found. Auction DB cleanup will be skipped.');
}

const db = admin.firestore();
const auth = admin.auth();

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function clearAllData() {
  console.log('\n' + '='.repeat(80));
  console.log('🔥 COMPREHENSIVE DATA CLEANUP SCRIPT');
  console.log('='.repeat(80) + '\n');
  
  console.log('⚠️  CRITICAL WARNING: This will DELETE ALL DATA!\n');
  console.log('📋 What will be DELETED:');
  console.log('   ✓ Firebase: All collections (seasons, teams, players, bids, matches, etc.)');
  console.log('   ✓ Firebase: All Auth users except super admin');
  console.log('   ✓ Firebase: All usernames except super admin');
  console.log('   ✓ Neon Main DB: All tables');
  console.log('   ✓ Neon Tournament DB: All tables EXCEPT historical tournaments');
  console.log('   ✓ Neon Fantasy DB: All tables');
  console.log('   ✓ Neon Auction DB: All tables\n');
  
  console.log('📋 What will be PRESERVED:');
  console.log('   ✓ Firebase: Super Admin user and credentials');
  console.log('   ✓ Firebase: Security rules and indexes');
  console.log('   ✓ Neon Tournament DB: Historical tournaments (is_historical = true)');
  console.log('   ✓ All Neon: Table structure (tables will be emptied, not dropped)\n');

  return new Promise((resolve) => {
    rl.question('❓ Are you ABSOLUTELY sure? Type "DELETE ALL DATA" to confirm: ', async (answer) => {
      rl.close();
      
      if (answer !== 'DELETE ALL DATA') {
        console.log('\n❌ Cancelled. No data was deleted.');
        resolve(false);
        return;
      }

      console.log('\n🚀 Starting cleanup...\n');
      console.log('='.repeat(80) + '\n');

      try {
        // ============================================================
        // PART 1: FIREBASE CLEANUP
        // ============================================================
        console.log('🔥 PART 1: FIREBASE CLEANUP\n');

        // Step 1: Identify super admin
        console.log('1️⃣ Identifying super admin user...');
        const usersSnapshot = await db.collection('users')
          .where('role', '==', 'super_admin')
          .limit(1)
          .get();

        let superAdminUid = null;
        let superAdminUsername = null;
        let superAdminEmail = null;
        
        if (!usersSnapshot.empty) {
          superAdminUid = usersSnapshot.docs[0].id;
          const superAdminData = usersSnapshot.docs[0].data();
          superAdminEmail = superAdminData.email;
          superAdminUsername = superAdminData.username ? superAdminData.username.toLowerCase() : null;
          console.log(`   ✅ Found super admin: ${superAdminEmail} (${superAdminUid})`);
          if (superAdminUsername) {
            console.log(`   ✅ Super admin username: ${superAdminUsername}`);
          }
        } else {
          console.log('   ⚠️  No super admin found in Firestore!');
        }
        console.log('');

        // Step 2: Delete Firebase collections
        const collections = [
          'seasons',
          'teams',
          'teamstats',
          'realplayers',
          'realplayerstats',
          'bids',
          'matches',
          'fixtures',
          'invites',
          'awards',
          'footballPlayers',
          'categories',
          'import_progress',
          'news',
          'notifications',
          'polls',
          'poll_options',
          'poll_votes',
          'user_poll_votes',
          'fantasy_leagues',
          'fantasy_teams',
          'fantasy_team_selections',
          'fantasy_round_scores',
          'fantasy_lineups',
          'player_awards',
          'season_trophies',
          'squad_submissions',
          'squad_validations',
          'group_stage_teams',
          'knockout_bracket',
          'tiebreakers',
          'match_reviews',
          'player_ratings',
          'tournament_teams'
        ];

        for (const collectionName of collections) {
          console.log(`2️⃣ Deleting ${collectionName} collection...`);
          const deleteCount = await deleteCollection(db, collectionName, 250);
          console.log(`   ✅ Deleted ${deleteCount} documents from ${collectionName}\n`);
        }

        // Step 3: Delete usernames except super admin
        console.log('3️⃣ Deleting usernames collection (except super admin)...');
        const allUsernamesSnapshot = await db.collection('usernames').get();
        let deletedUsernamesCount = 0;
        
        const usernameBatch = db.batch();
        allUsernamesSnapshot.docs.forEach((doc) => {
          if (superAdminUsername && doc.id === superAdminUsername) {
            console.log(`   🔒 Keeping super admin username: ${doc.id}`);
          } else {
            usernameBatch.delete(doc.ref);
            deletedUsernamesCount++;
          }
        });
        
        if (deletedUsernamesCount > 0) {
          await usernameBatch.commit();
        }
        console.log(`   ✅ Deleted ${deletedUsernamesCount} username entries\n`);

        // Step 4: Delete users except super admin
        console.log('4️⃣ Deleting users from Firestore (except super admin)...');
        const allUsersSnapshot = await db.collection('users').get();
        let deletedUsersCount = 0;
        
        const userBatch = db.batch();
        allUsersSnapshot.docs.forEach((doc) => {
          if (doc.id !== superAdminUid) {
            userBatch.delete(doc.ref);
            deletedUsersCount++;
          } else {
            console.log(`   🔒 Keeping super admin user: ${superAdminEmail}`);
          }
        });
        
        if (deletedUsersCount > 0) {
          await userBatch.commit();
        }
        console.log(`   ✅ Deleted ${deletedUsersCount} user documents\n`);

        // Step 5: Delete Firebase Auth users except super admin
        console.log('5️⃣ Deleting Firebase Auth users (except super admin)...');
        let deletedAuthCount = 0;
        
        let nextPageToken;
        do {
          const listUsersResult = await auth.listUsers(1000, nextPageToken);
          
          const uidsToDelete = listUsersResult.users
            .filter(user => user.uid !== superAdminUid)
            .map(user => user.uid);

          if (uidsToDelete.length > 0) {
            await auth.deleteUsers(uidsToDelete);
            deletedAuthCount += uidsToDelete.length;
            console.log(`   🗑️  Deleted ${uidsToDelete.length} Auth users...`);
          }

          nextPageToken = listUsersResult.pageToken;
        } while (nextPageToken);

        console.log(`   ✅ Deleted ${deletedAuthCount} Auth users\n`);

        // ============================================================
        // PART 2: NEON DATABASE CLEANUP
        // ============================================================
        console.log('='.repeat(80) + '\n');
        console.log('🐘 PART 2: NEON DATABASE CLEANUP\n');
        
        let totalTablesCleared = 0;
        
        // ============================================================
        // 2A: Main Database
        // ============================================================
        if (neonSql) {
          console.log('6️⃣-A Clearing Main Database...');
          const mainTables = await neonSql`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_type = 'BASE TABLE'
            ORDER BY table_name;
          `;
          
          console.log(`   ✅ Found ${mainTables.length} tables in Main DB\n`);

          for (const table of mainTables) {
            const tableName = table.table_name;
            console.log(`   Clearing: ${tableName}...`);
            
            try {
              const countBefore = await neonSql.unsafe(`SELECT COUNT(*) as count FROM ${tableName}`);
              const recordCount = countBefore[0]?.count || 0;
              
              if (recordCount > 0) {
                await neonSql.unsafe(`TRUNCATE TABLE ${tableName} RESTART IDENTITY CASCADE`);
                console.log(`   ✅ Cleared ${recordCount} records\n`);
              } else {
                console.log(`   ℹ️  Already empty\n`);
              }
              totalTablesCleared++;
            } catch (error) {
              console.log(`   ⚠️  Error: ${error.message}\n`);
            }
          }
        }

        // ============================================================
        // 2B: Tournament Database (preserve historical)
        // ============================================================
        if (tournamentSql) {
          console.log('\n6️⃣-B Clearing Tournament Database (preserving historical)...');
          
          // Get historical tournament IDs
          const historicalTournaments = await tournamentSql`
            SELECT id, tournament_name 
            FROM tournaments 
            WHERE is_historical = true
          `;
          
          const historicalIds = historicalTournaments.map(t => t.id);
          console.log(`   🔒 Found ${historicalIds.length} historical tournaments to preserve`);
          historicalTournaments.forEach(t => {
            console.log(`      - ${t.tournament_name} (${t.id})`);
          });
          console.log('');
          
          const tournamentTables = await tournamentSql`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_type = 'BASE TABLE'
            ORDER BY table_name;
          `;
          
          console.log(`   ✅ Found ${tournamentTables.length} tables in Tournament DB\n`);

          for (const table of tournamentTables) {
            const tableName = table.table_name;
            console.log(`   Clearing: ${tableName}...`);
            
            try {
              const countBefore = await tournamentSql.unsafe(`SELECT COUNT(*) as count FROM ${tableName}`);
              const recordCount = countBefore[0]?.count || 0;
              
              if (recordCount > 0) {
                // Special handling for tournaments table
                if (tableName === 'tournaments' && historicalIds.length > 0) {
                  const idList = historicalIds.map(id => `'${id}'`).join(',');
                  await tournamentSql.unsafe(`
                    DELETE FROM ${tableName} 
                    WHERE is_historical IS NOT TRUE
                    OR is_historical IS NULL
                  `);
                  const preserved = await tournamentSql.unsafe(`SELECT COUNT(*) as count FROM ${tableName}`);
                  console.log(`   ✅ Deleted ${recordCount - preserved[0].count} records, preserved ${preserved[0].count}\n`);
                }
                // Special handling for tables with tournament_id
                else if (['fixtures', 'team_stats', 'player_stats', 'tournament_teams'].includes(tableName) && historicalIds.length > 0) {
                  const idList = historicalIds.map(id => `'${id}'`).join(',');
                  await tournamentSql.unsafe(`
                    DELETE FROM ${tableName}
                    WHERE tournament_id NOT IN (${idList})
                  `);
                  const remaining = await tournamentSql.unsafe(`SELECT COUNT(*) as count FROM ${tableName}`);
                  console.log(`   ✅ Deleted ${recordCount - remaining[0].count} records, preserved ${remaining[0].count}\n`);
                }
                // All other tables - clear completely
                else {
                  await tournamentSql.unsafe(`TRUNCATE TABLE ${tableName} RESTART IDENTITY CASCADE`);
                  console.log(`   ✅ Cleared ${recordCount} records\n`);
                }
              } else {
                console.log(`   ℹ️  Already empty\n`);
              }
              totalTablesCleared++;
            } catch (error) {
              console.log(`   ⚠️  Error: ${error.message}\n`);
            }
          }
        }

        // ============================================================
        // 2C: Fantasy Database
        // ============================================================
        if (fantasySql) {
          console.log('\n6️⃣-C Clearing Fantasy Database...');
          const fantasyTables = await fantasySql`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_type = 'BASE TABLE'
            ORDER BY table_name;
          `;
          
          console.log(`   ✅ Found ${fantasyTables.length} tables in Fantasy DB\n`);

          for (const table of fantasyTables) {
            const tableName = table.table_name;
            console.log(`   Clearing: ${tableName}...`);
            
            try {
              const countBefore = await fantasySql.unsafe(`SELECT COUNT(*) as count FROM ${tableName}`);
              const recordCount = countBefore[0]?.count || 0;
              
              if (recordCount > 0) {
                await fantasySql.unsafe(`TRUNCATE TABLE ${tableName} RESTART IDENTITY CASCADE`);
                console.log(`   ✅ Cleared ${recordCount} records\n`);
              } else {
                console.log(`   ℹ️  Already empty\n`);
              }
              totalTablesCleared++;
            } catch (error) {
              console.log(`   ⚠️  Error: ${error.message}\n`);
            }
          }
        }

        // ============================================================
        // 2D: Auction Database
        // ============================================================
        if (auctionSql) {
          console.log('\n6️⃣-D Clearing Auction Database...');
          const auctionTables = await auctionSql`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_type = 'BASE TABLE'
            ORDER BY table_name;
          `;
          
          console.log(`   ✅ Found ${auctionTables.length} tables in Auction DB\n`);

          for (const table of auctionTables) {
            const tableName = table.table_name;
            console.log(`   Clearing: ${tableName}...`);
            
            try {
              const countBefore = await auctionSql.unsafe(`SELECT COUNT(*) as count FROM ${tableName}`);
              const recordCount = countBefore[0]?.count || 0;
              
              if (recordCount > 0) {
                await auctionSql.unsafe(`TRUNCATE TABLE ${tableName} RESTART IDENTITY CASCADE`);
                console.log(`   ✅ Cleared ${recordCount} records\n`);
              } else {
                console.log(`   ℹ️  Already empty\n`);
              }
              totalTablesCleared++;
            } catch (error) {
              console.log(`   ⚠️  Error: ${error.message}\n`);
            }
          }
        }

        // ============================================================
        // SUMMARY
        // ============================================================
        console.log('='.repeat(80) + '\n');
        console.log('✅ CLEANUP COMPLETED SUCCESSFULLY!\n');
        console.log('📊 Summary:');
        console.log('   Firebase:');
        console.log(`      - Collections cleared: ${collections.length}`);
        console.log(`      - Username entries deleted: ${deletedUsernamesCount}`);
        console.log(`      - Firestore users deleted: ${deletedUsersCount}`);
        console.log(`      - Auth users deleted: ${deletedAuthCount}`);
        console.log(`      - Super admin preserved: ${superAdminUid ? superAdminEmail + ' ✅' : 'None found ⚠️'}`);
        
        if (totalTablesCleared > 0) {
          console.log('   Neon Databases:');
          console.log(`      - Total tables cleared: ${totalTablesCleared}`);
          console.log('      - Historical tournaments preserved ✅');
          console.log('      - Table structure preserved ✅');
        }
        
        console.log('\n' + '='.repeat(80) + '\n');

        resolve(true);
      } catch (error) {
        console.error('\n❌ Error during cleanup:', error);
        console.error('Stack trace:', error.stack);
        resolve(false);
      }
    });
  });
}

// Helper function to delete a collection efficiently
async function deleteCollection(db, collectionPath, batchSize = 250) {
  const collectionRef = db.collection(collectionPath);
  let deletedCount = 0;
  
  let hasMore = true;
  while (hasMore) {
    const snapshot = await collectionRef.limit(batchSize).get();
    
    if (snapshot.size === 0) {
      hasMore = false;
      break;
    }
    
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    deletedCount += snapshot.size;
    
    if (deletedCount % 1000 === 0) {
      console.log(`   🗑️  Deleted ${deletedCount} documents...`);
    }
    
    if (snapshot.size === batchSize) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return deletedCount;
}

// Run the script
console.log('\n🚀 Comprehensive Data Cleanup Script\n');
console.log('This script will clear all data from Firebase and Neon');
console.log('while preserving your super admin credentials.\n');

clearAllData().then((success) => {
  if (success) {
    console.log('👋 Done! Your databases are now clean (super admin preserved).\n');
  } else {
    console.log('👋 Script terminated.\n');
  }
  process.exit(success ? 0 : 1);
});
