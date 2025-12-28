/**
 * Comprehensive analysis of realplayerstats table
 */

import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const connectionString = process.env.NEON_TOURNAMENT_DB_URL;

if (!connectionString) {
    console.error('❌ NEON_TOURNAMENT_DB_URL environment variable is not set');
    process.exit(1);
}

const sql = neon(connectionString);

async function analyzeRealPlayerStats() {
    const output: string[] = [];

    try {
        output.push(`\n${'='.repeat(80)}`);
        output.push(`COMPREHENSIVE ANALYSIS OF REALPLAYERSTATS TABLE`);
        output.push(`${'='.repeat(80)}\n`);

        // 1. Total count
        const totalCount = await sql`SELECT COUNT(*) as count FROM realplayerstats`;
        output.push(`📊 Total Records: ${totalCount[0].count}\n`);

        // 2. Check all columns
        output.push(`📋 Table Schema:\n`);
        const columns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'realplayerstats'
      ORDER BY ordinal_position
    `;
        columns.forEach((col: any) => {
            output.push(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
        });

        // 3. Season distribution
        output.push(`\n📅 Season Distribution:\n`);
        const seasonDist = await sql`
      SELECT season_id, COUNT(*) as player_count, COUNT(DISTINCT team_id) as team_count
      FROM realplayerstats
      GROUP BY season_id
      ORDER BY season_id
    `;
        output.push(`Found ${seasonDist.length} distinct seasons:`);
        seasonDist.forEach((s: any) => {
            output.push(`  - ${s.season_id}: ${s.player_count} players across ${s.team_count} teams`);
        });

        // 4. Check for S15 specifically
        output.push(`\n🔍 Season S15 Deep Dive:\n`);
        const s15Count = await sql`
      SELECT COUNT(*) as count FROM realplayerstats WHERE season_id = 'S15'
    `;
        output.push(`Total S15 records: ${s15Count[0].count}`);

        if (s15Count[0].count > 0) {
            const s15Teams = await sql`
        SELECT team_id, team, COUNT(*) as player_count
        FROM realplayerstats
        WHERE season_id = 'S15'
        GROUP BY team_id, team
        ORDER BY team_id
      `;
            output.push(`\nS15 Teams (${s15Teams.length}):`);
            s15Teams.forEach((t: any) => {
                output.push(`  - ${t.team_id} (${t.team}): ${t.player_count} players`);
            });
        }

        // 5. Check for SSPSLS15 (with typo pattern)
        output.push(`\n🔍 Checking for SSPSLS15 (typo pattern):\n`);
        const sspsls15Count = await sql`
      SELECT COUNT(*) as count FROM realplayerstats WHERE season_id = 'SSPSLS15'
    `;
        output.push(`Total SSPSLS15 records: ${sspsls15Count[0].count}`);

        if (sspsls15Count[0].count > 0) {
            const sspsls15Teams = await sql`
        SELECT team_id, team, COUNT(*) as player_count
        FROM realplayerstats
        WHERE season_id = 'SSPSLS15'
        GROUP BY team_id, team
        ORDER BY team_id
      `;
            output.push(`\nSSPSLS15 Teams (${sspsls15Teams.length}):`);
            sspsls15Teams.forEach((t: any) => {
                output.push(`  - ${t.team_id} (${t.team}): ${t.player_count} players`);
            });

            // Check if SSPSLT0013 is in SSPSLS15
            const team13 = sspsls15Teams.find((t: any) => t.team_id === 'SSPSLT0013');
            if (team13) {
                output.push(`\n✅ Found SSPSLT0013 in SSPSLS15!`);

                // Get the players
                const players = await sql`
          SELECT player_id, player_name, matches_played, goals_scored, assists, points
          FROM realplayerstats
          WHERE season_id = 'SSPSLS15' AND team_id = 'SSPSLT0013'
          ORDER BY points DESC
        `;
                output.push(`\nPlayers for SSPSLT0013 in SSPSLS15:`);
                players.forEach((p: any) => {
                    output.push(`  - ${p.player_name}: ${p.points} pts (${p.goals_scored}G, ${p.assists}A, ${p.matches_played} matches)`);
                });
            } else {
                output.push(`\n❌ SSPSLT0013 NOT found in SSPSLS15`);
            }
        }

        // 6. Check all season_id patterns
        output.push(`\n🔍 All Unique Season IDs:\n`);
        const allSeasonIds = await sql`
      SELECT DISTINCT season_id
      FROM realplayerstats
      ORDER BY season_id
    `;
        output.push(`Found ${allSeasonIds.length} unique season IDs:`);
        allSeasonIds.forEach((s: any) => {
            output.push(`  - ${s.season_id}`);
        });

        // 7. Check team SSPSLT0013 across all seasons
        output.push(`\n🔍 Team SSPSLT0013 in ALL seasons:\n`);
        const team13AllSeasons = await sql`
      SELECT season_id, team, COUNT(*) as player_count
      FROM realplayerstats
      WHERE team_id = 'SSPSLT0013'
      GROUP BY season_id, team
      ORDER BY season_id
    `;
        output.push(`Found ${team13AllSeasons.length} seasons for SSPSLT0013:`);
        team13AllSeasons.forEach((s: any) => {
            output.push(`  - ${s.season_id} (${s.team}): ${s.player_count} players`);
        });

        output.push(`\n${'='.repeat(80)}\n`);

        // Write to file
        const outputText = output.join('\n');
        fs.writeFileSync('realplayerstats-analysis.txt', outputText);
        console.log('✅ Results written to realplayerstats-analysis.txt');
        console.log(outputText);

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

analyzeRealPlayerStats();
