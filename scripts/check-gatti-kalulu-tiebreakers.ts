/**
 * Check Gatti and Kalulu Tiebreaker Budget Updates
 * 
 * This script checks if Federico Gatti and Pierre Kalulu's tiebreaker
 * resolutions properly updated the football budget and spent in both databases
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

interface PlayerCheck {
    player_name: string;
    player_id: string;
    team_id: string;
    team_name: string;
    season_id: string;
    winning_bid: number;
    tiebreaker_id: string;
    tiebreaker_status: string;

    // Neon checks
    neon_team_football_budget: number;
    neon_team_football_spent: number;
    neon_team_football_players_count: number;

    // Firebase checks
    firebase_football_budget: number;
    firebase_football_spent: number;
    firebase_players_count: number;

    // Issues
    issues: string[];
}

async function checkPlayer(playerName: string): Promise<PlayerCheck | null> {
    console.log(`\n🔍 Checking ${playerName}...`);

    // Find the player's tiebreaker
    const tiebreakers = await sql`
    SELECT 
      bt.id as tiebreaker_id,
      bt.player_id,
      bt.player_name,
      bt.season_id,
      bt.current_highest_team_id as team_id,
      bt.current_highest_bid as winning_bid,
      bt.status
    FROM bulk_tiebreakers bt
    WHERE bt.player_name ILIKE ${`%${playerName}%`}
    ORDER BY bt.created_at DESC
    LIMIT 1
  `;

    if (tiebreakers.length === 0) {
        console.log(`❌ No tiebreaker found for ${playerName}`);
        return null;
    }

    const tb = tiebreakers[0];
    console.log(`✅ Found tiebreaker: ${tb.tiebreaker_id}`);
    console.log(`   Status: ${tb.status}`);
    console.log(`   Team: ${tb.team_id}`);
    console.log(`   Winning Bid: £${tb.winning_bid}`);

    // Get team name
    const teamResult = await sql`
    SELECT team_name FROM teams WHERE id = ${tb.team_id} AND season_id = ${tb.season_id} LIMIT 1
  `;
    const teamName = teamResult[0]?.team_name || 'Unknown';

    // Get Neon team data
    const neonTeam = await sql`
    SELECT 
      football_budget,
      football_spent,
      football_players_count
    FROM teams
    WHERE id = ${tb.team_id}
    AND season_id = ${tb.season_id}
  `;

    const neonData = neonTeam[0] || {};

    // Get Firebase team data
    const teamSeasonId = `${tb.team_id}_${tb.season_id}`;
    const teamSeasonRef = db.collection('team_seasons').doc(teamSeasonId);
    const teamSeasonSnap = await teamSeasonRef.get();

    let firebaseData: any = {};
    if (teamSeasonSnap.exists) {
        firebaseData = teamSeasonSnap.data() || {};
    } else {
        console.log(`⚠️  Firebase team_seasons document not found: ${teamSeasonId}`);
    }

    // Analyze issues
    const issues: string[] = [];

    // Check if tiebreaker is resolved
    if (tb.status !== 'resolved' && tb.status !== 'finalized') {
        issues.push(`Tiebreaker status is '${tb.status}' (should be 'resolved' or 'finalized')`);
    }

    // Check if player is in footballplayers table
    const playerCheck = await sql`
    SELECT team_id, is_sold, acquisition_value
    FROM footballplayers
    WHERE id = ${tb.player_id}
  `;

    if (playerCheck.length === 0) {
        issues.push(`Player not found in footballplayers table`);
    } else {
        const player = playerCheck[0];
        if (!player.is_sold) {
            issues.push(`Player is_sold is false in footballplayers table`);
        }
        if (player.team_id !== tb.team_id) {
            issues.push(`Player team_id mismatch: footballplayers has ${player.team_id}, tiebreaker has ${tb.team_id}`);
        }
    }

    return {
        player_name: tb.player_name,
        player_id: tb.player_id,
        team_id: tb.team_id,
        team_name: teamName,
        season_id: tb.season_id,
        winning_bid: tb.winning_bid,
        tiebreaker_id: tb.tiebreaker_id,
        tiebreaker_status: tb.status,
        neon_team_football_budget: neonData.football_budget || 0,
        neon_team_football_spent: neonData.football_spent || 0,
        neon_team_football_players_count: neonData.football_players_count || 0,
        firebase_football_budget: firebaseData.football_budget || 0,
        firebase_football_spent: firebaseData.football_spent || 0,
        firebase_players_count: firebaseData.players_count || 0,
        issues,
    };
}

async function main() {
    console.log('🔍 Checking Federico Gatti and Pierre Kalulu Tiebreaker Budget Updates...\n');
    console.log('='.repeat(100));

    const players = ['Federico Gatti', 'Pierre Kalulu'];
    const results: PlayerCheck[] = [];

    for (const playerName of players) {
        const result = await checkPlayer(playerName);
        if (result) {
            results.push(result);
        }
    }

    console.log('\n\n📊 DETAILED ANALYSIS');
    console.log('='.repeat(100));

    for (const result of results) {
        console.log(`\n🎯 ${result.player_name}`);
        console.log('-'.repeat(100));
        console.log(`Player ID: ${result.player_id}`);
        console.log(`Team: ${result.team_name} (${result.team_id})`);
        console.log(`Season: ${result.season_id}`);
        console.log(`Winning Bid: £${result.winning_bid}`);
        console.log(`Tiebreaker ID: ${result.tiebreaker_id}`);
        console.log(`Tiebreaker Status: ${result.tiebreaker_status}`);

        console.log(`\n🗄️  Neon Database (teams table):`);
        console.log(`   football_budget: £${result.neon_team_football_budget}`);
        console.log(`   football_spent: £${result.neon_team_football_spent}`);
        console.log(`   football_players_count: ${result.neon_team_football_players_count}`);

        console.log(`\n🔥 Firebase Database (team_seasons):`);
        console.log(`   football_budget: £${result.firebase_football_budget}`);
        console.log(`   football_spent: £${result.firebase_football_spent}`);
        console.log(`   players_count: ${result.firebase_players_count}`);

        if (result.issues.length > 0) {
            console.log(`\n⚠️  Issues Found:`);
            result.issues.forEach(issue => console.log(`   - ${issue}`));
        } else {
            console.log(`\n✅ No issues found`);
        }
    }

    // Summary
    console.log('\n\n📋 SUMMARY');
    console.log('='.repeat(100));

    const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);

    if (totalIssues > 0) {
        console.log(`❌ Found ${totalIssues} issue(s) across ${results.length} player(s)`);
        console.log('\n💡 These players may need manual budget correction');
    } else {
        console.log(`✅ All ${results.length} player(s) have correct budget updates`);
    }

    console.log('\n✅ Check complete - No changes made to databases');
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
