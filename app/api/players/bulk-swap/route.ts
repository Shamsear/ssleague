import { NextRequest, NextResponse } from 'next/server';
import { getAuctionDb } from '@/lib/neon/auction-config';
import { adminDb } from '@/lib/firebase/admin';
import admin from 'firebase-admin';
import { closePlayerHistory, createPlayerHistory } from '@/lib/player-history';

/**
 * POST /api/players/bulk-swap
 * Bulk swap multiple football players across multiple teams
 * 
 * Each swap pair is independent and has its own fee calculation
 * 
 * Body:
 * {
 *   swaps: [
 *     {
 *       player_a_id: string,
 *       player_b_id: string
 *     },
 *     ...
 *   ],
 *   season_id: string,
 *   swapped_by: string,
 *   swapped_by_name: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      swaps,
      season_id,
      swapped_by,
      swapped_by_name
    } = body;

    // Validate required fields
    if (!swaps || !Array.isArray(swaps) || swaps.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing or invalid swaps array',
          errorCode: 'MISSING_FIELDS'
        },
        { status: 400 }
      );
    }

    if (!season_id || !swapped_by || !swapped_by_name) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: season_id, swapped_by, swapped_by_name',
          errorCode: 'MISSING_FIELDS'
        },
        { status: 400 }
      );
    }

    // Validate each swap has required fields
    for (let i = 0; i < swaps.length; i++) {
      const swap = swaps[i];
      if (!swap.player_a_id || !swap.player_b_id) {
        return NextResponse.json(
          {
            success: false,
            error: `Swap ${i + 1}: Missing player_a_id or player_b_id`,
            errorCode: 'INVALID_SWAP'
          },
          { status: 400 }
        );
      }

      if (swap.player_a_id === swap.player_b_id) {
        return NextResponse.json(
          {
            success: false,
            error: `Swap ${i + 1}: Cannot swap a player with themselves`,
            errorCode: 'SAME_PLAYER'
          },
          { status: 400 }
        );
      }
    }

    const sql = getAuctionDb();

    console.log('🔄 Bulk swap request:', { swap_count: swaps.length, season_id });

    // Collect all unique player IDs
    const allPlayerIds = new Set<string>();
    swaps.forEach(swap => {
      allPlayerIds.add(swap.player_a_id);
      allPlayerIds.add(swap.player_b_id);
    });

    // Check for duplicate players across swaps
    const playerIdArray = Array.from(allPlayerIds);
    if (playerIdArray.length !== swaps.length * 2) {
      return NextResponse.json(
        {
          success: false,
          error: 'Duplicate players detected across swaps. Each player can only be in one swap.',
          errorCode: 'DUPLICATE_PLAYERS'
        },
        { status: 400 }
      );
    }

    // Fetch all players at once
    const placeholders = playerIdArray.map((_, i) => `$${i + 1}`).join(', ');
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
      WHERE player_id IN (${placeholders})
    `;
    
    const players = await sql.query(playersQuery, playerIdArray);

    console.log('📊 Players found:', players.length, 'out of', playerIdArray.length);

    if (players.length !== playerIdArray.length) {
      const foundIds = new Set(players.map((p: any) => p.player_id));
      const missingIds = playerIdArray.filter(id => !foundIds.has(id));
      return NextResponse.json(
        {
          success: false,
          error: `Some players not found: ${missingIds.join(', ')}`,
          errorCode: 'PLAYER_NOT_FOUND',
          missing_players: missingIds
        },
        { status: 404 }
      );
    }

    // Create a map for quick player lookup
    const playerMap = new Map(players.map((p: any) => [p.player_id, p]));

    // Validate all swaps
    const validatedSwaps = [];
    for (let i = 0; i < swaps.length; i++) {
      const swap = swaps[i];
      const playerA = playerMap.get(swap.player_a_id);
      const playerB = playerMap.get(swap.player_b_id);

      if (!playerA || !playerB) {
        return NextResponse.json(
          {
            success: false,
            error: `Swap ${i + 1}: Player data not found`,
            errorCode: 'PLAYER_NOT_FOUND'
          },
          { status: 404 }
        );
      }

      // Validate players are assigned to teams
      if (!playerA.team_id || playerA.status === 'free_agent' || !playerA.is_sold) {
        return NextResponse.json(
          {
            success: false,
            error: `Swap ${i + 1}: ${playerA.player_name} is not assigned to a team`,
            errorCode: 'PLAYER_NOT_ASSIGNED'
          },
          { status: 400 }
        );
      }

      if (!playerB.team_id || playerB.status === 'free_agent' || !playerB.is_sold) {
        return NextResponse.json(
          {
            success: false,
            error: `Swap ${i + 1}: ${playerB.player_name} is not assigned to a team`,
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
            error: `Swap ${i + 1}: Both players are on the same team`,
            errorCode: 'SAME_TEAM'
          },
          { status: 400 }
        );
      }

      validatedSwaps.push({
        playerA,
        playerB,
        index: i + 1
      });
    }

    // Get all unique team IDs involved
    const teamIds = new Set<string>();
    validatedSwaps.forEach(({ playerA, playerB }) => {
      teamIds.add(playerA.team_id);
      teamIds.add(playerB.team_id);
    });

    // Fetch team season data for all teams
    const teamSeasonIds = Array.from(teamIds).map(tid => `${tid}_${season_id}`);
    const teamSeasonDocs = await Promise.all(
      teamSeasonIds.map(tsid => adminDb.collection('team_seasons').doc(tsid).get())
    );

    const teamSeasonMap = new Map();
    teamSeasonDocs.forEach((doc, idx) => {
      if (doc.exists) {
        const teamId = Array.from(teamIds)[idx];
        teamSeasonMap.set(teamId, doc.data());
      }
    });

    // Check if all teams exist
    for (const teamId of teamIds) {
      if (!teamSeasonMap.has(teamId)) {
        return NextResponse.json(
          {
            success: false,
            error: `Team ${teamId} season data not found`,
            errorCode: 'TEAM_NOT_FOUND'
          },
          { status: 404 }
        );
      }
    }

    // Calculate fees for each team based on their swap count
    const teamSwapCounts = new Map<string, number>();
    const teamFees = new Map<string, number>();
    
    // Initialize with current swap counts
    teamIds.forEach(teamId => {
      const teamData = teamSeasonMap.get(teamId);
      teamSwapCounts.set(teamId, teamData?.football_swap_count || 0);
    });

    // Calculate fee for each swap
    const calculateFee = (swapNumber: number): number => {
      if (swapNumber <= 6) return 0;  // First 6 swaps are FREE
      if (swapNumber === 7) return 100;
      if (swapNumber === 8) return 125;
      return 150;
    };

    const swapDetails = validatedSwaps.map(({ playerA, playerB, index }) => {
      const teamAId = playerA.team_id;
      const teamBId = playerB.team_id;

      // Increment swap count for this team
      const teamASwapCount = (teamSwapCounts.get(teamAId) || 0) + 1;
      const teamBSwapCount = (teamSwapCounts.get(teamBId) || 0) + 1;
      
      teamSwapCounts.set(teamAId, teamASwapCount);
      teamSwapCounts.set(teamBId, teamBSwapCount);

      const teamAFee = calculateFee(teamASwapCount);
      const teamBFee = calculateFee(teamBSwapCount);

      // Accumulate total fees per team
      teamFees.set(teamAId, (teamFees.get(teamAId) || 0) + teamAFee);
      teamFees.set(teamBId, (teamFees.get(teamBId) || 0) + teamBFee);

      return {
        playerA,
        playerB,
        teamASwapCount,
        teamBSwapCount,
        teamAFee,
        teamBFee,
        index
      };
    });

    // Validate all teams have sufficient budget
    for (const [teamId, totalFee] of teamFees) {
      const teamData = teamSeasonMap.get(teamId);
      const budget = teamData?.football_budget || 0;
      
      if (budget < totalFee) {
        return NextResponse.json(
          {
            success: false,
            error: `Team ${teamId} has insufficient budget. Required: ${totalFee}, Available: ${budget}`,
            errorCode: 'INSUFFICIENT_FUNDS'
          },
          { status: 400 }
        );
      }
    }

    // Execute all swaps in a transaction
    await sql.query('BEGIN');

    try {
      // Update all players
      for (const detail of swapDetails) {
        const { playerA, playerB } = detail;

        // Swap Player A to Player B's team with Player B's acquisition_value
        await sql.query(
          `UPDATE footballplayers 
           SET team_id = $1, acquisition_value = $2, updated_at = NOW() 
           WHERE player_id = $3`,
          [playerB.team_id, playerB.acquisition_value, playerA.player_id]
        );

        // Swap Player B to Player A's team with Player A's acquisition_value
        await sql.query(
          `UPDATE footballplayers 
           SET team_id = $1, acquisition_value = $2, updated_at = NOW() 
           WHERE player_id = $3`,
          [playerA.team_id, playerA.acquisition_value, playerB.player_id]
        );

        // Update team_players table
        await sql.query(
          `UPDATE team_players 
           SET team_id = $1, updated_at = NOW() 
           WHERE player_id = $2`,
          [playerB.team_id, playerA.id]
        );

        await sql.query(
          `UPDATE team_players 
           SET team_id = $1, updated_at = NOW() 
           WHERE player_id = $2`,
          [playerA.team_id, playerB.id]
        );
      }

      await sql.query('COMMIT');
      console.log('✅ All player swaps committed');

      // Update Firestore: team budgets, swap counts, and position counts
      const batch = adminDb.batch();

      // Track position changes per team
      const teamPositionChanges = new Map<string, Map<string, number>>();

      for (const detail of swapDetails) {
        const { playerA, playerB } = detail;
        const teamAId = playerA.team_id;
        const teamBId = playerB.team_id;

        const playerAPosition = playerA.position_group || playerA.position || 'Unknown';
        const playerBPosition = playerB.position_group || playerB.position || 'Unknown';

        // Initialize position change maps
        if (!teamPositionChanges.has(teamAId)) {
          teamPositionChanges.set(teamAId, new Map());
        }
        if (!teamPositionChanges.has(teamBId)) {
          teamPositionChanges.set(teamBId, new Map());
        }

        const teamAChanges = teamPositionChanges.get(teamAId)!;
        const teamBChanges = teamPositionChanges.get(teamBId)!;

        // Team A loses Player A's position, gains Player B's position
        if (playerAPosition !== 'Unknown') {
          teamAChanges.set(playerAPosition, (teamAChanges.get(playerAPosition) || 0) - 1);
        }
        if (playerBPosition !== 'Unknown') {
          teamAChanges.set(playerBPosition, (teamAChanges.get(playerBPosition) || 0) + 1);
        }

        // Team B loses Player B's position, gains Player A's position
        if (playerBPosition !== 'Unknown') {
          teamBChanges.set(playerBPosition, (teamBChanges.get(playerBPosition) || 0) - 1);
        }
        if (playerAPosition !== 'Unknown') {
          teamBChanges.set(playerAPosition, (teamBChanges.get(playerAPosition) || 0) + 1);
        }
      }

      // Apply updates to each team
      for (const teamId of teamIds) {
        const teamSeasonId = `${teamId}_${season_id}`;
        const totalFee = teamFees.get(teamId) || 0;
        const swapCount = teamSwapCounts.get(teamId)! - (teamSeasonMap.get(teamId)?.football_swap_count || 0);

        const updates: any = {
          football_budget: admin.firestore.FieldValue.increment(-totalFee),
          football_swap_count: admin.firestore.FieldValue.increment(swapCount),
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        };

        // Add position count updates
        const positionChanges = teamPositionChanges.get(teamId);
        if (positionChanges) {
          for (const [position, change] of positionChanges) {
            if (change !== 0) {
              updates[`position_counts.${position}`] = admin.firestore.FieldValue.increment(change);
            }
          }
        }

        batch.update(adminDb.collection('team_seasons').doc(teamSeasonId), updates);
      }

      await batch.commit();
      console.log('✅ All team budgets and counts updated');

      // Create player_transactions records and update player history
      const playerTransactionsRef = adminDb.collection('player_transactions');
      
      for (const detail of swapDetails) {
        const { playerA, playerB, index } = detail;
        
        // Create transaction record
        const transactionRef = playerTransactionsRef.doc();
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
          swap_number: index,
          processed_by: swapped_by,
          processed_by_name: swapped_by_name,
          created_at: admin.firestore.FieldValue.serverTimestamp()
        });

        // Update player history
        try {
          // Get team names
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
            acquisitionValue: playerB.acquisition_value,
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
            acquisitionValue: playerA.acquisition_value,
            contractStartSeason: season_id,
            contractEndSeason: season_id,
            transactionId: transactionId
          });

          console.log(`✅ Player history updated for swap ${index}`);
        } catch (historyError) {
          console.error(`Error updating player history for swap ${index}:`, historyError);
          // Continue even if history update fails
        }
      }

      // Log fee transactions
      const transactionsRef = adminDb.collection('transactions');
      const teamData = teamSeasonMap;

      for (const detail of swapDetails) {
        const { playerA, playerB, teamAFee, teamBFee, teamASwapCount, teamBSwapCount } = detail;
        const teamAId = playerA.team_id;
        const teamBId = playerB.team_id;

        const teamABudget = teamData.get(teamAId)?.football_budget || 0;
        const teamBBudget = teamData.get(teamBId)?.football_budget || 0;

        // Log transaction for Team A
        if (teamAFee > 0) {
          await transactionsRef.add({
            team_id: teamAId,
            season_id: season_id,
            transaction_type: 'football_swap_fee',
            amount: -teamAFee,
            balance_before: teamABudget,
            balance_after: teamABudget - teamAFee,
            description: `Bulk swap fee (Swap #${teamASwapCount}): ${playerA.player_name} ↔ ${playerB.player_name}`,
            player_id: playerB.player_id,
            player_name: playerB.player_name,
            related_team_id: teamBId,
            created_at: admin.firestore.FieldValue.serverTimestamp()
          });
        }

        // Log transaction for Team B
        if (teamBFee > 0) {
          await transactionsRef.add({
            team_id: teamBId,
            season_id: season_id,
            transaction_type: 'football_swap_fee',
            amount: -teamBFee,
            balance_before: teamBBudget,
            balance_after: teamBBudget - teamBFee,
            description: `Bulk swap fee (Swap #${teamBSwapCount}): ${playerB.player_name} ↔ ${playerA.player_name}`,
            player_id: playerA.player_id,
            player_name: playerA.player_name,
            related_team_id: teamAId,
            created_at: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      }

      // Build detailed swap summary
      const swapSummary = swapDetails.map((d, idx) => ({
        swap_number: idx + 1,
        player_a: {
          name: d.playerA.player_name,
          from_team: d.playerA.team_id,
          to_team: d.playerB.team_id,
          old_value: d.playerA.acquisition_value,
          new_value: d.playerB.acquisition_value
        },
        player_b: {
          name: d.playerB.player_name,
          from_team: d.playerB.team_id,
          to_team: d.playerA.team_id,
          old_value: d.playerB.acquisition_value,
          new_value: d.playerA.acquisition_value
        },
        team_a: {
          team_id: d.playerA.team_id,
          swap_count: d.teamASwapCount,
          fee: d.teamAFee
        },
        team_b: {
          team_id: d.playerB.team_id,
          swap_count: d.teamBSwapCount,
          fee: d.teamBFee
        }
      }));

      // Build team summary
      const teamSummary = Array.from(teamIds).map(teamId => ({
        team_id: teamId,
        total_swaps: teamSwapCounts.get(teamId)! - (teamSeasonMap.get(teamId)?.football_swap_count || 0),
        total_fee: teamFees.get(teamId) || 0,
        new_swap_count: teamSwapCounts.get(teamId)!
      }));

      return NextResponse.json({
        success: true,
        message: `Successfully swapped ${swaps.length} player pair(s)`,
        data: {
          swaps_completed: swaps.length,
          teams_affected: teamIds.size,
          total_fees: Array.from(teamFees.values()).reduce((sum, fee) => sum + fee, 0),
          swap_details: swapSummary,
          team_summary: teamSummary
        }
      });

    } catch (error) {
      await sql.query('ROLLBACK');
      throw error;
    }

  } catch (error: any) {
    console.error('Error in bulk-swap API:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to perform bulk swap',
        errorCode: 'SYSTEM_ERROR'
      },
      { status: 500 }
    );
  }
}
