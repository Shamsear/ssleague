/**
 * Budget Reserve Calculator
 * 
 * Three-Phase System:
 * - Phase 1: Strict reserve (cumulative for all future phases)
 * - Phase 2: Soft reserve with floor enforcement
 * - Phase 3: Flexible (minimum £10 per player)
 */

import { neon } from '@neondatabase/serverless';
import { adminDb } from './firebase/admin';
import { getAuctionSettings } from './auction-settings';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

export interface ReserveConfig {
  phase_1_end_round: number;       // Last round of Phase 1 (e.g., 18)
  phase_1_min_balance: number;     // Min balance per round in Phase 1 (e.g., 30)
  phase_2_end_round: number;       // Last round of Phase 2 (e.g., 20)
  phase_2_min_balance: number;     // Min balance per round in Phase 2 (e.g., 30)
  phase_3_min_balance: number;     // Min balance per slot in Phase 3 (e.g., 10)
  max_squad_size: number;          // Total squad size (e.g., 25)
}

export interface ReserveInfo {
  reserve: number;                 // Total recommended reserve
  floorReserve: number;            // Minimum floor reserve (strictly enforced)
  maxBid: number;                  // Maximum bid allowed (balance - floor)
  maxRecommendedBid: number;       // Recommended max bid (balance - reserve)
  phase: 'phase_1' | 'phase_2' | 'phase_3';
  enforceStrict: boolean;          // Whether to strictly enforce reserve
  allowSkip: boolean;              // Whether team can skip round if broke
  minimumToParticipate: number;    // Minimum balance needed to participate
  calculation: string;             // Human-readable calculation explanation
  breakdown: {
    phase1Reserve?: number;
    phase2Reserve?: number;
    phase3Reserve?: number;
  };
}

/**
 * Calculate budget reserve for a team in a given round (Core function)
 */
export function calculateReserveCore(
  currentRoundNumber: number,
  teamBalance: number,
  teamSquadSize: number,
  config: ReserveConfig
): ReserveInfo {
  
  // Determine current phase
  let phase: 'phase_1' | 'phase_2' | 'phase_3';
  if (currentRoundNumber <= config.phase_1_end_round) {
    phase = 'phase_1';
  } else if (currentRoundNumber <= config.phase_2_end_round) {
    phase = 'phase_2';
  } else {
    phase = 'phase_3';
  }

  const emptySlots = config.max_squad_size - teamSquadSize;

  // ===== PHASE 1: STRICT RESERVE =====
  if (phase === 'phase_1') {
    // Reserve for: Phase 1 remaining + Phase 2 full + Phase 3 slots
    // Calculate based on EXPECTED rounds, not created rounds
    
    const phase1Remaining = Math.max(0, config.phase_1_end_round - currentRoundNumber);
    const phase2Full = Math.max(0, config.phase_2_end_round - config.phase_1_end_round);
    
    // Calculate slots remaining after all Phase 1 & 2 rounds
    // Must include current round's player (team will get 1 player this round)
    const playersAfterPhase2 = teamSquadSize + 1 + phase1Remaining + phase2Full;
    const slotsAfterPhase2 = Math.max(0, config.max_squad_size - playersAfterPhase2);
    
    const phase1Reserve = phase1Remaining * config.phase_1_min_balance;
    const phase2Reserve = phase2Full * config.phase_2_min_balance;
    const phase3Reserve = slotsAfterPhase2 * config.phase_3_min_balance;
    
    const totalReserve = phase1Reserve + phase2Reserve + phase3Reserve;
    
    return {
      reserve: totalReserve,
      floorReserve: totalReserve,
      maxBid: Math.max(0, teamBalance - totalReserve),
      maxRecommendedBid: Math.max(0, teamBalance - totalReserve),
      phase: 'phase_1',
      enforceStrict: true,
      allowSkip: false,
      minimumToParticipate: config.phase_1_min_balance,
      calculation: `Phase 1: ${phase1Remaining}×£${config.phase_1_min_balance} + Phase 2: ${phase2Full}×£${config.phase_2_min_balance} + Phase 3: ${slotsAfterPhase2}×£${config.phase_3_min_balance} = £${totalReserve}`,
      breakdown: {
        phase1Reserve,
        phase2Reserve,
        phase3Reserve,
      },
    };
  }

  // ===== PHASE 2: SOFT RESERVE WITH FLOOR =====
  if (phase === 'phase_2') {
    // SKIPPABLE: Team only needs £30 to participate
    // Floor: Must maintain Phase 3 reserve assuming team MIGHT skip remaining Phase 2 rounds
    // Recommended: Phase 2 remaining + Phase 3 slots
    // Calculate based on EXPECTED rounds, not created rounds
    
    const phase2Remaining = Math.max(0, config.phase_2_end_round - currentRoundNumber);
    
    // Floor calculation: Assume team gets player THIS round only, then skips rest of Phase 2
    const playersAfterThisRound = teamSquadSize + 1;
    const slotsAfterThisRound = Math.max(0, config.max_squad_size - playersAfterThisRound);
    const phase3Floor = slotsAfterThisRound * config.phase_3_min_balance;
    
    // Recommended: Assume team completes all Phase 2 rounds
    const playersAfterPhase2 = teamSquadSize + phase2Remaining + 1; // +1 for current round
    const slotsAfterPhase2 = Math.max(0, config.max_squad_size - playersAfterPhase2);
    const phase2Reserve = phase2Remaining * config.phase_2_min_balance;
    const recommendedPhase3Reserve = slotsAfterPhase2 * config.phase_3_min_balance;
    const recommendedReserve = phase2Reserve + recommendedPhase3Reserve;
    
    return {
      reserve: recommendedReserve,
      floorReserve: phase3Floor, // Strictly enforced - worst case (skip remaining Phase 2)
      maxBid: Math.max(0, teamBalance - phase3Floor),
      maxRecommendedBid: Math.max(0, teamBalance - recommendedReserve),
      phase: 'phase_2',
      enforceStrict: false, // Only floor enforced, not full reserve
      allowSkip: true,
      minimumToParticipate: config.phase_2_min_balance,
      calculation: `Recommended: ${phase2Remaining}×£${config.phase_2_min_balance} + ${slotsAfterPhase2}×£${config.phase_3_min_balance} = £${recommendedReserve} | Floor: £${phase3Floor} (worst case: ${slotsAfterThisRound} slots if skip rest)`,
      breakdown: {
        phase2Reserve,
        phase3Reserve: recommendedPhase3Reserve,
      },
    };
  }

  // ===== PHASE 3: FLEXIBLE FLOOR =====
  // SKIPPABLE: Team only needs £10 to participate
  // No reserve needed (final phase)
  
  return {
    reserve: 0,
    floorReserve: 0,
    maxBid: teamBalance,
    maxRecommendedBid: teamBalance,
    phase: 'phase_3',
    enforceStrict: false,
    allowSkip: true,
    minimumToParticipate: config.phase_3_min_balance,
    calculation: `Phase 3: No reserve (final phase), minimum £${config.phase_3_min_balance} per player`,
    breakdown: {},
  };
}

