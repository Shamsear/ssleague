/**
 * Database Cleanup Script
 * Clears all collections except super admin user
 * 
 * Usage: npx tsx scripts/clear-database.ts
 */

import * as admin from 'firebase-admin';
import * as readline from 'readline';
import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });
// Fallback to .env if .env.local doesn't exist
if (!process.env.DATABASE_URL && !process.env.FIREBASE_SERVICE_ACCOUNT) {
  dotenv.config();
}

// Check if databases are configured
const hasFirebaseServiceAccount = !!process.env.FIREBASE_SERVICE_ACCOUNT;
const hasFirebaseEnvVars = !!(process.env.FIREBASE_ADMIN_PROJECT_ID && 
                               process.env.FIREBASE_ADMIN_CLIENT_EMAIL && 
                               process.env.FIREBASE_ADMIN_PRIVATE_KEY);
const hasFirebase = hasFirebaseServiceAccount || hasFirebaseEnvVars;
const hasAuctionDb = !!process.env.NEON_DATABASE_URL || !!process.env.NEON_AUCTION_DB_URL;
const hasTournamentDb = !!process.env.NEON_TOURNAMENT_DB_URL;
const hasFantasyDb = !!process.env.FANTASY_DATABASE_URL;

// Initialize all Neon databases
let sqlAuction: any = null;
let sqlTournament: any = null;
let sqlFantasy: any = null;

if (hasAuctionDb) {
  sqlAuction = neon(process.env.NEON_DATABASE_URL || process.env.NEON_AUCTION_DB_URL!);
}
if (hasTournamentDb) {
  sqlTournament = neon(process.env.NEON_TOURNAMENT_DB_URL!);
}
if (hasFantasyDb) {
  sqlFantasy = neon(process.env.FANTASY_DATABASE_URL!);
}

// Initialize Firebase Admin only if configured
if (hasFirebase && !admin.apps.length) {
  try {
    if (hasFirebaseServiceAccount) {
      // Method 1: Service account JSON file
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('🔥 Firebase initialized with service account JSON');
    } else if (hasFirebaseEnvVars) {
      // Method 2: Individual environment variables
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_ADMIN_PROJECT_ID!,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
          privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY!.replace(/\\n/g, '\n'),
        }),
      });
      console.log('🔥 Firebase initialized with environment variables');
    }
  } catch (error: any) {
    console.error('❌ Failed to initialize Firebase Admin:', error.message);
    process.exit(1);
  }
}

const db = hasFirebase ? admin.firestore() : null;

// Function to get all Firebase collections dynamically
async function getAllFirebaseCollections(): Promise<string[]> {
  if (!db) return [];
  try {
    const collections = await db.listCollections();
    return collections
      .map(col => col.id)
      .filter(id => id !== 'users' && id !== 'usernames'); // We handle users and usernames separately
  } catch (error: any) {
    console.error(`Error getting Firebase collections: ${error.message}`);
    return [];
  }
}

// Function to get all tables in a Neon database dynamically
async function getAllTables(sql: any): Promise<string[]> {
  try {
    const result = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    return result.map((row: any) => row.table_name);
  } catch (error: any) {
    console.error(`Error getting tables: ${error.message}`);
    return [];
  }
}

// Function to prompt user for confirmation
function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => rl.question(query, (ans: string) => {
    rl.close();
    resolve(ans);
  }));
}

// Function to delete all documents in a collection
async function clearCollection(collectionName: string): Promise<number> {
  if (!db) {
    console.log(`  ℹ ${collectionName}: Firebase not configured, skipping`);
    return 0;
  }
  try {
    const snapshot = await db.collection(collectionName).get();
    
    if (snapshot.empty) {
      console.log(`  ✓ ${collectionName}: Already empty`);
      return 0;
    }

    const batch = db.batch();
    let count = 0;

    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
      count++;
    });

    await batch.commit();
    console.log(`  ✓ ${collectionName}: Deleted ${count} documents`);
    return count;
  } catch (error: any) {
    console.error(`  ✗ ${collectionName}: Error - ${error.message}`);
    return 0;
  }
}

