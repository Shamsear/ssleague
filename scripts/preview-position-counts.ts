/**
 * Preview Position Counts Verification
 * 
 * This script checks if position counts are correct in both databases:
 * 1. Neon PostgreSQL - teams table
 * 2. Firebase - team_seasons collection
 * 
 * Compares against actual player data to find discrepancies
 */


import { neon } from '@neondatabase/serverless';
import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    const serviceAccount = JSON.parse(
        process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}'
    );

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

const db = admin.firestore();


interface PositionCounts {
    GK?: number;
    DEF?: number;
    MID?: number;
    FWD?: number;
    [key: string]: number | undefined;
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

    // Firebase counts
    firebase_position_counts: PositionCounts;
    firebase_players_count: number;

    // Discrepancies
    neon_count_mismatch: boolean;
    firebase_count_mismatch: boolean;
    firebase_position_mismatch: boolean;

    issues: string[];
}

async function getActualPositionCounts(teamId: string, seasonId: string): Promise<{ counts: PositionCounts; total: number }> {
    // Get all players for this team in this season
    const players = await sql`
    SELECT 
      fp.position,
      COUNT(*) as count
    FROM team_players tp
    JOIN footballplayers fp ON tp.player_id = fp.id
    WHERE tp.team_id = ${teamId}
    AND tp.season_id = ${seasonId}
    GROUP BY fp.position
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
      football_players_count
    FROM teams
    WHERE id = ${teamId}
    AND season_id = ${seasonId}
  `;

    return result[0] || null;
}

async function getFirebaseTeamData(teamId: string, seasonId: string) {
    const teamSeasonId = `${teamId}_${seasonId}`;
    const docRef = db.collection('team_seasons').doc(teamSeasonId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
        return null;
    }

    const data = docSnap.data();
    return {
        position_counts: data?.position_counts || {},
        players_count: data?.players_count || 0,
        team_name: data?.team_name || 'Unknown',
    };
}

function comparePositionCounts(actual: PositionCounts, stored: PositionCounts): boolean {
    const allPositions = new Set([...Object.keys(actual), ...Object.keys(stored)]);

    for (const position of allPositions) {
        const actualCount = actual[position] || 0;
        const storedCount = stored[position] || 0;

        if (actualCount !== storedCount) {
            return false;
        }
    }

    return true;
}

function formatPositionCounts(counts: PositionCounts): string {
    const positions = ['GK', 'DEF', 'MID', 'FWD'];
    return positions.map(pos => `${pos}: ${counts[pos] || 0}`).join(', ');
}

async function analyzeTeam(teamId: string, seasonId: string): Promise<TeamAnalysis> {
    const issues: string[] = [];

    // Get actual position counts from player data
    const { counts: actualCounts, total: actualTotal } = await getActualPositionCounts(teamId, seasonId);

    // Get Neon data
    const neonData = await getNeonTeamData(teamId, seasonId);
    const neonCount = neonData?.football_players_count || 0;
    const teamName = neonData?.team_name || 'Unknown';

    // Get Firebase data
    const firebaseData = await getFirebaseTeamData(teamId, seasonId);
    const firebaseCounts = firebaseData?.position_counts || {};
    const firebaseTotal = firebaseData?.players_count || 0;

    // Check for mismatches
    const neonMismatch = neonCount !== actualTotal;
    const firebaseTotalMismatch = firebaseTotal !== actualTotal;
    const firebasePositionMismatch = !comparePositionCounts(actualCounts, firebaseCounts);

    if (neonMismatch) {
        issues.push(`Neon count mismatch: Expected ${actualTotal}, got ${neonCount}`);
    }

    if (firebaseTotalMismatch) {
        issues.push(`Firebase total count mismatch: Expected ${actualTotal}, got ${firebaseTotal}`);
    }

    if (firebasePositionMismatch) {
        issues.push(`Firebase position counts mismatch`);
        issues.push(`  Expected: ${formatPositionCounts(actualCounts)}`);
        issues.push(`  Got: ${formatPositionCounts(firebaseCounts)}`);
    }

    return {
        team_id: teamId,
        team_name: teamName,
        season_id: seasonId,
        actual_position_counts: actualCounts,
        actual_total_players: actualTotal,
        neon_football_players_count: neonCount,
        firebase_position_counts: firebaseCounts,
        firebase_players_count: firebaseTotal,
        neon_count_mismatch: neonMismatch,
        firebase_count_mismatch: firebaseTotalMismatch,
        firebase_position_mismatch: firebasePositionMismatch,
        issues,
    };
}

async function main() {
    console.log('🔍 Starting Position Counts Verification...\n');

    // Get current season
    const seasonResult = await sql`
    SELECT id, name, status 
    FROM seasons 
    WHERE status = 'active' 
    ORDER BY created_at DESC 
    LIMIT 1
  `;

    if (seasonResult.length === 0) {
        console.log('❌ No active season found');
        return;
    }

    const season = seasonResult[0];
    const seasonId = season.id;

    console.log(`📅 Season: ${season.name} (${seasonId})`);
    console.log(`📊 Status: ${season.status}\n`);

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

        console.log(`\n🔥 Firebase Database (team_seasons):`);
        console.log(`   Total Count: ${analysis.firebase_players_count} ${analysis.firebase_count_mismatch ? '❌ MISMATCH' : '✅'}`);
        console.log(`   Position Counts: ${formatPositionCounts(analysis.firebase_position_counts)} ${analysis.firebase_position_mismatch ? '❌ MISMATCH' : '✅'}`);

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
        console.log('\n✅ ALL POSITION COUNTS ARE CORRECT!');
    }

    // Detailed breakdown by issue type
    const neonIssues = analyses.filter(a => a.neon_count_mismatch).length;
    const firebaseTotalIssues = analyses.filter(a => a.firebase_count_mismatch).length;
    const firebasePositionIssues = analyses.filter(a => a.firebase_position_mismatch).length;

    console.log('\n\n📊 ISSUE BREAKDOWN');
    console.log('='.repeat(100));
    console.log(`Neon football_players_count mismatches: ${neonIssues}`);
    console.log(`Firebase players_count mismatches: ${firebaseTotalIssues}`);
    console.log(`Firebase position_counts mismatches: ${firebasePositionIssues}`);

    console.log('\n✅ Preview complete - No changes made to databases');
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
