import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase/config';
import { collection, query, where, orderBy, limit as fbLimit, getDocs, startAfter, Query, DocumentData } from 'firebase/firestore';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const seasonId = searchParams.get('season_id');
    const teamId = searchParams.get('team_id');
    const transactionType = searchParams.get('transaction_type');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!seasonId) {
      return NextResponse.json(
        { success: false, error: 'Season ID is required' },
        { status: 400 }
      );
    }

    // Build the query
    const transactionsRef = collection(db, 'transactions');
    let q: Query<DocumentData> = query(
      transactionsRef,
      where('season_id', '==', seasonId),
      orderBy('created_at', 'desc')
    );

    // Add transaction type filter if provided
    if (transactionType) {
      q = query(
        transactionsRef,
        where('season_id', '==', seasonId),
        where('transaction_type', '==', transactionType),
        orderBy('created_at', 'desc')
      );
    }

    // Fetch all matching documents (Firebase doesn't support offset directly)
    const querySnapshot = await getDocs(q);
    
    let allTransactions: any[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      
      // Apply team filter if provided (client-side filtering)
      if (teamId) {
        const matchesTeam = 
          data.old_team_id === teamId ||
          data.new_team_id === teamId ||
          data.team_a_id === teamId ||
          data.team_b_id === teamId ||
          data.teams?.team_a_id === teamId ||
          data.teams?.team_b_id === teamId;
        
        if (!matchesTeam) return;
      }
      
      allTransactions.push({
        id: doc.id,
        ...data,
        created_at: data.created_at?.toDate?.()?.toISOString() || new Date().toISOString()
      });
    });

    // Apply pagination
    const totalCount = allTransactions.length;
    const paginatedTransactions = allTransactions.slice(offset, offset + limit);

    return NextResponse.json({
      success: true,
      transactions: paginatedTransactions,
      pagination: {
        total: totalCount,
        limit,
        offset,
        has_more: offset + limit < totalCount
      }
    });
  } catch (error) {
    console.error('Error fetching transfer history:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch transfer history', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
