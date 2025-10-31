/**
 * Migration Script: Populate team_trophies table from existing data
 * 
 * This script:
 * 1. Reads all teamstats records
 * 2. Creates trophy records based on position (1 = Winner, 2 = Runner Up)
 * 3. Extracts cup trophies from teamstats.trophies JSONB field
 * 4. Inserts all trophies into team_trophies table
 * 
 * Usage: npx tsx scripts/migrate-trophies-to-table.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { neon } from '@neondatabase/serverless';

// Load environment variables FIRST
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function migrateTrophies() {
  console.log('🏆 Starting trophy migration...\n');
  console.log('='.repeat(80) + '\n');

  try {
    const connectionString = process.env.NEON_TOURNAMENT_DB_URL;
    if (!connectionString) {
      throw new Error('NEON_TOURNAMENT_DB_URL not found in environment');
    }
    const sql = neon(connectionString);

    // 1. Fetch all teamstats records
    console.log('📊 Fetching all teamstats records...');
    const allTeamStats = await sql`
      SELECT 
        team_id,
        team_name,
        season_id,
        position,
        trophies
      FROM teamstats
      WHERE season_id IS NOT NULL
      ORDER BY season_id, position
    `;

    console.log(`✅ Found ${allTeamStats.length} teamstats records\n`);

    let trophiesCreated = 0;
    let skipped = 0;

    // 2. Process each team's stats
    for (const stats of allTeamStats) {
      const { team_id, team_name, season_id, position, trophies } = stats;

      console.log(`\n📌 Processing: ${team_name} (${season_id})`);

      // A. Insert position-based trophies
      if (position === 1) {
        try {
          const result = await sql`
            INSERT INTO team_trophies (
              team_id,
              team_name,
              season_id,
              trophy_type,
              trophy_name,
              position,
              awarded_by,
              notes
            )
            VALUES (
              ${team_id},
              ${team_name},
              ${season_id},
              'league',
              'League Winner',
              1,
              'system',
              'Migrated from teamstats.position'
            )
            ON CONFLICT (team_id, season_id, trophy_name) DO NOTHING
            RETURNING id
          `;

          if (result.length > 0) {
            console.log(`  ✅ Added: League Winner`);
            trophiesCreated++;
          } else {
            console.log(`  ℹ️  Skipped: League Winner (already exists)`);
            skipped++;
          }
        } catch (error) {
          console.error(`  ❌ Error adding League Winner:`, error);
        }
      } else if (position === 2) {
        try {
          const result = await sql`
            INSERT INTO team_trophies (
              team_id,
              team_name,
              season_id,
              trophy_type,
              trophy_name,
              position,
              awarded_by,
              notes
            )
            VALUES (
              ${team_id},
              ${team_name},
              ${season_id},
              'runner_up',
              'Runner Up',
              2,
              'system',
              'Migrated from teamstats.position'
            )
            ON CONFLICT (team_id, season_id, trophy_name) DO NOTHING
            RETURNING id
          `;

          if (result.length > 0) {
            console.log(`  ✅ Added: Runner Up`);
            trophiesCreated++;
          } else {
            console.log(`  ℹ️  Skipped: Runner Up (already exists)`);
            skipped++;
          }
        } catch (error) {
          console.error(`  ❌ Error adding Runner Up:`, error);
        }
      }

      // B. Extract and insert cup trophies from JSONB
      if (trophies && Array.isArray(trophies)) {
        for (const trophy of trophies) {
          if (trophy.type === 'cup' && trophy.name) {
            try {
              const result = await sql`
                INSERT INTO team_trophies (
                  team_id,
                  team_name,
                  season_id,
                  trophy_type,
                  trophy_name,
                  awarded_by,
                  notes
                )
                VALUES (
                  ${team_id},
                  ${team_name},
                  ${season_id},
                  'cup',
                  ${trophy.name},
                  'system',
                  'Migrated from teamstats.trophies'
                )
                ON CONFLICT (team_id, season_id, trophy_name) DO NOTHING
                RETURNING id
              `;

              if (result.length > 0) {
                console.log(`  ✅ Added: ${trophy.name} (Cup)`);
                trophiesCreated++;
              } else {
                console.log(`  ℹ️  Skipped: ${trophy.name} (already exists)`);
                skipped++;
              }
            } catch (error) {
              console.error(`  ❌ Error adding ${trophy.name}:`, error);
            }
          }
        }
      }
    }

    // 3. Summary
    console.log('\n' + '='.repeat(80));
    console.log('🎉 Migration Complete!\n');
    console.log(`📊 Stats:`);
    console.log(`   - Teams processed: ${allTeamStats.length}`);
    console.log(`   - Trophies created: ${trophiesCreated}`);
    console.log(`   - Skipped (duplicates): ${skipped}`);
    console.log(`   - Total: ${trophiesCreated + skipped}`);

    // 4. Verify
    console.log('\n🔍 Verifying migration...');
    const verifyCount = await sql`
      SELECT COUNT(*) as count
      FROM team_trophies
    `;
    console.log(`✅ Total trophies in team_trophies table: ${verifyCount[0].count}\n`);

  } catch (error: any) {
    console.error('❌ Migration failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run migration
migrateTrophies()
  .then(() => {
    console.log('✅ Migration script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration script failed:', error);
    process.exit(1);
  });
