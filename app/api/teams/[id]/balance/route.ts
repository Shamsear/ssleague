import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

/**
 * GET /api/teams/[id]/balance
 * Get the current balance for a team in a specific season
 * 
 * Query Parameters:
 * - season_id: string (required)
 * - player_type: 'real' | 'football' (optional) - determines which balance to return
 * 
 * Examples:
 * - /api/teams/SSPSLT0001/balance?season_id=SSPSLS16&player_type=real
 * - /api/teams/SSPSLT0001/balance?season_id=SSPSLS16&player_type=football
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const season_id = searchParams.get('season_id');
    const player_type = searchParams.get('player_type') as 'real' | 'football' | null;
    const { id: team_id } = await params;

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

    if (!team_id) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing team ID',
          errorCode: 'MISSING_TEAM_ID'
        },
        { status: 400 }
      );
    }

    // Get team_season document using admin SDK
    const teamSeasonId = `${team_id}_${season_id}`;
    const teamSeasonDoc = await adminDb.collection('team_seasons').doc(teamSeasonId).get();

    if (!teamSeasonDoc.exists) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Team season not found',
          errorCode: 'TEAM_SEASON_NOT_FOUND'
        },
        { status: 404 }
      );
    }

    const teamSeasonData = teamSeasonDoc.data();
    
    // Determine which balance to return based on player_type
    let balance: number;
    let currency: string;
    
    if (player_type === 'real') {
      // Real players use real_player_budget
      balance = teamSeasonData?.real_player_budget ?? 0;
      currency = 'USD';
    } else if (player_type === 'football') {
      // Football players use football_budget
      balance = teamSeasonData?.football_budget ?? 0;
      currency = 'EUR';
    } else {
      // Default: return real_player_budget (for backward compatibility)
      balance = teamSeasonData?.real_player_budget ?? 0;
      currency = 'USD';
    }

    return NextResponse.json({
      success: true,
      data: {
        team_id,
        season_id,
        balance,
        currency,
        player_type: player_type || 'real',
        team_season_id: teamSeasonId,
        // Include both balances for reference
        real_player_budget: teamSeasonData?.real_player_budget ?? 0,
        football_budget: teamSeasonData?.football_budget ?? 0,
        real_player_spent: teamSeasonData?.real_player_spent ?? 0,
        football_spent: teamSeasonData?.football_spent ?? 0
      }
    });

  } catch (error: any) {
    console.error('Error in team balance API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to get team balance',
        errorCode: 'SYSTEM_ERROR'
      },
      { status: 500 }
    );
  }
}
