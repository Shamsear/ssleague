import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { verifyAuth } from '@/lib/auth-helper';
import { encryptBidData } from '@/lib/encryption';
import { broadcastRoundUpdate } from '@/lib/realtime/broadcast';
import { generateBidId, generateTeamId } from '@/lib/id-generator';
import { adminDb } from '@/lib/firebase/admin';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

export async function POST(request: NextRequest) {
  try {
    // Verify JWT token
    const auth = await verifyAuth(['team'], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = auth.userId!;

    const body = await request.json();
    const { player_id, round_id, amount } = body;
    
    // Get team ID for this user from database
    let teamIdResult = await sql`
      SELECT id FROM teams WHERE firebase_uid = ${userId} LIMIT 1
    `;
    
    let teamId: string | null = null;
    if (teamIdResult.length > 0) {
      teamId = teamIdResult[0].id;
    }
    // Note: Team will be created later if it doesn't exist, using team_id from Firebase

    // Validate input
    if (!player_id || !round_id || !amount) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (amount < 10) {
      return NextResponse.json(
        { success: false, error: 'Bid amount must be at least £10' },
        { status: 400 }
      );
    }

    // Get round details
    const roundResult = await sql`
      SELECT 
        r.id,
        r.position,
        r.max_bids_per_team,
        r.status,
        r.end_time,
        r.season_id
      FROM rounds r
      WHERE r.id = ${round_id}
    `;

    if (roundResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Round not found' },
        { status: 404 }
      );
    }

    const round = roundResult[0];

    // Get team's season data to check budget
    let teamSeasonId = `${teamId}_${round.season_id}`;
    let teamSeasonDoc = await adminDb.collection('team_seasons').doc(teamSeasonId).get();
    
    // Fallback: Query by user_id field if direct lookup fails
    if (!teamSeasonDoc.exists) {
      const teamSeasonQuery = await adminDb.collection('team_seasons')
        .where('user_id', '==', userId)
        .where('season_id', '==', round.season_id)
        .where('status', '==', 'registered')
        .limit(1)
        .get();
      
      if (teamSeasonQuery.empty) {
        return NextResponse.json(
          { success: false, error: 'Team not registered for this season' },
          { status: 404 }
        );
      }
      
      teamSeasonDoc = teamSeasonQuery.docs[0];
      teamSeasonId = teamSeasonDoc.id;
    }
    
    const teamSeasonData = teamSeasonDoc.data();
    
    // Determine currency system and get appropriate balance
    const currencySystem = teamSeasonData?.currency_system || 'single';
    const isDualCurrency = currencySystem === 'dual';
    
    let teamBalance = 0;
    if (isDualCurrency) {
      // For dual currency, use football_budget (since this is for football players)
      teamBalance = teamSeasonData?.football_budget || 0;
    } else {
      // For single currency, use budget
      teamBalance = teamSeasonData?.budget || 0;
    }

    // Check if team has sufficient balance
    if (amount > teamBalance) {
      return NextResponse.json(
        { success: false, error: 'Insufficient team balance' },
        { status: 400 }
      );
    }

    // Check if round is active
    if (round.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Round is not active' },
        { status: 400 }
      );
    }

    // Check if round has ended
    const now = new Date();
    const endTime = new Date(round.end_time);
    if (now > endTime) {
      return NextResponse.json(
        { success: false, error: 'Round has ended' },
        { status: 400 }
      );
    }

    // Verify player exists and is available for this position
    const playerResult = await sql`
      SELECT 
        id,
        name,
        position,
        is_auction_eligible,
        is_sold,
        team_id
      FROM footballplayers 
      WHERE id = ${player_id}
    `;

    if (playerResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Player not found' },
        { status: 404 }
      );
    }

    const player = playerResult[0];

    // Check if player is available for auction
    if (!player.is_auction_eligible) {
      return NextResponse.json(
        { success: false, error: 'Player is not eligible for auction' },
        { status: 400 }
      );
    }

    if (player.is_sold) {
      return NextResponse.json(
        { success: false, error: 'Player is already sold' },
        { status: 400 }
      );
    }

    if (player.team_id && player.team_id !== '') {
      return NextResponse.json(
        { success: false, error: 'Player is already assigned to a team' },
        { status: 400 }
      );
    }

    if (player.position !== round.position) {
      return NextResponse.json(
        { success: false, error: 'Player position does not match round position' },
        { status: 400 }
      );
    }

    // Check if team already has a bid for this player in this round
    const existingBidResult = await sql`
      SELECT id, encrypted_bid_data FROM bids 
      WHERE team_id = ${teamId}
      AND player_id = ${player_id}
      AND round_id = ${round_id}
      AND status = 'active'
    `;

    if (existingBidResult.length > 0) {
      // Bid already exists - check if it's the same amount (idempotent)
      const { decryptBidData } = await import('@/lib/encryption');
      try {
        const existingDecrypted = decryptBidData(existingBidResult[0].encrypted_bid_data);
        if (existingDecrypted.amount === amount) {
          // Same bid already exists - return success (idempotent)
          console.log(`✅ Idempotent bid request for player ${player_id} with amount ${amount}`);
          return NextResponse.json({
            success: true,
            message: 'Bid already placed',
            bid: {
              id: existingBidResult[0].id,
              team_id: teamId,
              round_id,
              status: 'active'
            },
          });
        }
      } catch (err) {
        console.error('Failed to decrypt existing bid:', err);
      }
      
      // Different amount - return error
      return NextResponse.json(
        { success: false, error: 'You already have a bid for this player in this round' },
        { status: 400 }
      );
    }

    // Check number of active bids for this round
    const bidCountResult = await sql`
      SELECT COUNT(*) as bid_count
      FROM bids 
      WHERE team_id = ${teamId}
      AND round_id = ${round_id}
      AND status = 'active'
    `;

    const bidCount = parseInt(bidCountResult[0]?.bid_count || '0');

    if (bidCount >= round.max_bids_per_team) {
      return NextResponse.json(
        { success: false, error: `Maximum number of bids (${round.max_bids_per_team}) reached for this round` },
        { status: 400 }
      );
    }

    // Encrypt sensitive bid data for blind bidding
    const encryptedBidData = encryptBidData({
      player_id: player_id,
      amount: amount
    });

    // Check for duplicate bid amounts in existing bids
    // Note: Frontend also validates this, but backend double-checks
    const existingBidsCheck = await sql`
      SELECT encrypted_bid_data FROM bids
      WHERE team_id = ${teamId}
      AND round_id = ${round_id}
      AND status = 'active'
    `;

    // Decrypt and check for duplicate amounts
    const { decryptBidData } = await import('@/lib/encryption');
    for (const existingBid of existingBidsCheck) {
      try {
        const decrypted = decryptBidData(existingBid.encrypted_bid_data);
        if (decrypted.amount === amount) {
          return NextResponse.json(
            { success: false, error: 'You already have a bid with this amount in this round. Each bid must have a unique amount.' },
            { status: 400 }
          );
        }
      } catch (err) {
        // Skip if decryption fails
        console.error('Failed to decrypt existing bid:', err);
      }
    }

    // Get team name and team_id from teamSeasonData
    const teamName = teamSeasonData?.team_name || teamSeasonData?.name || 'Team';
    
    // If team doesn't exist in Neon yet, get team_id from Firebase and create it
    if (!teamId) {
      teamId = teamSeasonData?.team_id;
      
      if (!teamId) {
        return NextResponse.json(
          { success: false, error: 'Team configuration error - no team_id in Firebase' },
          { status: 500 }
        );
      }
      
      // Get budget from Firebase to populate Neon
      const footballBudget = teamSeasonData?.football_budget || 0;
      const footballSpent = teamSeasonData?.football_spent || 0;
      
      await sql`
        INSERT INTO teams (id, name, firebase_uid, season_id, football_budget, football_spent, created_at, updated_at)
        VALUES (${teamId}, ${teamName}, ${userId}, ${round.season_id}, ${footballBudget}, ${footballSpent}, NOW(), NOW())
        ON CONFLICT (firebase_uid) DO NOTHING
      `;
      console.log(`✅ Created team: ${teamId} (${teamName}) with budget £${footballBudget}`);
    }
    
    // Generate unique bid ID: team_id + round_id + player_id
    const bidId = `${teamId}_${round_id}_${player_id}`;
    
    // Create the bid - amount stored ONLY in encrypted form for blind bidding
    // The amount column stays NULL until round finalization
    const bidResult = await sql`
      INSERT INTO bids (
        id,
        team_id,
        team_name,
        player_id,
        round_id,
        season_id,
        amount,
        encrypted_bid_data,
        status,
        created_at
      ) VALUES (
        ${bidId},
        ${teamId},
        ${teamName},
        ${player_id},
        ${round_id},
        ${round.season_id},
        NULL,
        ${encryptedBidData},
        'active',
        NOW()
      )
      RETURNING id, team_id, team_name, round_id, season_id, status, created_at
    `;

    const newBid = bidResult[0];

    // Broadcast bid submitted via Firebase Realtime DB
    await broadcastRoundUpdate(round.season_id, round_id, {
      type: 'bid_submitted',
      team_id: teamId,
      team_name: teamName,
      round_id,
      player_id,
    });

    return NextResponse.json({
      success: true,
      message: 'Bid placed successfully',
      bid: newBid,
    });
  } catch (error) {
    console.error('Error placing bid:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
