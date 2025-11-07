import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { verifyAuth } from '@/lib/auth-helper';
import { finalizeRound, applyFinalizationResults } from '@/lib/finalize-round';
import { generateRoundId } from '@/lib/id-generator';
import { validateAuctionSettings } from '@/lib/auction-settings';

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
              
              // Broadcast WebSocket event for round finalization
              if (typeof global.wsBroadcast === 'function') {
                global.wsBroadcast(`season:${seasonId}`, {
                  type: 'round_finalized',
                  data: { roundId: round.id, position: round.position }
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
      position,
      max_bids_per_team,
      duration_hours,
    } = body;

    // Validate required fields
    if (!season_id || !position || !max_bids_per_team || !duration_hours) {
      return NextResponse.json(
        { success: false, error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Validate that auction settings exist for this season
    const validation = await validateAuctionSettings(season_id);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: validation.status || 400 }
      );
    }

    // Check if there's already an active round for this season
    const activeRound = await sql`
      SELECT id FROM rounds
      WHERE season_id = ${season_id}
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
    
    // Create the round - timestamptz columns handle UTC automatically
    const newRound = await sql`
      INSERT INTO rounds (
        id,
        season_id,
        position,
        max_bids_per_team,
        end_time,
        status,
        created_at,
        updated_at
      ) VALUES (
        ${roundId!},
        ${season_id},
        ${position},
        ${max_bids_per_team},
        ${endTime.toISOString()},
        'active',
        ${now.toISOString()},
        ${now.toISOString()}
      )
      RETURNING *
    `;

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
