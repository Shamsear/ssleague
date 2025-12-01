import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { verifyAuth } from '@/lib/auth-helper';
import { validateAuctionSettings } from '@/lib/auction-settings';
import { generateBulkRoundId } from '@/lib/id-generator';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

/**
 * POST /api/admin/bulk-rounds
 * Create a new bulk bidding round and auto-add ALL eligible players
 * Committee admin only
 */
export async function POST(request: NextRequest) {
  try {
    // ✅ ZERO FIREBASE READS - Uses JWT claims only
    const auth = await verifyAuth(['admin', 'committee_admin'], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get request body
    const { auction_settings_id, base_price = 10, duration_hours = 0, duration_minutes = 5, duration_seconds = 0 } = await request.json();

    if (!auction_settings_id) {
      return NextResponse.json(
        { success: false, error: 'auction_settings_id is required' },
        { status: 400 }
      );
    }

    // Convert duration to total seconds
    const totalDurationSeconds = (duration_hours * 3600) + (duration_minutes * 60) + duration_seconds;

    // Validate that auction settings exist and get season_id from it
    const settingsResult = await sql`
      SELECT season_id, auction_window 
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
    const season_id = auctionSettings.season_id;

    console.log('🔄 Creating bulk round:', { auction_settings_id, season_id, base_price, duration_hours, duration_minutes, duration_seconds, totalDurationSeconds });
    console.log('✅ Auction settings validated for season:', season_id);

    // Get next round number for this season (includes ALL round types)
    const existingRounds = await sql`
      SELECT MAX(round_number) as max_round
      FROM rounds
      WHERE season_id = ${season_id}
    `;
    
    const nextRoundNumber = (existingRounds[0]?.max_round || 0) + 1;

    // Generate readable ID for bulk round
    const roundId = await generateBulkRoundId();
    console.log(`📝 Generated bulk round ID: ${roundId}`);

    // Create the bulk round with readable ID
    const roundResult = await sql`
    INSERT INTO rounds (
        id,
        season_id,
        auction_settings_id,
        round_number,
        round_type,
        base_price,
        status,
        duration_seconds,
        created_at
      ) VALUES (
        ${roundId},
        ${season_id},
        ${auction_settings_id},
        ${nextRoundNumber},
        'bulk',
        ${base_price},
        'draft',
        ${totalDurationSeconds},
        NOW()
      )
      RETURNING id, round_number
    `;

    const createdRoundId = roundResult[0].id;
    const roundNumber = roundResult[0].round_number;

    console.log(`✅ Created bulk round ${roundNumber} with ID: ${createdRoundId}`);

    // Get ALL eligible players (not sold, auction eligible)
    console.time('⚡ Fetch eligible players');
    const eligiblePlayers = await sql`
      SELECT 
        id as player_id,
        name,
        position,
        position_group,
        overall_rating
      FROM footballplayers
      WHERE (season_id = ${season_id} OR season_id IS NULL)
      AND is_auction_eligible = true
      AND is_sold = false
      ORDER BY overall_rating DESC, name ASC
    `;
    console.timeEnd('⚡ Fetch eligible players');

    console.log(`📊 Found ${eligiblePlayers.length} eligible players`);

    if (eligiblePlayers.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'No eligible players found for this season. Make sure players are added and marked as auction eligible.' 
        },
        { status: 400 }
      );
    }

    // Insert all players into round_players table
    console.time('⚡ Insert players into round');
    
    try {
      // Build bulk insert values
      const playerValues = eligiblePlayers.map((player: any) => 
        `('${createdRoundId}', '${season_id}', '${player.player_id}', '${player.name.replace(/'/g, "''")}', '${player.position || ''}', '${player.position_group || ''}', ${base_price}, 'pending')`
      ).join(',');

      console.log(`📝 Inserting ${eligiblePlayers.length} players using individual inserts...`);
      
      // Insert players one by one using proper parameterized queries
      // This is slower but guaranteed to work
      let successCount = 0;
      let failCount = 0;
      
      for (const player of eligiblePlayers) {
        try {
          await sql`
            INSERT INTO round_players (
              round_id,
              season_id,
              player_id, 
              player_name, 
              position, 
              position_group, 
              base_price, 
              status
            ) VALUES (
              ${createdRoundId},
              ${season_id},
              ${player.player_id},
              ${player.name},
              ${player.position || ''},
              ${player.position_group || ''},
              ${base_price},
              'pending'
            )
          `;
          successCount++;
          
          // Log progress every 500 players
          if (successCount % 500 === 0) {
            console.log(`  ✅ Inserted ${successCount} players...`);
          }
        } catch (err) {
          failCount++;
          if (failCount <= 5) {
            console.error(`  ❌ Failed to insert player ${player.player_id}: ${err}`);
          }
        }
      }
      
      console.log(`✅ Insert complete: ${successCount} succeeded, ${failCount} failed`);
      
      console.timeEnd('⚡ Insert players into round');

      // Verify the insert worked
      const verifyCount = await sql`
        SELECT COUNT(*) as count FROM round_players WHERE round_id = ${createdRoundId}
      `;
      const actualCount = parseInt(verifyCount[0]?.count || '0');
      console.log(`✅ Verified: ${actualCount} players added to bulk round ${roundNumber}`);

      if (actualCount === 0) {
        console.error('❌ WARNING: No players were actually inserted!');
        return NextResponse.json(
          { 
            success: false, 
            error: 'Failed to insert players into round_players table' 
          },
          { status: 500 }
        );
      }
    } catch (insertError) {
      console.error('❌ Error inserting players:', insertError);
      throw insertError;
    }

    // Return success
    return NextResponse.json({
      success: true,
      data: {
        round_id: createdRoundId,
        round_number: roundNumber,
        season_id,
        base_price,
        duration_hours,
        duration_minutes,
        duration_seconds,
        total_duration_seconds: totalDurationSeconds,
        player_count: eligiblePlayers.length,
        status: 'draft',
        message: `Bulk round ${roundNumber} created successfully with ${eligiblePlayers.length} players`,
      },
    });

  } catch (error: any) {
    console.error('❌ Error creating bulk round:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/bulk-rounds
 * List all bulk rounds for a season
 * Committee admin only
 */
export async function GET(request: NextRequest) {
  try {
    // ✅ ZERO FIREBASE READS - Uses JWT claims only
    const auth = await verifyAuth(['admin', 'committee_admin'], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get query params
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('season_id');
    const status = searchParams.get('status');

    if (!seasonId) {
      return NextResponse.json(
        { success: false, error: 'season_id is required' },
        { status: 400 }
      );
    }

    // Build query
    let query = sql`
      SELECT 
        ar.id,
        ar.season_id,
        ar.round_number,
        ar.status,
        ar.base_price,
        ar.duration_seconds,
        ar.start_time,
        ar.end_time,
        ar.created_at,
        COUNT(rp.id) as player_count,
        COUNT(rp.id) FILTER (WHERE rp.status = 'sold') as sold_count
      FROM rounds r
      LEFT JOIN round_players rp ON ar.id = rp.round_id
      WHERE ar.season_id = ${seasonId}
      AND ar.round_type = 'bulk'
    `;

    // Add status filter if provided
    if (status && status !== 'all') {
      query = sql`${query} AND ar.status = ${status}`;
    }

    query = sql`
      ${query}
      GROUP BY ar.id
      ORDER BY ar.round_number DESC
    `;

    const rounds = await query;

    return NextResponse.json({
      success: true,
      data: rounds,
    });

  } catch (error: any) {
    console.error('❌ Error fetching bulk rounds:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