/**
 * Check if team can participate in a round
 */
export function canParticipateInRound(
  teamBalance: number,
  reserveInfo: ReserveInfo
): { canParticipate: boolean; reason?: string } {
  if (teamBalance < reserveInfo.minimumToParticipate) {
    if (reserveInfo.allowSkip) {
      return {
        canParticipate: false,
        reason: `Insufficient balance (£${teamBalance}). Round is skippable - you'll be assigned a random player for £${reserveInfo.minimumToParticipate}.`,
      };
    } else {
      return {
        canParticipate: false,
        reason: `Insufficient balance (£${teamBalance}). You need at least £${reserveInfo.minimumToParticipate} to participate in this round.`,
      };
    }
  }
  
  return { canParticipate: true };
}

/**
 * Validate if a bid amount is allowed
 */
export function validateBidAmount(
  bidAmount: number,
  teamBalance: number,
  reserveInfo: ReserveInfo
): { valid: boolean; error?: string; warning?: string } {
  
  // Check minimum bid
  if (bidAmount < 10) {
    return { valid: false, error: 'Minimum bid is £10' };
  }
  
  // Check basic balance
  if (bidAmount > teamBalance) {
    return { valid: false, error: 'Bid exceeds team balance' };
  }
  
  // Phase 1: Strict enforcement
  if (reserveInfo.phase === 'phase_1' && bidAmount > reserveInfo.maxBid) {
    return {
      valid: false,
      error: `Bid exceeds maximum allowed (£${reserveInfo.maxBid}). ${reserveInfo.calculation}`,
    };
  }
  
  // Phase 2: Floor enforcement + warning
  if (reserveInfo.phase === 'phase_2') {
    if (bidAmount > reserveInfo.maxBid) {
      return {
        valid: false,
        error: `Bid violates Phase 3 floor reserve. Maximum allowed: £${reserveInfo.maxBid} (must maintain £${reserveInfo.floorReserve} for remaining slots)`,
      };
    }
    
    if (bidAmount > reserveInfo.maxRecommendedBid) {
      return {
        valid: true,
        warning: `⚠️ Bid exceeds recommended limit (£${reserveInfo.maxRecommendedBid}). You may not have enough for upcoming Phase 2 rounds.`,
      };
    }
  }
  
  // Phase 3: Minimum only
  if (reserveInfo.phase === 'phase_3' && bidAmount < reserveInfo.minimumToParticipate) {
    return {
      valid: false,
      error: `Minimum bid in Phase 3 is £${reserveInfo.minimumToParticipate}`,
    };
  }
  
  return { valid: true };
}

