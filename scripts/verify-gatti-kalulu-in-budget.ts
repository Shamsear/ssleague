/**
 * DETAILED PREVIEW: Check if Gatti and Kalulu costs are included in team budgets
 * 
 * This verifies if the winning bid amounts were actually added to football_spent
 */

import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

async function analyzeTeamBudget(playerName: string) {
    console.log(`\n${'='.repeat(100)}`);
    console.log(`🔍 Analyzing: ${playerName}`);
    console.log('='.repeat(100));

    // Get tiebreaker info
    const tiebreakers = await sql`
    SELECT 
      bt.id as tiebreaker_id,
      bt.player_id,
      bt.player_name,
      bt.season_id,
      bt.current_highest_team_id as team_id,
      bt.current_highest_bid as winning_bid,
      bt.status,
      bt.resolved_at
    FROM bulk_tiebreakers bt
    WHERE bt.player_name ILIKE ${`%${playerName}%`}
    ORDER BY bt.created_at DESC
    LIMIT 1
  `;

    if (tiebreakers.length === 0) {
        console.log(`❌ No tiebreaker found\n`);
        return;
    }

    const tb = tiebreakers[0];

    // Get team info
    const teamInfo = await sql`
    SELECT name, football_budget, football_spent, football_players_count
    FROM teams
    WHERE id = ${tb.team_id} AND season_id = ${tb.season_id}
  `;

    const team = teamInfo[0];

    console.log(`\n📋 Tiebreaker Info:`);
    console.log(`   Player: ${tb.player_name} (ID: ${tb.player_id})`);
    console.log(`   Team: ${team.name} (${tb.team_id})`);
    console.log(`   Winning Bid: £${tb.winning_bid}`);
    console.log(`   Status: ${tb.status}`);
    console.log(`   Resolved At: ${tb.resolved_at || 'Not resolved'}`);

    console.log(`\n💰 Current Team Budget (Neon):`);
    console.log(`   football_budget: £${team.football_budget}`);
    console.log(`   football_spent: £${team.football_spent}`);
    console.log(`   football_players_count: ${team.football_players_count}`);

    // Get ALL players for this team and sum their acquisition values
    const allPlayers = await sql`
    SELECT 
      id,
      name,
      position,
      acquisition_value,
      is_sold,
      team_id
    FROM footballplayers
    WHERE team_id = ${tb.team_id}
    AND season_id = ${tb.season_id}
    AND is_sold = true
    ORDER BY acquisition_value DESC
  `;

    console.log(`\n👥 All Sold Players for ${team.name}:`);
    console.log(`   Total Count: ${allPlayers.length}`);

    let totalAcquisitionValue = 0;
    let foundGattiOrKalulu = false;

    console.log(`\n   Top 10 Players by Value:`);
    allPlayers.slice(0, 10).forEach((p: any, index: number) => {
        const isTarget = p.id === tb.player_id;
        const marker = isTarget ? '👉' : '  ';
        console.log(`   ${marker} ${index + 1}. ${p.name} (${p.position}) - £${p.acquisition_value}`);
        if (isTarget) foundGattiOrKalulu = true;
    });

    // Check if our target player is in the list
    const targetPlayer = allPlayers.find((p: any) => p.id === tb.player_id);
    if (targetPlayer) {
        console.log(`\n   ✅ ${tb.player_name} FOUND in team's sold players`);
        console.log(`      Acquisition Value: £${targetPlayer.acquisition_value}`);
    } else {
        console.log(`\n   ❌ ${tb.player_name} NOT FOUND in team's sold players!`);
    }

    // Calculate total acquisition value
    allPlayers.forEach((p: any) => {
        totalAcquisitionValue += parseFloat(p.acquisition_value || 0);
    });

    console.log(`\n📊 Budget Verification:`);
    console.log(`   Sum of all player acquisition_values: £${totalAcquisitionValue.toFixed(2)}`);
    console.log(`   Team football_spent (Neon): £${team.football_spent}`);
    console.log(`   Difference: £${(team.football_spent - totalAcquisitionValue).toFixed(2)}`);

    if (Math.abs(team.football_spent - totalAcquisitionValue) < 0.01) {
        console.log(`   ✅ MATCH - football_spent equals sum of acquisition values`);
    } else if (team.football_spent < totalAcquisitionValue) {
        console.log(`   ❌ MISMATCH - football_spent is LESS than sum of acquisition values`);
        console.log(`   ⚠️  This means some player costs are NOT included in football_spent!`);
    } else {
        console.log(`   ⚠️  MISMATCH - football_spent is MORE than sum of acquisition values`);
    }

    // Specific check for our target player
    if (targetPlayer) {
        const expectedSpentWithoutPlayer = totalAcquisitionValue - parseFloat(targetPlayer.acquisition_value);
        const expectedSpentWithPlayer = totalAcquisitionValue;

        console.log(`\n🎯 Specific Check for ${tb.player_name}:`);
        console.log(`   If ${tb.player_name} cost WAS included:`);
        console.log(`      Expected football_spent: £${expectedSpentWithPlayer.toFixed(2)}`);
        console.log(`      Actual football_spent: £${team.football_spent}`);
        console.log(`      Match: ${Math.abs(team.football_spent - expectedSpentWithPlayer) < 0.01 ? '✅ YES' : '❌ NO'}`);

        console.log(`\n   If ${tb.player_name} cost was NOT included:`);
        console.log(`      Expected football_spent: £${expectedSpentWithoutPlayer.toFixed(2)}`);
        console.log(`      Actual football_spent: £${team.football_spent}`);
        console.log(`      Match: ${Math.abs(team.football_spent - expectedSpentWithoutPlayer) < 0.01 ? '✅ YES' : '❌ NO'}`);
    }

    return {
        player_name: tb.player_name,
        team_name: team.name,
        winning_bid: tb.winning_bid,
        football_spent: team.football_spent,
        total_acquisition_value: totalAcquisitionValue,
        player_found: !!targetPlayer,
        budget_matches: Math.abs(team.football_spent - totalAcquisitionValue) < 0.01,
    };
}

