import { neon } from '@neondatabase/serverless';
import { adminDb } from './firebase/admin';
import { decryptBidData } from './encryption';
import { createTiebreaker } from './tiebreaker';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

interface Bid {
  id: string;
  team_id: string;
  team_name: string;
  player_id: string;
  player_name: string;
  amount: number;
  round_id: string;
}

interface AllocationResult {
  team_id: string;
  team_name: string;
  player_id: string;
  player_name: string;
  amount: number;
  bid_id: string;
  phase: 'regular' | 'incomplete';
}

interface FinalizationResult {
  success: boolean;
  allocations: AllocationResult[];
  tieDetected: boolean;
  tiedBids?: Bid[];
  tiebreakerId?: string;
  error?: string;
}

/**
 * Finalizes a round by allocating players to teams based on bids
 * 
 * SIMPLIFIED LOGIC:
 * 1. Get all bids that meet required count → sort by amount
 * 2. Allocate highest bid → remove player & team → re-sort → repeat
 * 3. For incomplete teams: give highest bid player at average winning amount
 * 4. If tie at top: create tiebreaker (teams submit, amounts replace original, re-finalize)
 */
export async function finalizeRound(roundId: string): Promise<FinalizationResult> {
  try {
    // Get round details
    const roundResult = await sql`
      SELECT 
        id,
        position,
        max_bids_per_team,
        status,
        season_id
      FROM rounds
      WHERE id = ${roundId}
    `;

    if (roundResult.length === 0) {
      return {
        success: false,
        allocations: [],
        tieDetected: false,
        error: 'Round not found',
      };
    }

    const round = roundResult[0];
    const requiredBids = round.max_bids_per_team;

    // Check for resolved tiebreakers and replace amounts in bids
    const resolvedTiebreakers = await sql`
      SELECT 
        t.id,
        t.player_id,
        t.winning_team_id,
        t.winning_amount
      FROM tiebreakers t
      WHERE t.round_id = ${roundId}
      AND t.status = 'resolved'
    `;
    
    console.log(`🏆 Found ${resolvedTiebreakers.length} resolved tiebreakers`);
    
    // Map: (player_id + team_id) -> new amount from tiebreaker
    const tiebreakerReplacements = new Map<string, number>();
    for (const tb of resolvedTiebreakers) {
      const key = `${tb.player_id}_${tb.winning_team_id}`;
      tiebreakerReplacements.set(key, tb.winning_amount);
      console.log(`  ➔ Player ${tb.player_id} + Team ${tb.winning_team_id}: £${tb.winning_amount}`);
    }

    // Get all active bids (encrypted)
    const bidsResult = await sql`
      SELECT 
        b.id,
        b.team_id,
        b.encrypted_bid_data,
        b.round_id
      FROM bids b
      WHERE b.round_id = ${roundId}
      AND b.status = 'active'
    `;

    // Decrypt bids and REPLACE amounts if tiebreaker resolved
    const decryptedBids = [];
    for (const bid of bidsResult) {
      try {
        const { player_id, amount } = decryptBidData(bid.encrypted_bid_data);
        
        // Check if this bid has a tiebreaker replacement
        const replacementKey = `${player_id}_${bid.team_id}`;
        const finalAmount = tiebreakerReplacements.get(replacementKey) || amount;
        
        if (tiebreakerReplacements.has(replacementKey)) {
          console.log(`🔄 Replacing bid amount: £${amount} → £${finalAmount}`);
        }
        
        // Get player name
        const playerResult = await sql`
          SELECT name FROM footballplayers WHERE id = ${player_id}
        `;
        
        decryptedBids.push({
          id: bid.id,
          team_id: bid.team_id,
          player_id: player_id,
          player_name: playerResult[0]?.name || 'Unknown',
          amount: finalAmount, // Use tiebreaker amount if resolved
          round_id: bid.round_id
        });
      } catch (error) {
        console.error(`Failed to decrypt bid ${bid.id}:`, error);
        // Skip corrupted bids
      }
    }

    // Sort by amount (highest first)
    decryptedBids.sort((a, b) => b.amount - a.amount);

    if (decryptedBids.length === 0) {
      return {
        success: false,
        allocations: [],
        tieDetected: false,
        error: 'No active bids found for this round',
      };
    }

    // Fetch team names from Firebase (team_seasons) - BATCH ALL AT ONCE
    const uniqueTeamIds = [...new Set(decryptedBids.map(b => b.team_id))];
    const teamNamesMap = new Map<string, string>();
    
    // Parallel fetch all team names
    const teamNamePromises = uniqueTeamIds.map(async (teamId) => {
      try {
        const teamSeasonId = `${teamId}_${round.season_id}`;
        const teamSeasonDoc = await adminDb.collection('team_seasons').doc(teamSeasonId).get();
        
        if (teamSeasonDoc.exists) {
          return { teamId, name: teamSeasonDoc.data()?.team_name || teamId };
        }
        
        const userDoc = await adminDb.collection('users').doc(teamId).get();
        return { 
          teamId, 
          name: userDoc.exists ? userDoc.data()?.teamName || teamId : teamId 
        };
      } catch (error) {
        console.error(`Error fetching team ${teamId}:`, error);
        return { teamId, name: teamId };
      }
    });
    
    const teamNamesResults = await Promise.all(teamNamePromises);
    teamNamesResults.forEach(({ teamId, name }) => {
      teamNamesMap.set(teamId, name);
    });

    // Add team names to bids
    const bidsWithTeamNames = decryptedBids.map(bid => ({
      ...bid,
      team_name: teamNamesMap.get(bid.team_id) || bid.team_id
    }));

    // Count bids per team
    const teamBidCounts = new Map<string, number>();
    for (const bid of bidsWithTeamNames) {
      teamBidCounts.set(bid.team_id, (teamBidCounts.get(bid.team_id) || 0) + 1);
    }

    // Separate teams by bid count
    const completeTeams = new Set<string>();
    const incompleteTeams = new Set<string>();

    for (const [teamId, count] of teamBidCounts.entries()) {
      if (count === requiredBids) {
        completeTeams.add(teamId);
      } else if (count < requiredBids) {
        incompleteTeams.add(teamId);
      }
    }

    console.log(`📊 Teams: ${completeTeams.size} complete, ${incompleteTeams.size} incomplete`);

    const allocations: AllocationResult[] = [];
    const allocatedPlayers = new Set<string>();
    const allocatedTeams = new Set<string>();

    // ============================================
    // STEP 1: Allocate to teams with complete bids
    // ============================================
    
    // Get all bids from complete teams
    let activeBids: Bid[] = bidsWithTeamNames
      .filter(bid => completeTeams.has(bid.team_id))
      .map(bid => ({
        id: bid.id,
        team_id: bid.team_id,
        team_name: bid.team_name,
        player_id: bid.player_id,
        player_name: bid.player_name,
        amount: bid.amount, // Already replaced with tiebreaker amounts if resolved
        round_id: bid.round_id,
      }));

    // Allocate one by one until all complete teams have a player
    while (activeBids.length > 0 && allocatedTeams.size < completeTeams.size) {
      // Sort by amount DESC
      activeBids.sort((a, b) => b.amount - a.amount);

      const topBid = activeBids[0];
      const topAmount = topBid.amount;

      // Find all bids with same amount (ties)
      const tiedBids = activeBids.filter(bid => 
        bid.amount === topAmount && 
        bid.player_id === topBid.player_id
      );

      if (tiedBids.length > 1) {
        // TIE DETECTED - stop and create tiebreaker
        console.log(`⚠️ TIE: ${tiedBids.length} teams bid £${topAmount} for ${topBid.player_name}`);
        
        const tiebreakerResult = await createTiebreaker(
          roundId,
          topBid.player_id,
          tiedBids
        );

        if (!tiebreakerResult.success) {
          return {
            success: false,
            allocations: [],
            tieDetected: true,
            tiedBids: tiedBids,
            error: tiebreakerResult.error || 'Failed to create tiebreaker',
          };
        }

        return {
          success: false,
          allocations: [],
          tieDetected: true,
          tiedBids: tiedBids,
          tiebreakerId: tiebreakerResult.tiebreakerId,
          error: 'Tie detected - resolve tiebreaker and finalize again',
        };
      }

      // No tie - allocate this player to this team
      console.log(`✅ Allocate: ${topBid.player_name} → ${topBid.team_name} for £${topBid.amount}`);
      
      allocations.push({
        team_id: topBid.team_id,
        team_name: topBid.team_name,
        player_id: topBid.player_id,
        player_name: topBid.player_name,
        amount: topBid.amount,
        bid_id: topBid.id,
        phase: 'regular',
      });

      allocatedPlayers.add(topBid.player_id);
      allocatedTeams.add(topBid.team_id);

      // Remove this player and this team from remaining bids
      activeBids = activeBids.filter(
        bid => bid.player_id !== topBid.player_id && bid.team_id !== topBid.team_id
      );
    }

    // ============================================
    // STEP 2: Handle incomplete teams
    // ============================================

    if (incompleteTeams.size > 0) {
      console.log(`🛠️ Handling ${incompleteTeams.size} incomplete teams...`);
      
      // Calculate average winning bid
      const averageAmount = allocations.length > 0
        ? Math.round(allocations.reduce((sum, a) => sum + a.amount, 0) / allocations.length)
        : 1000;
      
      console.log(`💰 Average winning bid: £${averageAmount}`);

      // Process each incomplete team
      for (const teamId of incompleteTeams) {
        if (allocatedTeams.has(teamId)) continue;

        // Get this team's bids, excluding sold players
        const teamBids = bidsWithTeamNames
          .filter(bid => 
            bid.team_id === teamId && 
            !allocatedPlayers.has(bid.player_id)
          )
          .sort((a, b) => b.amount - a.amount);

        if (teamBids.length > 0) {
          const topBid = teamBids[0];
          
          console.log(`  → ${topBid.team_name}: highest available = ${topBid.player_name} at average £${averageAmount}`);

          allocations.push({
            team_id: topBid.team_id,
            team_name: topBid.team_name,
            player_id: topBid.player_id,
            player_name: topBid.player_name,
            amount: averageAmount, // Charge average, not their bid
            bid_id: topBid.id,
            phase: 'incomplete',
          });

          allocatedPlayers.add(topBid.player_id);
          allocatedTeams.add(topBid.team_id);
        }
      }
    }

    return {
      success: true,
      allocations,
      tieDetected: false,
    };
  } catch (error) {
    console.error('Error in finalizeRound:', error);
    return {
      success: false,
      allocations: [],
      tieDetected: false,
      error: 'Internal error during finalization',
    };
  }
}

