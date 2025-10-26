/**
 * PHASE 2: Migrate Existing Data to Multi-Tournament
 * 
 * This script populates tournament_id for all existing data
 * and creates default "League" tournaments for each season.
 * 
 * Run this AFTER 01-create-multi-tournament-architecture.ts
 */

import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

// Load environment variables
config({ path: '.env.local' });

// Initialize Firebase for this script
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrateExistingData() {
  const sql = neon(process.env.NEON_TOURNAMENT_DB_URL!);

  console.log('🚀 Starting Data Migration to Multi-Tournament');
  console.log('=============================================\n');

  try {
    // ========================================
    // STEP 1: Get all seasons from Firebase
    // ========================================
    console.log('📊 Step 1/6: Fetching seasons from Firebase...');
    
    const seasonsSnapshot = await getDocs(collection(db, 'seasons'));
    const seasons: any[] = [];
    
    seasonsSnapshot.forEach((doc) => {
      seasons.push({
        id: doc.id,
        ...doc.data()
      });
    });

    console.log(`✅ Found ${seasons.length} seasons\n`);

    // ========================================
    // STEP 2: Create default tournaments for each season
    // ========================================
    console.log('📊 Step 2/6: Creating default tournaments...');
    
    for (const season of seasons) {
      const tournamentId = `${season.id}-LEAGUE`;
      
      await sql`
        INSERT INTO tournaments (
          id,
          season_id,
          tournament_type,
          tournament_name,
          tournament_code,
          status,
          is_primary,
          display_order,
          start_date,
          end_date
        ) VALUES (
          ${tournamentId},
          ${season.id},
          'league',
          ${season.name || season.id} || ' League',
          'PL',
          ${season.isActive ? 'active' : 'completed'},
          true,
          1,
          ${season.startDate ? new Date(season.startDate.toDate()) : null},
          ${season.endDate ? new Date(season.endDate.toDate()) : null}
        )
        ON CONFLICT (season_id, tournament_type) DO UPDATE SET
          tournament_name = EXCLUDED.tournament_name,
          status = EXCLUDED.status,
          updated_at = NOW()
      `;
      
      console.log(`  ✅ Created tournament: ${tournamentId}`);
    }

    console.log(`✅ Created ${seasons.length} default tournaments\n`);

    // ========================================
    // STEP 3: Migrate fixtures
    // ========================================
    console.log('📊 Step 3/6: Migrating fixtures data...');
    
    await sql`
      UPDATE fixtures
      SET tournament_id = season_id || '-LEAGUE'
      WHERE tournament_id IS NULL
    `;

    const fixturesCount = await sql`SELECT COUNT(*) as count FROM fixtures WHERE tournament_id IS NOT NULL`;
    console.log(`✅ Migrated ${fixturesCount[0].count} fixtures\n`);

    // ========================================
    // STEP 4: Migrate realplayerstats
    // ========================================
    console.log('📊 Step 4/6: Migrating player stats data...');
    
    await sql`
      UPDATE realplayerstats
      SET tournament_id = season_id || '-LEAGUE'
      WHERE tournament_id IS NULL
    `;

    const playerStatsCount = await sql`SELECT COUNT(*) as count FROM realplayerstats WHERE tournament_id IS NOT NULL`;
    console.log(`✅ Migrated ${playerStatsCount[0].count} player stat records\n`);

    // ========================================
    // STEP 5: Migrate teamstats
    // ========================================
    console.log('📊 Step 5/6: Migrating team stats data...');
    
    await sql`
      UPDATE teamstats
      SET tournament_id = season_id || '-LEAGUE'
      WHERE tournament_id IS NULL
    `;

    const teamStatsCount = await sql`SELECT COUNT(*) as count FROM teamstats WHERE tournament_id IS NOT NULL`;
    console.log(`✅ Migrated ${teamStatsCount[0].count} team stat records\n`);

    // ========================================
    // STEP 6: Migrate tournament_settings
    // ========================================
    console.log('📊 Step 6/6: Migrating tournament settings...');
    
    await sql`
      UPDATE tournament_settings
      SET tournament_id = season_id || '-LEAGUE'
      WHERE tournament_id IS NULL
    `;

    const settingsCount = await sql`SELECT COUNT(*) as count FROM tournament_settings WHERE tournament_id IS NOT NULL`;
    console.log(`✅ Migrated ${settingsCount[0].count} tournament settings\n`);

    // ========================================
    // STEP 7: Update matchups with tournament_id from fixtures
    // ========================================
    console.log('📊 Step 7/7: Updating matchups with tournament_id...');
    
    let matchupsCount = [{count: 0}];
    try {
      // Check if matchups table has fixture_id column
      const matchupsColumns = await sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'matchups' AND column_name = 'fixture_id'
      `;
      
      if (matchupsColumns.length > 0) {
        await sql`
          UPDATE matchups m
          SET tournament_id = f.tournament_id
          FROM fixtures f
          WHERE m.fixture_id = f.id
            AND m.tournament_id IS NULL
        `;

        matchupsCount = await sql`SELECT COUNT(*) as count FROM matchups WHERE tournament_id IS NOT NULL`;
        console.log(`✅ Updated ${matchupsCount[0].count} matchups\n`);
      } else {
        console.log(`⚠️  Matchups table doesn't have fixture_id column, skipping...\n`);
      }
    } catch (error) {
      console.log(`⚠️  Matchups update skipped (table may not exist)\n`);
    }

    console.log('=============================================');
    console.log('✨ Data Migration Complete!');
    console.log('=============================================\n');
    
    console.log('📊 Summary:');
    console.log(`  - Seasons processed: ${seasons.length}`);
    console.log(`  - Tournaments created: ${seasons.length}`);
    console.log(`  - Fixtures migrated: ${fixturesCount[0].count}`);
    console.log(`  - Player stats migrated: ${playerStatsCount[0].count}`);
    console.log(`  - Team stats migrated: ${teamStatsCount[0].count}`);
    console.log(`  - Settings migrated: ${settingsCount[0].count}`);
    console.log(`  - Matchups updated: ${matchupsCount[0].count}\n`);

    console.log('⚠️  NEXT STEPS:');
    console.log('1. Run script 03-add-constraints.ts to add foreign keys');
    console.log('2. Verify data integrity');
    console.log('3. Update API routes\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run the migration
migrateExistingData()
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Failed:', error);
    process.exit(1);
  });
