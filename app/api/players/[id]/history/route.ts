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
    
    // First, get the player's player_id from the database
    const playerData = await sql`
      SELECT player_id FROM footballplayers WHERE id = ${id}
    `;
    
    const playerIdForTransactions = playerData[0]?.player_id || id;
    
    // Fetch all transactions for this player from Firebase using player_id
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
        // Sort by created_at in descending order (newest first)
        const aTime = a.created_at?._seconds || a.created_at?.seconds || 0;
        const bTime = b.created_at?._seconds || b.created_at?.seconds || 0;
        return bTime - aTime;
      });
    
    // Fetch all winning bids for this player from Neon to build contract history
    // NOTE: bids.player_id stores the footballplayers.id (not player_id column)
    const winningBids = await sql`
      SELECT 
        b.id,
        b.round_id,
        b.team_id,
        b.amount,
        b.encrypted_bid_data,
        b.created_at as bid_time,
        b.season_id,
        t.name as team_name,
        r.position as round_number
      FROM bids b
      LEFT JOIN teams t ON b.team_id = t.id
      LEFT JOIN rounds r ON b.round_id::text = r.id::text
      WHERE b.player_id = ${id}
        AND b.status = 'won'
      ORDER BY b.created_at ASC
    `;
    
    // Build player roadmap
    const roadmap = [];
    
    // Process winning bids to create contract periods
    for (const bid of winningBids) {
      const acquisitionSeason = bid.season_id;
      
      // Try to get bid amount from amount column or decrypt encrypted_bid_data
      let bidAmount = bid.amount;
      if (!bidAmount && bid.encrypted_bid_data) {
        try {
          const decrypted = decryptBidData(bid.encrypted_bid_data);
          bidAmount = decrypted.amount;
        } catch (err) {
          console.error('Failed to decrypt bid:', err);
          bidAmount = 0;
        }
      }
      bidAmount = bidAmount || 0;
      
      // Check if there's a release transaction for this player from this team
      const releaseTransaction = transactions.find(
        (t: any) => 
          t.transaction_type === 'release' && 
          t.team_id === bid.team_id &&
          t.season_id >= acquisitionSeason
      );
      
      roadmap.push({
        type: 'contract',
        team_id: bid.team_id,
        team_name: bid.team_name,
        acquisition_season: acquisitionSeason,
        acquisition_season_name: acquisitionSeason, // Use season_id as name since we don't have seasons table
        acquisition_amount: bidAmount,
        acquisition_date: bid.bid_time,
        acquisition_round: bid.round_number,
        release_season: releaseTransaction?.release_season || null,
        release_season_name: releaseTransaction?.season_id || null,
        release_amount: releaseTransaction?.refund_amount || null,
        release_date: releaseTransaction?.created_at 
          ? (releaseTransaction.created_at._seconds 
              ? new Date(releaseTransaction.created_at._seconds * 1000).toISOString()
              : releaseTransaction.created_at)
          : null,
        release_timing: releaseTransaction?.release_timing || null,
        contract_duration: 2, // Default 2 seasons
        status: releaseTransaction ? 'released' : 'active'
      });
    }
    
    // Separate release transactions
    const releases = transactions.filter((t: any) => t.transaction_type === 'release');
    
    return NextResponse.json({
      success: true,
      data: {
        transactions,
        releases,
        roadmap,
        winningBids
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
