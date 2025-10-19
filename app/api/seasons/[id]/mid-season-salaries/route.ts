import { NextRequest, NextResponse } from 'next/server';
import { deductMidSeasonSalaries } from '@/lib/firebase/multiSeasonTeams';

/**
 * POST /api/seasons/:id/mid-season-salaries
 * 
 * Deduct mid-season salaries from all teams for football players
 * Should be triggered at the halfway point of the season (e.g., after round 19 of 38)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const seasonId = params.id;
    
    if (!seasonId) {
      return NextResponse.json(
        { error: 'Season ID is required' },
        { status: 400 }
      );
    }
    
    console.log(`Starting mid-season salary deduction for season ${seasonId}...`);
    
    // Deduct mid-season salaries
    const result = await deductMidSeasonSalaries(seasonId);
    
    return NextResponse.json({
      success: true,
      message: 'Mid-season salary deduction completed',
      seasonId,
      result: {
        successful: result.success,
        failed: result.failed,
        total: result.success + result.failed,
      },
      details: {
        description: 'Football player salaries (half-season) deducted from team euro balances',
        formula: 'Deduction = salary_per_half_season for each player',
      }
    });
    
  } catch (error: any) {
    console.error('Error deducting mid-season salaries:', error);
    return NextResponse.json(
      { 
        error: 'Failed to deduct mid-season salaries',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/seasons/:id/mid-season-salaries
 * 
 * Preview mid-season salary deductions without actually deducting
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const seasonId = params.id;
    
    if (!seasonId) {
      return NextResponse.json(
        { error: 'Season ID is required' },
        { status: 400 }
      );
    }
    
    // This would need implementation to calculate without deducting
    // For now, just return information
    return NextResponse.json({
      seasonId,
      message: 'Mid-season salary preview',
      info: 'This endpoint would show how much would be deducted without actually deducting',
      action: 'Use POST to actually deduct mid-season salaries',
      timing: 'Should be triggered at halfway point (e.g., after round 19 of 38 rounds)'
    });
    
  } catch (error: any) {
    console.error('Error previewing mid-season salaries:', error);
    return NextResponse.json(
      { 
        error: 'Failed to preview mid-season salaries',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
