/**
 * Check realplayerstats table for a specific team
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

async function checkRealPlayerStats() {
    const output: string[] = [];

    try {
        const teamId = 'SSPSLT0013';

        output.push(`\n🔍 Checking realplayerstats for team: ${teamId}\n`);

        // Check all seasons for this team
        const allSeasons = await sql`
      SELECT DISTINCT season_id, team_id, team
      FROM realplayerstats
      WHERE team_id = ${teamId}
      ORDER BY season_id DESC
    `;

        output.push(`Found ${allSeasons.length} seasons for team ${teamId}:`);
        allSeasons.forEach((s: any) => {
            output.push(`  - ${s.season_id} (team: ${s.team})`);
        });

        // Check a specific season (S15)
        output.push(`\n🔍 Checking S15 specifically:\n`);
        const s15Players = await sql`
      SELECT player_id, player_name, team_id, season_id, matches_played, goals_scored, assists, points
      FROM realplayerstats
      WHERE team_id = ${teamId} AND season_id = 'S15'
      ORDER BY points DESC
    `;

        output.push(`Found ${s15Players.length} players in S15:`);
        s15Players.forEach((p: any) => {
            output.push(`  - ${p.player_name}: ${p.points} pts (${p.goals_scored}G, ${p.assists}A)`);
        });

        // Check total count in realplayerstats
        output.push(`\n📊 Total stats:\n`);
        const totalCount = await sql`
      SELECT COUNT(*) as count FROM realplayerstats
    `;
        output.push(`Total records in realplayerstats: ${totalCount[0].count}`);

        // Check distinct teams
        const distinctTeams = await sql`
      SELECT DISTINCT team_id, team FROM realplayerstats ORDER BY team_id
    `;
        output.push(`\nDistinct teams (${distinctTeams.length}):`);
        distinctTeams.slice(0, 20).forEach((t: any) => {
            output.push(`  - ${t.team_id}: ${t.team}`);
        });

        // Write to file
        const outputText = output.join('\n');
        fs.writeFileSync('realplayerstats-check.txt', outputText);
        console.log('✅ Results written to realplayerstats-check.txt');
        console.log(outputText);

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

checkRealPlayerStats();
