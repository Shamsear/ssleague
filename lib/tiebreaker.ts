import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

interface TiedBid {
  id: string;
  team_id: string;
  team_name: string;
  player_id: string;
  player_name: string;
  amount: number;
  round_id: string;
}

interface TiebreakerResult {
  success: boolean;
  tiebreakerId?: string;
  error?: string;
}

/**
 * Creates a tiebreaker record when multiple bids are tied
 */
export async function createTiebreaker(
  roundId: string,
  playerId: string,
  tiedBids: TiedBid[]
): Promise<TiebreakerResult> {
  try {
    if (tiedBids.length < 2) {
      return {
        success: false,
        error: 'At least 2 tied bids are required to create a tiebreaker',
      };
    }

    const originalAmount = tiedBids[0].amount;

    // Create tiebreaker record (no time limit)
    const tiebreakerResult = await sql`
      INSERT INTO tiebreakers (
        round_id,
        player_id,
        original_amount,
        status,
        duration_minutes
      ) VALUES (
        ${roundId},
        ${playerId},
        ${originalAmount},
        'active',
        NULL
      )
      RETURNING id
    `;

    const tiebreakerId = tiebreakerResult[0].id;

    // Create team_tiebreaker records for each tied team
    for (const bid of tiedBids) {
      await sql`
        INSERT INTO team_tiebreakers (
          tiebreaker_id,
          team_id,
          original_bid_id,
          submitted
        ) VALUES (
          ${tiebreakerId},
          ${bid.team_id},
          ${bid.id},
          false
        )
      `;
    }

    console.log(`✅ Tiebreaker created: ${tiebreakerId} for player ${playerId}`);

    return {
      success: true,
      tiebreakerId: tiebreakerId,
    };
  } catch (error) {
    console.error('Error creating tiebreaker:', error);
    return {
      success: false,
      error: 'Failed to create tiebreaker',
    };
  }
}

/**
 * Check if a tiebreaker has expired (past duration time)
 * Note: Tiebreakers no longer have time limits (duration_minutes is NULL)
 */
export async function isTiebreakerExpired(tiebreakerId: string): Promise<boolean> {
  try {
    const result = await sql`
      SELECT 
        created_at,
        duration_minutes
      FROM tiebreakers
      WHERE id = ${tiebreakerId}
      AND status = 'active'
    `;

    if (result.length === 0) return false;

    const { duration_minutes } = result[0];
    
    // If duration_minutes is NULL, tiebreaker never expires
    if (duration_minutes === null) return false;
    
    // Legacy support: if duration_minutes exists, check expiration
    const { created_at } = result[0];
    const createdTime = new Date(created_at).getTime();
    const now = Date.now();
    const expirationTime = createdTime + duration_minutes * 60 * 1000;

    return now >= expirationTime;
  } catch (error) {
    console.error('Error checking tiebreaker expiration:', error);
    return false;
  }
}

/**
 * Check if all teams have submitted their bids for a tiebreaker
 */
