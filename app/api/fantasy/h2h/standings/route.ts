/**
 * API: H2H Standings
 * GET /api/fantasy/h2h/standings - Get H2H standings and fixtures
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getH2HStandings,
  getTeamH2HRecord,
  getTeamH2HFixtures
} from '@/lib/fantasy/h2h-calculator';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get('league_id');
    const teamId = searchParams.get('team_id');
    const view = searchParams.get('view'); // 'fixtures' or default

    if (!leagueId) {
      return NextResponse.json(
        { error: 'league_id is required' },
        { status: 400 }
      );
    }

    // Get team fixtures
    if (view === 'fixtures' && teamId) {
      const fixtures = await getTeamH2HFixtures(leagueId, teamId);
      return NextResponse.json({
        success: true,
        league_id: leagueId,
        team_id: teamId,
        fixtures
      });
    }

    // Get standings (default)
    const standings = await getH2HStandings(leagueId);

    // If team_id provided, also get their record
    let teamRecord = null;
    if (teamId) {
      teamRecord = await getTeamH2HRecord(leagueId, teamId);
    }

    return NextResponse.json({
      success: true,
      league_id: leagueId,
      team_id: teamId,
      standings,
      team_record: teamRecord
    });

  } catch (error: any) {
    console.error('Error fetching H2H standings:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch H2H standings',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}
