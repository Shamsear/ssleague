import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { verifyAuth } from '@/lib/auth-helper';
import { finalizeRound, applyFinalizationResults } from '@/lib/finalize-round';
import { generateRoundId } from '@/lib/id-generator';
import { validateAuctionSettings } from '@/lib/auction-settings';
import { broadcastRoundUpdate } from '@/lib/realtime/broadcast';
import { sendNotificationToSeason } from '@/lib/notifications/send-notification';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

/**
 * GET /api/admin/rounds
 * List all rounds for a season
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication and authorization
    const auth = await verifyAuth(['admin', 'committee_admin']);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const seasonId = searchParams.get('season_id');
    const status = searchParams.get('status');

    // Find expired active rounds and auto-finalize them
    const expiredRounds = await sql`
      SELECT id, position
      FROM rounds
      WHERE status = 'active'
      AND end_time < NOW()
    `;

    // Auto-finalize each expired round in the background
    if (expiredRounds.length > 0) {
      // Trigger finalization for each expired round (non-blocking)
      expiredRounds.forEach(async (round) => {
        try {
          console.log(`🔄 Auto-finalizing expired round: ${round.id} (${round.position})`);
          
          // Call finalization logic directly
          const finalizationResult = await finalizeRound(round.id);
          
          if (finalizationResult.success) {
            // Apply finalization results to database
            const applyResult = await applyFinalizationResults(
              round.id,
              finalizationResult.allocations
            );
            
            if (applyResult.success) {
              console.log(`✅ Auto-finalized expired round: ${round.id} (${round.position})`);
              
              // Broadcast via Firebase Realtime DB for round finalization
              if (seasonId) {
                const { broadcastRoundUpdate } = await import('@/lib/realtime/broadcast');
                await broadcastRoundUpdate(seasonId, round.id, {
                  status: 'completed',
                  finalized: true,
                });
              }
            } else {
              console.error(`❌ Failed to apply finalization results for round ${round.id}:`, applyResult.error);
            }
          } else if (finalizationResult.tieDetected) {
            console.log(`⚠️ Tie detected in round ${round.id}, tiebreaker created`);
            // Mark round as finalizing (already done in createTiebreaker)
          } else {
            console.error(`❌ Failed to finalize round ${round.id}:`, finalizationResult.error);
          }
        } catch (error) {
          console.error(`❌ Failed to auto-finalize round ${round.id}:`, error);
        }
      });
    }

    let rounds;

    if (seasonId && status) {
      rounds = await sql`
        SELECT 
          r.*,
          COUNT(DISTINCT b.id) as total_bids,
          COUNT(DISTINCT b.team_id) as teams_bid,
          CASE 
            WHEN r.round_type = 'bulk' THEN (SELECT COUNT(*) FROM round_players WHERE round_id = r.id)
            ELSE 0
          END as player_count
        FROM rounds r
        LEFT JOIN bids b ON r.id = b.round_id
        WHERE r.season_id = ${seasonId} AND r.status = ${status}
        GROUP BY r.id
        ORDER BY r.created_at DESC
      `;
    } else if (seasonId) {
      rounds = await sql`
        SELECT 
          r.*,
          COUNT(DISTINCT b.id) as total_bids,
          COUNT(DISTINCT b.team_id) as teams_bid,
          CASE 
            WHEN r.round_type = 'bulk' THEN (SELECT COUNT(*) FROM round_players WHERE round_id = r.id)
            ELSE 0
          END as player_count
        FROM rounds r
        LEFT JOIN bids b ON r.id = b.round_id
        WHERE r.season_id = ${seasonId}
        GROUP BY r.id
        ORDER BY r.created_at DESC
      `;
    } else {
      rounds = await sql`
        SELECT 
          r.*,
          COUNT(DISTINCT b.id) as total_bids,
          COUNT(DISTINCT b.team_id) as teams_bid,
          CASE 
            WHEN r.round_type = 'bulk' THEN (SELECT COUNT(*) FROM round_players WHERE round_id = r.id)
            ELSE 0
          END as player_count
        FROM rounds r
        LEFT JOIN bids b ON r.id = b.round_id
        GROUP BY r.id
        ORDER BY r.created_at DESC
      `;
    }

    return NextResponse.json({
      success: true,
      data: rounds,
    });
  } catch (error: any) {
    console.error('Error fetching rounds:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/rounds
 * Create a new round
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication and authorization
    const auth = await verifyAuth(['admin', 'committee_admin']);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    let body;
    try {
      const text = await request.text();
      if (!text || text.trim() === '') {
        return NextResponse.json(
          { success: false, error: 'Request body is empty' },
          { status: 400 }
        );
      }
      body = JSON.parse(text);
    } catch (parseError) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const {
      season_id,
      auction_settings_id,
      position,
      max_bids_per_team,
      duration_hours,
    } = body;

    // Validate required fields
    if (!auction_settings_id || !position || !max_bids_per_team || !duration_hours) {
      return NextResponse.json(
        { success: false, error: 'auction_settings_id, position, max_bids_per_team, and duration_hours are required' },
        { status: 400 }
      );
    }

    // Validate that auction settings exist and get season_id from it
    const settingsResult = await sql`
      SELECT season_id, auction_window, max_rounds 
      FROM auction_settings 
      WHERE id = ${auction_settings_id}
    `;
    
    if (settingsResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Auction settings not found' },
        { status: 404 }
      );
    }
    
    const auctionSettings = settingsResult[0];
    const seasonId = auctionSettings.season_id;

    // Check if there's already an active round for this season
    const activeRound = await sql`
      SELECT id FROM rounds
      WHERE season_id = ${seasonId}
      AND status = 'active'
      LIMIT 1
    `;

    if (activeRound.length > 0) {
      return NextResponse.json(
        { success: false, error: 'There is already an active round. Please complete it first.' },
        { status: 400 }
      );
    }

    // Generate readable round ID with retry logic
    let roundId: string;
    let attempts = 0;
    const maxAttempts = 5;
    
    while (attempts < maxAttempts) {
      roundId = await generateRoundId();
      
      // Check if this ID already exists
      const existing = await sql`SELECT id FROM rounds WHERE id = ${roundId} LIMIT 1`;
      
      if (existing.length === 0) {
        break; // ID is unique, proceed
      }
      
      attempts++;
      console.log(`⚠️ Round ID ${roundId} already exists, retrying... (attempt ${attempts}/${maxAttempts})`);
      
      if (attempts >= maxAttempts) {
        return NextResponse.json(
          { success: false, error: 'Failed to generate unique round ID after multiple attempts' },
          { status: 500 }
        );
      }
      
      // Wait a bit before retrying to avoid race conditions
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Calculate end time (always use UTC)
    const now = new Date();
    const endTime = new Date(now.getTime() + (parseFloat(duration_hours) * 3600 * 1000));
    
    // Calculate round_number (count existing rounds + 1)
    const roundCountResult = await sql`
      SELECT COUNT(*) as count FROM rounds WHERE season_id = ${seasonId}
    `;
    const roundNumber = parseInt(roundCountResult[0]?.count || '0') + 1;
    
    // Create the round - timestamptz columns handle UTC automatically
    const newRound = await sql`
      INSERT INTO rounds (
        id,
        season_id,
        auction_settings_id,
        position,
        max_bids_per_team,
        round_number,
        end_time,
        status,
        created_at,
        updated_at
      ) VALUES (
        ${roundId!},
        ${seasonId},
        ${auction_settings_id},
        ${position},
        ${max_bids_per_team},
        ${roundNumber},
        ${endTime.toISOString()},
        'active',
        ${now.toISOString()},
        ${now.toISOString()}
      )
      RETURNING *
    `;

    // Send FCM notification to all teams in season (before Firebase to avoid timeout)
    try {
      console.log(`📣 Sending round start notification for season ${seasonId}, round ${roundId}`);
      const notifResult = await sendNotificationToSeason(
        {
          title: `🎯 New ${auctionSettings.auction_window.replace('_', ' ').toUpperCase()} Round!`,
          body: `${position} bidding is now open. Duration: ${duration_hours} hour(s). Place your bids now!`,
          url: `/dashboard/team`,
          icon: '/logo.png',
          data: {
            type: 'round_started',
            roundId: roundId!,
            position: position,
            endTime: endTime.toISOString()
          }
        },
        seasonId
      );
      console.log(`✅ Round start notification result:`, notifResult);
    } catch (notifError) {
      console.error('Failed to send round start notification:', notifError);
      // Don't fail the request if notification fails
    }

    // Broadcast round started via Firebase Realtime DB (blocking to ensure it completes)
    try {
      await broadcastRoundUpdate(seasonId, roundId!, {
        type: 'round_started',
        status: 'active',
        round_id: roundId!,
        position,
        end_time: endTime.toISOString(),
      });
      console.log(`✅ Round started broadcast sent for round ${roundId}`);
    } catch (broadcastError) {
      console.error('❌ Firebase broadcast failed:', broadcastError);
      // Don't fail the request if broadcast fails
    }

    return NextResponse.json({
      success: true,
      data: newRound[0],
      message: 'Round created successfully',
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error creating round:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
