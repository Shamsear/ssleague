import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/auth-helper';
import { calculateFootballPlayerSalary, isMidSeasonRound } from '@/lib/contracts';
import { logSalaryPayment } from '@/lib/transaction-logger';
import { getAuctionDb } from '@/lib/neon/auction-config';
import { sendNotification } from '@/lib/notifications/send-notification';

export async function POST(request: NextRequest) {
  try {
    // ✅ ZERO FIREBASE READS - Uses JWT claims only
    const auth = await verifyAuth(['committee_admin'], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { seasonId, roundNumber, customAmounts, selectedTeamIds } = body;
    // customAmounts is optional: { [teamId: string]: number }
    // selectedTeamIds is optional: string[] - if provided, only process these teams

    if (!seasonId || !roundNumber) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get season
    const seasonRef = adminDb.collection('seasons').doc(seasonId);
    const seasonDoc = await seasonRef.get();

    if (!seasonDoc.exists) {
      return NextResponse.json(
        { error: 'Season not found' },
        { status: 404 }
      );
    }

    const seasonData = seasonDoc.data();
    const totalRounds = seasonData?.totalRounds || 38;

    // Check if this is mid-season round
    if (!isMidSeasonRound(roundNumber, totalRounds)) {
      return NextResponse.json(
        { error: 'Not a mid-season round. Mid-season is typically at round ' + Math.floor(totalRounds / 2) },
        { status: 400 }
      );
    }

    // Get all team_seasons for this season
    const teamSeasonsSnapshot = await adminDb
      .collection('team_seasons')
      .where('season_id', '==', seasonId)
      .where('status', '==', 'registered')
      .get();

    console.log(`Found ${teamSeasonsSnapshot.docs.length} registered teams for season ${seasonId}`);

    // Filter to only selected teams if provided
    const teamsToProcess = selectedTeamIds && selectedTeamIds.length > 0
      ? teamSeasonsSnapshot.docs.filter(doc => selectedTeamIds.includes(doc.data().team_id))
      : teamSeasonsSnapshot.docs;

    console.log(`Processing ${teamsToProcess.length} team(s)${selectedTeamIds ? ' (selected)' : ' (all)'}`);

    let teamsProcessed = 0;
    let totalDeducted = 0;
    const errors: string[] = [];
    const sql = getAuctionDb();

    // Process each team
    for (const teamSeasonDoc of teamsToProcess) {
      try {
        const teamSeasonData = teamSeasonDoc.data();
        const teamId = teamSeasonData.team_id;
        const teamName = teamSeasonData.team_name || 'Unknown Team';
        const currentEuroBalance = teamSeasonData.football_budget || 0;

        console.log(`\nProcessing team: ${teamName} (${teamId})`);
        console.log(`  Current Euro balance: €${currentEuroBalance.toFixed(2)}`);

        // Check if there's a custom amount for this team
        const hasCustomAmount = customAmounts && customAmounts[teamId] !== undefined;
        let teamSalaryTotal = 0;
        let playerCount = 0;

        if (hasCustomAmount) {
          // Use custom amount
          teamSalaryTotal = customAmounts[teamId];
          console.log(`  Using custom amount: €${teamSalaryTotal.toFixed(2)}`);

          // Get player count
          const countResult = await sql`
            SELECT COUNT(*) as count FROM footballplayers
            WHERE team_id = ${teamId} AND season_id = ${seasonId}
          `;
          playerCount = parseInt(countResult[0]?.count) || 0;
          console.log(`  Players: ${playerCount}`);
        } else {
          // Calculate from players
          const footballPlayers = await sql`
            SELECT player_id, acquisition_value FROM footballplayers
            WHERE team_id = ${teamId}
            AND season_id = ${seasonId}
          `;

          playerCount = footballPlayers.length;
          console.log(`  Players found: ${playerCount}`);

          // Calculate total salary
          for (const player of footballPlayers) {
            const auctionValue = player.acquisition_value || 0;
            const salary = calculateFootballPlayerSalary(auctionValue);
            teamSalaryTotal += salary;
          }

          console.log(`  Calculated salary: €${teamSalaryTotal.toFixed(2)}`);

          if (playerCount === 0) {
            console.log(`  ⚠️ No football players found, skipping`);
            continue;
          }
        }

        // Check if team has enough balance
        if (currentEuroBalance < teamSalaryTotal) {
          const msg = `${teamName}: Insufficient euro balance (€${currentEuroBalance.toFixed(2)} < €${teamSalaryTotal.toFixed(2)})`;
          console.log(`  ❌ ${msg}`);
          errors.push(msg);
          continue;
        }

        // Deduct salary from euro balance
        const newEuroBalance = currentEuroBalance - teamSalaryTotal;

        // Update team_seasons document in Firebase
        await teamSeasonDoc.ref.update({
          football_budget: newEuroBalance,
          football_spent: (teamSeasonData.football_spent || 0) + teamSalaryTotal,
          last_salary_deduction: {
            round: roundNumber,
            amount: teamSalaryTotal,
            date: new Date(),
          },
          updated_at: new Date(),
        });

        console.log(`  ✅ Balance updated: €${currentEuroBalance.toFixed(2)} → €${newEuroBalance.toFixed(2)}`);

        // Also update auction DB teams table
        try {
          await sql`
            UPDATE teams
            SET 
              football_budget = ${newEuroBalance},
              updated_at = NOW()
            WHERE id = ${teamId}
          `;
          console.log(`  ✅ Auction DB synced`);
        } catch (auctionDbError) {
          console.warn(`  ⚠️  Auction DB sync failed:`, auctionDbError);
          // Don't fail the whole operation if auction DB sync fails
        }

        // Log salary payment transaction
        await logSalaryPayment(
          teamId,
          seasonId,
          teamSalaryTotal,
          currentEuroBalance,
          'football',
          undefined,
          roundNumber,
          playerCount,
          hasCustomAmount
            ? `Mid-season salary (custom)`
            : `Mid-season salary`
        );

        console.log(`  ✅ Transaction logged`);

        // Send FCM notification to the team
        try {
          await sendNotification(
            {
              title: '💰 Mid-Season Salary',
              body: `€${teamSalaryTotal.toFixed(2)} salary deducted`,
              url: `/dashboard/team`,
              icon: '/logo.png',
              data: {
                type: 'salary_deduction',
                team_id: teamId,
                amount: teamSalaryTotal.toString(),
                round: roundNumber.toString(),
                new_balance: newEuroBalance.toString(),
              }
            },
            teamId
          );
        } catch (notifError) {
          console.error('Failed to send salary notification:', notifError);
          // Don't fail the request
        }

        teamsProcessed++;
        totalDeducted += teamSalaryTotal;
      } catch (error) {
        const msg = `${teamSeasonDoc.data().team_name || teamSeasonDoc.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(`  ❌ Error: ${msg}`);
        errors.push(msg);
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`  ✅ Teams processed: ${teamsProcessed}`);
    console.log(`  💶 Total deducted: €${totalDeducted.toFixed(2)}`);
    if (errors.length > 0) {
      console.log(`  ❌ Errors: ${errors.length}`);
    }

    return NextResponse.json({
      success: true,
      teamsProcessed,
      totalDeducted,
      errors: errors.length > 0 ? errors : undefined,
      message: `Mid-season salary deductions processed for ${teamsProcessed} teams`,
    });
  } catch (error) {
    console.error('Error processing mid-season salary:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process salary deductions' },
      { status: 500 }
    );
  }
}