// Function to clear Neon table
async function clearNeonTable(sql: any, tableName: string, dbName: string = 'Neon'): Promise<number> {
  if (!sql) {
    console.log(`  ℹ ${tableName}: ${dbName} not configured, skipping`);
    return 0;
  }
  try {
    // Use dynamic SQL with unsafe() for table names (identifiers)
    // Get count first
    const countResult = await sql.unsafe(`SELECT COUNT(*) as count FROM ${tableName}`);
    const beforeCount = parseInt(countResult[0]?.count || '0');
    
    if (beforeCount === 0) {
      console.log(`  ✓ ${tableName}: Already empty`);
      return 0;
    }
    
    // Delete all rows
    await sql.unsafe(`DELETE FROM ${tableName}`);
    
    console.log(`  ✓ ${tableName}: Deleted ${beforeCount} rows`);
    return beforeCount;
  } catch (error: any) {
    // Table might not exist, that's okay
    if (error.message.includes('does not exist') || error.message.includes('relation') && error.message.includes('does not exist')) {
      console.log(`  ℹ ${tableName}: Table does not exist, skipping`);
      return 0;
    }
    console.error(`  ✗ ${tableName}: Error - ${error.message}`);
    return 0;
  }
}

// Function to clear users except super admin
async function clearUsersExceptSuperAdmin(): Promise<number> {
  if (!db) {
    console.log('  ℹ users: Firebase not configured, skipping');
    return 0;
  }
  try {
    const usersSnapshot = await db.collection('users').get();
    
    if (usersSnapshot.empty) {
      console.log('  ✓ users: Already empty');
      return 0;
    }

    const batch = db.batch();
    let count = 0;
    let superAdminCount = 0;
    const superAdminUsernames: string[] = [];

    usersSnapshot.docs.forEach((doc) => {
      const userData = doc.data();
      
      // Keep super admin users
      if (userData.role === 'super_admin') {
        superAdminCount++;
        if (userData.username) {
          superAdminUsernames.push(userData.username);
        }
        console.log(`  ℹ Keeping super admin: ${userData.email || doc.id}`);
      } else {
        batch.delete(doc.ref);
        count++;
      }
    });

    if (count > 0) {
      await batch.commit();
    }

    // Also clear usernames collection except for super admins
    const usernamesSnapshot = await db.collection('usernames').get();
    if (!usernamesSnapshot.empty) {
      const usernameBatch = db.batch();
      let usernamesDeleted = 0;
      
      usernamesSnapshot.docs.forEach((doc) => {
        if (!superAdminUsernames.includes(doc.id)) {
          usernameBatch.delete(doc.ref);
          usernamesDeleted++;
        }
      });
      
      if (usernamesDeleted > 0) {
        await usernameBatch.commit();
        console.log(`  ✓ usernames: Deleted ${usernamesDeleted} documents, kept ${superAdminUsernames.length} for super admin(s)`);
      } else {
        console.log(`  ✓ usernames: Kept ${superAdminUsernames.length} for super admin(s)`);
      }
    }

    console.log(`  ✓ users: Deleted ${count} documents, kept ${superAdminCount} super admin(s)`);
    return count;
  } catch (error: any) {
    console.error(`  ✗ users: Error - ${error.message}`);
    return 0;
  }
}