/**
 * Async wrapper: Calculate reserve for a specific team and round
 * Fetches all necessary data from database
 */
export async function calculateReserve(
  teamId: string,
  roundId: string,
  seasonId: string
): Promise<{
  requiresReserve: boolean;
  minimumReserve: number;
  explanation: string;
  phase: 'phase_1' | 'phase_2' | 'phase_3';
}> {
  try {
    // Fetch round info with auction settings
    const roundResult = await sql`
      SELECT 
        r.round_number,
        r.season_id,
        r.auction_settings_id,
        a.phase_1_end_round,
        a.phase_1_min_balance,
        a.phase_2_end_round,
        a.phase_2_min_balance,
        a.phase_3_min_balance,
        a.max_squad_size
      FROM rounds r
      LEFT JOIN auction_settings a ON r.auction_settings_id = a.id
      WHERE r.id = ${roundId}
    `;
    
    if (roundResult.length === 0) {
      throw new Error('Round not found');
    }
    
    const round = roundResult[0];
    const currentRoundNumber = round.round_number;
    console.log(`🔍 [Reserve Calculator] Round ${roundId}: round_number = ${currentRoundNumber}, auction_settings_id = ${round.auction_settings_id}`);
    
    // Check if auction settings exist
    if (!round.auction_settings_id || !round.phase_1_end_round) {
      console.warn(`⚠️ [Reserve Calculator] Round ${roundId} has no auction_settings_id, falling back to season settings`);
      // Fallback to old method for backward compatibility
      const settings = await getAuctionSettings(round.season_id || seasonId);
      const reserveInfo = calculateReserveCore(
        currentRoundNumber,
        0, // Will be filled from team data below
        0,
        {
          phase_1_end_round: settings.phase_1_end_round,
          phase_1_min_balance: settings.phase_1_min_balance,
          phase_2_end_round: settings.phase_2_end_round,
          phase_2_min_balance: settings.phase_2_min_balance,
          phase_3_min_balance: settings.phase_3_min_balance,
          max_squad_size: settings.max_squad_size,
        }
      );
    }
    
    // Fetch team data from Firebase
    const teamSeasonDoc = await adminDb.collection('team_seasons').doc(`${teamId}_${round.season_id || seasonId}`).get();
    
    if (!teamSeasonDoc.exists) {
      throw new Error('Team season data not found');
    }
    
    const teamData = teamSeasonDoc.data();
    const currencySystem = teamData?.currency_system || 'single';
    const teamBalance = currencySystem === 'dual' 
      ? (teamData?.football_budget || 0) 
      : (teamData?.budget || 0);
    const teamSquadSize = teamData?.players_count || 0;
    
    // Use auction settings from round
    const settings = {
      phase_1_end_round: round.phase_1_end_round,
      phase_1_min_balance: round.phase_1_min_balance,
      phase_2_end_round: round.phase_2_end_round,
      phase_2_min_balance: round.phase_2_min_balance,
      phase_3_min_balance: round.phase_3_min_balance,
      max_squad_size: round.max_squad_size,
    };
    
    // Calculate reserve using core function
    console.log(`🔍 [Reserve Calculator] Input: currentRound=${currentRoundNumber}, balance=${teamBalance}, squadSize=${teamSquadSize}`);
    console.log(`🔍 [Reserve Calculator] Settings: phase1End=${settings.phase_1_end_round}, phase2End=${settings.phase_2_end_round}, maxSquad=${settings.max_squad_size}`);
    
    const reserveInfo = calculateReserveCore(
      currentRoundNumber,
      teamBalance,
      teamSquadSize,
      settings
    );
    
    console.log(`🔍 [Reserve Calculator] Result: phase=${reserveInfo.phase}, reserve=${reserveInfo.floorReserve}, explanation="${reserveInfo.calculation}"`);
    
    return {
      requiresReserve: reserveInfo.enforceStrict,
      minimumReserve: reserveInfo.floorReserve,
      explanation: reserveInfo.calculation,
      phase: reserveInfo.phase,
    };
  } catch (error) {
    console.error('Reserve calculation error:', error);
    // Return safe defaults if calculation fails
    return {
      requiresReserve: false,
      minimumReserve: 0,
      explanation: 'Reserve calculation unavailable',
      phase: 'phase_3',
    };
  }
}
