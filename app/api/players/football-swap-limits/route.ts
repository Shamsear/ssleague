import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

/**
 * GET /api/players/football-swap-limits?team_id=xxx&season_id=xxx
 * Get football player swap count and next swap fee for a team
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const team_id = searchParams.get('team_id');
    const season_id = searchParams.get('season_id');

    if (!team_id || !season_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing team_id or season_id',
          errorCode: 'MISSING_PARAMS'
        },
        { status: 400 }
      );
    }

    const teamSeasonId = `${team_id}_${season_id}`;
    const doc = await adminDb.collection('team_seasons').doc(teamSeasonId).get();

    if (!doc.exists) {
      return NextResponse.json(
        {
          success: false,
          error: 'Team season not found',
          errorCode: 'NOT_FOUND'
        },
        { status: 404 }
      );
    }

    const data = doc.data();
    const swapCount = data?.football_swap_count || 0;
    const nextSwapNumber = swapCount + 1;

    // Calculate next swap fee
    const calculateFee = (swapNumber: number): number => {
      if (swapNumber <= 3) return 0;      // First 3 swaps are free
      if (swapNumber === 4) return 100;   // 4th swap costs 100
      if (swapNumber === 5) return 125;   // 5th swap costs 125
      return 150; // 6th+ swaps cost 150
    };

    const nextSwapFee = calculateFee(nextSwapNumber);
    const footballBudget = data?.football_budget || 0;

    return NextResponse.json({
      success: true,
      data: {
        swaps_used: swapCount,
        next_swap_number: nextSwapNumber,
        next_swap_fee: nextSwapFee,
        football_budget: footballBudget,
        can_afford_next_swap: footballBudget >= nextSwapFee,
        swap_history: [
          { swap: 1, fee: 0, status: swapCount >= 1 ? 'used' : 'available' },
          { swap: 2, fee: 0, status: swapCount >= 2 ? 'used' : 'available' },
          { swap: 3, fee: 0, status: swapCount >= 3 ? 'used' : 'available' },
          { swap: 4, fee: 100, status: swapCount >= 4 ? 'used' : 'available' },
          { swap: 5, fee: 125, status: swapCount >= 5 ? 'used' : 'available' }
        ]
      }
    });

  } catch (error: any) {
    console.error('Error in football-swap-limits API:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to get swap limits',
        errorCode: 'SYSTEM_ERROR'
      },
      { status: 500 }
    );
  }
}
