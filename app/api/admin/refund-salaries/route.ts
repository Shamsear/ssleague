import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { getAuthToken } from '@/lib/auth/token-helper';

/**
 * Refund all salary deductions for a season
 * This is useful for testing/resetting
 */
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

    const body = await request.json();
    const { season_id } = body;

    if (!season_id) {
      return NextResponse.json(
        { error: 'season_id is required' },
        { status: 400 }
      );
    }

    console.log(`\n💰 Refunding Salary Deductions for Season ${season_id}\n`);

    // Get all salary payment transactions
    const transactionsSnapshot = await adminDb.collection('transactions')
      .where('season_id', '==', season_id)
      .where('transaction_type', '==', 'salary_payment')
      .where('currency_type', '==', 'real_player')
      .get();

    if (transactionsSnapshot.empty) {
      return NextResponse.json({
        success: true,
        message: 'No salary payment transactions found to refund',
        refunds: []
      });
    }

    console.log(`Found ${transactionsSnapshot.size} salary payment transactions\n`);

    // Group by team
    const refunds: { [key: string]: number } = {};
    transactionsSnapshot.forEach(doc => {
      const data = doc.data();
      const team_id = data.team_id;
      const amount = Math.abs(data.amount); // Get positive amount

      if (!refunds[team_id]) {
        refunds[team_id] = 0;
      }
      refunds[team_id] += amount;
    });

    // Apply refunds
    const refundResults: any[] = [];

    for (const [team_id, refund_amount] of Object.entries(refunds)) {
      const teamSeasonDocId = `${team_id}_${season_id}`;
      const teamSeasonRef = adminDb.collection('team_seasons').doc(teamSeasonDocId);
      const teamSeasonDoc = await teamSeasonRef.get();

      if (!teamSeasonDoc.exists) {
        console.log(`  ❌ ${team_id}: Team season document not found (${teamSeasonDocId})`);
        refundResults.push({
          team_id,
          success: false,
          error: 'Team season document not found'
        });
        continue;
      }

      const data = teamSeasonDoc.data();
      const current_balance = data?.real_player_budget || 0;
      const new_balance = current_balance + refund_amount;

      // Update balance
      await teamSeasonRef.update({
        real_player_budget: new_balance,
        updated_at: new Date()
      });

      console.log(`  ✅ ${team_id}: Refunded $${refund_amount.toFixed(2)}`);
      console.log(`     Balance: $${current_balance.toFixed(2)} → $${new_balance.toFixed(2)}\n`);

      refundResults.push({
        team_id,
        success: true,
        refund_amount,
        balance_before: current_balance,
        balance_after: new_balance
      });
    }

    // Delete salary payment transactions
    console.log('\nDeleting salary payment transactions...\n');
    const batch = adminDb.batch();

    transactionsSnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    console.log(`✅ Deleted ${transactionsSnapshot.size} salary payment transactions`);
    console.log(`\n✅ Refund complete! All teams have been refunded their salary deductions.\n`);

    return NextResponse.json({
      success: true,
      message: `Refunded ${refundResults.length} teams and deleted ${transactionsSnapshot.size} transactions`,
      refunds: refundResults
    });

  } catch (error) {
    console.error('Error refunding salaries:', error);
    return NextResponse.json(
      { error: 'Failed to refund salaries' },
      { status: 500 }
    );
  }
}
