import { NextRequest, NextResponse } from 'next/server';

/**
 * Auto-lock lineups for a specific fixture if deadline has passed
 * 
 * NOTE: This feature is currently disabled as it was designed for the old system
 * where lineups were stored in fixtures.home_lineup/away_lineup columns.
 * 
 * The current system stores lineups in a separate 'lineups' table in Neon.
 * 
 * TODO: Refactor this feature to work with the lineups table:
 * - Query lineups table instead of fixtures table
 * - Update is_locked field in lineups table
 * - Implement warning system using team_seasons in Firebase
 * - Auto-submit logic for teams with exactly 5 players
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fixture_id } = body;

    if (!fixture_id) {
      return NextResponse.json(
        { success: false, error: 'fixture_id is required' },
        { status: 400 }
      );
    }

    // Auto-lock feature temporarily disabled - needs refactoring for lineups table
    console.log('🔒 Auto-lock requested for fixture:', fixture_id, '(feature disabled - needs refactoring)');
    
    return NextResponse.json({
      success: true,
      message: 'Auto-lock feature temporarily disabled - needs refactoring for lineups table',
      locked: false
    });
  } catch (error: any) {
    console.error('Error in auto-lock:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
