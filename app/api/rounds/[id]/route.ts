import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { adminDb } from '@/lib/firebase/admin';
import { decryptBidData } from '@/lib/encryption';

const sql = neon(process.env.NEON_DATABASE_URL!);

// GET single round by ID with players
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const roundId = id; // Round ID is a UUID string, not an integer

    // Fetch round details
    const rounds = await sql`
      SELECT * FROM rounds WHERE id = ${roundId} LIMIT 1;
    `;

    if (rounds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Round not found' },
        { status: 404 }
      );
    }

    const round = rounds[0];

    // Fetch bids for this round with player information
    const bidsRaw = await sql`
      SELECT 
        b.*,
        p.name as player_name,
        p.position,
        p.overall_rating
      FROM bids b
      LEFT JOIN footballplayers p ON b.player_id = p.id
      WHERE b.round_id = ${roundId}
      ORDER BY b.created_at DESC;
    `;

    // STEP 1: Get all unique team IDs
    const uniqueTeamIds = [...new Set(bidsRaw.map((b: any) => b.team_id))];
    
    // STEP 2: Batch fetch ALL team names at once from Firebase
    const teamNamesMap = new Map<string, string>();
    const teamSeasonPromises = uniqueTeamIds.map(async (teamId) => {
      try {
        const teamSeasonId = `${teamId}_${round.season_id}`;
        const doc = await adminDb.collection('team_seasons').doc(teamSeasonId).get();
        if (doc.exists) {
          return { teamId, name: doc.data()?.team_name || teamId };
        }
        const userDoc = await adminDb.collection('users').doc(teamId).get();
        return { teamId, name: userDoc.exists ? userDoc.data()?.teamName || teamId : teamId };
      } catch (error) {
        return { teamId, name: teamId };
      }
    });
    
    const teamNames = await Promise.all(teamSeasonPromises);
    teamNames.forEach(({ teamId, name }) => teamNamesMap.set(teamId, name));
    
    // STEP 3: Get won bid purchase prices (batch query)
    const wonBidPlayerIds = bidsRaw.filter((b: any) => b.status === 'won').map((b: any) => b.player_id);
    const purchasePrices = new Map<string, number>();
    
    if (wonBidPlayerIds.length > 0) {
      const teamPlayersResult = await sql`
        SELECT tp.player_id, tp.team_id, tp.purchase_price
        FROM team_players tp
        WHERE tp.player_id = ANY(${wonBidPlayerIds})
        ORDER BY tp.acquired_at DESC
      `;
      
      teamPlayersResult.forEach((tp: any) => {
        const key = `${tp.player_id}_${tp.team_id}`;
        if (!purchasePrices.has(key)) {
          purchasePrices.set(key, tp.purchase_price);
        }
      });
    }
    
    // STEP 4: Process all bids (now with pre-fetched data)
    const bids = [];
    for (const bid of bidsRaw) {
      try {
        const { amount } = decryptBidData(bid.encrypted_bid_data);
        
        let finalAmount = amount;
        if (bid.status === 'won') {
          const priceKey = `${bid.player_id}_${bid.team_id}`;
          finalAmount = purchasePrices.get(priceKey) || amount;
        }
        
        bids.push({
          ...bid,
          amount: finalAmount,
          team_name: teamNamesMap.get(bid.team_id) || bid.team_id,
        });
      } catch (error) {
        console.error(`Error processing bid ${bid.id}:`, error);
      }
    }

    // Calculate bid statistics grouped by player
    const bidStats = await sql`
      SELECT 
        b.player_id,
        p.name as player_name,
        p.position,
        COUNT(*) as bid_count,
        MAX(b.amount) as highest_bid,
        MIN(b.amount) as lowest_bid,
        COUNT(DISTINCT b.team_id) as teams_count
      FROM bids b
      LEFT JOIN footballplayers p ON b.player_id = p.id
      WHERE b.round_id = ${roundId}
      GROUP BY b.player_id, p.name, p.position
      ORDER BY highest_bid DESC;
    `;

    return NextResponse.json({
      success: true,
      data: {
        ...round,
        bids,
        bidStats,
      },
    });
  } catch (error: any) {
    console.error('Error fetching round:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// PATCH - Update round
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const roundId = id; // Round ID is a UUID string, not an integer
    const body = await request.json();

    const {
      status,
      start_time,
      end_time,
      base_price,
      duration_seconds,
      position,
      position_group,
    } = body;

    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
    }
    if (start_time !== undefined) {
      updates.push(`start_time = $${paramCount++}`);
      values.push(start_time);
    }
    if (end_time !== undefined) {
      updates.push(`end_time = $${paramCount++}`);
      values.push(end_time);
    }
    if (base_price !== undefined) {
      updates.push(`base_price = $${paramCount++}`);
      values.push(base_price);
    }
    if (duration_seconds !== undefined) {
      updates.push(`duration_seconds = $${paramCount++}`);
      values.push(duration_seconds);
    }
    if (position !== undefined) {
      updates.push(`position = $${paramCount++}`);
      values.push(position);
    }
    if (position_group !== undefined) {
      updates.push(`position_group = $${paramCount++}`);
      values.push(position_group);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      );
    }

    // Execute update using conditional queries
    let updatedRound;
    
    // Build update based on provided fields
    if (status !== undefined && start_time === undefined && end_time === undefined && 
        base_price === undefined && duration_seconds === undefined && 
        position === undefined && position_group === undefined) {
      updatedRound = await sql`
        UPDATE rounds 
        SET status = ${status}, updated_at = NOW()
        WHERE id = ${roundId}
        RETURNING *
      `;
    } else if (end_time !== undefined) {
      // Common case: updating end_time
      updatedRound = await sql`
        UPDATE rounds 
        SET end_time = ${end_time}, updated_at = NOW()
        WHERE id = ${roundId}
        RETURNING *
      `;
    } else {
      // For complex updates, use individual updates
      if (status !== undefined) {
        await sql`UPDATE rounds SET status = ${status} WHERE id = ${roundId}`;
      }
      if (start_time !== undefined) {
        await sql`UPDATE rounds SET start_time = ${start_time} WHERE id = ${roundId}`;
      }
      if (base_price !== undefined) {
        await sql`UPDATE rounds SET base_price = ${base_price} WHERE id = ${roundId}`;
      }
      if (duration_seconds !== undefined) {
        await sql`UPDATE rounds SET duration_seconds = ${duration_seconds} WHERE id = ${roundId}`;
      }
      if (position !== undefined) {
        await sql`UPDATE rounds SET position = ${position} WHERE id = ${roundId}`;
      }
      if (position_group !== undefined) {
        await sql`UPDATE rounds SET position_group = ${position_group} WHERE id = ${roundId}`;
      }
      
      await sql`UPDATE rounds SET updated_at = NOW() WHERE id = ${roundId}`;
      updatedRound = await sql`SELECT * FROM rounds WHERE id = ${roundId}`;
    }

    if (updatedRound.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Round not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedRound[0],
      message: 'Round updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating round:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// DELETE round
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const roundId = id; // Round ID is a UUID string, not an integer

    // Check if round exists and can be deleted
    const rounds = await sql`
      SELECT status FROM rounds WHERE id = ${roundId} LIMIT 1;
    `;

    if (rounds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Round not found' },
        { status: 404 }
      );
    }

    // Don't allow deleting active or completed rounds
    if (rounds[0].status === 'active' || rounds[0].status === 'completed') {
      return NextResponse.json(
        { success: false, error: 'Cannot delete active or completed rounds' },
        { status: 400 }
      );
    }

    // Delete the round (cascade will delete related players and bids)
    await sql`DELETE FROM rounds WHERE id = ${roundId};`;

    return NextResponse.json({
      success: true,
      message: 'Round deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting round:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
