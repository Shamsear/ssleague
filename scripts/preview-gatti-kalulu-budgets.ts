/**
 * PREVIEW: Check Gatti and Kalulu Tiebreaker Status
 * 
 * This script ONLY CHECKS (no changes) the tiebreaker status for 
 * Federico Gatti and Pierre Kalulu
 */

import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

async function checkPlayer(playerName: string) {
    console.log(`\n${'='.repeat(100)}`);
    console.log(`🔍 Checking: ${playerName}`);
    console.log('='.repeat(100));

    // Find the player's tiebreaker
    const tiebreakers = await sql`
    SELECT 
      bt.id as tiebreaker_id,
      bt.player_id,
      bt.player_name,
      bt.season_id,
      bt.current_highest_team_id as team_id,
      bt.current_highest_bid as winning_bid,
      bt.status,
      bt.resolved_at,
      bt.created_at
    FROM bulk_tiebreakers bt
    WHERE bt.player_name ILIKE ${`%${playerName}%`}
    ORDER BY bt.created_at DESC
    LIMIT 1
  `;

    if (tiebreakers.length === 0) {
        console.log(`❌ No tiebreaker found for ${playerName}\n`);
        return null;
    }

    const tb = tiebreakers[0];

    console.log(`\n📋 Tiebreaker Information:`);
    console.log(`   ID: ${tb.tiebreaker_id}`);
    console.log(`   Player ID: ${tb.player_id}`);
    console.log(`   Season: ${tb.season_id}`);
    console.log(`   Status: ${tb.status} ${tb.status === 'resolved' ? '✅' : '⚠️'}`);
    console.log(`   Winning Team: ${tb.team_id}`);
    console.log(`   Winning Bid: £${tb.winning_bid}`);
    console.log(`   Created: ${tb.created_at}`);
    console.log(`   Resolved: ${tb.resolved_at || 'Not resolved'}`);

    // Get team name
    const teamResult = await sql`
    SELECT name FROM teams WHERE id = ${tb.team_id} LIMIT 1
  `;
    const teamName = teamResult[0]?.name || 'Unknown';
    console.log(`   Team Name: ${teamName}`);

    // Check player in footballplayers table
    console.log(`\n👤 Player Status (footballplayers table):`);
    const playerCheck = await sql`
    SELECT 
      id,
      team_id, 
      is_sold, 
      acquisition_value,
      status as player_status,
      contract_id,
      season_id
    FROM footballplayers
    WHERE id = ${tb.player_id}
  `;

    if (playerCheck.length === 0) {
        console.log(`   ❌ Player NOT FOUND in footballplayers table`);
    } else {
        const player = playerCheck[0];
        console.log(`   is_sold: ${player.is_sold ? '✅ TRUE' : '❌ FALSE'}`);
        console.log(`   team_id: ${player.team_id || 'NULL'} ${player.team_id === tb.team_id ? '✅' : '❌ MISMATCH'}`);
        console.log(`   acquisition_value: £${player.acquisition_value || 0} ${player.acquisition_value === tb.winning_bid ? '✅' : '⚠️'}`);
        console.log(`   status: ${player.player_status || 'NULL'}`);
        console.log(`   contract_id: ${player.contract_id || 'NULL'}`);
        console.log(`   season_id: ${player.season_id || 'NULL'}`);
    }

    // Check team budget - try to get columns that exist
    console.log(`\n💰 Team Budget Status:`);
    try {
        const teamBudget = await sql`
      SELECT * FROM teams WHERE id = ${tb.team_id} AND season_id = ${tb.season_id} LIMIT 1
    `;

        if (teamBudget.length > 0) {
            const team = teamBudget[0];
            console.log(`   Team: ${team.name}`);

            // Check which budget columns exist
            if ('football_budget' in team) {
                console.log(`   football_budget: £${team.football_budget || 0}`);
            } else {
                console.log(`   football_budget: Column doesn't exist`);
            }

            if ('football_spent' in team) {
                console.log(`   football_spent: £${team.football_spent || 0}`);
            } else {
                console.log(`   football_spent: Column doesn't exist`);
            }

            if ('football_players_count' in team) {
                console.log(`   football_players_count: ${team.football_players_count || 0}`);
            } else {
                console.log(`   football_players_count: Column doesn't exist`);
            }

            // Show all columns for debugging
            console.log(`\n   Available columns in teams table:`);
            console.log(`   ${Object.keys(team).join(', ')}`);
        } else {
            console.log(`   ❌ Team not found in teams table`);
        }
    } catch (error: any) {
        console.log(`   ❌ Error querying teams table: ${error.message}`);
    }

    // Count actual players for this team
    console.log(`\n📊 Actual Player Count:`);
    const actualCount = await sql`
    SELECT COUNT(*) as count
    FROM footballplayers
    WHERE team_id = ${tb.team_id}
    AND season_id = ${tb.season_id}
    AND is_sold = true
  `;
    console.log(`   Sold players for ${teamName}: ${actualCount[0]?.count || 0}`);

    return {
        player_name: tb.player_name,
        tiebreaker_id: tb.tiebreaker_id,
        status: tb.status,
        team_id: tb.team_id,
        team_name: teamName,
        winning_bid: tb.winning_bid,
    };
}

async function main() {
    console.log('\n🔍 PREVIEW: Checking Federico Gatti and Pierre Kalulu Tiebreaker Status\n');
    console.log('⚠️  THIS IS A PREVIEW ONLY - NO CHANGES WILL BE MADE\n');

    const players = ['Federico Gatti', 'Pierre Kalulu'];
    const results = [];

    for (const playerName of players) {
        const result = await checkPlayer(playerName);
        if (result) {
            results.push(result);
        }
    }

    // Summary
    console.log(`\n\n${'='.repeat(100)}`);
    console.log('📋 SUMMARY');
    console.log('='.repeat(100));

    for (const result of results) {
        const statusIcon = result.status === 'resolved' ? '✅' : '❌';
        console.log(`${statusIcon} ${result.player_name}: ${result.status} - ${result.team_name} - £${result.winning_bid}`);
    }

    console.log('\n✅ Preview complete - No changes made to database');
    console.log('\n💡 Check the details above to see if budget columns exist and are updated correctly');
}

main()
    .then(() => {
        console.log('\n🎉 Analysis complete!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Error:', error);
        console.error(error.stack);
        process.exit(1);
    });
