import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { cookies } from 'next/headers';
import { adminAuth } from '@/lib/firebase/admin';
import { generateTiebreakerId } from '@/lib/id-generator';

import { broadcastRoundUpdate } from '@/lib/realtime/broadcast';
import { sendNotificationToSeason } from '@/lib/notifications/send-notification';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

/**
 * POST /api/admin/bulk-rounds/:id/create-tiebreaker
 * Manually create a tiebreaker for a contested player
 * Committee admin only
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify Firebase ID token
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (error) {
      console.error('Token verification error:', error);
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }

    const { id: roundId } = await params;
    const { player_id } = await request.json();

    if (!player_id) {
      return NextResponse.json(
        { success: false, error: 'player_id is required' },
        { status: 400 }
      );
    }

    console.log(`🎯 Creating tiebreaker for player ${player_id} in round ${roundId}`);

    // Get round details
    const roundResult = await sql`
      SELECT id, season_id, base_price, status
      FROM rounds
      WHERE id = ${roundId}
      AND round_type = 'bulk'
    `;

    if (roundResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Bulk round not found' },
        { status: 404 }
      );
    }

    const round = roundResult[0];

    // Get all bids for this player
    const bidsResult = await sql`
      SELECT 
        rb.team_id,
        rb.team_name,
        rb.id as bid_id
      FROM round_bids rb
      WHERE rb.round_id = ${roundId}
      AND rb.player_id = ${player_id}
      ORDER BY rb.bid_time ASC
    `;

    if (bidsResult.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Not enough bids to create tiebreaker (need at least 2)' },
        { status: 400 }
      );
    }

    // Check if tiebreaker already exists
    const existingTiebreaker = await sql`
      SELECT id FROM tiebreakers
      WHERE round_id = ${roundId}
      AND player_id = ${player_id}
      AND status IN ('active', 'pending')
    `;

    if (existingTiebreaker.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Tiebreaker already exists for this player' },
        { status: 400 }
      );
    }

    // Get player name
    const playerResult = await sql`
      SELECT player_name
      FROM round_players
      WHERE round_id = ${roundId}
      AND player_id = ${player_id}
    `;

    const playerName = playerResult[0]?.player_name || 'Unknown Player';

    // Generate tiebreaker ID
    const tiebreakerId = await generateTiebreakerId();

    // Prepare tied_teams JSONB array
    const tiedTeams = bidsResult.map(bid => ({
      team_id: bid.team_id,
      team_name: bid.team_name
    }));

    // Create tiebreaker (active status so teams can bid immediately)
    // Set 1 hour deadline (60 minutes) just like normal rounds
    await sql`
      INSERT INTO tiebreakers (
        id,
        round_id,
        player_id,
        player_name,
        original_amount,
        tied_teams,
        status,
        season_id,
        duration_minutes,
        created_at
      ) VALUES (
        ${tiebreakerId},
        ${roundId},
        ${player_id},
        ${playerName},
        ${round.base_price},
        ${JSON.stringify(tiedTeams)}::jsonb,
        'active',
        ${round.season_id},
        60,
        NOW()
      )
    `;

    // Create team_tiebreaker records for each team
    for (const bid of bidsResult) {
      const teamTiebreakerId = `${bid.team_id}_${tiebreakerId}`;
      
      await sql`
        INSERT INTO team_tiebreakers (
          id,
          tiebreaker_id,
          team_id,
          team_name,
          original_bid_id,
          submitted,
          new_bid_amount,
          created_at
        ) VALUES (
          ${teamTiebreakerId},
          ${tiebreakerId},
          ${bid.team_id},
          ${bid.team_name},
          ${bid.bid_id},
          false,
          NULL,
          NOW()
        )
        ON CONFLICT (id) DO NOTHING
      `;
    }

    // Update round_players status
    await sql`
      UPDATE round_players
      SET status = 'tiebreaker'
      WHERE round_id = ${roundId}
      AND player_id = ${player_id}
    `;

    // 🆕 CREATE BULK TIEBREAKER INFRASTRUCTURE
    // This enables the "Last Person Standing" auction system
    
    // Get player details for bulk tiebreaker
    const playerDetails = await sql`
      SELECT rp.player_name, fp.position, fp.team_name as player_team
      FROM round_players rp
      LEFT JOIN footballplayers fp ON rp.player_id = fp.id
      WHERE rp.round_id = ${roundId} AND rp.player_id = ${player_id}
    `;
    
    const playerInfo = playerDetails[0] || {};
    
    // Create bulk_tiebreakers record (new schema after cleanup)
    // Columns: id, bulk_round_id, season_id, player_id, player_name, player_position,
    //          status, current_highest_bid, current_highest_team_id,
    //          start_time, last_activity_time, max_end_time, teams_remaining,
    //          base_price, created_at, updated_at, resolved_at
    await sql`
      INSERT INTO bulk_tiebreakers (
        id,
        bulk_round_id,
        season_id,
        player_id,
        player_name,
        player_position,
        base_price,
        status,
        teams_remaining,
        start_time,
        max_end_time,
        created_at,
        updated_at
      ) VALUES (
        ${tiebreakerId},
        ${roundId},
        ${round.season_id},
        ${player_id},
        ${playerInfo.player_name || playerName},
        ${playerInfo.position || 'Unknown'},
        ${round.base_price},
        'active',
        ${tiedTeams.length},
        NOW(),
        NOW() + INTERVAL '24 hours',
        NOW(),
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        bulk_round_id = EXCLUDED.bulk_round_id,
        season_id = EXCLUDED.season_id,
        player_name = EXCLUDED.player_name,
        player_position = EXCLUDED.player_position,
        teams_remaining = EXCLUDED.teams_remaining,
        updated_at = NOW()
    `;
    
    // Create bulk_tiebreaker_teams records for participating teams
    for (const bid of bidsResult) {
      await sql`
        INSERT INTO bulk_tiebreaker_teams (
          tiebreaker_id,
          team_id,
          team_name,
          season_id,
          status,
          current_bid,
          joined_at
        ) VALUES (
          ${tiebreakerId},
          ${bid.team_id},
          ${bid.team_name},
          ${round.season_id},
          'active',
          ${round.base_price},
          NOW()
        )
        ON CONFLICT (tiebreaker_id, team_id) DO UPDATE SET
          team_name = EXCLUDED.team_name,
          season_id = EXCLUDED.season_id,
          status = 'active',
          current_bid = EXCLUDED.current_bid
      `;
    }

    console.log(`✅ Created tiebreaker ${tiebreakerId} for ${playerName} with ${bidsResult.length} teams`);
    console.log(`✅ Created bulk tiebreaker infrastructure for Last Person Standing auction`);

    // Broadcast tiebreaker creation via Firebase Realtime DB
    await broadcastRoundUpdate(round.season_id, roundId, {
      type: 'tiebreaker_created',
      tiebreaker_id: tiebreakerId,
      player_id,
      player_name: playerName,
      team_count: bidsResult.length,
    });

    // Send FCM notification to all teams in the season
    try {
      await sendNotificationToSeason(
        {
          title: '⚔️ Tiebreaker Created!',
          body: `${playerName} is now in a tiebreaker with ${bidsResult.length} teams competing. Submit your bid!`,
          url: `/tiebreakers/${tiebreakerId}`,
          icon: '/logo.png',
          data: {
            type: 'tiebreaker_created',
            tiebreaker_id: tiebreakerId,
            player_id,
            player_name: playerName,
            round_id: roundId,
            team_count: bidsResult.length.toString(),
          }
        },
        round.season_id
      );
    } catch (notifError) {
      console.error('Failed to send tiebreaker creation notification:', notifError);
      // Don't fail the request
    }

    return NextResponse.json({
      success: true,
      data: {
        tiebreaker_id: tiebreakerId,
        player_name: playerName,
        team_count: bidsResult.length,
        message: `Tiebreaker created for ${playerName}`,
      },
    });

  } catch (error: any) {
    console.error('❌ Error creating tiebreaker:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