export async function allTeamsSubmitted(tiebreakerId: string): Promise<boolean> {
  try {
    const result = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE submitted = true) as submitted_count
      FROM team_tiebreakers
      WHERE tiebreaker_id = ${tiebreakerId}
    `;

    if (result.length === 0) return false;

    const { total, submitted_count } = result[0];
    return parseInt(total) === parseInt(submitted_count);
  } catch (error) {
    console.error('Error checking team submissions:', error);
    return false;
  }
}

/**
 * Get active tiebreaker for a team (if any)
 */
export async function getActiveTiebreakerForTeam(
  teamId: string
): Promise<string | null> {
  try {
    const result = await sql`
      SELECT t.id
      FROM tiebreakers t
      INNER JOIN team_tiebreakers tt ON t.id = tt.tiebreaker_id
      WHERE tt.team_id = ${teamId}
      AND t.status = 'active'
      ORDER BY t.created_at DESC
      LIMIT 1
    `;

    return result.length > 0 ? result[0].id : null;
  } catch (error) {
    console.error('Error getting active tiebreaker for team:', error);
    return null;
  }
}

/**
 * Check if a tiebreaker should be auto-resolved
 * Note: Tiebreakers no longer expire, only resolve when all teams submit
 */
export async function shouldAutoResolve(tiebreakerId: string): Promise<boolean> {
  const allSubmitted = await allTeamsSubmitted(tiebreakerId);
  
  return allSubmitted;
}

interface ResolutionResult {
  success: boolean;
  data?: {
    winningTeamId?: string;
    winningAmount?: number;
    status: string;
    newTiebreakerId?: string;
  };
  error?: string;
}

/**
 * Resolve a tiebreaker based on submitted bids or exclude it
 * @param tiebreakerId - The tiebreaker ID to resolve
 * @param resolutionType - 'auto' to pick highest bid, 'exclude' to exclude from allocation
 */
export async function resolveTiebreaker(
  tiebreakerId: string,
  resolutionType: 'auto' | 'exclude'
): Promise<ResolutionResult> {
  try {
    // Get tiebreaker details
    const tiebreakerResult = await sql`
      SELECT * FROM tiebreakers WHERE id = ${tiebreakerId}
    `;

    if (tiebreakerResult.length === 0) {
      return {
        success: false,
        error: 'Tiebreaker not found',
      };
    }

    const tiebreaker = tiebreakerResult[0];

    if (tiebreaker.status !== 'active') {
      return {
        success: false,
        error: 'Tiebreaker is not active',
      };
    }

    if (resolutionType === 'exclude') {
      // Mark as excluded - no winner
      await sql`
        UPDATE tiebreakers
        SET 
          status = 'excluded',
          resolved_at = NOW()
        WHERE id = ${tiebreakerId}
      `;

      console.log(`✅ Tiebreaker ${tiebreakerId} excluded from allocation`);

      return {
        success: true,
        data: {
          status: 'excluded',
        },
      };
    }

    // Auto resolution - find highest new bid
    const teamBidsResult = await sql`
      SELECT 
        tt.*,
        b.team_id
      FROM team_tiebreakers tt
      INNER JOIN bids b ON tt.original_bid_id = b.id
      WHERE tt.tiebreaker_id = ${tiebreakerId}
      AND tt.submitted = true
      AND tt.new_bid_amount IS NOT NULL
      ORDER BY tt.new_bid_amount DESC
    `;

    if (teamBidsResult.length === 0) {
      // No one submitted - mark as excluded
      await sql`
        UPDATE tiebreakers
        SET 
          status = 'excluded',
          resolved_at = NOW()
        WHERE id = ${tiebreakerId}
      `;

      console.log(`⚠️ Tiebreaker ${tiebreakerId} excluded - no submissions`);

      return {
        success: true,
        data: {
          status: 'excluded',
        },
      };
    }

    const winningBid = teamBidsResult[0];

    // Check for another tie in new bids
    const tiedNewBids = teamBidsResult.filter(
      (bid) => bid.new_bid_amount === winningBid.new_bid_amount
    );

    if (tiedNewBids.length > 1) {
      // Another tie - create a new tiebreaker!
      console.log(`⚠️ Tiebreaker ${tiebreakerId} resulted in another tie - creating new tiebreaker`);
      
      // Mark current tiebreaker as resolved (tied again)
      await sql`
        UPDATE tiebreakers
        SET 
          status = 'tied_again',
          resolved_at = NOW()
        WHERE id = ${tiebreakerId}
      `;
      
      // Prepare tied bids for new tiebreaker
      const newTiedBids = tiedNewBids.map((bid: any) => ({
        id: bid.original_bid_id,
        team_id: bid.team_id,
        team_name: '', // Will be fetched if needed
        player_id: tiebreaker.player_id,
        player_name: '',
        amount: bid.new_bid_amount,
        round_id: tiebreaker.round_id,
      }));
      
      // Create new tiebreaker
      const newTiebreakerResult = await createTiebreaker(
        tiebreaker.round_id,
        tiebreaker.player_id,
        newTiedBids
      );
      
      if (newTiebreakerResult.success) {
        console.log(`✅ New tiebreaker created: ${newTiebreakerResult.tiebreakerId}`);
        return {
          success: true,
          data: {
            status: 'tied_again',
            newTiebreakerId: newTiebreakerResult.tiebreakerId,
          },
        };
      } else {
        console.error('Failed to create new tiebreaker');
        return {
          success: false,
          error: 'Another tie detected but failed to create new tiebreaker',
        };
      }
    }

    // Mark as resolved with winner
    await sql`
      UPDATE tiebreakers
      SET 
        status = 'resolved',
        winning_team_id = ${winningBid.team_id},
        winning_amount = ${winningBid.new_bid_amount},
        resolved_at = NOW()
      WHERE id = ${tiebreakerId}
    `;

    console.log(
      `✅ Tiebreaker ${tiebreakerId} resolved - Winner: Team ${winningBid.team_id}, Amount: £${winningBid.new_bid_amount}`
    );

    return {
      success: true,
      data: {
        winningTeamId: winningBid.team_id,
        winningAmount: winningBid.new_bid_amount,
        status: 'resolved',
      },
    };
  } catch (error) {
    console.error('Error resolving tiebreaker:', error);
    return {
      success: false,
      error: 'Failed to resolve tiebreaker',
    };
  }
}
