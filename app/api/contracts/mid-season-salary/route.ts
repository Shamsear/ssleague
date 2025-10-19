import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';
import { calculateFootballPlayerSalary, isMidSeasonRound } from '@/lib/contracts';

export async function POST(request: NextRequest) {
  try {
    // Get Firebase ID token from cookie
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

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

    // Get all teams in this season
    const teamsSnapshot = await adminDb
      .collection('teams')
      .where('season_id', '==', seasonId)
      .get();

    let teamsProcessed = 0;
    let totalDeducted = 0;
    const errors: string[] = [];

    // Process each team
    const batch = adminDb.batch();

    for (const teamDoc of teamsSnapshot.docs) {
      try {
        const teamData = teamDoc.data();
        const footballPlayers = teamData?.football_players || [];
        const currentEuroBalance = teamData?.euroBalance || 0;

        let teamSalaryTotal = 0;

        // Calculate total salary for all football players
        for (const player of footballPlayers) {
          const salary = calculateFootballPlayerSalary(player.auctionValue || 0);
          teamSalaryTotal += salary;
        }

        // Check if team has enough balance
        if (currentEuroBalance < teamSalaryTotal) {
          errors.push(`${teamData.team_name}: Insufficient euro balance`);
          continue;
        }

        // Deduct salary from euro balance
        const newEuroBalance = currentEuroBalance - teamSalaryTotal;

        batch.update(teamDoc.ref, {
          euroBalance: newEuroBalance,
          lastSalaryDeduction: {
            round: roundNumber,
            amount: teamSalaryTotal,
            date: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        });

        teamsProcessed++;
        totalDeducted += teamSalaryTotal;
      } catch (error) {
        errors.push(`${teamDoc.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Commit all updates
    await batch.commit();

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
