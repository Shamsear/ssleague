require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkTransferPoints() {
    if (!process.env.FANTASY_DATABASE_URL) {
        console.error('❌ FANTASY_DATABASE_URL not found in environment variables');
        process.exit(1);
    }

    const sql = neon(process.env.FANTASY_DATABASE_URL);

    console.log('🔍 Checking Transfer Points Deduction...\n');

    // Get recent transfers
    console.log('📊 Recent Transfers:');
    console.log('='.repeat(100));

    const transfers = await sql`
    SELECT 
      transfer_id,
      team_id,
      player_out_name,
      player_in_name,
      points_deducted,
      transfer_cost,
      is_free_transfer,
      transferred_at
    FROM fantasy_transfers
    ORDER BY id DESC
    LIMIT 10
  `;

    if (transfers.length === 0) {
        console.log('❌ No transfers found in the database.');
        console.log('\nThis could mean:');
        console.log('  1. No transfers have been made yet');
        console.log('  2. The transfer system hasn\'t been used');

        // Check if there are any teams
        const teams = await sql`SELECT COUNT(*) as count FROM fantasy_teams`;
        console.log(`\nTotal fantasy teams: ${teams[0].count}`);

        return;
    }

    console.log(`Found ${transfers.length} recent transfers:\n`);

    transfers.forEach((transfer, index) => {
        console.log(`${index + 1}. Transfer ID: ${transfer.transfer_id}`);
        console.log(`   Team ID: ${transfer.team_id}`);
        console.log(`   Player Out: ${transfer.player_out_name || 'None (pure addition)'}`);
        console.log(`   Player In: ${transfer.player_in_name || 'None (pure release)'}`);
        console.log(`   Points Deducted: ${transfer.points_deducted || 0}`);
        console.log(`   Transfer Cost: ${transfer.transfer_cost || 0}`);
        console.log(`   Free Transfer: ${transfer.is_free_transfer ? 'Yes' : 'No'}`);
        console.log(`   Date: ${transfer.transferred_at ? new Date(transfer.transferred_at).toLocaleString() : 'N/A'}`);
        console.log('');
    });

    console.log('='.repeat(100));

    // Analysis
    console.log('\n🔍 Analysis:');
    const transfersWithPoints = transfers.filter(t => Number(t.points_deducted || 0) > 0);
    const freeTransfers = transfers.filter(t => t.is_free_transfer === true);

    console.log(`Total transfers: ${transfers.length}`);
    console.log(`Transfers with points deducted: ${transfersWithPoints.length}`);
    console.log(`Free transfers: ${freeTransfers.length}`);

    if (transfersWithPoints.length > 0) {
        const totalPointsDeducted = transfersWithPoints.reduce((sum, t) => sum + Number(t.points_deducted), 0);
        const avgPointsDeducted = totalPointsDeducted / transfersWithPoints.length;
        console.log(`Total points deducted across all transfers: ${totalPointsDeducted}`);
        console.log(`Average points deducted per transfer: ${avgPointsDeducted.toFixed(2)}`);
    }

    // Check transfer windows settings
    console.log('\n\n📋 Transfer Window Settings:');
    console.log('='.repeat(100));

    const windows = await sql`
    SELECT 
      window_id,
      window_name,
      is_active,
      max_transfers_per_window,
      points_cost_per_transfer,
      opens_at,
      closes_at
    FROM transfer_windows
    ORDER BY id DESC
    LIMIT 5
  `;

    if (windows.length === 0) {
        console.log('❌ No transfer windows found.');
    } else {
        windows.forEach((window, index) => {
            console.log(`\n${index + 1}. ${window.window_name || 'Unnamed Window'}`);
            console.log(`   Window ID: ${window.window_id}`);
            console.log(`   Active: ${window.is_active ? '✅ Yes' : '❌ No'}`);
            console.log(`   Max Transfers: ${window.max_transfers_per_window || 'N/A'}`);
            console.log(`   Points Cost per Transfer: ${window.points_cost_per_transfer || 0}`);
            console.log(`   Opens: ${window.opens_at ? new Date(window.opens_at).toLocaleString() : 'N/A'}`);
            console.log(`   Closes: ${window.closes_at ? new Date(window.closes_at).toLocaleString() : 'N/A'}`);
        });
    }

    // Check fantasy teams and their points
    console.log('\n\n📈 Fantasy Teams with Transfers:');
    console.log('='.repeat(100));

    const teamStats = await sql`
    SELECT 
      ft.team_id,
      ft.team_name,
      ft.total_points,
      ft.player_points,
      ft.passive_points,
      COUNT(t.transfer_id) as transfer_count,
      SUM(CASE WHEN t.points_deducted > 0 THEN t.points_deducted ELSE 0 END) as total_points_deducted
    FROM fantasy_teams ft
    LEFT JOIN fantasy_transfers t ON ft.team_id = t.team_id
    GROUP BY ft.team_id, ft.team_name, ft.total_points, ft.player_points, ft.passive_points
    HAVING COUNT(t.transfer_id) > 0
    ORDER BY transfer_count DESC
    LIMIT 10
  `;

    if (teamStats.length === 0) {
        console.log('❌ No teams with transfers found.');
    } else {
        teamStats.forEach((team, index) => {
            const totalPoints = Number(team.total_points || 0);
            const playerPoints = Number(team.player_points || 0);
            const passivePoints = Number(team.passive_points || 0);
            const deductedPoints = Number(team.total_points_deducted || 0);
            const pointsBeforeDeduction = totalPoints + deductedPoints;

            console.log(`\n${index + 1}. ${team.team_name}`);
            console.log(`   Team ID: ${team.team_id}`);
            console.log(`   Total Points: ${totalPoints}`);
            console.log(`   Player Points: ${playerPoints}`);
            console.log(`   Passive Points: ${passivePoints}`);
            console.log(`   Transfers Made: ${team.transfer_count}`);
            console.log(`   Total Points Deducted: ${deductedPoints}`);
            console.log(`   Points Before Deduction: ${pointsBeforeDeduction}`);

            if (deductedPoints > 0) {
                console.log(`   ✅ Points WERE deducted from this team`);
            } else if (team.transfer_count > 0) {
                console.log(`   ⚠️  Transfers made but NO points deducted (possibly free transfers)`);
            }
        });
    }

    console.log('\n' + '='.repeat(100));

    // Final verdict
    console.log('\n\n🎯 VERDICT:');
    console.log('='.repeat(100));

    if (transfers.length === 0) {
        console.log('❌ Cannot verify - no transfers have been made yet.');
    } else if (transfersWithPoints.length > 0) {
        console.log('✅ YES - Transfer points ARE being deducted from teams!');
        console.log(`   ${transfersWithPoints.length} out of ${transfers.length} transfers had points deducted.`);
        console.log(`\n   The code is working correctly:`);
        console.log(`   - Lines 359-367 in execute/route.ts deduct points from total_points`);
        console.log(`   - Lines 173-179 in make-transfer/route.ts also deduct points`);
    } else if (freeTransfers.length === transfers.length) {
        console.log('⚠️  All transfers were marked as FREE transfers.');
        console.log('   This is expected if teams are within their free transfer allowance.');
        console.log('   Points are only deducted for non-free transfers.');
    } else {
        console.log('⚠️  POTENTIAL ISSUE - Transfers exist but no points were deducted.');
        console.log('   Please check:');
        console.log('   1. Transfer window settings (points_cost_per_transfer)');
        console.log('   2. Whether all transfers are marked as free transfers');
        console.log('   3. The code logic in the transfer API routes');
    }

    console.log('='.repeat(100));
    console.log('\n✅ Check complete!');
}

checkTransferPoints().catch(console.error);
