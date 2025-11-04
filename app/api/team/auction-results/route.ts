import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getAuthToken } from '@/lib/auth/token-helper';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { decryptBidData } from '@/lib/encryption';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

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

    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('season_id');
    const roundId = searchParams.get('round_id'); // Optional filter by specific round

    if (!seasonId) {
      return NextResponse.json({
        success: false,
        error: 'Season ID is required',
      }, { status: 400 });
    }

    // Get team ID from database
    const teamIdResult = await sql`
      SELECT id FROM teams WHERE firebase_uid = ${userId} LIMIT 1
    `;
    
    const dbTeamId = teamIdResult.length > 0 ? teamIdResult[0].id : null;
    
    if (!dbTeamId) {
      return NextResponse.json({
        success: false,
        error: 'Team not found',
      }, { status: 404 });
    }

    // Fetch completed rounds for this season
    const roundsQuery = roundId 
      ? sql`
          SELECT id, season_id, position, round_number, round_type, status, end_time, created_at
          FROM rounds
          WHERE id = ${roundId} AND season_id = ${seasonId}
          ORDER BY created_at DESC
        `
      : sql`
          SELECT id, season_id, position, round_number, round_type, status, end_time, created_at
          FROM rounds
          WHERE season_id = ${seasonId}
          AND status = 'completed'
          AND round_type != 'bulk'
          ORDER BY created_at DESC
        `;
    
    const rounds = await roundsQuery;

    // For each round, fetch all bids with player info
    const roundsWithResults = await Promise.all(rounds.map(async (round) => {
      // Get all bids for this round
      const allBidsRaw = await sql`
        SELECT 
          b.id,
          b.team_id,
          b.player_id,
          b.amount,
          b.encrypted_bid_data,
          b.status,
          b.created_at,
          p.name as player_name,
          p.position,
          p.overall_rating,
          p.team_name as player_team,
          tp.purchase_price as final_amount
        FROM bids b
        INNER JOIN footballplayers p ON b.player_id = p.id
        LEFT JOIN team_players tp ON b.player_id = tp.player_id AND tp.team_id = b.team_id
        WHERE b.round_id = ${round.id}
        ORDER BY b.player_id, b.amount DESC
      `;

      // Decrypt all bids
      const allBidsDecrypted = allBidsRaw.map(bid => {
        let bidAmount = bid.amount;
        if (bid.amount === null && bid.encrypted_bid_data) {
          try {
            const decrypted = decryptBidData(bid.encrypted_bid_data);
            bidAmount = decrypted.amount;
          } catch (err) {
            console.error('Failed to decrypt bid:', err);
            bidAmount = 0;
          }
        }
        return { ...bid, decrypted_amount: bidAmount };
      });

      // Group bids by player
      const playerBidsMap = new Map<string, any[]>();
      allBidsDecrypted.forEach(bid => {
        if (!playerBidsMap.has(bid.player_id)) {
          playerBidsMap.set(bid.player_id, []);
        }
        playerBidsMap.get(bid.player_id)!.push(bid);
      });

      // Get team names in batch
      const uniqueTeamIds = [...new Set(allBidsDecrypted.map(b => b.team_id))];
      const teamNamesMap = new Map<string, string>();
      
      await Promise.all(uniqueTeamIds.map(async (teamId) => {
        try {
          const doc = await adminDb.collection('team_seasons').doc(`${teamId}_${seasonId}`).get();
          teamNamesMap.set(teamId, doc.exists ? doc.data()?.team_name || teamId : teamId);
        } catch {
          teamNamesMap.set(teamId, teamId);
        }
      }));

      // Build players array with all bids
      const players = Array.from(playerBidsMap.entries()).map(([playerId, bids]) => {
        const sortedBids = bids.sort((a, b) => b.decrypted_amount - a.decrypted_amount);
        const winningBid = sortedBids.find(b => b.status === 'won') || sortedBids[0];
        const myBid = sortedBids.find(b => b.team_id === dbTeamId);
        
        return {
          player_id: playerId,
          player_name: bids[0].player_name,
          position: bids[0].position,
          overall_rating: bids[0].overall_rating,
          player_team: bids[0].player_team,
          winning_bid: {
            amount: winningBid.final_amount || winningBid.decrypted_amount,
            team_id: winningBid.team_id,
            team_name: teamNamesMap.get(winningBid.team_id) || winningBid.team_id,
            is_you: winningBid.team_id === dbTeamId,
          },
          your_bid: myBid ? {
            amount: myBid.decrypted_amount,
            status: myBid.status,
            won: myBid.status === 'won',
            lost_by: myBid.status === 'lost' 
              ? (winningBid.final_amount || winningBid.decrypted_amount) - myBid.decrypted_amount 
              : 0,
          } : null,
          all_bids: sortedBids.map(bid => ({
            team_id: bid.team_id,
            team_name: teamNamesMap.get(bid.team_id) || bid.team_id,
            amount: bid.decrypted_amount,
            status: bid.status,
            is_you: bid.team_id === dbTeamId,
            is_winner: bid.id === winningBid.id,
          })),
          total_bids: bids.length,
        };
      });

      // Sort players by winning bid amount (descending)
      players.sort((a, b) => b.winning_bid.amount - a.winning_bid.amount);

      return {
        round_id: round.id,
        round_number: round.round_number,
        position: round.position,
        round_type: round.round_type,
        status: round.status,
        end_time: round.end_time,
        created_at: round.created_at,
        players,
        total_players: players.length,
        your_wins: players.filter(p => p.your_bid?.won).length,
        your_losses: players.filter(p => p.your_bid && !p.your_bid.won).length,
        no_bids: players.filter(p => !p.your_bid).length,
      };
    }));

    return NextResponse.json({
      success: true,
      data: {
        rounds: roundsWithResults,
        total_rounds: rounds.length,
      },
    });

  } catch (error: any) {
    console.error('Error fetching auction results:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch auction results',
    }, { status: 500 });
  }
}
