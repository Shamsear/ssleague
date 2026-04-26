import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { adminDb } from '@/lib/firebase/admin';
import { decryptBidData } from '@/lib/encryption';

// Fetch player history including transactions and contract timeline
const sql = neon(process.env.NEON_DATABASE_URL!);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    console.log('=== CONTRACT HISTORY DEBUG ===');
    console.log('Requested player ID:', id);
    
    // First, get the player's player_id from the database
    const playerData = await sql`
      SELECT player_id FROM footballplayers WHERE id = ${id}
    `;
    
    const playerIdForTransactions = playerData[0]?.player_id || id;
    console.log('Player ID for transactions:', playerIdForTransactions);
    
    // Fetch transactions from Firebase for cross-reference only
    const transactionsSnapshot = await adminDb
      .collection('transactions')
      .where('player_id', '==', playerIdForTransactions.toString())
      .get();
    
    const transactions = transactionsSnapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      .sort((a: any, b: any) => {
        const aTime = a.created_at?._seconds || a.created_at?.seconds || 0;
        const bTime = b.created_at?._seconds || b.created_at?.seconds || 0;
        return bTime - aTime;
      });
    
    console.log('Firebase transactions found:', transactions.length);
    console.log('Transaction types:', transactions.map((t: any) => t.transaction_type));
    
    // Fetch ALL player history from Neon (primary source for contract history)
    const playerHistory = await sql`
      SELECT 
        ph.player_id,
        ph.team_id,
        t.name as team_name,
        ph.season_id,
        ph.acquisition_type,
        ph.acquisition_date,
        ph.acquisition_value,
        ph.status,
        ph.end_date,
        ph.end_reason,
        ph.transaction_id,
        ph.contract_start_season,
        ph.contract_end_season
      FROM player_history ph
      LEFT JOIN teams t ON ph.team_id = t.id
      WHERE ph.player_id = ${playerIdForTransactions.toString()}
      ORDER BY ph.acquisition_date ASC
    `;
    
    console.log('Player history records found:', playerHistory.length);
    console.log('Player history details:', JSON.stringify(playerHistory, null, 2));
    
    // Build roadmap from player_history
    console.log('Building roadmap from player_history...');
    const roadmap = playerHistory.map((history: any) => {
      const baseData = {
        team_id: history.team_id,
        team_name: history.team_name,
        season_id: history.season_id,
        acquisition_date: history.acquisition_date,
        acquisition_value: history.acquisition_value,
        status: history.status,
        end_date: history.end_date,
        end_reason: history.end_reason,
        transaction_id: history.transaction_id,
        contract_start_season: history.contract_start_season,
        contract_end_season: history.contract_end_season
      };
      
      if (history.acquisition_type === 'swap') {
        return {
          type: 'swap',
          ...baseData
        };
      } else if (history.acquisition_type === 'auction') {
        return {
          type: 'auction',
          ...baseData,
          acquisition_amount: history.acquisition_value
        };
      } else {
        return {
          type: history.acquisition_type || 'unknown',
          ...baseData
        };
      }
    });
    
    console.log('Final roadmap entries:', roadmap.length);
    console.log('Roadmap summary:', roadmap.map((r: any) => ({ type: r.type, team: r.team_name, date: r.acquisition_date })));
    console.log('=== END CONTRACT HISTORY DEBUG ===');
    
    return NextResponse.json({
      success: true,
      data: {
        transactions, // For cross-reference only
        playerHistory,
        roadmap
      }
    });
  } catch (error: any) {
    console.error('Error fetching player history:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
