import { NextRequest, NextResponse } from 'next/server';
import { generateGroupStageFixtures, getGroupFixtures, deleteGroupFixtures } from '@/lib/firebase/groupStage';

// GET - Get group fixtures for a tournament
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const seasonId = searchParams.get('season_id');
    const tournamentId = searchParams.get('tournament_id');

    if (!seasonId || !tournamentId) {
      return NextResponse.json(
        { success: false, error: 'season_id and tournament_id are required' },
        { status: 400 }
      );
    }

    const fixtures = await getGroupFixtures(seasonId, tournamentId);

    return NextResponse.json({ 
      success: true, 
      fixtures 
    });
  } catch (error) {
    console.error('Error fetching group fixtures:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch group fixtures' },
      { status: 500 }
    );
  }
}

// POST - Generate group fixtures
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { season_id, tournament_id, number_of_groups, teams_per_group, teams } = body;

    if (!season_id || !tournament_id || !number_of_groups || !teams_per_group || !teams) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const result = await generateGroupStageFixtures(
      season_id,
      tournament_id,
      number_of_groups,
      teams_per_group,
      teams
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Group fixtures generated successfully',
      fixturesCount: result.fixtures?.length || 0
    });
  } catch (error) {
    console.error('Error generating group fixtures:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate group fixtures' },
      { status: 500 }
    );
  }
}

// DELETE - Delete all group fixtures for a tournament
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const seasonId = searchParams.get('season_id');
    const tournamentId = searchParams.get('tournament_id');

    if (!seasonId || !tournamentId) {
      return NextResponse.json(
        { success: false, error: 'season_id and tournament_id are required' },
        { status: 400 }
      );
    }

    const result = await deleteGroupFixtures(seasonId, tournamentId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Group fixtures deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting group fixtures:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete group fixtures' },
      { status: 500 }
    );
  }
}
