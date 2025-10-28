import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    // Get Firebase ID token from cookie
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized - No token',
      }, { status: 401 });
    }

    // Verify Firebase ID token
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (err) {
      console.error('Token verification error:', err);
      return NextResponse.json({
        success: false,
        error: 'Invalid token',
      }, { status: 401 });
    }

    const userId = decodedToken.uid;

    // Get season_id from query params
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('season_id');

    if (!seasonId) {
      return NextResponse.json({
        success: false,
        error: 'Season ID is required',
      }, { status: 400 });
    }

    // Get team_season document
    const teamSeasonId = `${userId}_${seasonId}`;
    const teamSeasonDoc = await adminDb.collection('team_seasons').doc(teamSeasonId).get();

    if (!teamSeasonDoc.exists) {
      // Fallback: Query by user_id field
      const teamSeasonQuery = await adminDb.collection('team_seasons')
        .where('user_id', '==', userId)
        .where('season_id', '==', seasonId)
        .where('status', '==', 'registered')
        .limit(1)
        .get();

      if (teamSeasonQuery.empty) {
        return NextResponse.json({
          success: false,
          error: 'Team not registered for this season',
        }, { status: 404 });
      }
    }

    const teamSeasonData = teamSeasonDoc.exists 
      ? teamSeasonDoc.data() 
      : teamSeasonQuery.docs[0].data();

    // Determine currency system
    const currencySystem = teamSeasonData?.currency_system || 'single';
    const isDualCurrency = currencySystem === 'dual';

    // Fetch transaction history from Firestore subcollection
    const transactionsSnapshot = await adminDb
      .collection('team_seasons')
      .doc(teamSeasonDoc.exists ? teamSeasonId : teamSeasonQuery.docs[0].id)
      .collection('transactions')
      .orderBy('created_at', 'desc')
      .limit(500)
      .get();

    // Separate transactions by currency type
    const footballTransactions: any[] = [];
    const realPlayerTransactions: any[] = [];

    transactionsSnapshot.forEach(doc => {
      const data = doc.data();
      const transaction = {
        id: doc.id,
        date: data.created_at?.toDate?.()?.toISOString() || new Date().toISOString(),
        type: data.type || 'unknown',
        amount: data.amount || 0,
        reason: data.reason || data.description || 'No description',
        balance_after: data.balance_after || 0,
        metadata: data.metadata || {},
      };

      // Categorize by currency type
      if (data.currency_type === 'real_player' || data.type?.includes('real_player')) {
        realPlayerTransactions.push(transaction);
      } else {
        footballTransactions.push(transaction);
      }
    });

    // Build response based on currency system
    if (isDualCurrency) {
      return NextResponse.json({
        success: true,
        season_id: seasonId,
        currency_system: 'dual',
        football: {
          current_balance: teamSeasonData?.football_budget || 0,
          starting_balance: teamSeasonData?.initial_football_budget || 10000,
          total_spent: teamSeasonData?.football_spent || 0,
          total_earned: teamSeasonData?.football_earned || 0,
          transactions: footballTransactions,
        },
        real_player: {
          current_balance: teamSeasonData?.real_player_budget || 0,
          starting_balance: teamSeasonData?.initial_real_player_budget || 5000,
          total_spent: teamSeasonData?.real_player_spent || 0,
          total_earned: teamSeasonData?.real_player_earned || 0,
          transactions: realPlayerTransactions,
        },
      });
    } else {
      // Single currency system - put all transactions in football budget
      return NextResponse.json({
        success: true,
        season_id: seasonId,
        currency_system: 'single',
        football: {
          current_balance: teamSeasonData?.budget || 0,
          starting_balance: teamSeasonData?.starting_balance || 15000,
          total_spent: teamSeasonData?.total_spent || 0,
          total_earned: teamSeasonData?.total_earned || 0,
          transactions: [...footballTransactions, ...realPlayerTransactions],
        },
        real_player: {
          current_balance: 0,
          starting_balance: 0,
          total_spent: 0,
          total_earned: 0,
          transactions: [],
        },
      });
    }

  } catch (error: any) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch transactions',
      details: error.message,
    }, { status: 500 });
  }
}
