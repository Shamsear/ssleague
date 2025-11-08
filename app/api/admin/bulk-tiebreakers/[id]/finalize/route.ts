import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { verifyAuth } from '@/lib/auth-helper';
import { finalizeBulkTiebreaker } from '@/lib/finalize-bulk-tiebreaker';
import { sendNotificationToSeason } from '@/lib/notifications/send-notification';
// Firebase Realtime DB broadcasting is handled by finalizeBulkTiebreaker

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

/**
 * POST /api/admin/bulk-tiebreakers/:id/finalize
 * Manually finalize a bulk tiebreaker
 * Admin/Committee only
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ✅ ZERO FIREBASE READS - Uses JWT claims only
    const auth = await verifyAuth(['admin', 'committee', 'committee_admin'], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: tiebreakerId } = await params;

    console.log(`🔄 Admin attempting to finalize tiebreaker ${tiebreakerId}`);

    // Get tiebreaker details
    const tiebreakerCheck = await sql`
      SELECT 
        id, 
        player_name,
        player_position,
        status, 
        current_highest_bid,
        current_highest_team_id
      FROM bulk_tiebreakers
      WHERE id = ${tiebreakerId}
    `;

    if (tiebreakerCheck.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tiebreaker not found' },
        { status: 404 }
      );
    }

    const tiebreaker = tiebreakerCheck[0];

    // Check if already finalized (prevent duplicates)
    if (tiebreaker.status === 'resolved' || tiebreaker.status === 'finalized') {
      return NextResponse.json(
        { success: false, error: 'Tiebreaker already finalized' },
        { status: 400 }
      );
    }

    // Check if there's a winner
    if (!tiebreaker.current_highest_team_id) {
      return NextResponse.json(
        { success: false, error: 'No winner determined - cannot finalize' },
        { status: 400 }
      );
    }

    // Check how many teams are still active
    const activeTeamsCheck = await sql`
      SELECT COUNT(*) as count, 
             array_agg(team_id) FILTER (WHERE status = 'active') as active_team_ids,
             array_agg(team_name) FILTER (WHERE status = 'active') as active_teams
      FROM bulk_tiebreaker_teams
      WHERE tiebreaker_id = ${tiebreakerId}
      AND status = 'active'
    `;

    const activeCount = parseInt(activeTeamsCheck[0]?.count || '0');
    const activeTeamIds = activeTeamsCheck[0]?.active_team_ids || [];
    const activeTeams = activeTeamsCheck[0]?.active_teams || [];

    if (activeCount === 0) {
      return NextResponse.json(
        { success: false, error: 'No active teams found - cannot finalize' },
        { status: 400 }
      );
    }

    // If multiple teams are still active, auto-withdraw everyone except the highest bidder
    if (activeCount > 1) {
      console.log(`⚠️ ${activeCount} teams still active: ${activeTeams.join(', ')}`);
      console.log(`🔄 Auto-withdrawing all teams except highest bidder (${tiebreaker.current_highest_team_id})...`);
      
      // Withdraw all teams except the winner
      const teamsToWithdraw = activeTeamIds.filter(id => id !== tiebreaker.current_highest_team_id);
      
      if (teamsToWithdraw.length > 0) {
        await sql`
          UPDATE bulk_tiebreaker_teams
          SET 
            status = 'withdrawn',
            withdrawn_at = NOW()
          WHERE tiebreaker_id = ${tiebreakerId}
          AND team_id = ANY(${teamsToWithdraw})
        `;
        
        // Update teams_remaining count
        await sql`
          UPDATE bulk_tiebreakers
          SET teams_remaining = 1
          WHERE id = ${tiebreakerId}
        `;
        
        console.log(`✅ Auto-withdrew ${teamsToWithdraw.length} teams`);
      }
    }

    console.log(`✅ Validation passed. Finalizing tiebreaker ${tiebreakerId}...`);

    // Call finalization function
    const finalizeResult = await finalizeBulkTiebreaker(tiebreakerId);

    if (!finalizeResult.success) {
      console.error(`❌ Finalization failed: ${finalizeResult.error}`);
      return NextResponse.json(
        { success: false, error: finalizeResult.error },
        { status: 500 }
      );
    }

    console.log(`✅ Tiebreaker ${tiebreakerId} finalized successfully!`);

    // Get winner team name and season ID for notifications
    const winnerTeamResult = await sql`
      SELECT team_name FROM bulk_tiebreaker_teams
      WHERE tiebreaker_id = ${tiebreakerId} 
      AND team_id = ${tiebreaker.current_highest_team_id}
    `;
    const winnerTeamName = winnerTeamResult[0]?.team_name || 'Unknown';

    // Get season ID
    const seasonResult = await sql`
      SELECT season_id FROM bulk_tiebreakers
      WHERE id = ${tiebreakerId}
    `;
    const seasonId = seasonResult[0]?.season_id;

    // Broadcasting is handled by finalizeBulkTiebreaker function

    // Send FCM notification to all teams in the season
    if (seasonId) {
      try {
        await sendNotificationToSeason(
          {
            title: '🏆 Tiebreaker Resolved!',
            body: `${winnerTeamName} wins ${tiebreaker.player_name} for £${finalizeResult.winning_amount}!`,
            url: `/tiebreakers/${tiebreakerId}`,
            icon: '/logo.png',
            data: {
              type: 'tiebreaker_finalized',
              tiebreaker_id: tiebreakerId,
              player_name: tiebreaker.player_name,
              winner_team_id: finalizeResult.winner_team_id,
              winner_team_name: winnerTeamName,
              winning_amount: finalizeResult.winning_amount?.toString() || '0',
            }
          },
          seasonId
        );
      } catch (notifError) {
        console.error('Failed to send tiebreaker finalization notification:', notifError);
        // Don't fail the request
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        tiebreaker_id: tiebreakerId,
        player_name: tiebreaker.player_name,
        winner_team_id: finalizeResult.winner_team_id,
        winner_team_name: winnerTeamName,
        winning_amount: finalizeResult.winning_amount,
        player_id: finalizeResult.player_id,
        message: `Successfully finalized! ${winnerTeamName} wins ${tiebreaker.player_name} for £${finalizeResult.winning_amount}`,
      },
    });

  } catch (error: any) {
    console.error('❌ Error in admin finalize endpoint:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
