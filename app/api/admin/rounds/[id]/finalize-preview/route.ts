import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { verifyAuth } from '@/lib/auth-helper';
import { decryptBidData } from '@/lib/encryption';
import { batchGetFirebaseFields } from '@/lib/firebase/batch';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

interface BidDetail {
  id: string;
  team_id: string;
  team_name: string;
  player_id: string;
  player_name: string;
  position: string;
  amount: number;
  original_amount?: number;
  from_tiebreaker?: boolean;
}

interface AllocationStep {
  step_number: number;
  action: string;
  bid: BidDetail;
  remaining_bids_count: number;
  allocated_teams: string[];
  allocated_players: string[];
}

interface Phase {
  phase_name: string;
  description: string;
  teams_involved: string[];
  steps: AllocationStep[];
  final_allocations: {
    team_name: string;
    player_name: string;
    amount: number;
    phase: string;
  }[];
}

/**
 * GET /api/admin/rounds/[id]/finalize-preview
 * Returns detailed step-by-step preview of round finalization
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ✅ ZERO FIREBASE READS - Uses JWT claims only
    const auth = await verifyAuth(['admin', 'committee_admin'], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: roundId } = await params;

    // Get round details
    const roundResult = await sql`
      SELECT id, position, max_bids_per_team, status, season_id
      FROM rounds WHERE id = ${roundId}
    `;

    if (roundResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Round not found' },
        { status: 404 }
      );
    }

    const round = roundResult[0];
    const requiredBids = round.max_bids_per_team;

    // Check for resolved tiebreakers
    const resolvedTiebreakers = await sql`
      SELECT t.id, t.player_id, t.winning_team_id, t.winning_amount
      FROM tiebreakers t
      WHERE t.round_id = ${roundId} AND t.status = 'resolved'
    `;

    const tiebreakerReplacements = new Map<string, number>();
    for (const tb of resolvedTiebreakers) {
      const key = `${tb.player_id}_${tb.winning_team_id}`;
      tiebreakerReplacements.set(key, tb.winning_amount);
    }

    // Get all active bids
    const bidsResult = await sql`
      SELECT b.id, b.team_id, b.encrypted_bid_data, b.round_id
      FROM bids b
      WHERE b.round_id = ${roundId} AND b.status = 'active'
    `;

    console.time('⚡ Decrypt bids and collect player IDs');
    
    // Step 1: Decrypt all bids and collect unique player IDs
    const decryptedBidsData: Array<{
      id: string;
      team_id: string;
      player_id: string;
      amount: number;
      original_amount?: number;
      from_tiebreaker: boolean;
    }> = [];
    
    const playerIds = new Set<string>();
    
    for (const bid of bidsResult) {
      try {
        const { player_id, amount } = decryptBidData(bid.encrypted_bid_data);
        
        const replacementKey = `${player_id}_${bid.team_id}`;
        const originalAmount = amount;
        const finalAmount = tiebreakerReplacements.get(replacementKey) || amount;
        
        playerIds.add(player_id);
        
        decryptedBidsData.push({
          id: bid.id,
          team_id: bid.team_id,
          player_id: player_id,
          amount: finalAmount,
          original_amount: originalAmount !== finalAmount ? originalAmount : undefined,
          from_tiebreaker: tiebreakerReplacements.has(replacementKey),
        });
      } catch (error) {
        console.error(`Failed to decrypt bid ${bid.id}:`, error);
      }
    }
    
    console.timeEnd('⚡ Decrypt bids and collect player IDs');
    
    console.time('⚡ Batch fetch player data');
    
    // Step 2: Batch fetch all player data in one query
    const playerIdsArray = Array.from(playerIds);
    let playersData: any[] = [];
    
    if (playerIdsArray.length > 0) {
      playersData = await sql`
        SELECT id, name, position 
        FROM footballplayers 
        WHERE id = ANY(${playerIdsArray})
      `;
    }
    
    const playersMap = new Map<string, { name: string; position: string }>();
    playersData.forEach(player => {
      playersMap.set(player.id, { name: player.name, position: player.position });
    });
    
    console.timeEnd('⚡ Batch fetch player data');
    
    // Step 3: Combine decrypted bids with player data
    const decryptedBids: BidDetail[] = decryptedBidsData.map(bid => {
      const player = playersMap.get(bid.player_id);
      return {
        ...bid,
        team_name: '', // Will be filled later
        player_name: player?.name || 'Unknown',
        position: player?.position || '',
      };
    });

    // Fetch team names - OPTIMIZED with batch Firebase queries
    console.time('⚡ Batch fetch team names');
    
    const uniqueTeamIds = [...new Set(decryptedBids.map(b => b.team_id))];
    const teamNamesMap = new Map<string, string>();
    
    // Batch fetch team_seasons
    const teamSeasonIds = uniqueTeamIds.map(teamId => `${teamId}_${round.season_id}`);
    const teamSeasonsMap = await batchGetFirebaseFields<{ team_name: string }>(
      'team_seasons',
      teamSeasonIds,
      ['team_name']
    );
    
    // Map team_season data to team IDs
    const teamsWithoutSeasonData: string[] = [];
    uniqueTeamIds.forEach(teamId => {
      const tsId = `${teamId}_${round.season_id}`;
      const tsData = teamSeasonsMap.get(tsId);
      if (tsData?.team_name) {
        teamNamesMap.set(teamId, tsData.team_name);
      } else {
        teamsWithoutSeasonData.push(teamId);
      }
    });
    
    // Fallback: Batch fetch from users collection for teams without season data
    if (teamsWithoutSeasonData.length > 0) {
      const usersMap = await batchGetFirebaseFields<{ teamName: string }>(
        'users',
        teamsWithoutSeasonData,
        ['teamName']
      );
      
      teamsWithoutSeasonData.forEach(teamId => {
        const userData = usersMap.get(teamId);
        teamNamesMap.set(teamId, userData?.teamName || teamId);
      });
    }
    
    console.timeEnd('⚡ Batch fetch team names');

    // Add team names to bids
    for (const bid of decryptedBids) {
      bid.team_name = teamNamesMap.get(bid.team_id) || bid.team_id;
    }

    // Count bids per team
    const teamBidCounts = new Map<string, number>();
    for (const bid of decryptedBids) {
      teamBidCounts.set(bid.team_id, (teamBidCounts.get(bid.team_id) || 0) + 1);
    }

    // Separate teams
    const completeTeams = new Set<string>();
    const incompleteTeams = new Set<string>();

    for (const [teamId, count] of teamBidCounts.entries()) {
      if (count === requiredBids) {
        completeTeams.add(teamId);
      } else if (count < requiredBids) {
        incompleteTeams.add(teamId);
      }
    }

    // PHASE 1: Complete Teams Allocation
    const phase1Steps: AllocationStep[] = [];
    const phase1Allocations: any[] = [];
    const allocatedPlayers = new Set<string>();
    const allocatedTeams = new Set<string>();

    let activeBids = decryptedBids
      .filter(bid => completeTeams.has(bid.team_id))
      .map(b => ({ ...b }));

    let stepNumber = 1;

    while (activeBids.length > 0 && allocatedTeams.size < completeTeams.size) {
      // Sort by amount DESC
      activeBids.sort((a, b) => b.amount - a.amount);

      const topBid = activeBids[0];

      // Check for ties
      const tiedBids = activeBids.filter(bid => 
        bid.amount === topBid.amount && bid.player_id === topBid.player_id
      );

      if (tiedBids.length > 1) {
        // Tie detected
        phase1Steps.push({
          step_number: stepNumber,
          action: `⚠️ TIE DETECTED: ${tiedBids.length} teams bid £${topBid.amount.toLocaleString()} for ${topBid.player_name}`,
          bid: topBid,
          remaining_bids_count: activeBids.length,
          allocated_teams: Array.from(allocatedTeams),
          allocated_players: Array.from(allocatedPlayers),
        });

        return NextResponse.json({
          success: false,
          tieDetected: true,
          phases: [{
            phase_name: 'Phase 1: Complete Teams',
            description: 'Allocating players to teams with correct number of bids',
            teams_involved: Array.from(completeTeams).map(id => teamNamesMap.get(id) || id),
            steps: phase1Steps,
            final_allocations: phase1Allocations,
          }],
          tiedBids: tiedBids.map(b => ({
            team_name: b.team_name,
            player_name: b.player_name,
            amount: b.amount,
          })),
          message: 'Tiebreaker required',
        });
      }

      // Allocate
      phase1Steps.push({
        step_number: stepNumber,
        action: `✅ Allocate ${topBid.player_name} to ${topBid.team_name} for £${topBid.amount.toLocaleString()}${topBid.from_tiebreaker ? ' (from tiebreaker)' : ''}`,
        bid: topBid,
        remaining_bids_count: activeBids.length - 1,
        allocated_teams: [...Array.from(allocatedTeams), topBid.team_id],
        allocated_players: [...Array.from(allocatedPlayers), topBid.player_id],
      });

      phase1Allocations.push({
        team_name: topBid.team_name,
        player_name: topBid.player_name,
        amount: topBid.amount,
        phase: 'regular',
      });

      allocatedPlayers.add(topBid.player_id);
      allocatedTeams.add(topBid.team_id);

      // Remove allocated player and team
      activeBids = activeBids.filter(
        bid => bid.player_id !== topBid.player_id && bid.team_id !== topBid.team_id
      );

      stepNumber++;
    }

    // PHASE 2: Incomplete Teams
    const phase2Steps: AllocationStep[] = [];
    const phase2Allocations: any[] = [];

    if (incompleteTeams.size > 0) {
      const averageAmount = phase1Allocations.length > 0
        ? Math.round(phase1Allocations.reduce((sum, a) => sum + a.amount, 0) / phase1Allocations.length)
        : 1000;

      stepNumber = 1;

      for (const teamId of incompleteTeams) {
        if (allocatedTeams.has(teamId)) continue;

        const teamBids = decryptedBids
          .filter(bid => bid.team_id === teamId && !allocatedPlayers.has(bid.player_id))
          .sort((a, b) => b.amount - a.amount);

        if (teamBids.length > 0) {
          const topBid = teamBids[0];

          phase2Steps.push({
            step_number: stepNumber,
            action: `📊 Allocate ${topBid.player_name} to ${topBid.team_name} at average £${averageAmount.toLocaleString()} (team had incomplete bids)`,
            bid: { ...topBid, amount: averageAmount },
            remaining_bids_count: teamBids.length - 1,
            allocated_teams: [...Array.from(allocatedTeams), teamId],
            allocated_players: [...Array.from(allocatedPlayers), topBid.player_id],
          });

          phase2Allocations.push({
            team_name: topBid.team_name,
            player_name: topBid.player_name,
            amount: averageAmount,
            phase: 'incomplete',
          });

          allocatedPlayers.add(topBid.player_id);
          allocatedTeams.add(teamId);
          stepNumber++;
        }
      }
    }

    // Build response
    const phases: Phase[] = [
      {
        phase_name: 'Phase 1: Complete Teams',
        description: `Allocating to ${completeTeams.size} teams with ${requiredBids} bids each`,
        teams_involved: Array.from(completeTeams).map(id => teamNamesMap.get(id) || id),
        steps: phase1Steps,
        final_allocations: phase1Allocations,
      },
    ];

    if (incompleteTeams.size > 0) {
      phases.push({
        phase_name: 'Phase 2: Incomplete Teams',
        description: `Allocating to ${incompleteTeams.size} teams with fewer than ${requiredBids} bids (charged average price)`,
        teams_involved: Array.from(incompleteTeams).map(id => teamNamesMap.get(id) || id),
        steps: phase2Steps,
        final_allocations: phase2Allocations,
      });
    }

    return NextResponse.json({
      success: true,
      phases,
      summary: {
        total_allocations: phase1Allocations.length + phase2Allocations.length,
        complete_teams: completeTeams.size,
        incomplete_teams: incompleteTeams.size,
        average_price: phase1Allocations.length > 0
          ? Math.round(phase1Allocations.reduce((sum: number, a: any) => sum + a.amount, 0) / phase1Allocations.length)
          : 0,
      },
      tiebreaker_info: {
        resolved_count: resolvedTiebreakers.length,
        resolved_tiebreakers: resolvedTiebreakers.map((tb: any) => ({
          player_id: tb.player_id,
          winning_team: teamNamesMap.get(tb.winning_team_id),
          winning_amount: tb.winning_amount,
        })),
      },
    });
  } catch (error) {
    console.error('Error generating finalization preview:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
