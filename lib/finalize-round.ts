import { neon } from '@neondatabase/serverless';
import { adminDb } from './firebase/admin';
import { decryptBidData } from './encryption';
import { createTiebreaker } from './tiebreaker';
import { getTournamentDb } from './neon/tournament-config';
import { logAuctionWin } from './transaction-logger';
import { triggerNews } from './news/trigger';
import { calculateReserveCore, ReserveConfig } from './reserve-calculator';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);
const tournamentSql = getTournamentDb();

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
 * Finalizes a round - ONE PLAYER PER TEAM ALLOCATION
 */
export async function finalizeRound(roundId: string): Promise<FinalizationResult> {
  try {
    console.log(`🎯 Starting finalization for round ${roundId}`);
    
    const roundResult = await sql`
      SELECT id, position, max_bids_per_team, status, season_id, round_number
      FROM rounds WHERE id = ${roundId}
    `;

    if (roundResult.length === 0) {
      return { success: false, allocations: [], tieDetected: false, error: 'Round not found' };
    }

    const round = roundResult[0];
    const requiredBids = round.max_bids_per_team;
    
    // Fetch auction settings to determine current phase
    const settingsResult = await sql`
      SELECT phase_1_end_round, phase_1_min_balance, phase_2_end_round, 
             phase_2_min_balance, phase_3_min_balance, max_squad_size
      FROM auction_settings WHERE season_id = ${round.season_id}
    `;
    const settings = settingsResult[0];
    
    // Determine current phase
    let currentPhase: 'phase_1' | 'phase_2' | 'phase_3';
    if (round.round_number <= settings.phase_1_end_round) {
      currentPhase = 'phase_1';
    } else if (round.round_number <= settings.phase_2_end_round) {
      currentPhase = 'phase_2';
    } else {
      currentPhase = 'phase_3';
    }
    
    console.log(`📍 Round ${round.round_number} is in ${currentPhase}`);
    const minAllocation = currentPhase === 'phase_3' ? settings.phase_3_min_balance : null;

    // Check for active tiebreakers
    const activeTiebreakers = await sql`
      SELECT id FROM tiebreakers
      WHERE round_id = ${roundId} AND status = 'active'
    `;
    
    if (activeTiebreakers.length > 0) {
      console.log(`⛔ Cannot finalize - ${activeTiebreakers.length} active tiebreaker(s)`);
      return {
        success: false,
        allocations: [],
        tieDetected: true,
        error: `${activeTiebreakers.length} tiebreaker(s) must be resolved first`,
      };
    }

    // Get resolved tiebreakers
    const resolvedTiebreakers = await sql`
      SELECT player_id, winning_team_id, winning_bid
      FROM tiebreakers
      WHERE round_id = ${roundId} AND status = 'resolved'
    `;
    
    const tiebreakerReplacements = new Map<string, number>();
    for (const tb of resolvedTiebreakers) {
      // Parse winning_bid as number (comes as string from PostgreSQL NUMERIC type)
      const winningAmount = typeof tb.winning_bid === 'string' ? parseFloat(tb.winning_bid) : tb.winning_bid;
      tiebreakerReplacements.set(`${tb.player_id}_${tb.winning_team_id}`, winningAmount);
    }

    // Get and decrypt bids
    const bidsResult = await sql`
      SELECT id, team_id, encrypted_bid_data, round_id
      FROM bids WHERE round_id = ${roundId} AND status = 'active'
    `;

    const decryptedBids = [];
    for (const bid of bidsResult) {
      try {
        const { player_id, amount } = decryptBidData(bid.encrypted_bid_data);
        const finalAmount = tiebreakerReplacements.get(`${player_id}_${bid.team_id}`) || amount;
        
        const playerResult = await sql`SELECT name FROM footballplayers WHERE id = ${player_id}`;
        
        decryptedBids.push({
          id: bid.id,
          team_id: bid.team_id,
          player_id,
          player_name: playerResult[0]?.name || 'Unknown',
          amount: finalAmount,
          round_id: bid.round_id
        });
      } catch (error) {
        console.error(`Failed to decrypt bid ${bid.id}`);
      }
    }

    if (decryptedBids.length === 0) {
      return { success: true, allocations: [], tieDetected: false };
    }

    // Fetch team names
    const uniqueTeamIds = [...new Set(decryptedBids.map(b => b.team_id))];
    const teamNamesMap = new Map<string, string>();
    
    await Promise.all(uniqueTeamIds.map(async (teamId) => {
      try {
        const doc = await adminDb.collection('team_seasons').doc(`${teamId}_${round.season_id}`).get();
        teamNamesMap.set(teamId, doc.exists ? doc.data()?.team_name || teamId : teamId);
      } catch {
        teamNamesMap.set(teamId, teamId);
      }
    }));

    const bidsWithNames = decryptedBids.map(bid => ({
      ...bid,
      team_name: teamNamesMap.get(bid.team_id) || bid.team_id
    }));

    // Get teams that submitted their bids (clicked Submit button)
    const submissions = await sql`SELECT team_id FROM bid_submissions WHERE round_id = ${roundId}`;
    const submittedTeams = new Set(submissions.map((s: any) => s.team_id));
    
    // Get all teams in this season
    const allTeamsResult = await sql`SELECT id FROM teams WHERE season_id = ${round.season_id}`;
    const allTeamIds = allTeamsResult.map((t: any) => t.id);
    
    // Separate submitted vs non-submitted teams
    const nonSubmittedTeams = allTeamIds.filter((teamId: string) => !submittedTeams.has(teamId));
    
    console.log(`📊 ${submittedTeams.size} teams submitted bids, ${nonSubmittedTeams.length} teams didn't submit`);

    const allocations: AllocationResult[] = [];
    const allocatedPlayers = new Set<string>();
    const allocatedTeams = new Set<string>();

    // Allocate to submitted teams (normal auction - highest bid wins, 1 player per team)
    let activeBids: Bid[] = bidsWithNames
      .filter(bid => submittedTeams.has(bid.team_id))
      .map(bid => ({
        id: bid.id,
        team_id: bid.team_id,
        team_name: bid.team_name,
        player_id: bid.player_id,
        player_name: bid.player_name,
        amount: bid.amount,
        round_id: bid.round_id,
      }));

    // Each team gets MAX 1 player
    while (activeBids.length > 0 && allocatedTeams.size < submittedTeams.size) {
      activeBids.sort((a, b) => b.amount - a.amount);
      const topBid = activeBids[0];
      const tiedBids = activeBids.filter(b => b.amount === topBid.amount && b.player_id === topBid.player_id);

      if (tiedBids.length > 1) {
        console.log(`⚠️ TIE: ${tiedBids.length} teams bid £${topBid.amount} for ${topBid.player_name}`);
        
        const tbResult = await createTiebreaker(roundId, topBid.player_id, tiedBids);
        if (!tbResult.success) {
          return { success: false, allocations: [], tieDetected: true, tiedBids, error: tbResult.error };
        }
        
        await sql`UPDATE rounds SET status = 'tiebreaker_pending', updated_at = NOW() WHERE id = ${roundId}`;
        
        return {
          success: false,
          allocations: [],
          tieDetected: true,
          tiedBids,
          tiebreakerId: tbResult.tiebreakerId,
          error: 'Tie detected - teams must resolve tiebreaker',
        };
      }

      console.log(`✅ ${topBid.player_name} → ${topBid.team_name} (£${topBid.amount})`);
      
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
      // Remove this player AND this team from the pool (1 player per team max)
      activeBids = activeBids.filter(b => b.player_id !== topBid.player_id && b.team_id !== topBid.team_id);
    }

    // Get teams that already have players in this round (from previous finalization attempts)
    const existingAllocations = await sql`
      SELECT DISTINCT team_id
      FROM team_players
      WHERE round_id = ${roundId}
    `;
    const teamsWithPlayers = new Set(existingAllocations.map((a: any) => a.team_id));
    
    // Add to allocatedTeams to prevent duplicates
    teamsWithPlayers.forEach(teamId => allocatedTeams.add(teamId));
    
    console.log(`🔍 Teams already allocated in this round: ${teamsWithPlayers.size}`);
    
    // Handle non-submitted teams (teams that didn't click Submit button)
    if (nonSubmittedTeams.length > 0) {
      const avgAmount = allocations.length > 0
        ? Math.round(allocations.reduce((sum, a) => sum + a.amount, 0) / allocations.length)
        : 1000;

      console.log(`💰 Average price for non-submitted teams: £${avgAmount}`);
      
      // Phase 2: Teams can skip (no forced allocation)
      if (currentPhase === 'phase_2') {
        console.log(`⏭️ Phase 2: Non-submitted teams can skip this round`);
        // Don't force allocation for Phase 2 - teams can skip
      } else {
        // Phase 1 & 3: Force allocation for non-submitted teams
        console.log(`🔒 ${currentPhase}: Forcing allocation for non-submitted teams`);
      
        for (const teamId of nonSubmittedTeams) {
        // Skip if team already got a player (should only get 1 per round)
        if (allocatedTeams.has(teamId)) continue;
        
        // Get team name
        const teamName = teamNamesMap.get(teamId) || teamId;
        
        // Phase 1: Use average price, Phase 3: Use £10 minimum
        let allocationAmount = currentPhase === 'phase_1' ? avgAmount : (minAllocation || 10);
        
        // Check team balance and reserve requirements, adjust price if needed
        let canAfford = false;
        try {
          const tsDoc = await adminDb.collection('team_seasons').doc(`${teamId}_${round.season_id}`).get();
          if (tsDoc.exists) {
            const tsd = tsDoc.data();
            const curr = tsd?.currency_system || 'single';
            const teamBalance = curr === 'dual' ? (tsd?.football_budget || 0) : (tsd?.budget || 0);
            const teamSquadSize = tsd?.players_count || 0;
            
            // Calculate reserve requirements
            const reserveConfig: ReserveConfig = {
              phase_1_end_round: settings.phase_1_end_round,
              phase_1_min_balance: settings.phase_1_min_balance,
              phase_2_end_round: settings.phase_2_end_round,
              phase_2_min_balance: settings.phase_2_min_balance,
              phase_3_min_balance: settings.phase_3_min_balance,
              max_squad_size: settings.max_squad_size,
            };
            
            const reserveInfo = calculateReserveCore(
              round.round_number,
              teamBalance,
              teamSquadSize,
              reserveConfig
            );
            
            // Calculate maximum they can afford while maintaining reserve
            const maxAffordable = teamBalance - reserveInfo.floorReserve;
            
            if (maxAffordable >= (minAllocation || 10)) {
              // Team can afford at least minimum allocation
              if (allocationAmount > maxAffordable) {
                // Adjust allocation to what they can afford
                allocationAmount = maxAffordable;
                console.log(`💰 ${currentPhase}: Adjusted allocation for ${teamName} from £${currentPhase === 'phase_1' ? avgAmount : (minAllocation || 10)} to £${allocationAmount} (their max affordable)`);
              }
              canAfford = true;
            } else {
              console.log(`⚠️ ${currentPhase}: Team ${teamName} cannot afford even minimum £${minAllocation || 10} (balance: £${teamBalance}, reserve needed: £${reserveInfo.floorReserve}, max affordable: £${maxAffordable})`);
            }
          }
        } catch (err) {
          console.error(`Failed to check balance for team ${teamId}:`, err);
        }
        
        if (!canAfford) continue;
        
        // Get this team's bids (excluding already allocated players)
        const teamBids = bidsWithNames
          .filter(b => b.team_id === teamId && !allocatedPlayers.has(b.player_id));

        if (teamBids.length > 0) {
          // Randomly pick from their remaining bids
          const randomIndex = Math.floor(Math.random() * teamBids.length);
          const randomBid = teamBids[randomIndex];
          
          allocations.push({
            team_id: teamId,
            team_name: teamName,
            player_id: randomBid.player_id,
            player_name: randomBid.player_name,
            amount: allocationAmount,
            bid_id: randomBid.id,
            phase: 'incomplete',
          });
          allocatedPlayers.add(randomBid.player_id);
          allocatedTeams.add(teamId);
          console.log(`🔄 ${currentPhase}: Random allocation ${randomBid.player_name} → ${teamName} (£${allocationAmount}) - Team didn't submit`);
        }
      }
      } // End Phase 1 & 3 forced allocation

      // Random allocation from entire position pool for teams without any remaining bids (Phase 1 & 3 only)
      if (currentPhase !== 'phase_2') {
        const teamsWithoutPlayers = nonSubmittedTeams.filter(teamId => !allocatedTeams.has(teamId));
        
        if (teamsWithoutPlayers.length > 0) {
          console.log(`🎲 ${currentPhase}: ${teamsWithoutPlayers.length} teams need random allocation from position pool`);
        
        // Get available players for this round's position/position_group
        // Support multi-position rounds (e.g., "LB,LWF")
        const positions = round.position.split(',').map((p: string) => p.trim());
        
        const availablePlayers = await sql`
          SELECT id, name, position, position_group
          FROM footballplayers
          WHERE is_auction_eligible = true
            AND is_sold = false
            AND (position = ANY(${positions}) OR position_group = ANY(${positions}))
        `;
        
        // Filter out already allocated players
        const unallocatedPlayers = availablePlayers.filter(
          (p: any) => !allocatedPlayers.has(p.id)
        );
        
        console.log(`📦 Found ${unallocatedPlayers.length} unallocated players in position ${round.position}`);
        
        for (const teamId of teamsWithoutPlayers) {
          if (unallocatedPlayers.length === 0) {
            console.log(`⚠️ No more players available for team ${teamId}`);
            break;
          }
          
          // Get team name
          const teamName = teamNamesMap.get(teamId) || teamId;
          
          // Phase 1: Use average price, Phase 3: Use £10 minimum
          let allocationAmount = currentPhase === 'phase_1' ? avgAmount : (minAllocation || 10);
          
          // Check team balance and reserve requirements, adjust price if needed
          let canParticipate = false;
          try {
            const tsDoc = await adminDb.collection('team_seasons').doc(`${teamId}_${round.season_id}`).get();
            if (tsDoc.exists) {
              const tsd = tsDoc.data();
              const curr = tsd?.currency_system || 'single';
              const teamBalance = curr === 'dual' ? (tsd?.football_budget || 0) : (tsd?.budget || 0);
              const teamSquadSize = tsd?.players_count || 0;
              
              // Calculate reserve requirements
              const reserveConfig: ReserveConfig = {
                phase_1_end_round: settings.phase_1_end_round,
                phase_1_min_balance: settings.phase_1_min_balance,
                phase_2_end_round: settings.phase_2_end_round,
                phase_2_min_balance: settings.phase_2_min_balance,
                phase_3_min_balance: settings.phase_3_min_balance,
                max_squad_size: settings.max_squad_size,
              };
              
              const reserveInfo = calculateReserveCore(
                round.round_number,
                teamBalance,
                teamSquadSize,
                reserveConfig
              );
              
              // Calculate maximum they can afford while maintaining reserve
              const maxAffordable = teamBalance - reserveInfo.floorReserve;
              
              if (maxAffordable >= (minAllocation || 10)) {
                // Team can afford at least minimum allocation
                if (allocationAmount > maxAffordable) {
                  // Adjust allocation to what they can afford
                  allocationAmount = maxAffordable;
                  console.log(`💰 ${currentPhase}: Adjusted allocation for ${teamName} from £${currentPhase === 'phase_1' ? avgAmount : (minAllocation || 10)} to £${allocationAmount} (their max affordable)`);
                }
                canParticipate = true;
              } else {
                console.log(`⚠️ ${currentPhase}: Team ${teamName} cannot afford even minimum £${minAllocation || 10} (balance: £${teamBalance}, reserve needed: £${reserveInfo.floorReserve}, max affordable: £${maxAffordable})`);
              }
            }
          } catch (err) {
            console.error(`Failed to check balance for team ${teamId}:`, err);
          }
          
          if (!canParticipate) continue;
          
          // Randomly pick a player from unallocated pool
          const randomIndex = Math.floor(Math.random() * unallocatedPlayers.length);
          const randomPlayer = unallocatedPlayers[randomIndex];
          
          // Create a synthetic bid ID for this allocation
          const syntheticBidId = `synthetic_${teamId}_${randomPlayer.id}_${Date.now()}`;
          
          allocations.push({
            team_id: teamId,
            team_name: teamName,
            player_id: randomPlayer.id,
            player_name: randomPlayer.name,
            amount: allocationAmount,
            bid_id: syntheticBidId,
            phase: 'incomplete',
          });
          
          allocatedPlayers.add(randomPlayer.id);
          allocatedTeams.add(teamId);
          
          // Remove from pool
          unallocatedPlayers.splice(randomIndex, 1);
          
          console.log(`🎲 ${currentPhase}: Random allocation ${randomPlayer.name} → ${teamName} (£${allocationAmount}) - No bids available`);
        }
        } // End if teamsWithoutPlayers
      } // End if currentPhase !== 'phase_2'
    } // End if nonSubmittedTeams

    return { success: true, allocations, tieDetected: false };
  } catch (error) {
    console.error('Finalization error:', error);
    return { success: false, allocations: [], tieDetected: false, error: 'Internal error' };
  }
}

