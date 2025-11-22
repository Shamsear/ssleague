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
      
      try {
        // Fetch all auction-eligible players from footballplayers table
        const eligiblePlayers = await sql`
          SELECT id, name, position, position_group
          FROM footballplayers
          WHERE is_auction_eligible = true
          AND is_sold = false
          ORDER BY position, name
        `;

        console.log(`📊 Found ${eligiblePlayers.length} auction-eligible players`);

        // Handle edge case: no eligible players found
        if (eligiblePlayers.length === 0) {
          console.warn(`⚠️ No eligible players found for season ${season_id}`);
          return NextResponse.json({
            success: true,
            data: round,
            message: 'Bulk round created successfully. 0 players added (no eligible players found)',
            player_count: 0,
          }, { status: 201 });
        }

        // Check for existing players in this round to prevent duplicates
        const existingPlayers = await sql`
          SELECT player_id
          FROM round_players
          WHERE round_id = ${round.id}
        `;

        const existingPlayerIds = new Set(existingPlayers.map((p: any) => p.player_id));
        
        if (existingPlayerIds.size > 0) {
          console.log(`🔍 Found ${existingPlayerIds.size} existing players in round ${round.id}`);
        }

        // Track successful, failed, and skipped insertions
        let successCount = 0;
        let failureCount = 0;
        let skippedCount = 0;
        const failedPlayers: string[] = [];
        const skippedPlayers: string[] = [];

        // Insert all eligible players into round_players with error handling and duplicate prevention
        for (const player of eligiblePlayers) {
          // Skip if player already exists in this round
          if (existingPlayerIds.has(player.id)) {
            skippedCount++;
            skippedPlayers.push(player.name);
            console.log(`⏭️ Skipping duplicate player ${player.id} (${player.name}) - already in round`);
            continue;
          }

          try {
            await sql`
              INSERT INTO round_players (
                round_id, player_id, player_name, position, position_group, base_price, status, season_id
              )
              VALUES (
                ${round.id}, ${player.id}, ${player.name}, ${player.position}, 
                ${player.position_group}, ${base_price}, 'pending', ${season_id}
              );
            `;
            successCount++;
          } catch (playerError: any) {
            failureCount++;
            failedPlayers.push(player.name);
            console.error(`❌ Failed to insert player ${player.id} (${player.name}):`, playerError.message);
          }
        }

        // Log final results
        if (skippedCount > 0) {
          console.log(`⏭️ Skipped ${skippedCount} duplicate players: ${skippedPlayers.join(', ')}`);
        }
        
        if (failureCount > 0) {
          console.warn(`⚠️ Added ${successCount} players to bulk round ${round.round_number}, ${failureCount} failed, ${skippedCount} skipped`);
          console.warn(`Failed players: ${failedPlayers.join(', ')}`);
        } else {
          console.log(`✅ Successfully added ${successCount} players to bulk round ${round.round_number}${skippedCount > 0 ? ` (${skippedCount} duplicates skipped)` : ''}`);
        }

        return NextResponse.json({
          success: true,
          data: round,
          message: `Bulk round created successfully. ${successCount} player${successCount !== 1 ? 's' : ''} added to the round${skippedCount > 0 ? ` (${skippedCount} duplicate${skippedCount !== 1 ? 's' : ''} skipped)` : ''}${failureCount > 0 ? ` (${failureCount} failed)` : ''}`,
          player_count: successCount,
          failed_count: failureCount,
          skipped_count: skippedCount,
        }, { status: 201 });

      } catch (bulkError: any) {
        // Critical error during bulk player population
        console.error(`❌ Critical error during bulk player population for round ${round.id}:`, bulkError);
        
        // Attempt to clean up the round since player population failed
        try {
          await sql`DELETE FROM rounds WHERE id = ${round.id}`;
          console.log(`🧹 Rolled back round ${round.id} due to critical error`);
        } catch (cleanupError: any) {
          console.error(`❌ Failed to rollback round ${round.id}:`, cleanupError.message);
        }

        return NextResponse.json(
          { 
            success: false, 
            error: 'Failed to populate bulk round with players',
            details: bulkError.message 
          },
          { status: 500 }
        );
      }
    }
    // For NORMAL rounds, add manually selected players if provided
    else if (player_ids.length > 0) {
      // Fetch player details
      const players = await sql`
        SELECT id, name, position, position_group
        FROM footballplayers
        WHERE id = ANY(${player_ids});
      `;

      // Insert players into round_players with season_id
      for (const player of players) {
        await sql`
          INSERT INTO round_players (
            round_id, player_id, player_name, position, position_group, base_price, status, season_id
          )
          VALUES (
            ${round.id}, ${player.id}, ${player.name}, ${player.position}, 
            ${player.position_group}, ${base_price}, 'pending', ${season_id}
          );
        `;
      }

      return NextResponse.json({
        success: true,
        data: round,
        message: `Round created successfully. ${players.length} player${players.length !== 1 ? 's' : ''} added to the round`,
        player_count: players.length,
      }, { status: 201 });
    }

    // Return for normal rounds with no players
    return NextResponse.json({
      success: true,
      data: round,
      message: 'Round created successfully. 0 players added to the round',
      player_count: 0,
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error creating round:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
