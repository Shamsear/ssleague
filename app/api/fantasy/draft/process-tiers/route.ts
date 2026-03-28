import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-helper';
import { 
  processDraftTiers,
  generateDraftReport,
  type DraftProcessingResult 
} from '@/lib/fantasy/draft-processor';
import { sendNotification } from '@/lib/notifications/send-notification';
import { fantasySql } from '@/lib/neon/fantasy-config';

/**
 * POST /api/fantasy/draft/process-tiers
 * Committee-only endpoint to process all tier bids and assign players
 * 
 * Request Body:
 * {
 *   league_id: string;
 *   send_notifications?: boolean; // Default: true
 * }
 * 
 * Response:
 * {
 *   success: boolean;
 *   results_by_tier: Array<{
 *     tier_number: number;
 *     tier_name: string;
 *     total_bids: number;
 *     valid_bids: number;
 *     winners: number;
 *     skipped: number;
 *     failed: number;
 *     winning_bids: Array<{
 *       team_id: string;
 *       team_name: string;
 *       player_id: string;
 *       player_name: string;
 *       bid_amount: number;
 *     }>;
 *   }>;
 *   total_players_drafted: number;
 *   total_budget_spent: number;
 *   average_squad_size: number;
 *   processing_time_ms: number;
 *   notifications_sent?: number;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify committee admin authorization
    const auth = await verifyAuth(['committee_admin'], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { 
          success: false,
          error: auth.error || 'Unauthorized - Committee access required' 
        },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { league_id, tier_number, send_notifications = true } = body;

    // Validate required parameters
    if (!league_id) {
      return NextResponse.json(
        { 
          success: false,
          error: 'league_id is required' 
        },
        { status: 400 }
      );
    }

    console.log(`🎯 Processing draft tiers for league: ${league_id}`);
    console.log(`   Requested by: ${auth.userId} (${auth.role})`);
    console.log(`   Tier number: ${tier_number || 'all'}`);
    console.log(`   Send notifications: ${send_notifications}`);

    // Process draft tiers (specific tier or all)
    const result: DraftProcessingResult = await processDraftTiers(league_id, tier_number);

    if (!result.success) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Draft processing failed',
          details: result.errors?.join(', ') || 'Unknown error',
          partial_results: result.results_by_tier
        },
        { status: 500 }
      );
    }

    console.log(`✅ Draft processing complete`);
    console.log(`   Players drafted: ${result.total_players_drafted}`);
    console.log(`   Budget spent: €${result.total_budget_spent}M`);
    console.log(`   Average squad size: ${result.average_squad_size.toFixed(1)}`);

    // Send notifications to teams
    let notificationsSent = 0;
    if (send_notifications) {
      try {
        notificationsSent = await sendDraftResultsNotifications(league_id, result);
        console.log(`📬 Sent notifications to ${notificationsSent} teams`);
      } catch (notifError) {
        console.error('⚠️ Error sending notifications:', notifError);
        // Don't fail the request if notifications fail
      }
    }

    // Return processing results
    return NextResponse.json({
      success: true,
      message: `Successfully processed draft for ${result.total_players_drafted} players`,
      league_id: result.league_id,
      results_by_tier: result.results_by_tier,
      total_players_drafted: result.total_players_drafted,
      total_budget_spent: result.total_budget_spent,
      average_squad_size: result.average_squad_size,
      processing_time_ms: result.processing_time_ms,
      notifications_sent: notificationsSent
    });

  } catch (error) {
    console.error('❌ Error processing draft:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to process draft',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Send notifications to all teams about draft results
 */
async function sendDraftResultsNotifications(
  leagueId: string,
  result: DraftProcessingResult
): Promise<number> {
  try {
    // Get all teams in the league with their owner UIDs
    const teams = await fantasySql<Array<{
      team_id: string;
      team_name: string;
      owner_uid: string;
      squad_size: number;
      budget_remaining: number;
    }>>`
      SELECT 
        team_id, 
        team_name, 
        owner_uid,
        squad_size,
        budget_remaining
      FROM fantasy_teams
      WHERE league_id = ${leagueId}
    `;

    if (teams.length === 0) {
      console.log('⚠️ No teams found for notifications');
      return 0;
    }

    console.log(`📤 Sending draft results to ${teams.length} teams...`);

    // Send individual notifications to each team
    let successCount = 0;
    
    for (const team of teams) {
      try {
        // Get team's winning bids
        const teamWins = result.results_by_tier.flatMap(tier => 
          tier.winning_bids.filter(bid => bid.team_id === team.team_id)
        );

        const playersWon = teamWins.length;
        const totalSpent = teamWins.reduce((sum, bid) => sum + bid.bid_amount, 0);

        // Customize notification based on results
        let title = '🎉 Draft Complete!';
        let body = '';

        if (playersWon === 0) {
          body = `The draft has been processed. You didn't win any players this round. Budget remaining: €${team.budget_remaining}M`;
        } else if (playersWon === 1) {
          body = `You won ${teamWins[0].player_name} for €${teamWins[0].bid_amount}M! Budget remaining: €${team.budget_remaining}M`;
        } else {
          body = `You won ${playersWon} players for €${totalSpent}M! Budget remaining: €${team.budget_remaining}M. Check your squad now!`;
        }

        const notifResult = await sendNotification(
          {
            title,
            body,
            icon: '/logo.png',
            url: '/dashboard/team/fantasy/my-team',
            data: {
              type: 'draft_complete',
              league_id: leagueId,
              team_id: team.team_id,
              players_won: playersWon.toString(),
              total_spent: totalSpent.toString()
            }
          },
          {
            userId: team.owner_uid
          }
        );

        if (notifResult.success) {
          successCount++;
        }
      } catch (teamError) {
        console.error(`❌ Error sending notification to team ${team.team_name}:`, teamError);
        // Continue with other teams
      }
    }

    return successCount;
  } catch (error) {
    console.error('❌ Error in sendDraftResultsNotifications:', error);
    throw error;
  }
}
