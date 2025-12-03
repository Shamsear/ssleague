import { NextRequest, NextResponse } from 'next/server';
import { getAuctionDb } from '@/lib/neon/auction-config';
import { adminDb } from '@/lib/firebase/admin';
import admin from 'firebase-admin';

/**
 * POST /api/players/simple-swap
 * Simple swap for football players - just exchange team_ids
 * 
 * Swap Fees:
 * - Swaps 1-3: FREE
 * - Swap 4: 100 fee (per team)
 * - Swap 5: 125 fee (per team)
 * 
 * Body:
 * {
 *   player_a_id: string,
 *   player_b_id: string,
 *   season_id: string,
 *   swapped_by: string,
 *   swapped_by_name: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      player_a_id,
      player_b_id,
      season_id,
      swapped_by,
      swapped_by_name
    } = body;

    // Validate required fields
    if (!player_a_id || !player_b_id || !season_id || !swapped_by || !swapped_by_name) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields',
          errorCode: 'MISSING_FIELDS'
        },
        { status: 400 }
      );
    }

    const sql = getAuctionDb();

    // Fetch both players with their positions
    const playersQuery = `
      SELECT 
        id,
        player_id,
        name as player_name,
        team_id,
        overall_rating,
        position,
        position_group
      FROM footballplayers
      WHERE player_id IN ($1, $2) AND season_id = $3
    `;
    
    const players = await sql.query(playersQuery, [player_a_id, player_b_id, season_id]);

    if (players.length !== 2) {
      return NextResponse.json(
        {
          success: false,
          error: 'One or both players not found',
          errorCode: 'PLAYER_NOT_FOUND'
        },
        { status: 404 }
      );
    }

    const playerA = players.find((p: any) => p.player_id === player_a_id);
    const playerB = players.find((p: any) => p.player_id === player_b_id);

    if (!playerA || !playerB) {
      return NextResponse.json(
        {
          success: false,
          error: 'Player data mismatch',
          errorCode: 'PLAYER_NOT_FOUND'
        },
        { status: 404 }
      );
    }

    // Validate different teams
    if (playerA.team_id === playerB.team_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot swap players from the same team',
          errorCode: 'SAME_TEAM'
        },
        { status: 400 }
      );
    }

    // Get swap counts for both teams
    const teamASeasonId = `${playerA.team_id}_${season_id}`;
    const teamBSeasonId = `${playerB.team_id}_${season_id}`;

    const [teamADoc, teamBDoc] = await Promise.all([
      adminDb.collection('team_seasons').doc(teamASeasonId).get(),
      adminDb.collection('team_seasons').doc(teamBSeasonId).get()
    ]);

    if (!teamADoc.exists || !teamBDoc.exists) {
      return NextResponse.json(
        {
          success: false,
          error: 'Team season data not found',
          errorCode: 'TEAM_NOT_FOUND'
        },
        { status: 404 }
      );
    }

    const teamAData = teamADoc.data();
    const teamBData = teamBDoc.data();

    const teamASwapCount = (teamAData?.football_swap_count || 0) + 1; // Next swap number
    const teamBSwapCount = (teamBData?.football_swap_count || 0) + 1; // Next swap number

    // Calculate fees based on swap count
    const calculateFee = (swapNumber: number): number => {
      if (swapNumber <= 3) return 0;      // First 3 swaps are free
      if (swapNumber === 4) return 100;   // 4th swap costs 100
      if (swapNumber === 5) return 125;   // 5th swap costs 125
      return 150; // 6th+ swaps cost 150 (or reject if you want max 5)
    };

    const teamAFee = calculateFee(teamASwapCount);
    const teamBFee = calculateFee(teamBSwapCount);

    // Check if teams have sufficient football budget
    const teamABudget = teamAData?.football_budget || 0;
    const teamBBudget = teamBData?.football_budget || 0;

    if (teamABudget < teamAFee) {
      return NextResponse.json(
        {
          success: false,
          error: `Team A has insufficient football budget. Required: ${teamAFee}, Available: ${teamABudget}`,
          errorCode: 'INSUFFICIENT_FUNDS'
        },
        { status: 400 }
      );
    }

    if (teamBBudget < teamBFee) {
      return NextResponse.json(
        {
          success: false,
          error: `Team B has insufficient football budget. Required: ${teamBFee}, Available: ${teamBBudget}`,
          errorCode: 'INSUFFICIENT_FUNDS'
        },
        { status: 400 }
      );
    }

    // Perform swap with fees
    await sql.query('BEGIN');

    try {
      // Update Player A to Player B's team in footballplayers
      await sql.query(
        `UPDATE footballplayers 
         SET team_id = $1, updated_at = NOW() 
         WHERE player_id = $2 AND season_id = $3`,
        [playerB.team_id, player_a_id, season_id]
      );

      // Update Player B to Player A's team in footballplayers
      await sql.query(
        `UPDATE footballplayers 
         SET team_id = $1, updated_at = NOW() 
         WHERE player_id = $2 AND season_id = $3`,
        [playerA.team_id, player_b_id, season_id]
      );

      // Update team_players table (uses footballplayers.id, not player_id)
      // Update Player A's team in team_players (if exists)
      const updatePlayerAResult = await sql.query(
        `UPDATE team_players 
         SET team_id = $1, updated_at = NOW() 
         WHERE player_id = $2 AND season_id = $3
         RETURNING id`,
        [playerB.team_id, playerA.id, season_id]
      );
      
      console.log(`Updated Player A in team_players: ${updatePlayerAResult.length} rows affected`);

      // Update Player B's team in team_players (if exists)
      const updatePlayerBResult = await sql.query(
        `UPDATE team_players 
         SET team_id = $1, updated_at = NOW() 
         WHERE player_id = $2 AND season_id = $3
         RETURNING id`,
        [playerA.team_id, playerB.id, season_id]
      );
      
      console.log(`Updated Player B in team_players: ${updatePlayerBResult.length} rows affected`);

      await sql.query('COMMIT');

      // Update team budgets, swap counts, and position counts in Firestore
      const batch = adminDb.batch();

      // Prepare position count updates
      const playerAPosition = playerA.position_group || playerA.position || 'Unknown';
      const playerBPosition = playerB.position_group || playerB.position || 'Unknown';

      // Team A loses Player A's position, gains Player B's position
      const teamAUpdates: any = {
        football_budget: admin.firestore.FieldValue.increment(-teamAFee),
        football_swap_count: admin.firestore.FieldValue.increment(1),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      };

      // Update position counts for Team A
      if (playerAPosition !== 'Unknown') {
        teamAUpdates[`position_counts.${playerAPosition}`] = admin.firestore.FieldValue.increment(-1);
      }
      if (playerBPosition !== 'Unknown') {
        teamAUpdates[`position_counts.${playerBPosition}`] = admin.firestore.FieldValue.increment(1);
      }

      // Team B loses Player B's position, gains Player A's position
      const teamBUpdates: any = {
        football_budget: admin.firestore.FieldValue.increment(-teamBFee),
        football_swap_count: admin.firestore.FieldValue.increment(1),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      };

      // Update position counts for Team B
      if (playerBPosition !== 'Unknown') {
        teamBUpdates[`position_counts.${playerBPosition}`] = admin.firestore.FieldValue.increment(-1);
      }
      if (playerAPosition !== 'Unknown') {
        teamBUpdates[`position_counts.${playerAPosition}`] = admin.firestore.FieldValue.increment(1);
      }

      batch.update(adminDb.collection('team_seasons').doc(teamASeasonId), teamAUpdates);
      batch.update(adminDb.collection('team_seasons').doc(teamBSeasonId), teamBUpdates);

      await batch.commit();

      // Log transactions for both teams
      const transactionsRef = adminDb.collection('transactions');
      
      // Transaction for Team A
      if (teamAFee > 0) {
        await transactionsRef.add({
          team_id: playerA.team_id,
          season_id: season_id,
          transaction_type: 'football_swap_fee',
          amount: -teamAFee,
          balance_before: teamABudget,
          balance_after: teamABudget - teamAFee,
          description: `Football player swap fee (Swap #${teamASwapCount}): ${playerA.player_name} ↔ ${playerB.player_name}`,
          player_id: player_b_id,
          player_name: playerB.player_name,
          related_team_id: playerB.team_id,
          created_at: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      // Transaction for Team B
      if (teamBFee > 0) {
        await transactionsRef.add({
          team_id: playerB.team_id,
          season_id: season_id,
          transaction_type: 'football_swap_fee',
          amount: -teamBFee,
          balance_before: teamBBudget,
          balance_after: teamBBudget - teamBFee,
          description: `Football player swap fee (Swap #${teamBSwapCount}): ${playerB.player_name} ↔ ${playerA.player_name}`,
          player_id: player_a_id,
          player_name: playerA.player_name,
          related_team_id: playerA.team_id,
          created_at: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      return NextResponse.json({
        success: true,
        message: `${playerA.player_name} and ${playerB.player_name} swapped successfully`,
        data: {
          player_a: {
            name: playerA.player_name,
            old_team: playerA.team_id,
            new_team: playerB.team_id
          },
          player_b: {
            name: playerB.player_name,
            old_team: playerB.team_id,
            new_team: playerA.team_id
          },
          fees: {
            team_a_fee: teamAFee,
            team_b_fee: teamBFee,
            team_a_swap_number: teamASwapCount,
            team_b_swap_number: teamBSwapCount
          }
        }
      });

    } catch (error) {
      await sql.query('ROLLBACK');
      throw error;
    }

  } catch (error: any) {
    console.error('Error in simple-swap API:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to swap players',
        errorCode: 'SYSTEM_ERROR'
      },
      { status: 500 }
    );
  }
}
