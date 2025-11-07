import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { verifyAuth } from '@/lib/auth-helper';
import { adminDb } from '@/lib/firebase/admin';
import { getAuctionSettings } from '@/lib/auction-settings';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

/**
 * GET /api/team/bulk-rounds/:id
 * Get bulk round details with players for team bidding
 * Team users only
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ✅ ZERO FIREBASE READS - Uses JWT claims only
    const auth = await verifyAuth(['team'], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = auth.userId!;

    // Get user data from Firebase (still needed for team data)
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.exists ? userDoc.data() : null;

    const { id: roundId } = await params;
    
    console.log(`🔍 Fetching bulk round with ID: ${roundId} (type: ${typeof roundId})`);

    // Get round details
    const roundData = await sql`
      SELECT 
        id,
        round_number,
        status,
        base_price,
        start_time,
        end_time,
        duration_seconds,
        season_id,
        (SELECT COUNT(*) FROM round_players WHERE round_id = rounds.id) as player_count
      FROM rounds
      WHERE id = ${roundId}
      AND round_type = 'bulk'
    `;
    
    console.log(`📊 Query result: Found ${roundData.length} rounds`);
    if (roundData.length > 0) {
      console.log(`✅ Round found: ${roundData[0].id}, status: ${roundData[0].status}`);
    }

    if (roundData.length === 0) {
      console.error(`❌ Bulk round not found for ID: ${roundId}`);
      // Try to find any bulk rounds to help debug
      const allBulkRounds = await sql`
        SELECT id, round_number, status FROM rounds WHERE round_type = 'bulk' LIMIT 5
      `;
      console.log(`📊 Available bulk rounds:`, allBulkRounds);
      
      return NextResponse.json(
        { success: false, error: `Bulk round not found (ID: ${roundId})` },
        { status: 404 }
      );
    }

    const round = roundData[0];

    // If round is completed/finalized, return round data but no players
    // This allows the frontend to detect completion and redirect
    if (round.status === 'completed' || round.status === 'cancelled' || round.status === 'pending_tiebreakers') {
      console.log(`⚠️ Round is ${round.status} - returning minimal data for redirect`);
      return NextResponse.json({
        success: true,
        data: {
          round: {
            id: round.id,
            round_number: round.round_number,
            status: round.status,
            base_price: round.base_price,
            start_time: round.start_time,
            end_time: round.end_time,
            duration_seconds: round.duration_seconds,
            player_count: round.player_count,
          },
          players: [],
          balance: 0,
          squad: { current: 0, max: 25, available: 0 },
        },
      });
    }

    // Get all players in this round (only for active rounds)
    const players = await sql`
      SELECT 
        rp.player_id as id,
        rp.player_name as name,
        rp.position,
        fp.overall_rating,
        fp.club as team_name,
        rp.status,
        fp.playing_style
      FROM round_players rp
      LEFT JOIN footballplayers fp ON rp.player_id = fp.id
      WHERE rp.round_id = ${roundId}
      AND rp.status IN ('pending', 'available')
      ORDER BY fp.overall_rating DESC, rp.player_name ASC
    `;

    // Get team data from Neon (budget and squad info)
    let balance = 1000; // Default balance
    let currentSquadSize = 0;
    let maxSquadSize = 25; // Default
    let availableSlots = maxSquadSize;

    try {
      // Get auction settings
      const auctionSettings = await getAuctionSettings(round.season_id);
      maxSquadSize = auctionSettings.max_squad_size;

      // Get team's budget and squad count from Neon teams table
      const teamData = await sql`
        SELECT 
          football_budget,
          football_players_count
        FROM teams
        WHERE firebase_uid = ${userId}
        AND season_id = ${round.season_id}
        LIMIT 1
      `;

      console.log(`🔍 Team data query for user ${userId}, season ${round.season_id}:`, teamData);

      if (teamData.length > 0) {
        balance = parseInt(teamData[0].football_budget) || 1000;
        currentSquadSize = parseInt(teamData[0].football_players_count) || 0;
      } else {
        // Team doesn't exist in Neon yet - create it
        console.log(`⚠️ Team not found in Neon for user ${userId}, creating...`);
        
        // Get team data from Firebase
        const teamSeasonId = `${userId}_${round.season_id}`;
        const teamSeasonDoc = await adminDb.collection('team_seasons').doc(teamSeasonId).get();
        
        if (teamSeasonDoc.exists) {
          const teamSeasonData = teamSeasonDoc.data();
          const teamName = teamSeasonData?.team_name || userData.teamName || 'Team';
          const teamId = teamSeasonData?.team_id || userId;
          balance = teamSeasonData?.football_budget || 1000;
          
          try {
            await sql`
              INSERT INTO teams (
                id, 
                name, 
                firebase_uid, 
                season_id, 
                football_budget, 
                football_spent,
                football_players_count,
                created_at, 
                updated_at
              )
              VALUES (
                ${teamId}, 
                ${teamName}, 
                ${userId}, 
                ${round.season_id}, 
                ${balance}, 
                0,
                0,
                NOW(), 
                NOW()
              )
            `;
            console.log(`✅ Created team in Neon: ${teamId} (${teamName})`);
          } catch (insertError: any) {
            if (insertError.code === '23505') {
              // Duplicate - fetch it
              const retryData = await sql`
                SELECT football_budget, football_players_count
                FROM teams
                WHERE firebase_uid = ${userId}
                AND season_id = ${round.season_id}
                LIMIT 1
              `;
              if (retryData.length > 0) {
                balance = parseInt(retryData[0].football_budget) || 1000;
                currentSquadSize = parseInt(retryData[0].football_players_count) || 0;
              }
            } else {
              console.error('Error creating team:', insertError);
            }
          }
        }
      }

      availableSlots = maxSquadSize - currentSquadSize;
    } catch (error) {
      console.error('Error fetching team data:', error);
    }

    return NextResponse.json({
      success: true,
      data: {
        round: {
          id: round.id,
          round_number: round.round_number,
          status: round.status,
          base_price: round.base_price,
          start_time: round.start_time,
          end_time: round.end_time,
          duration_seconds: round.duration_seconds,
          player_count: parseInt(round.player_count),
        },
        players: players.map(p => ({
          id: p.id,
          name: p.name,
          position: p.position,
          overall_rating: p.overall_rating,
          team_name: p.team_name,
          playing_style: p.playing_style,
          status: p.status,
        })),
        balance,
        squad: {
          current: currentSquadSize,
          max: maxSquadSize,
          available: availableSlots,
        },
      },
    });

  } catch (error: any) {
    console.error('❌ Error fetching bulk round:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
