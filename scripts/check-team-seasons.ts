/**
 * Check what seasons exist for team SSPSLT0013
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

async function checkTeamSeasons() {
    const output: string[] = [];

    try {
        const teamId = 'SSPSLT0013';

        output.push(`\n🔍 Checking all data for team: ${teamId}\n`);

        // Check teamstats
        output.push(`📊 Team Stats (teamstats table):\n`);
        const teamStats = await sql`
      SELECT season_id, team_name, matches_played, wins, draws, losses, points, position
      FROM teamstats
      WHERE team_id = ${teamId}
      ORDER BY season_id DESC
    `;

        output.push(`Found ${teamStats.length} seasons in teamstats:`);
        teamStats.forEach((s: any) => {
            output.push(`  - ${s.season_id}: ${s.team_name} (${s.matches_played} matches, ${s.points} pts, pos: ${s.position || 'N/A'})`);
        });

        // Check realplayerstats
        output.push(`\n👥 Real Players (realplayerstats table):\n`);
        const realPlayers = await sql`
      SELECT DISTINCT season_id, COUNT(*) as player_count
      FROM realplayerstats
      WHERE team_id = ${teamId}
      GROUP BY season_id
      ORDER BY season_id DESC
    `;

        output.push(`Found ${realPlayers.length} seasons with players in realplayerstats:`);
        realPlayers.forEach((s: any) => {
            output.push(`  - ${s.season_id}: ${s.player_count} players`);
        });

        // Check player_seasons (modern table)
        output.push(`\n👥 Modern Players (player_seasons table):\n`);
        const modernPlayers = await sql`
      SELECT DISTINCT season_id, COUNT(*) as player_count
      FROM player_seasons
      WHERE team_id = ${teamId}
      GROUP BY season_id
      ORDER BY season_id DESC
    `;

        output.push(`Found ${modernPlayers.length} seasons with players in player_seasons:`);
        modernPlayers.forEach((s: any) => {
            output.push(`  - ${s.season_id}: ${s.player_count} players`);
        });

        // Write to file
        const outputText = output.join('\n');
        fs.writeFileSync('team-seasons-check.txt', outputText);
        console.log('✅ Results written to team-seasons-check.txt');
        console.log(outputText);

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

checkTeamSeasons();
