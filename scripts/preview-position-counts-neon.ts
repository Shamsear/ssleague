/**
 * Preview Position Counts Verification (Neon Only - Simplified)
 * 
 * This script checks if position counts are correct in Neon PostgreSQL database
 * Compares against actual player data to find discrepancies
 */

import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

interface PositionCounts {
    [key: string]: number;
}

interface TeamAnalysis {
    team_id: string;
    team_name: string;
    season_id: string;

    // Actual counts from player data
    actual_position_counts: PositionCounts;
    actual_total_players: number;

    // Neon database counts
    neon_football_players_count: number;

    // Discrepancies
    neon_count_mismatch: boolean;

    issues: string[];
}

async function getActualPositionCounts(teamId: string, seasonId: string): Promise<{ counts: PositionCounts; total: number }> {
    // Get all players for this team in this season directly from footballplayers table
    const players = await sql`
    SELECT 
      position,
      COUNT(*) as count
    FROM footballplayers
    WHERE team_id = ${teamId}
    AND season_id = ${seasonId}
    AND is_sold = true
    GROUP BY position
  `;

    const counts: PositionCounts = {};
    let total = 0;

    for (const row of players) {
        const position = row.position as string;
        const count = parseInt(row.count as string);
        counts[position] = count;
        total += count;
    }

    return { counts, total };
}

async function getNeonTeamData(teamId: string, seasonId: string) {
    const result = await sql`
    SELECT 
      id,
      team_name,
      football_players_count,
      football_budget,
      football_spent
    FROM teams
    WHERE id = ${teamId}
    AND season_id = ${seasonId}
  `;

    return result[0] || null;
}

function formatPositionCounts(counts: PositionCounts): string {
    if (Object.keys(counts).length === 0) {
        return 'No players';
    }

    return Object.entries(counts)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([pos, count]) => `${pos}: ${count}`)
        .join(', ');
}

async function analyzeTeam(teamId: string, seasonId: string): Promise<TeamAnalysis> {
    const issues: string[] = [];

    // Get actual position counts from player data
    const { counts: actualCounts, total: actualTotal } = await getActualPositionCounts(teamId, seasonId);

    // Get Neon data
    const neonData = await getNeonTeamData(teamId, seasonId);
    const neonCount = neonData?.football_players_count || 0;
    const teamName = neonData?.team_name || 'Unknown';

    // Check for mismatches
    const neonMismatch = neonCount !== actualTotal;

    if (neonMismatch) {
        issues.push(`Neon count mismatch: Expected ${actualTotal}, got ${neonCount}`);
    }

    return {
        team_id: teamId,
        team_name: teamName,
        season_id: seasonId,
        actual_position_counts: actualCounts,
        actual_total_players: actualTotal,
        neon_football_players_count: neonCount,
        neon_count_mismatch: neonMismatch,
        issues,
    };
}

async function main() {
    console.log('🔍 Starting Position Counts Verification (Neon Database)...\n');

    // Get all distinct season_ids from teams table
    const seasonResults = await sql`
    SELECT DISTINCT season_id
    FROM teams
    WHERE season_id IS NOT NULL
    ORDER BY season_id DESC
    LIMIT 1
  `;

    if (seasonResults.length === 0) {
        console.log('❌ No seasons found in teams table');
        return;
    }

    const seasonId = seasonResults[0].season_id;

    console.log(`📅 Season ID: ${seasonId}\n`);

    // Get all teams in this season
    const teams = await sql`
    SELECT DISTINCT id, team_name
    FROM teams
    WHERE season_id = ${seasonId}
    ORDER BY team_name
  `;

    console.log(`👥 Found ${teams.length} teams\n`);
    console.log('='.repeat(100));

    const analyses: TeamAnalysis[] = [];
    let teamsWithIssues = 0;

    for (const team of teams) {
        const analysis = await analyzeTeam(team.id, seasonId);
        analyses.push(analysis);

        const hasIssues = analysis.issues.length > 0;
        if (hasIssues) teamsWithIssues++;

        const statusIcon = hasIssues ? '❌' : '✅';

        console.log(`\n${statusIcon} ${analysis.team_name} (${analysis.team_id})`);
        console.log('-'.repeat(100));

        console.log(`\n📊 Actual Player Data (Source of Truth):`);
        console.log(`   Total Players: ${analysis.actual_total_players}`);
        console.log(`   Position Breakdown: ${formatPositionCounts(analysis.actual_position_counts)}`);

        console.log(`\n🗄️  Neon Database (teams.football_players_count):`);
        console.log(`   Count: ${analysis.neon_football_players_count} ${analysis.neon_count_mismatch ? '❌ MISMATCH' : '✅'}`);

        if (hasIssues) {
            console.log(`\n⚠️  Issues Found:`);
            analysis.issues.forEach(issue => console.log(`   - ${issue}`));
        }

        console.log('\n' + '='.repeat(100));
    }

    // Summary
    console.log('\n\n📋 SUMMARY');
    console.log('='.repeat(100));
    console.log(`Total Teams Analyzed: ${teams.length}`);
    console.log(`Teams with Correct Counts: ${teams.length - teamsWithIssues} ✅`);
    console.log(`Teams with Issues: ${teamsWithIssues} ❌`);

    if (teamsWithIssues > 0) {
        console.log('\n⚠️  ISSUES DETECTED - Position counts need correction!');
        console.log('\nTeams with issues:');
        analyses
            .filter(a => a.issues.length > 0)
            .forEach(a => {
                console.log(`\n  ${a.team_name} (${a.team_id}):`);
                a.issues.forEach(issue => console.log(`    - ${issue}`));
            });
    } else {
        console.log('\n✅ ALL POSITION COUNTS ARE CORRECT IN NEON DATABASE!');
    }

    // Detailed breakdown
    const neonIssues = analyses.filter(a => a.neon_count_mismatch).length;

    console.log('\n\n📊 ISSUE BREAKDOWN');
    console.log('='.repeat(100));
    console.log(`Neon football_players_count mismatches: ${neonIssues}`);

    console.log('\n✅ Preview complete - No changes made to database');
    console.log('\n💡 Note: This checks Neon database only. Firebase check requires FIREBASE_SERVICE_ACCOUNT_KEY');
}

main()
    .then(() => {
        console.log('\n🎉 Analysis complete!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Error:', error);
        process.exit(1);
    });
