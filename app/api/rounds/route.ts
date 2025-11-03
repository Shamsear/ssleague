import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { generateRoundId, generateBulkRoundId } from '@/lib/id-generator';

const sql = neon(process.env.NEON_DATABASE_URL!);

// GET all rounds or filter by season
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const seasonId = searchParams.get('season_id');
    const status = searchParams.get('status');
    const roundType = searchParams.get('round_type');

    let rounds;
    
    if (seasonId && status && roundType) {
      rounds = await sql`
        SELECT 
          r.*,
          COUNT(DISTINCT rp.id) as player_count,
          COUNT(DISTINCT CASE WHEN rp.status = 'sold' THEN rp.id END) as sold_count
        FROM rounds r
        LEFT JOIN round_players rp ON r.id = rp.round_id
        WHERE r.season_id = ${seasonId} AND r.status = ${status} AND r.round_type = ${roundType}
        GROUP BY r.id
        ORDER BY r.round_number DESC;
      `;
    } else if (seasonId && roundType) {
      rounds = await sql`
        SELECT 
          r.*,
          COUNT(DISTINCT rp.id) as player_count,
          COUNT(DISTINCT CASE WHEN rp.status = 'sold' THEN rp.id END) as sold_count
        FROM rounds r
        LEFT JOIN round_players rp ON r.id = rp.round_id
        WHERE r.season_id = ${seasonId} AND r.round_type = ${roundType}
        GROUP BY r.id
        ORDER BY r.round_number DESC;
      `;
    } else if (seasonId && status) {
      rounds = await sql`
        SELECT 
          r.*,
          COUNT(DISTINCT rp.id) as player_count,
          COUNT(DISTINCT CASE WHEN rp.status = 'sold' THEN rp.id END) as sold_count
        FROM rounds r
        LEFT JOIN round_players rp ON r.id = rp.round_id
        WHERE r.season_id = ${seasonId} AND r.status = ${status}
        GROUP BY r.id
        ORDER BY r.round_number DESC;
      `;
    } else if (seasonId) {
      rounds = await sql`
        SELECT 
          r.*,
          COUNT(DISTINCT rp.id) as player_count,
          COUNT(DISTINCT CASE WHEN rp.status = 'sold' THEN rp.id END) as sold_count
        FROM rounds r
        LEFT JOIN round_players rp ON r.id = rp.round_id
        WHERE r.season_id = ${seasonId}
        GROUP BY r.id
        ORDER BY r.round_number DESC;
      `;
    } else {
      rounds = await sql`
        SELECT 
          r.*,
          COUNT(DISTINCT rp.id) as player_count,
          COUNT(DISTINCT CASE WHEN rp.status = 'sold' THEN rp.id END) as sold_count
        FROM rounds r
        LEFT JOIN round_players rp ON r.id = rp.round_id
        GROUP BY r.id
        ORDER BY r.created_at DESC;
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

// POST - Create new round
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      season_id,
      round_number,
      position,
      position_group,
      round_type = 'normal',
      base_price = 10,
      duration_hours = 0,
      duration_minutes = 5,
      duration_seconds = 0,
      start_time,
      player_ids = [],
    } = body;
    
    // Convert duration to total seconds
    const totalDurationSeconds = (duration_hours * 3600) + (duration_minutes * 60) + duration_seconds;

    // Validate required fields
    if (!season_id || !round_number) {
      return NextResponse.json(
        { success: false, error: 'season_id and round_number are required' },
        { status: 400 }
      );
    }

    // Check if round number already exists for this season
    const existingRound = await sql`
      SELECT id FROM rounds
      WHERE season_id = ${season_id} AND round_number = ${round_number}
      LIMIT 1;
    `;

    if (existingRound.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Round number already exists for this season' },
        { status: 400 }
      );
    }

    // Generate readable ID based on round type
    const roundId = round_type === 'bulk' 
      ? await generateBulkRoundId()
      : await generateRoundId();
    console.log(`📝 Generated ${round_type} round ID: ${roundId}`);

    // Create the round with readable ID
    const newRound = await sql`
      INSERT INTO rounds (
        id, season_id, round_number, position, position_group, 
        round_type, base_price, duration_seconds, start_time, status
      )
      VALUES (
        ${roundId}, ${season_id}, ${round_number}, ${position}, ${position_group},
        ${round_type}, ${base_price}, ${totalDurationSeconds}, ${start_time}, 'draft'
      )
      RETURNING *;
    `;

    const round = newRound[0];

    // For BULK rounds, automatically add ALL auction-eligible players
    if (round_type === 'bulk') {
      console.log('🔄 Bulk round created - adding all auction-eligible players...');
      
      // Fetch all auction-eligible players from footballplayers table
      const eligiblePlayers = await sql`
        SELECT id, name, position, position_group
        FROM footballplayers
        WHERE is_auction_eligible = true
        AND is_sold = false
        ORDER BY position, name
      `;

      console.log(`📊 Found ${eligiblePlayers.length} auction-eligible players`);

      // Insert all eligible players into round_players
      for (const player of eligiblePlayers) {
        await sql`
          INSERT INTO round_players (
            round_id, player_id, player_name, position, position_group, base_price, status
          )
          VALUES (
            ${round.id}, ${player.id}, ${player.name}, ${player.position}, 
            ${player.position_group}, ${base_price}, 'pending'
          );
        `;
      }

      console.log(`✅ Added ${eligiblePlayers.length} players to bulk round ${round.round_number}`);
    }
    // For NORMAL rounds, add manually selected players if provided
    else if (player_ids.length > 0) {
      // Fetch player details
      const players = await sql`
        SELECT id, name, position, position_group
        FROM footballplayers
        WHERE id = ANY(${player_ids});
      `;

      // Insert players into round_players
      for (const player of players) {
        await sql`
          INSERT INTO round_players (
            round_id, player_id, player_name, position, position_group, base_price, status
          )
          VALUES (
            ${round.id}, ${player.id}, ${player.name}, ${player.position}, 
            ${player.position_group}, ${base_price}, 'pending'
          );
        `;
      }
    }

    return NextResponse.json({
      success: true,
      data: round,
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
