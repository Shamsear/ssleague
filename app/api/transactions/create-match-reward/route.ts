import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getTournamentDb } from '@/lib/neon/tournament-config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      team_id,
      team_name,
      season_id,
      fixture_id,
      currency_type, // 'football' or 'real'
      amount,
      result, // 'Win', 'Draw', or 'Loss'
      description
    } = body;

    if (!team_id || !season_id || !fixture_id || !currency_type || !amount) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Fetch fixture from Neon to get updated_at timestamp and other details
    const sql = getTournamentDb();
    const fixtures = await sql`
      SELECT updated_at, scheduled_date, created_at, round_number, leg
      FROM fixtures
      WHERE id = ${fixture_id}
      LIMIT 1
    `;

    // Use fixture's updated_at if available, otherwise scheduled_date, otherwise created_at, otherwise current time
    let transactionDate = new Date();
    let roundNumber = 0;
    let leg = 'first';
    
    if (fixtures.length > 0) {
      const fixture = fixtures[0];
      transactionDate = fixture.updated_at || fixture.scheduled_date || fixture.created_at || new Date();
      roundNumber = fixture.round_number || 0;
      leg = fixture.leg || 'first';
    }

    // Determine both currency amounts based on result
    let eCoinAmount = 0;
    let sSCoinAmount = 0;
    
    if (result === 'Win') {
      eCoinAmount = 30;
      sSCoinAmount = 6;
    } else if (result === 'Draw') {
      eCoinAmount = 20;
      sSCoinAmount = 4;
    } else if (result === 'Loss') {
      eCoinAmount = 10;
      sSCoinAmount = 2;
    }

    // Create more descriptive description matching existing format
    const currencyName = currency_type === 'football' ? 'eCoin' : 'SSCoin';
    const detailedDescription = `Match Reward (${result}) - Round ${roundNumber} - Fixture: ${fixture_id} - ${currencyName}`;

    // Create transaction in Firebase with complete metadata
    const transactionRef = adminDb.collection('transactions').doc();
    const transactionData = {
      team_id,
      team_name: team_name || team_id,
      season_id,
      transaction_type: 'match_reward',
      currency_type,
      amount,
      description: detailedDescription,
      metadata: {
        fixture_id,
        result,
        round_number: roundNumber,
        leg,
        currency: currency_type === 'football' ? 'ecoin' : 'sscoin',
        ecoin: eCoinAmount,
        sscoin: sSCoinAmount
      },
      created_at: transactionDate,
      updated_at: transactionDate
    };

    await transactionRef.set(transactionData);

    return NextResponse.json({
      success: true,
      transaction_id: transactionRef.id,
      message: `Successfully created match reward transaction`
    });
  } catch (error) {
    console.error('Error creating match reward transaction:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create transaction',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
