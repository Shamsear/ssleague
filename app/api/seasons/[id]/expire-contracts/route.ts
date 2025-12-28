import { NextRequest, NextResponse } from 'next/server';
import { removeExpiredContracts } from '@/lib/firebase/multiSeasonPlayers';

/**
 * POST /api/seasons/:id/expire-contracts
 * 
 * Remove expired player contracts for a given season
 * Should be triggered at the start of a new season
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: seasonId } = await params;

    if (!seasonId) {
      return NextResponse.json(
        { error: 'Season ID is required' },
        { status: 400 }
      );
    }

    console.log(`Starting contract expiry process for season ${seasonId}...`);

    // Remove expired contracts
    const result = await removeExpiredContracts(seasonId);

    return NextResponse.json({
      success: true,
      message: 'Contract expiry process completed',
      seasonId,
      result: {
        removed: result.removed,
        errors: result.errors,
        total: result.removed + result.errors,
      },
      details: {
        realPlayers: result.removed > 0 ? 'Expired contracts removed' : 'No expired contracts found',
        footballPlayers: result.removed > 0 ? 'Expired contracts removed' : 'No expired contracts found',
      }
    });

  } catch (error: any) {
    console.error('Error expiring contracts:', error);
    return NextResponse.json(
      {
        error: 'Failed to expire contracts',
        details: error.message
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/seasons/:id/expire-contracts
 * 
 * Preview which contracts would be expired without actually expiring them
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: seasonId } = await params;

    if (!seasonId) {
      return NextResponse.json(
        { error: 'Season ID is required' },
        { status: 400 }
      );
    }

    // This would need implementation to query without updating
    // For now, just return information
    return NextResponse.json({
      seasonId,
      message: 'Contract expiry preview',
      info: 'This endpoint would show which contracts will expire without actually expiring them',
      action: 'Use POST to actually expire contracts'
    });

  } catch (error: any) {
    console.error('Error previewing contract expiry:', error);
    return NextResponse.json(
      {
        error: 'Failed to preview contract expiry',
        details: error.message
      },
      { status: 500 }
    );
  }
}
