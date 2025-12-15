import { NextRequest, NextResponse } from 'next/server';
import { fantasySql } from '@/lib/neon/fantasy-config';
import { verifyAuth } from '@/lib/auth-helper';

/**
 * POST /api/admin/fantasy/lineup-lock
 * Toggle lineup lock for a fantasy league (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const authResult = await verifyAuth(['committee_admin', 'admin'], request);
    if (!authResult.authenticated) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { league_id, is_locked } = body;

    if (!league_id || typeof is_locked !== 'boolean') {
      return NextResponse.json(
        { error: 'league_id and is_locked (boolean) are required' },
        { status: 400 }
      );
    }

    // Verify league exists
    const leagues = await fantasySql`
      SELECT league_id, league_name FROM fantasy_leagues
      WHERE league_id = ${league_id}
      LIMIT 1
    `;

    if (leagues.length === 0) {
      return NextResponse.json(
        { error: 'Fantasy league not found' },
        { status: 404 }
      );
    }

    // Update lineup lock status
    await fantasySql`
      UPDATE fantasy_leagues
      SET is_lineup_locked = ${is_locked},
          updated_at = CURRENT_TIMESTAMP
      WHERE league_id = ${league_id}
    `;

    const action = is_locked ? 'locked' : 'unlocked';
    console.log(`✅ Lineup ${action} for league: ${league_id}`);

    return NextResponse.json({
      success: true,
      message: `Lineup ${action} successfully`,
      league_id,
      is_lineup_locked: is_locked,
    });
  } catch (error) {
    console.error('Error toggling lineup lock:', error);
    return NextResponse.json(
      { 
        error: 'Failed to toggle lineup lock',
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/fantasy/lineup-lock?league_id={id}
 * Get lineup lock status for a fantasy league
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const league_id = searchParams.get('league_id');

    if (!league_id) {
      return NextResponse.json(
        { error: 'league_id is required' },
        { status: 400 }
      );
    }

    const leagues = await fantasySql`
      SELECT 
        league_id,
        league_name,
        is_lineup_locked,
        updated_at
      FROM fantasy_leagues
      WHERE league_id = ${league_id}
      LIMIT 1
    `;

    if (leagues.length === 0) {
      return NextResponse.json(
        { error: 'Fantasy league not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      league_id: leagues[0].league_id,
      league_name: leagues[0].league_name,
      is_lineup_locked: leagues[0].is_lineup_locked || false,
      updated_at: leagues[0].updated_at,
    });
  } catch (error) {
    console.error('Error getting lineup lock status:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get lineup lock status',
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
