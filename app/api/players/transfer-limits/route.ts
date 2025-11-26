import { NextRequest, NextResponse } from 'next/server';
import { getTransferLimitStatus, getMultipleTeamLimitStatuses } from '@/lib/transfer-limits';

/**
 * GET /api/players/transfer-limits
 * Get transfer limit status for one or more teams
 * 
 * This endpoint returns the current transfer limit status including:
 * - Number of transfers used
 * - Number of transfers remaining
 * - Whether the team can perform more transfers
 * 
 * Query Parameters:
 * - team_id: string (required if not using team_ids)
 * - team_ids: string (comma-separated list of team IDs, optional)
 * - season_id: string (required)
 * 
 * Examples:
 * - Single team: /api/players/transfer-limits?team_id=SSPSLT0001&season_id=SSPSLS16
 * - Multiple teams: /api/players/transfer-limits?team_ids=SSPSLT0001,SSPSLT0002&season_id=SSPSLS16
 * 
 * Requirements: 1.6
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const team_id = searchParams.get('team_id');
    const team_ids = searchParams.get('team_ids');
    const season_id = searchParams.get('season_id');

    // Validate required fields
    if (!season_id) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required parameter: season_id',
          errorCode: 'MISSING_SEASON_ID'
        },
        { status: 400 }
      );
    }

    if (!team_id && !team_ids) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required parameter: team_id or team_ids',
          errorCode: 'MISSING_TEAM_ID'
        },
        { status: 400 }
      );
    }

    // Handle multiple teams
    if (team_ids) {
      const teamIdArray = team_ids.split(',').map(id => id.trim()).filter(id => id.length > 0);
      
      if (teamIdArray.length === 0) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Invalid team_ids parameter',
            errorCode: 'INVALID_TEAM_IDS'
          },
          { status: 400 }
        );
      }

      const statuses = await getMultipleTeamLimitStatuses(teamIdArray, season_id);

      return NextResponse.json({
        success: true,
        season_id,
        teams: statuses
      });
    }

    // Handle single team
    if (team_id) {
      const status = await getTransferLimitStatus(team_id, season_id);

      return NextResponse.json({
        success: true,
        season_id,
        team_id,
        transfers_used: status.transfersUsed,
        transfers_remaining: status.transfersRemaining,
        can_transfer: status.canTransfer,
        max_transfers: 2
      });
    }

    // This should never be reached due to validation above
    return NextResponse.json(
      { 
        success: false, 
        error: 'Invalid request',
        errorCode: 'INVALID_REQUEST'
      },
      { status: 400 }
    );

  } catch (error: any) {
    console.error('Error in transfer-limits API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to get transfer limits',
        errorCode: 'SYSTEM_ERROR'
      },
      { status: 500 }
    );
  }
}
