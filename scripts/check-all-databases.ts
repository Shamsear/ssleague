import * as dotenv from 'dotenv';
import * as path from 'path';
import * as admin from 'firebase-admin';
import { neon } from '@neondatabase/serverless';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Initialize Firebase Admin
if (!admin.apps.length) {
  if (process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
    console.log('✅ Firebase Admin initialized\n');
  }
}

const db = admin.firestore();

async function checkFirebase() {
  console.log('🔥 FIREBASE FIRESTORE\n');
  console.log('=' .repeat(50));
  
  const collections = ['users', 'teams', 'seasons', 'squads', 'fixtures', 'transactions', 
                       'tournaments', 'lineups', 'match_results', 'player_stats', 
                       'team_stats', 'standings', 'awards', 'audit_logs', 
                       'notifications', 'disputes', 'realplayer', 'categories', 
                       'match_days', 'deadlines', 'team_members'];
  
  let totalDocs = 0;
  for (const collectionName of collections) {
    try {
      const snapshot = await db.collection(collectionName).get();
      if (snapshot.size > 0) {
        console.log(`${collectionName}: ${snapshot.size} documents`);
        totalDocs += snapshot.size;
      }
    } catch (error) {
      // Skip
    }
  }
  
  console.log('\n📊 Total Firebase documents:', totalDocs);
  console.log('=' .repeat(50) + '\n');
}

async function checkNeonDb(url: string | undefined, dbName: string, tables: string[]) {
  if (!url) {
    console.log(`\n❌ ${dbName}: Not configured\n`);
    return;
  }
  
  console.log(`\n${dbName}\n`);
  console.log('=' .repeat(50));
  
  const sql = neon(url);
  let totalRows = 0;
  
  for (const tableName of tables) {
    try {
      const result = await sql.unsafe(`SELECT COUNT(*) as count FROM ${tableName}`);
      const count = parseInt(result[0]?.count || '0');
      if (count > 0) {
        console.log(`${tableName}: ${count} rows`);
        totalRows += count;
      }
    } catch (error: any) {
      // Skip if table doesn't exist
    }
  }
  
  console.log(`\n📊 Total ${dbName} rows:`, totalRows);
  console.log('=' .repeat(50) + '\n');
}

async function listAllTables(url: string | undefined, dbName: string) {
  if (!url) {
    console.log(`\n⚠️  ${dbName}: URL not configured`);
    return;
  }
  
  console.log(`\n${dbName}`);
  console.log('=' .repeat(50));
  
  const sql = neon(url);
  
  try {
    const result = await sql.unsafe(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    console.log(`Found ${result.length} tables\n`);
    
    let totalRows = 0;
    if (result.length > 0) {
      for (const row of result) {
        const countResult = await sql.unsafe(`SELECT COUNT(*) as count FROM ${row.table_name}`);
        const count = parseInt(countResult[0]?.count || '0');
        if (count > 0) {
          console.log(`  ${row.table_name}: ${count} rows`);
          totalRows += count;
        }
      }
      if (totalRows === 0) {
        console.log('  All tables are empty');
      } else {
        console.log(`\n📊 Total rows: ${totalRows}`);
      }
    } else {
      console.log('  No tables found');
    }
  } catch (error: any) {
    console.error(`  ❌ Error: ${error.message}`);
  }
  console.log('=' .repeat(50));
}

async function main() {
  console.log('\n🔍 CHECKING ALL DATABASES\n');
  
  // Check Firebase
  await checkFirebase();
  
  // Check Neon Auction DB
  const auctionUrl = process.env.NEON_DATABASE_URL || process.env.NEON_AUCTION_DB_URL;
  await listAllTables(auctionUrl, '🎯 NEON AUCTION DB');
  
  // Check Neon Tournament DB
  await listAllTables(process.env.NEON_TOURNAMENT_DB_URL, '⚽ NEON TOURNAMENT DB');
  
  // Check Neon Fantasy DB
  await listAllTables(process.env.FANTASY_DATABASE_URL, '🏆 NEON FANTASY DB');
  
  await admin.app().delete();
  console.log('\n✅ Done\n');
}

main().catch(console.error);
