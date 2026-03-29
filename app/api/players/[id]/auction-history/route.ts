import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { decryptBidData } from '@/lib/encryption';

const sql = neon(process.env.DATABASE_URL!);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: playerId } = await params;

    // Fetch bids from regular auction (bids table)
    const regularBids = await sql`
      SELECT 
        b.id,
        b.round_id,
        b.player_id,
        b.team_id,
        t.name as team_name,
        b.amount,
        b.encrypted_bid_data,
        b.created_at as bid_time,
        b.status,
        CASE WHEN b.status = 'won' THEN true ELSE false END as is_winning,
        r.season_id,
        r.position,
        r.end_time,
        r.status as round_status,
        'normal' as round_type
      FROM bids b
      LEFT JOIN teams t ON b.team_id = t.id
      LEFT JOIN rounds r ON b.round_id::text = r.id::text
      WHERE b.player_id = ${playerId}
    `;

    // Fetch bids from bulk auction (round_bids table)
    const bulkBids = await sql`
      SELECT 
        rb.id,
        rb.round_id,
        rb.player_id,
        rb.team_id,
        rb.team_name,
        rb.bid_amount as amount,
        NULL as encrypted_bid_data,
        rb.bid_time,
        NULL as status,
        rb.is_winning,
        r.season_id,
        r.position,
        r.end_time,
        r.status as round_status,
        'bulk' as round_type
      FROM round_bids rb
      LEFT JOIN rounds r ON rb.round_id::text = r.id::text
      WHERE rb.player_id = ${playerId}
    `;

    // Combine both bid types
    const allBids = [...regularBids, ...bulkBids];

    // Sort by season and time
    allBids.sort((a: any, b: any) => {
      if (a.season_id !== b.season_id) {
        return (b.season_id || '').localeCompare(a.season_id || '');
      }
      return new Date(b.bid_time).getTime() - new Date(a.bid_time).getTime();
    });

    // Decrypt bid amounts for regular bids
    const decryptedBids = allBids.map((bid: any) => {
      let bidAmount = bid.amount;
      
      // If amount is null and encrypted_bid_data exists, decrypt it (regular bids)
      if (bid.amount === null && bid.encrypted_bid_data) {
        try {
          const decrypted = decryptBidData(bid.encrypted_bid_data);
          bidAmount = decrypted.amount;
        } catch (err) {
          console.error('Failed to decrypt bid:', err);
          bidAmount = 0; // Fallback
        }
      }
      
      return {
        ...bid,
        bid_amount: bidAmount || 0,
      };
    });

    // Group bids by season
    const bidsBySeason: Record<string, any[]> = {};
    const winningBids: any[] = [];

    decryptedBids.forEach((bid: any) => {
      const seasonId = bid.season_id || 'unknown';
      
      if (!bidsBySeason[seasonId]) {
        bidsBySeason[seasonId] = [];
      }
      
      // Add computed fields for display
      const enrichedBid = {
        ...bid,
        round_number: bid.position || 'N/A', // Use position as round identifier
        winning_bid: bid.bid_amount, // Use the same amount for winning bid
      };
      
      bidsBySeason[seasonId].push(enrichedBid);

      // Track winning bids (from both regular and bulk auctions)
      const isWinningBid = bid.status === 'won' || bid.is_winning === true;
      
      if (isWinningBid) {
        const existingWin = winningBids.find(
          (w: any) => w.season_id === bid.season_id && w.round_id === bid.round_id
        );
        if (!existingWin) {
          winningBids.push({
            season_id: bid.season_id,
            round_id: bid.round_id,
            round_number: bid.position || 'N/A',
            round_type: bid.round_type || 'auction',
            team_id: bid.team_id,
            team_name: bid.team_name,
            winning_bid: bid.bid_amount,
            bid_time: bid.bid_time,
            end_time: bid.end_time,
          });
        }
      }
    });

    // Calculate highest winning bid
    const highestBid = winningBids.length > 0
      ? Math.max(...winningBids.map((bid: any) => bid.winning_bid || 0))
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        bidsBySeason,
        winningBids: winningBids.sort((a: any, b: any) => {
          // Sort by season (desc) then bid time (desc)
          if (a.season_id !== b.season_id) {
            return b.season_id.localeCompare(a.season_id);
          }
          return new Date(b.bid_time).getTime() - new Date(a.bid_time).getTime();
        }),
        totalBids: decryptedBids.length,
        totalSeasons: Object.keys(bidsBySeason).length,
        highestBid,
      },
    });
  } catch (error) {
    console.error('Error fetching auction history:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch auction history',
      },
      { status: 500 }
    );
  }
}
