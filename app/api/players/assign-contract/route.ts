import { NextRequest, NextResponse } from 'next/server';
import { assignRealPlayerWithContract } from '@/lib/firebase/multiSeasonPlayers';
import { getTeamBalances } from '@/lib/firebase/multiSeasonTeams';
import { calculateRealPlayerSalary } from '@/lib/contracts';
import { sendNotification } from '@/lib/notifications/send-notification';

/**
 * POST /api/players/assign-contract
 * 
 * Assign a real player to a team with a contract (from WhatsApp auction)
 * For multi-season systems (Season 16+)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { playerId, teamId, starRating, auctionValue, startSeasonId } = body;
    
    // Validation
    if (!playerId || !teamId || !starRating || !auctionValue || !startSeasonId) {
      return NextResponse.json(
        { error: 'Missing required fields: playerId, teamId, starRating, auctionValue, startSeasonId' },
        { status: 400 }
      );
    }
    
    // Validate star rating
    if (starRating < 3 || starRating > 10) {
      return NextResponse.json(
        { error: 'Star rating must be between 3 and 10' },
        { status: 400 }
      );
    }
    
    // Validate auction value
    if (auctionValue <= 0) {
      return NextResponse.json(
        { error: 'Auction value must be greater than 0' },
        { status: 400 }
      );
    }
    
    // Check team balances before assignment
    const balances = await getTeamBalances(teamId);
    
    if (balances.dollar_balance < auctionValue) {
      return NextResponse.json(
        { 
          error: 'Insufficient dollar balance',
          current_balance: balances.dollar_balance,
          required: auctionValue,
          shortfall: auctionValue - balances.dollar_balance
        },
        { status: 400 }
      );
    }
    
    // Calculate salary for preview
    const salaryPerMatch = calculateRealPlayerSalary(auctionValue, starRating);
    
    // Assign player with contract
    await assignRealPlayerWithContract({
      playerId,
      teamId,
      starRating,
      auctionValue,
      startSeasonId,
    });
    
    // Get updated balances
    const updatedBalances = await getTeamBalances(teamId);
    
    // Send FCM notification to the team
    try {
      await sendNotification(
        {
          title: '⭐ Player Assigned',
          body: `Real player assigned with contract! $${auctionValue} deducted. Salary: $${salaryPerMatch}/match`,
          url: `/dashboard/team`,
          icon: '/logo.png',
          data: {
            type: 'player_assigned',
            player_id: playerId,
            star_rating: starRating.toString(),
            auction_value: auctionValue.toString(),
            salary_per_match: salaryPerMatch.toString(),
            contract_start: startSeasonId,
          }
        },
        teamId
      );
    } catch (notifError) {
      console.error('Failed to send player assignment notification:', notifError);
      // Don't fail the request
    }
    
    return NextResponse.json({
      success: true,
      message: 'Player assigned successfully',
      player: {
        playerId,
        teamId,
        starRating,
        auctionValue,
        salaryPerMatch,
        contractStart: startSeasonId,
        contractEnd: (parseInt(startSeasonId) + 1).toString(),
      },
      balances: {
        previous: balances,
        current: updatedBalances,
        deducted: auctionValue,
      }
    });
    
  } catch (error: any) {
    console.error('Error assigning player with contract:', error);
    return NextResponse.json(
      { 
        error: 'Failed to assign player',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/players/assign-contract?playerId=xxx&teamId=xxx
 * 
 * Preview contract assignment (check balances, calculate salary, etc.)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const teamId = searchParams.get('teamId');
    const starRating = parseInt(searchParams.get('starRating') || '0');
    const auctionValue = parseFloat(searchParams.get('auctionValue') || '0');
    
    if (!teamId) {
      return NextResponse.json(
        { error: 'Missing teamId parameter' },
        { status: 400 }
      );
    }
    
    // Get team balances
    const balances = await getTeamBalances(teamId);
    
    // Calculate salary if values provided
    let salaryPreview = null;
    if (starRating >= 3 && starRating <= 10 && auctionValue > 0) {
      salaryPreview = calculateRealPlayerSalary(auctionValue, starRating);
    }
    
    // Check affordability
    const canAfford = auctionValue > 0 ? balances.dollar_balance >= auctionValue : null;
    
    return NextResponse.json({
      teamId,
      balances,
      preview: {
        starRating: starRating || null,
        auctionValue: auctionValue || null,
        salaryPerMatch: salaryPreview,
        canAfford,
        remainingBalance: auctionValue > 0 ? balances.dollar_balance - auctionValue : null,
      }
    });
    
  } catch (error: any) {
    console.error('Error previewing contract:', error);
    return NextResponse.json(
      { 
        error: 'Failed to preview contract',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
