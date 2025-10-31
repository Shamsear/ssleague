import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { logAdjustment } from '@/lib/transaction-logger';
import type { CurrencyType } from '@/lib/transaction-logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { teamId, amount, reason, seasonId, adjustedBy, currencyType } = body;

    // Validate inputs
    if (!teamId || amount === undefined || !reason || !seasonId || !adjustedBy || !currencyType) {
      return NextResponse.json(
        { error: 'Missing required fields: teamId, amount, reason, seasonId, adjustedBy, currencyType' },
        { status: 400 }
      );
    }

    if (amount === 0) {
      return NextResponse.json(
        { error: 'Adjustment amount cannot be zero' },
        { status: 400 }
      );
    }

    if (!['football', 'real_player'].includes(currencyType)) {
      return NextResponse.json(
        { error: 'Invalid currency type. Must be "football" or "real_player"' },
        { status: 400 }
      );
    }

    // Get team from Firebase
    const teamRef = adminDb.collection('teams').doc(teamId);
    const teamDoc = await teamRef.get();

    if (!teamDoc.exists) {
      return NextResponse.json(
        { error: 'Team not found' },
        { status: 404 }
      );
    }

    const teamData = teamDoc.data();
    const teamName = teamData?.teamName || teamData?.team_name || 'Unknown Team';
    
    // Determine which balance to adjust
    const balanceField = currencyType === 'football' ? 'euroBalance' : 'dollarBalance';
    const currentBalance = teamData?.[balanceField] || 0;
    const newBalance = currentBalance + amount;
    
    // Check if adjustment would result in negative balance
    if (newBalance < 0) {
      return NextResponse.json(
        { error: `Adjustment would result in negative balance (${newBalance})` },
        { status: 400 }
      );
    }

    // Update team balance in Firebase
    await teamRef.update({
      [balanceField]: newBalance,
      updated_at: new Date(),
    });

    // Log the adjustment transaction
    await logAdjustment(
      teamId,
      seasonId,
      amount,
      currentBalance,
      currencyType as CurrencyType,
      reason,
      adjustedBy
    );

    return NextResponse.json({
      success: true,
      teamName,
      currencyType,
      previousBalance: currentBalance,
      newBalance,
      adjustmentAmount: amount,
      reason
    });
  } catch (error) {
    console.error('Error applying adjustment:', error);
    return NextResponse.json(
      { error: 'Failed to apply adjustment' },
      { status: 500 }
    );
  }
}
