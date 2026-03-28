import { NextRequest, NextResponse } from 'next/server';
import { calculateH2HResults, getH2HStandings } from '@/lib/fantasy/h2h-calculator';

/**
 * POST /api/fantasy/h2h/calculate
 * 
 * Calculate H2H results for a round
 * Committee only
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { league_id, round_id } = body;

    // Validation
    if (!league_id || !round_id) {
      return NextResponse.json(
        { error: 'Missing required fields: league_id, round_id' },
        { status: 400 }
      );
    }

    // Calculate H2H results
    const results = await calculateH2HResults(league_id, round_id);

    // Get updated standings
    const standings = await getH2HStandings(league_id);

    return NextResponse.json({
      success: true,
      message: 'H2H results calculated successfully',
      fixtures_processed: results.length,
      results,
      standings
    });

  } catch (error: any) {
    console.error('Error calculating H2H results:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to calculate H2H results' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/fantasy/h2h/calculate?league_id=xxx
 * 
 * Get H2H standings for a league
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get('league_id');

    if (!leagueId) {
      return NextResponse.json(
        { error: 'Missing required parameter: league_id' },
        { status: 400 }
      );
    }

    const standings = await getH2HStandings(leagueId);

    return NextResponse.json({
      success: true,
      standings
    });

  } catch (error: any) {
    console.error('Error fetching H2H standings:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch H2H standings' },
      { status: 500 }
    );
  }
}