export async function applyFinalizationResults(
  roundId: string,
  allocations: AllocationResult[]
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`💾 Applying finalization results for round ${roundId}`);
    console.log(`   Allocations:`, allocations.map(a => ({ player: a.player_name, team: a.team_name, amount: a.amount, type: typeof a.amount })));
    
    const roundDetails = await sql`SELECT season_id, status FROM rounds WHERE id = ${roundId}`;
    if (roundDetails.length === 0) return { success: false, error: 'Round not found' };
    
    const roundStatus = roundDetails[0]?.status;
    if (roundStatus === 'completed') return { success: true };
    if (roundStatus !== 'active' && roundStatus !== 'tiebreaker_pending') {
      return { success: false, error: `Invalid status: ${roundStatus}` };
    }
    
    const seasonId = roundDetails[0]?.season_id;
    const allBids = await sql`SELECT id, team_id, encrypted_bid_data FROM bids WHERE round_id = ${roundId} AND status = 'active'`;
    
    const decryptedAll = [];
    for (const bid of allBids) {
      try {
        const { player_id, amount } = decryptBidData(bid.encrypted_bid_data);
        decryptedAll.push({ id: bid.id, team_id: bid.team_id, player_id, amount });
      } catch {}
    }

    const winningIds = new Set(allocations.map(a => a.bid_id));

    for (const alloc of allocations) {
      // Check if this is a synthetic bid (Phase 3 random allocation)
      const isSyntheticBid = alloc.bid_id.startsWith('synthetic_');
      
      if (!isSyntheticBid) {
        // Real bid - update it in database
        if (alloc.phase === 'incomplete') {
          const orig = decryptedAll.find(b => b.id === alloc.bid_id);
          await sql`UPDATE bids SET status = 'won', phase = 'incomplete', actual_bid_amount = ${orig?.amount || alloc.amount}, updated_at = NOW() WHERE id = ${alloc.bid_id}`;
        } else {
          await sql`UPDATE bids SET status = 'won', phase = 'regular', updated_at = NOW() WHERE id = ${alloc.bid_id}`;
        }
      } else {
        // Synthetic bid - no bid to update, just log it
        console.log(`🎲 Synthetic allocation for team ${alloc.team_id}: ${alloc.player_name}`);
      }

      // Use ON CONFLICT to handle players that might already be in team_players table
      await sql`
        INSERT INTO team_players (team_id, player_id, season_id, round_id, purchase_price, acquired_at) 
        VALUES (${alloc.team_id}, ${alloc.player_id}, ${seasonId}, ${roundId}, ${alloc.amount}, NOW())
        ON CONFLICT (player_id, season_id) 
        DO UPDATE SET 
          team_id = ${alloc.team_id},
          round_id = ${roundId},
          purchase_price = ${alloc.amount},
          acquired_at = NOW()
      `;

      const playerRes = await sql`SELECT position FROM footballplayers WHERE id = ${alloc.player_id}`;
      const pos = playerRes[0]?.position;

      try {
        const tsId = `${alloc.team_id}_${seasonId}`;
        const tsRef = adminDb.collection('team_seasons').doc(tsId);
        const tsDoc = await tsRef.get();
        
        if (tsDoc.exists) {
          const tsd = tsDoc.data();
          const curr = tsd?.currency_system || 'single';
          const budget = curr === 'dual' ? (tsd?.football_budget || 0) : (tsd?.budget || 0);
          const posCounts = tsd?.position_counts || {};
          if (pos && pos in posCounts) posCounts[pos] = (posCounts[pos] || 0) + 1;
          
          const upd: any = {
            total_spent: (tsd?.total_spent || 0) + alloc.amount,
            players_count: (tsd?.players_count || 0) + 1,
            position_counts: posCounts,
            updated_at: new Date()
          };
          
          if (curr === 'dual') {
            upd.football_budget = budget - alloc.amount;
            upd.football_spent = (tsd?.football_spent || 0) + alloc.amount;
          } else {
            upd.budget = budget - alloc.amount;
          }
          
          await tsRef.update(upd);
          await logAuctionWin(alloc.team_id, seasonId, alloc.player_name, alloc.player_id, 'football', alloc.amount, budget, roundId);
        }
      } catch {}

      try {
        // alloc.team_id contains readable team ID (SSPSLT0001)
        await sql`UPDATE teams SET 
          football_spent = football_spent + ${alloc.amount}, 
          football_budget = football_budget - ${alloc.amount},
          football_players_count = football_players_count + 1,
          updated_at = NOW() 
        WHERE id = ${alloc.team_id}
        AND season_id = ${seasonId}`;
      } catch (teamUpdateError) {
        console.error(`Failed to update team ${alloc.team_id}:`, teamUpdateError);
      }

      const sNum = parseInt(seasonId?.replace(/\D/g, '') || '0');
      const sPre = seasonId?.replace(/\d+$/, '') || 'S';
      let dur = 2;
      try {
        const setRes = await sql`SELECT contract_duration FROM auction_settings WHERE season_id = ${seasonId} LIMIT 1`;
        if (setRes.length > 0) dur = setRes[0].contract_duration || 2;
      } catch {}
      
      const cEnd = `${sPre}${sNum + dur - 1}`;
      const cId = `contract_${alloc.player_id}_${seasonId}_${Date.now()}`;
      
      await sql`UPDATE footballplayers SET is_sold = true, team_id = ${alloc.team_id}, acquisition_value = ${alloc.amount}, season_id = ${seasonId}, round_id = ${roundId}, status = 'active', contract_id = ${cId}, contract_start_season = ${seasonId}, contract_end_season = ${cEnd}, contract_length = ${dur}, updated_at = NOW() WHERE id = ${alloc.player_id}`;
    }

    for (const bid of decryptedAll) {
      if (!winningIds.has(bid.id)) {
        await sql`UPDATE bids SET status = 'lost', updated_at = NOW() WHERE id = ${bid.id}`;
      }
    }

    await sql`UPDATE rounds SET status = 'completed', updated_at = NOW() WHERE id = ${roundId}`;

    try {
      const rRes = await sql`SELECT position FROM rounds WHERE id = ${roundId}`;
      const roundPosition = rRes[0]?.position || 'Unknown';
      const sorted = [...allocations].sort((a, b) => b.amount - a.amount);
      
      if (sorted.length > 0) {
        // Calculate stats
        const totalSpent = allocations.reduce((s, a) => s + a.amount, 0);
        const avgBid = Math.round(totalSpent / allocations.length);
        const highestBid = sorted[0];
        const lowestBid = sorted[sorted.length - 1];
        
        await triggerNews('auction_highlights', {
          season_id: seasonId,
          round_id: roundId,
          round_position: roundPosition,
          highest_bid: {
            player_name: highestBid.player_name,
            team_name: highestBid.team_name,
            amount: highestBid.amount,
          },
          lowest_bid: {
            player_name: lowestBid.player_name,
            team_name: lowestBid.team_name,
            amount: lowestBid.amount,
          },
          total_spent: totalSpent,
          average_bid: avgBid,
          players_allocated: allocations.length,
          all_allocations: sorted.map(a => ({
            player_name: a.player_name,
            team_name: a.team_name,
            amount: a.amount,
            phase: a.phase,
          })),
        });
      }
    } catch {}

    return { success: true };
  } catch (error) {
    console.error('Apply error:', error);
    return { success: false, error: 'Failed to apply' };
  }
}