async function main() {
    console.log('\n🔍 DETAILED BUDGET VERIFICATION FOR GATTI AND KALULU\n');
    console.log('⚠️  THIS IS A PREVIEW ONLY - NO CHANGES WILL BE MADE\n');

    const players = ['Federico Gatti', 'Pierre Kalulu'];
    const results = [];

    for (const playerName of players) {
        const result = await analyzeTeamBudget(playerName);
        if (result) {
            results.push(result);
        }
    }

    // Final Summary
    console.log(`\n\n${'='.repeat(100)}`);
    console.log('📋 FINAL VERDICT');
    console.log('='.repeat(100));

    for (const result of results) {
        console.log(`\n${result.player_name} (${result.team_name}):`);
        console.log(`   Winning Bid: £${result.winning_bid}`);
        console.log(`   Player in team roster: ${result.player_found ? '✅ YES' : '❌ NO'}`);
        console.log(`   football_spent: £${result.football_spent}`);
        console.log(`   Sum of all acquisitions: £${result.total_acquisition_value.toFixed(2)}`);
        console.log(`   Budget matches acquisitions: ${result.budget_matches ? '✅ YES' : '❌ NO'}`);

        if (!result.budget_matches) {
            const diff = result.football_spent - result.total_acquisition_value;
            if (diff < 0) {
                console.log(`   ⚠️  football_spent is £${Math.abs(diff).toFixed(2)} LESS than it should be`);
                console.log(`   🔧 ACTION NEEDED: Add £${Math.abs(diff).toFixed(2)} to football_spent`);
            } else {
                console.log(`   ⚠️  football_spent is £${diff.toFixed(2)} MORE than it should be`);
            }
        }
    }

    console.log('\n✅ Analysis complete - No changes made to database');
}

main()
    .then(() => {
        console.log('\n🎉 Done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Error:', error);
        console.error(error.stack);
        process.exit(1);
    });
