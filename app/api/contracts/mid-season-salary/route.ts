import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { getAuthToken } from '@/lib/auth/token-helper';
import { calculateFootballPlayerSalary, isMidSeasonRound } from '@/lib/contracts';
import { logSalaryPayment } from '@/lib/transaction-logger';
import { getAuctionDb } from '@/lib/neon/auction-config';

export async function POST(request: NextRequest) {
  try {
    // Get Firebase ID token from cookie
    const token = await getAuthToken(request);

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized - No token' },
        { status: 401 }
      );
    }

    // Verify Firebase ID token
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (err) {
      console.error('Token verification error:', err);
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Check if user is committee admin
    const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    const userData = userDoc.data();
    
    if (!userData || userData.role !== 'committee_admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Committee admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { seasonId, roundNumber } = body;

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

    let teamsProcessed = 0;
    let totalDeducted = 0;
    const errors: string[] = [];
    const sql = getAuctionDb();

    // Process each team
    for (const teamSeasonDoc of teamSeasonsSnapshot.docs) {
      try {
        const teamSeasonData = teamSeasonDoc.data();
        const teamId = teamSeasonData.team_id;
        const teamName = teamSeasonData.team_name || 'Unknown Team';
        const currentEuroBalance = teamSeasonData.football_budget || 0;

        console.log(`\nProcessing team: ${teamName} (${teamId})`);
        console.log(`  Current Euro balance: €${currentEuroBalance.toFixed(2)}`);

        // Fetch football players from Neon DB
        const footballPlayers = await sql`
          SELECT * FROM footballplayers
          WHERE team_id = ${teamId}
          AND season_id = ${seasonId}
        `;

        console.log(`  Football players found: ${footballPlayers.length}`);

        let teamSalaryTotal = 0;

        // Calculate total salary for all football players
        for (const player of footballPlayers) {
          const auctionValue = player.acquisition_value || 0;
          const salary = calculateFootballPlayerSalary(auctionValue);
          console.log(`    - ${player.name}: €${auctionValue} → salary €${salary.toFixed(2)}`);
          teamSalaryTotal += salary;
        }

        console.log(`  Total salary to deduct: €${teamSalaryTotal.toFixed(2)}`);

        if (footballPlayers.length === 0) {
          console.log(`  ⚠️ No football players found, skipping`);
          continue;
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

        // Update team_seasons document
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
        
        // Log salary payment transaction
        await logSalaryPayment(
          teamId,
          seasonId,
          teamSalaryTotal,
          currentEuroBalance,
          'football',
          undefined,
          roundNumber,
          footballPlayers.length,
          `Mid-season salary for ${footballPlayers.length} football players`
        );

        console.log(`  ✅ Transaction logged`);

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
