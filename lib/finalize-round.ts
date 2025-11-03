import { neon } from '@neondatabase/serverless';
import { adminDb } from './firebase/admin';
import { decryptBidData } from './encryption';
import { createTiebreaker } from './tiebreaker';
import { getTournamentDb } from './neon/tournament-config';
import { logAuctionWin } from './transaction-logger';
import { triggerNews } from './news/trigger';

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
      SELECT id, position, max_bids_per_team, status, season_id
      FROM rounds WHERE id = ${roundId}
    `;

    if (roundResult.length === 0) {
      return { success: false, allocations: [], tieDetected: false, error: 'Round not found' };
    }

    const round = roundResult[0];
    const requiredBids = round.max_bids_per_team;

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

    // Separate complete vs incomplete teams
    const teamBidCounts = new Map<string, number>();
    bidsWithNames.forEach(bid => {
      teamBidCounts.set(bid.team_id, (teamBidCounts.get(bid.team_id) || 0) + 1);
    });

    const completeTeams = new Set<string>();
    const incompleteTeams = new Set<string>();
    teamBidCounts.forEach((count, teamId) => {
      if (count === requiredBids) completeTeams.add(teamId);
      else if (count < requiredBids) incompleteTeams.add(teamId);
    });

    console.log(`📊 ${completeTeams.size} complete, ${incompleteTeams.size} incomplete`);

    const allocations: AllocationResult[] = [];
    const allocatedPlayers = new Set<string>();
    const allocatedTeams = new Set<string>();

    // Allocate to complete teams
    let activeBids: Bid[] = bidsWithNames
      .filter(bid => completeTeams.has(bid.team_id))
      .map(bid => ({
        id: bid.id,
        team_id: bid.team_id,
        team_name: bid.team_name,
        player_id: bid.player_id,
        player_name: bid.player_name,
        amount: bid.amount,
        round_id: bid.round_id,
      }));

    while (activeBids.length > 0 && allocatedTeams.size < completeTeams.size) {
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
      activeBids = activeBids.filter(b => b.player_id !== topBid.player_id && b.team_id !== topBid.team_id);
    }

    // Handle incomplete teams
    if (incompleteTeams.size > 0) {
      const avgAmount = allocations.length > 0
        ? Math.round(allocations.reduce((sum, a) => sum + a.amount, 0) / allocations.length)
        : 1000;

      for (const teamId of incompleteTeams) {
        if (allocatedTeams.has(teamId)) continue;
        const teamBids = bidsWithNames
          .filter(b => b.team_id === teamId && !allocatedPlayers.has(b.player_id))
          .sort((a, b) => b.amount - a.amount);

        if (teamBids.length > 0) {
          const top = teamBids[0];
          allocations.push({
            team_id: top.team_id,
            team_name: top.team_name,
            player_id: top.player_id,
            player_name: top.player_name,
            amount: avgAmount,
            bid_id: top.id,
            phase: 'incomplete',
          });
          allocatedPlayers.add(top.player_id);
          allocatedTeams.add(top.team_id);
        }
      }
    }

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
      if (alloc.phase === 'incomplete') {
        const orig = decryptedAll.find(b => b.id === alloc.bid_id);
        await sql`UPDATE bids SET status = 'won', phase = 'incomplete', actual_bid_amount = ${orig?.amount || alloc.amount}, updated_at = NOW() WHERE id = ${alloc.bid_id}`;
      } else {
        await sql`UPDATE bids SET status = 'won', phase = 'regular', updated_at = NOW() WHERE id = ${alloc.bid_id}`;
      }

      await sql`INSERT INTO team_players (team_id, player_id, season_id, round_id, purchase_price, acquired_at) VALUES (${alloc.team_id}, ${alloc.player_id}, ${seasonId}, ${roundId}, ${alloc.amount}, NOW())`;

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
        await sql`UPDATE teams SET 
          football_spent = football_spent + ${alloc.amount}, 
          football_budget = football_budget - ${alloc.amount},
          football_players_count = football_players_count + 1,
          updated_at = NOW() 
        WHERE firebase_uid = ${alloc.team_id}
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
