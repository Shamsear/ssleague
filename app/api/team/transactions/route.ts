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

    // Get team_id from teams collection
    const teamsQuery = await adminDb.collection('teams')
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (teamsQuery.empty) {
      return NextResponse.json({
        success: false,
        error: 'Team not found',
      }, { status: 404 });
    }

    const teamId = teamsQuery.docs[0].id;
    console.log(`Found team_id: ${teamId} for user: ${userId}`);

    // Get season_id from query params, or find active season
    const { searchParams } = new URL(request.url);
    let seasonId = searchParams.get('season_id');

    if (!seasonId) {
      // Find the active season
      const activeSeasonsQuery = await adminDb.collection('seasons')
        .where('isActive', '==', true)
        .limit(1)
        .get();

      if (activeSeasonsQuery.empty) {
        console.warn('No active season found, falling back to most recent registration');
        // Fallback: Find the team's most recent registered season
        const registrationsQuery = await adminDb.collection('team_seasons')
          .where('user_id', '==', userId)
          .where('status', '==', 'registered')
          .orderBy('created_at', 'desc')
          .limit(1)
          .get();

        if (registrationsQuery.empty) {
          return NextResponse.json({
            success: false,
            error: 'You are not registered for any season yet',
          }, { status: 404 });
        }

        seasonId = registrationsQuery.docs[0].data().season_id;
      } else {
        seasonId = activeSeasonsQuery.docs[0].id;
        console.log(`Using active season: ${seasonId}`);
      }
    }

    // Get team_season document using team_id (not user_id)
    const teamSeasonId = `${teamId}_${seasonId}`;
    console.log(`Fetching team_season document: ${teamSeasonId}`);
    
    const teamSeasonDoc = await adminDb.collection('team_seasons').doc(teamSeasonId).get();

    let teamSeasonData;
    let actualDocId = teamSeasonId;

    if (!teamSeasonDoc.exists) {
      console.warn(`Direct lookup failed for ${teamSeasonId}, trying fallback query`);
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

      teamSeasonData = teamSeasonQuery.docs[0].data();
      actualDocId = teamSeasonQuery.docs[0].id;
      console.log(`Found via fallback query: ${actualDocId}`);
    } else {
      teamSeasonData = teamSeasonDoc.data();
      console.log(`Found team_season data directly`);
    }
    
    console.log(`Team season data:`, {
      football_budget: teamSeasonData?.football_budget,
      football_starting_balance: teamSeasonData?.football_starting_balance,
      real_player_budget: teamSeasonData?.real_player_budget,
      real_player_starting_balance: teamSeasonData?.real_player_starting_balance,
    });

    // Determine currency system
    const currencySystem = teamSeasonData?.currency_system || 'single';
    const isDualCurrency = currencySystem === 'dual';

    // Fetch transaction history from transactions collection
    console.log(`Fetching transactions for team_id: ${teamId}, season_id: ${seasonId}`);
    const transactionsSnapshot = await adminDb
      .collection('transactions')
      .where('team_id', '==', teamId)
      .where('season_id', '==', seasonId)
      .orderBy('created_at', 'desc')
      .limit(500)
      .get();
    
    console.log(`Found ${transactionsSnapshot.size} transactions`);

    // Separate transactions by currency type
    const footballTransactions: any[] = [];
    const realPlayerTransactions: any[] = [];

    transactionsSnapshot.forEach(doc => {
      const data = doc.data();
      
      const transaction = {
        id: doc.id,
        date: data.created_at?.toDate?.()?.toISOString() || new Date().toISOString(),
        type: data.transaction_type || 'unknown',
        amount: data.amount || 0,
        reason: data.reason || data.description || 'Transaction',
        balance_after: data.balance_after || 0,
        metadata: data.metadata || {}
      };

      // Categorize by currency type
      if (data.currency_type === 'real_player') {
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
          starting_balance: teamSeasonData?.football_starting_balance || 0,
          total_spent: teamSeasonData?.football_spent || 0,
          total_earned: teamSeasonData?.football_earned || 0,
          transactions: footballTransactions,
        },
        real_player: {
          current_balance: teamSeasonData?.real_player_budget || 0,
          starting_balance: teamSeasonData?.real_player_starting_balance || 0,
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
          starting_balance: teamSeasonData?.initial_budget || teamSeasonData?.budget_initial || 0,
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
    console.error('❌ Error fetching transactions:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      name: error.name,
      code: error.code,
      details: error.details
    });
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch transactions',
      message: error.message || 'Unknown error',
      details: error.code || error.name || 'No additional details',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
