import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { getAuthToken } from '@/lib/auth/token-helper';
import { 
  getCachedUserTeamId, 
  getCachedActiveSeason, 
  getCachedTeamSeason,
  CACHE_DURATIONS 
} from '@/lib/firebase/smart-cache';
import { getCached, setCached } from '@/lib/firebase/cache';

export async function GET(request: NextRequest) {
  try {
    // Get token from Authorization header or cookie
    const token = await getAuthToken(request);

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

    // ✅ OPTIMIZED: Get team_id with smart caching (reduces 4 Firebase queries to 0-1)
    const teamId = await getCachedUserTeamId(userId);
    
    if (!teamId) {
      console.error(`No team found for user ${userId}`);
      return NextResponse.json({
        success: false,
        error: 'Team not found. Please make sure you are registered for a season.',
      }, { status: 404 });
    }

    console.log(`Found team_id: ${teamId} for user: ${userId}`);
    

    // Get season_id from query params, or find active season
    const { searchParams } = new URL(request.url);
    let seasonId = searchParams.get('season_id');

    if (!seasonId) {
      // ✅ OPTIMIZED: Get active season with caching (reduces Firebase query to 0-1)
      const activeSeason = await getCachedActiveSeason();
      
      if (!activeSeason) {
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
        seasonId = activeSeason.id;
        console.log(`Using active season: ${seasonId}`);
      }
    }

    // ✅ OPTIMIZED: Get team_season with smart caching (reduces 1-2 Firebase queries to 0-1)
    const teamSeasonResult = await getCachedTeamSeason(userId, seasonId);
    
    if (!teamSeasonResult) {
      return NextResponse.json({
        success: false,
        error: 'Team not registered for this season',
      }, { status: 404 });
    }
    
    const teamSeasonData = teamSeasonResult.data;
    const actualDocId = teamSeasonResult.id;
    console.log(`Found team_season: ${actualDocId}`);
    
    
    console.log(`Team season data:`, {
      football_budget: teamSeasonData?.football_budget,
      football_starting_balance: teamSeasonData?.football_starting_balance,
      real_player_budget: teamSeasonData?.real_player_budget,
      real_player_starting_balance: teamSeasonData?.real_player_starting_balance,
    });

    // Determine currency system
    const currencySystem = teamSeasonData?.currency_system || 'single';
    const isDualCurrency = currencySystem === 'dual';

    // ✅ OPTIMIZED: Fetch transactions with 15-minute cache
    const transactionsCacheKey = `${teamId}_${seasonId}`;
    let allTransactions = getCached<any[]>('transactions', transactionsCacheKey, CACHE_DURATIONS.TRANSACTIONS);
    
    if (!allTransactions) {
      console.log(`❌ [Cache MISS] transactions for team ${teamId}, season ${seasonId}`);
      const transactionsSnapshot = await adminDb
        .collection('transactions')
        .where('team_id', '==', teamId)
        .where('season_id', '==', seasonId)
        .orderBy('created_at', 'desc')
        .limit(500)
        .get();
      
      console.log(`Found ${transactionsSnapshot.size} transactions from Firebase`);
      allTransactions = transactionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Cache for 15 minutes
      setCached('transactions', transactionsCacheKey, allTransactions);
      console.log(`💾 [Cached] transactions for team ${teamId}`);
    } else {
      console.log(`✅ [Cache HIT] transactions for team ${teamId} (${allTransactions.length} transactions)`);
    }

    // Separate transactions by currency type
    let footballTransactions: any[] = [];
    let realPlayerTransactions: any[] = [];

    allTransactions.forEach(transaction => {
      const data = transaction;
      
      const formattedTransaction = {
        id: transaction.id,
        date: data.created_at?.toDate?.()?.toISOString() || new Date().toISOString(),
        type: data.transaction_type || 'unknown',
        amount: data.amount || 0,
        reason: data.reason || data.description || 'Transaction',
        balance_after: data.balance_after || 0,
        metadata: data.metadata || {}
      };

      // Categorize by currency type or transaction type
      const isRealPlayerTransaction = 
        data.currency_type === 'real_player' || 
        data.transaction_type === 'real_player_fee' ||
        data.transaction_type === 'real_player' ||
        (data.reason && data.reason.toLowerCase().includes('real player'));
      
      if (isRealPlayerTransaction) {
        realPlayerTransactions.push(formattedTransaction);
      } else {
        footballTransactions.push(formattedTransaction);
      }
    });

    // Sort transactions by created_at DESC, then by balance_after ASC for same timestamps
    const sortTransactions = (transactions: any[]) => {
      return transactions.sort((a, b) => {
        // First sort by date (newest first)
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        if (dateB !== dateA) {
          return dateB - dateA;
        }
        // If same timestamp, sort by balance (ascending = chronological order)
        return a.balance_after - b.balance_after;
      });
    };

    footballTransactions = sortTransactions(footballTransactions);
    realPlayerTransactions = sortTransactions(realPlayerTransactions);

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