/**
 * Applies the finalization results to the database
 */
export async function applyFinalizationResults(
  roundId: string,
  allocations: AllocationResult[]
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get round details for season_id
    const roundDetails = await sql`
      SELECT season_id FROM rounds WHERE id = ${roundId}
    `;
    const seasonId = roundDetails[0]?.season_id;

    // Get all bid IDs for this round with encrypted data
    const allBidsResult = await sql`
      SELECT id, team_id, player_id, encrypted_bid_data
      FROM bids
      WHERE round_id = ${roundId}
      AND status = 'active'
    `;
    
    // Decrypt to get actual amounts
    const decryptedAllBids = [];
    for (const bid of allBidsResult) {
      try {
        const { player_id, amount } = decryptBidData(bid.encrypted_bid_data);
        decryptedAllBids.push({
          id: bid.id,
          team_id: bid.team_id,
          player_id: player_id,
          amount: amount,
        });
      } catch (error) {
        console.error(`Failed to decrypt bid ${bid.id}:`, error);
      }
    }

    const allBids = decryptedAllBids;

    // Create sets for quick lookup
    const winningBidIds = new Set(allocations.map(a => a.bid_id));
    const winningTeamIds = new Set(allocations.map(a => a.team_id));
    const winningPlayerIds = new Set(allocations.map(a => a.player_id));

    // Process each allocation
    for (const allocation of allocations) {
      // 1. Update winning bid status with phase information
      if (allocation.phase === 'incomplete') {
        // For incomplete bids, store the original bid amount
        const originalBid = decryptedAllBids.find(b => b.id === allocation.bid_id);
        await sql`
          UPDATE bids
          SET status = 'won',
              phase = 'incomplete',
              actual_bid_amount = ${originalBid?.amount || allocation.amount},
              updated_at = NOW()
          WHERE id = ${allocation.bid_id}
        `;
      } else {
        await sql`
          UPDATE bids
          SET status = 'won',
              phase = 'regular',
              updated_at = NOW()
          WHERE id = ${allocation.bid_id}
        `;
      }

      // 2. Create team_players record
      await sql`
        INSERT INTO team_players (
          team_id,
          player_id,
          purchase_price,
          acquired_at
        ) VALUES (
          ${allocation.team_id},
          ${allocation.player_id},
          ${allocation.amount},
          NOW()
        )
      `;

      // 3. Get player position for position_counts update
      const playerResult = await sql`
        SELECT position FROM footballplayers WHERE id = ${allocation.player_id}
      `;
      const playerPosition = playerResult[0]?.position;

      // 4. Update team budget and position_counts in Firebase (team_seasons)
      try {
        if (seasonId) {
          const teamSeasonId = `${allocation.team_id}_${seasonId}`;
          const teamSeasonRef = adminDb.collection('team_seasons').doc(teamSeasonId);
          const teamSeasonDoc = await teamSeasonRef.get();
          
          if (teamSeasonDoc.exists) {
            const teamSeasonData = teamSeasonDoc.data();
            const currentBudget = teamSeasonData?.budget || 0;
            const totalSpent = (teamSeasonData?.total_spent || 0) + allocation.amount;
            const playersCount = (teamSeasonData?.players_count || 0) + 1;
            
            // Prepare position_counts update
            const positionCounts = teamSeasonData?.position_counts || {};
            if (playerPosition && playerPosition in positionCounts) {
              positionCounts[playerPosition] = (positionCounts[playerPosition] || 0) + 1;
            }
            
            // Update budget, total spent, player count, and position_counts
            await teamSeasonRef.update({
              budget: currentBudget - allocation.amount,
              total_spent: totalSpent,
              players_count: playersCount,
              position_counts: positionCounts,
              updated_at: new Date()
            });
            
            console.log(`✅ Updated team ${allocation.team_id}: budget £${currentBudget} -> £${currentBudget - allocation.amount}, ${playerPosition} count incremented`);
          } else {
            console.warn(`Team season doc not found for ${teamSeasonId}`);
          }
        }
      } catch (error) {
        console.error(`Error updating team stats for team ${allocation.team_id}:`, error);
        // Continue with finalization even if update fails
      }

      // 4. Update player: mark as sold, assign to team, and set season/round
      await sql`
        UPDATE footballplayers
        SET 
          is_sold = true,
          team_id = ${allocation.team_id},
          acquisition_value = ${allocation.amount},
          season_id = ${seasonId},
          round_id = ${roundId}
        WHERE id = ${allocation.player_id}
      `;
    }

    // Mark all other bids for this round as 'lost'
    for (const bid of allBids) {
      if (!winningBidIds.has(bid.id)) {
        await sql`
          UPDATE bids
          SET status = 'lost',
              updated_at = NOW()
          WHERE id = ${bid.id}
        `;
      }
    }

    // Update round status to completed
    await sql`
      UPDATE rounds
      SET status = 'completed',
          updated_at = NOW()
      WHERE id = ${roundId}
    `;

    return { success: true };
  } catch (error) {
    console.error('Error applying finalization results:', error);
    return {
      success: false,
      error: 'Failed to apply finalization results to database',
    };
  }
}
