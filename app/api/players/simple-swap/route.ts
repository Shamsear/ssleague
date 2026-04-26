import { NextRequest, NextResponse } from 'next/server';
import { getAuctionDb } from '@/lib/neon/auction-config';
import { adminDb } from '@/lib/firebase/admin';
import admin from 'firebase-admin';
import { closePlayerHistory, createPlayerHistory, getTeamName } from '@/lib/player-history';

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

    console.log('🔍 Simple swap request:', { player_a_id, player_b_id, season_id });

    // Fetch both players with their positions
    // Note: footballplayers table doesn't always have season_id set for active players
    // We'll validate they're assigned to teams instead
    const playersQuery = `
      SELECT 
        id,
        player_id,
        name as player_name,
        team_id,
        overall_rating,
        position,
        position_group,
        acquisition_value,
        season_id,
        status,
        is_sold
      FROM footballplayers
      WHERE player_id IN ($1, $2)
    `;
    
    const players = await sql.query(playersQuery, [player_a_id, player_b_id]);

    console.log('📊 Players found:', players.length, players.map((p: any) => ({ 
      id: p.player_id, 
      name: p.player_name, 
      team: p.team_id, 
      season: p.season_id,
      status: p.status,
      is_sold: p.is_sold
    })));

    if (players.length !== 2) {
      return NextResponse.json(
        {
          success: false,
          error: `One or both players not found. Found ${players.length} player(s). Make sure both players exist in the database.`,
          errorCode: 'PLAYER_NOT_FOUND',
          debug: {
            player_a_id,
            player_b_id,
            season_id,
            found_count: players.length
          }
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

    // Validate players are assigned to teams (not free agents)
    if (!playerA.team_id || playerA.status === 'free_agent' || !playerA.is_sold) {
      return NextResponse.json(
        {
          success: false,
          error: `${playerA.player_name} is not assigned to a team (free agent or not sold)`,
          errorCode: 'PLAYER_NOT_ASSIGNED'
        },
        { status: 400 }
      );
    }

    if (!playerB.team_id || playerB.status === 'free_agent' || !playerB.is_sold) {
      return NextResponse.json(
        {
          success: false,
          error: `${playerB.player_name} is not assigned to a team (free agent or not sold)`,
          errorCode: 'PLAYER_NOT_ASSIGNED'
        },
        { status: 400 }
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
      if (swapNumber <= 6) return 0;      // First 6 swaps are free
      if (swapNumber === 7) return 100;   // 7th swap costs 100
      if (swapNumber === 8) return 125;   // 8th swap costs 125
      return 150; // 9th+ swaps cost 150
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
      // Update Player A to Player B's team AND swap acquisition_value
      await sql.query(
        `UPDATE footballplayers 
         SET team_id = $1, acquisition_value = $2, updated_at = NOW() 
         WHERE player_id = $3`,
        [playerB.team_id, playerB.acquisition_value, player_a_id]
      );

      // Update Player B to Player A's team AND swap acquisition_value
      await sql.query(
        `UPDATE footballplayers 
         SET team_id = $1, acquisition_value = $2, updated_at = NOW() 
         WHERE player_id = $3`,
        [playerA.team_id, playerA.acquisition_value, player_b_id]
      );

      // Update team_players table (uses footballplayers.id, not player_id)
      // Update Player A's team in team_players (if exists)
      const updatePlayerAResult = await sql.query(
        `UPDATE team_players 
         SET team_id = $1, updated_at = NOW() 
         WHERE player_id = $2
         RETURNING id`,
        [playerB.team_id, playerA.id]
      );
      
      console.log(`Updated Player A in team_players: ${updatePlayerAResult.length} rows affected`);

      // Update Player B's team in team_players (if exists)
      const updatePlayerBResult = await sql.query(
        `UPDATE team_players 
         SET team_id = $1, updated_at = NOW() 
         WHERE player_id = $2
         RETURNING id`,
        [playerA.team_id, playerB.id]
      );
      
      console.log(`Updated Player B in team_players: ${updatePlayerBResult.length} rows affected`);

      await sql.query('COMMIT');

      // Create transaction record in Firebase player_transactions
      const transactionRef = adminDb.collection('player_transactions').doc();
      const transactionId = transactionRef.id;
      
      await transactionRef.set({
        transaction_type: 'swap',
        player_a_id: playerA.player_id,
        player_a_name: playerA.player_name,
        player_b_id: playerB.player_id,
        player_b_name: playerB.player_name,
        player_type: 'football',
        team_a_id: playerA.team_id,
        team_b_id: playerB.team_id,
        season_id: season_id,
        fee_team_a: teamAFee,
        fee_team_b: teamBFee,
        processed_by: swapped_by,
        processed_by_name: swapped_by_name,
        created_at: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log('✅ Transaction record created:', transactionId);

      // Update player history
      try {
        // Get team names from Firebase
        const [teamADoc, teamBDoc] = await Promise.all([
          adminDb.collection('teams').doc(playerA.team_id).get(),
          adminDb.collection('teams').doc(playerB.team_id).get()
        ]);
        
        const teamAName = teamADoc.exists ? teamADoc.data()?.name : 'Unknown Team';
        const teamBName = teamBDoc.exists ? teamBDoc.data()?.name : 'Unknown Team';

        // Close old history records
        await closePlayerHistory(playerA.player_id, playerA.team_id, 'swap', season_id, transactionId);
        await closePlayerHistory(playerB.player_id, playerB.team_id, 'swap', season_id, transactionId);

        // Create new history records
        await createPlayerHistory({
          playerId: playerA.player_id,
          playerName: playerA.player_name,
          position: playerA.position,
          teamId: playerB.team_id,
          teamName: teamBName,
          seasonId: season_id,
          acquisitionType: 'swap',
          acquisitionValue: playerB.acquisition_value, // Gets Player B's value
          contractStartSeason: season_id,
          contractEndSeason: season_id,
          transactionId: transactionId
        });

        await createPlayerHistory({
          playerId: playerB.player_id,
          playerName: playerB.player_name,
          position: playerB.position,
          teamId: playerA.team_id,
          teamName: teamAName,
          seasonId: season_id,
          acquisitionType: 'swap',
          acquisitionValue: playerA.acquisition_value, // Gets Player A's value
          contractStartSeason: season_id,
          contractEndSeason: season_id,
          transactionId: transactionId
        });

        console.log('✅ Player history updated');
      } catch (historyError) {
        console.error('Error updating player history:', historyError);
        // Continue even if history update fails
      }

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