// Main cleanup function
async function clearDatabase() {
  console.log('\n🗑️  DATABASE CLEANUP SCRIPT\n');
  console.log('⚠️  WARNING: This will delete ALL data except super admin users!\n');
  
  console.log(`1️⃣ Firebase Firestore: ${hasFirebase ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`2️⃣ Neon Auction DB: ${hasAuctionDb ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`3️⃣ Neon Tournament DB: ${hasTournamentDb ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`4️⃣ Neon Fantasy DB: ${hasFantasyDb ? '✅ Configured' : '❌ Not configured'}\n`);
  
  if (!hasFirebase && !hasAuctionDb && !hasTournamentDb && !hasFantasyDb) {
    console.log('❌ No databases are configured! Please set environment variables:');
    console.log('  - FIREBASE_SERVICE_ACCOUNT (for Firebase)');
    console.log('  - NEON_DATABASE_URL or NEON_AUCTION_DB_URL (for Auction DB)');
    console.log('  - NEON_TOURNAMENT_DB_URL (for Tournament DB)');
    console.log('  - FANTASY_DATABASE_URL (for Fantasy DB)\n');
    process.exit(1);
  }
  
  // Dynamically discover Firebase collections and Neon tables
  let firebaseCollections: string[] = [];
  let auctionTables: string[] = [];
  let tournamentTables: string[] = [];
  let fantasyTables: string[] = [];
  
  if (hasFirebase) {
    firebaseCollections = await getAllFirebaseCollections();
  }
  if (hasAuctionDb) {
    auctionTables = await getAllTables(sqlAuction);
  }
  if (hasTournamentDb) {
    tournamentTables = await getAllTables(sqlTournament);
  }
  if (hasFantasyDb) {
    fantasyTables = await getAllTables(sqlFantasy);
  }
  
  if (hasFirebase) {
    console.log(`📦 Firebase Collections to clear (${firebaseCollections.length} collections):`);
    if (firebaseCollections.length > 0) {
      console.log('  - ' + firebaseCollections.join('\n  - '));
    }
    console.log('  - users (except super_admin role)\n');
  }
  
  if (hasAuctionDb) {
    console.log(`🎯 Neon Auction DB Tables to clear (${auctionTables.length} tables):`);
    if (auctionTables.length > 0) {
      console.log('  - ' + auctionTables.join('\n  - '));
    } else {
      console.log('  (No tables found)');
    }
    console.log('');
  }
  
  if (hasTournamentDb) {
    console.log(`⚽ Neon Tournament DB Tables to clear (${tournamentTables.length} tables):`);
    if (tournamentTables.length > 0) {
      console.log('  - ' + tournamentTables.join('\n  - '));
    } else {
      console.log('  (No tables found)');
    }
    console.log('');
  }
  
  if (hasFantasyDb) {
    console.log(`🏆 Neon Fantasy DB Tables to clear (${fantasyTables.length} tables):`);
    if (fantasyTables.length > 0) {
      console.log('  - ' + fantasyTables.join('\n  - '));
    } else {
      console.log('  (No tables found)');
    }
    console.log('');
  }

  // Ask for confirmation
  const answer = await askQuestion('Are you sure you want to continue? (yes/no): ');
  
  if (answer.toLowerCase() !== 'yes') {
    console.log('\n❌ Cleanup cancelled.');
    process.exit(0);
  }

  console.log('\n🚀 Starting cleanup...\n');

  let totalDeleted = 0;

  // Clear Firebase collections
  if (hasFirebase && firebaseCollections.length > 0) {
    console.log('📦 Clearing Firebase Collections...\n');
    for (const collection of firebaseCollections) {
      const deleted = await clearCollection(collection);
      totalDeleted += deleted;
    }
  }

  // Clear users except super admin
  const usersDeleted = await clearUsersExceptSuperAdmin();
  totalDeleted += usersDeleted;

  // Clear Neon databases
  let auctionDeleted = 0;
  let tournamentDeleted = 0;
  let fantasyDeleted = 0;
  
  if (hasAuctionDb && auctionTables.length > 0) {
    console.log('\n🎯 Clearing Neon Auction DB...\n');
    for (const table of auctionTables) {
      const deleted = await clearNeonTable(sqlAuction, table, 'Auction DB');
      auctionDeleted += deleted;
    }
  }
  
  if (hasTournamentDb && tournamentTables.length > 0) {
    console.log('\n⚽ Clearing Neon Tournament DB...\n');
    for (const table of tournamentTables) {
      const deleted = await clearNeonTable(sqlTournament, table, 'Tournament DB');
      tournamentDeleted += deleted;
    }
  }
  
  if (hasFantasyDb && fantasyTables.length > 0) {
    console.log('\n🏆 Clearing Neon Fantasy DB...\n');
    for (const table of fantasyTables) {
      const deleted = await clearNeonTable(sqlFantasy, table, 'Fantasy DB');
      fantasyDeleted += deleted;
    }
  }

  const neonTotalDeleted = auctionDeleted + tournamentDeleted + fantasyDeleted;
  
  console.log('\n✅ Cleanup completed!');
  console.log(`📊 Firebase documents deleted: ${totalDeleted}`);
  console.log(`📊 Neon Auction DB rows deleted: ${auctionDeleted}`);
  console.log(`📊 Neon Tournament DB rows deleted: ${tournamentDeleted}`);
  console.log(`📊 Neon Fantasy DB rows deleted: ${fantasyDeleted}`);
  console.log(`📊 Total records deleted: ${totalDeleted + neonTotalDeleted}\n`);

  process.exit(0);
}

// Run the cleanup
clearDatabase().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
