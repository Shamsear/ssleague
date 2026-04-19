import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-helper';
import { adminDb } from '@/lib/firebase/admin';

/**
 * POST /api/admin/create-missing-transaction
 * Create missing transaction for Nathan Aké purchase
 * Admin/Committee only
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(['admin', 'committee_admin'], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Transaction details for Nathan Aké
    const transactionData = {
      userId: 'POOEoZr5lvZoeiQeA492LafRG9R2', // FC Barcelona firebase_uid
      seasonId: 'SSPSLS17',
      type: 'auction_win',
      category: 'football',
      amount: -10,
      balanceBefore: 3395.70,
      balanceAfter: 3385.70,
      description: 'Won Nathan Aké in auction',
      metadata: {
        playerId: '285',
        playerName: 'Nathan Aké',
        roundId: 'SSPSLFBR00010',
        bidAmount: 10,
      },
      createdAt: new Date(),
    };

    // Create transaction in Firebase
    const transactionRef = adminDb.collection('transactions').doc();
    await transactionRef.set(transactionData);

    console.log(`✅ Created missing transaction for Nathan Aké`);
    console.log(`   Transaction ID: ${transactionRef.id}`);

    return NextResponse.json({
      success: true,
      data: {
        transactionId: transactionRef.id,
        player: 'Nathan Aké',
        team: 'FC Barcelona (SSPSLT0006)',
        amount: -10,
        round: 'SSPSLFBR00010',
      },
      message: 'Transaction created successfully',
    });

  } catch (error: any) {
    console.error('❌ Error creating transaction:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
