import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { verifyAuth } from '@/lib/auth-helper';
import { adminDb } from '@/lib/firebase/admin';
import { decryptBidData } from '@/lib/encryption';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(['team'], request);
    if (!auth.authenticated) {
      return NextResponse.json({
        success: false,
        error: auth.error || 'Unauthorized',
      }, { status: 401 });
    }

    const userId = auth.userId!;

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
          b.phase,
          b.actual_bid_amount,
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

      // Get synthetic allocations (Phase 3 - no bids)
      const syntheticAllocations = await sql`
        SELECT 
          tp.team_id,
          tp.player_id,
          tp.purchase_price,
          tp.acquired_at,
          p.name as player_name,
          p.position,
          p.overall_rating,
          p.team_name as player_team
        FROM team_players tp
        JOIN footballplayers p ON tp.player_id = p.id
        WHERE tp.round_id = ${round.id}
          AND NOT EXISTS (
            SELECT 1 FROM bids b 
            WHERE b.round_id = ${round.id} 
              AND b.team_id = tp.team_id 
              AND b.player_id = tp.player_id
          )
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

      // Get team names in batch (include both bid teams and synthetic allocation teams)
      const bidTeamIds = allBidsDecrypted.map(b => b.team_id);
      const syntheticTeamIds = syntheticAllocations.map(s => s.team_id);
      const uniqueTeamIds = [...new Set([...bidTeamIds, ...syntheticTeamIds])];
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
        // Find the actual winning bid - must have status 'won' OR have final_amount set (from team_players)
        const winningBid = sortedBids.find(b => b.status === 'won' || b.final_amount !== null);
        
        if (!winningBid) {
          console.error(`No winning bid found for player ${playerId}, bids:`, sortedBids);
          return null; // Skip this player if no winner found
        }
        
        const myBid = sortedBids.find(b => b.team_id === dbTeamId);
        
        // Determine phase
        let phase = 'phase1'; // Regular auction
        let phaseNote = null;
        
        if (winningBid.phase === 'incomplete') {
          phase = 'phase2';
          phaseNote = `Team didn't submit. Random from bid list at average price.`;
          if (winningBid.actual_bid_amount) {
            phaseNote += ` Original bid: £${winningBid.actual_bid_amount.toLocaleString()}`;
          }
        }
        
        return {
          player_id: playerId,
          player_name: bids[0].player_name,
          position: bids[0].position,
          overall_rating: bids[0].overall_rating,
          player_team: bids[0].player_team,
          phase,
          phase_note: phaseNote,
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
      }).filter(p => p !== null); // Remove any players without valid winners

      // Add synthetic allocations (Phase 3)
      for (const synthetic of syntheticAllocations) {
        const teamName = teamNamesMap.get(synthetic.team_id) || synthetic.team_id;
        players.push({
          player_id: synthetic.player_id,
          player_name: synthetic.player_name,
          position: synthetic.position,
          overall_rating: synthetic.overall_rating,
          player_team: synthetic.player_team,
          phase: 'phase3',
          phase_note: `Team had no valid bids. Random from position pool at average price.`,
          winning_bid: {
            amount: synthetic.purchase_price,
            team_id: synthetic.team_id,
            team_name: teamName,
            is_you: synthetic.team_id === dbTeamId,
          },
          your_bid: synthetic.team_id === dbTeamId ? {
            amount: 0,
            status: 'won',
            won: true,
            lost_by: 0,
          } : null,
          all_bids: [],
          total_bids: 0,
        });
      }

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
