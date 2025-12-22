import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import { verifyAuth } from '@/lib/auth-helper';
import { adminDb } from '@/lib/firebase/admin';

/**
 * Allow home team to submit away team's lineup after away team received a warning
 * This is only allowed if:
 * 1. Away team has at least 1 lineup warning in the season
 * 2. Away team hasn't submitted their lineup yet
 * 3. Round has started
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ fixtureId: string }> }
) {
  try {
    const { fixtureId } = await params;
    
    const auth = await verifyAuth(['team'], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = auth.userId!;

    // Get request body
    const body = await request.json();
    const { players } = body as { players: Array<{
      player_id: string;
      player_name: string;
      position: number;
      is_substitute: boolean;
    }> };

    // Validate lineup
    if (!players || players.length !== 6) {
      return NextResponse.json(
        { success: false, error: 'Lineup must have exactly 6 players' },
        { status: 400 }
      );
    }

    const substituteCount = players.filter(p => p.is_substitute).length;
    if (substituteCount !== 1) {
      return NextResponse.json(
        { success: false, error: 'Lineup must have exactly 1 substitute' },
        { status: 400 }
      );
    }

    const sql = getTournamentDb();
    
    const fixtures = await sql`
      SELECT * FROM fixtures WHERE id = ${fixtureId} LIMIT 1
    `;

    if (fixtures.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Fixture not found' },
        { status: 404 }
      );
    }

    const fixture = fixtures[0];

    // Get team_id from team_seasons
    const teamSeasonsQuery = await adminDb
      .collection('team_seasons')
      .where('user_id', '==', userId)
      .where('season_id', '==', fixture.season_id)
      .where('status', '==', 'registered')
      .limit(1)
      .get();

    if (teamSeasonsQuery.empty) {
      return NextResponse.json(
        { success: false, error: 'Team not registered for this season' },
        { status: 403 }
      );
    }

    const teamId = teamSeasonsQuery.docs[0].data().team_id;
    const isHomeTeam = fixture.home_team_id === teamId;

    // Only home team can submit opponent's lineup
    if (!isHomeTeam) {
      return NextResponse.json(
        { success: false, error: 'Only home team can submit opponent lineup' },
        { status: 403 }
      );
    }

    // Check if away team lineup allows home submission
    const awayLineup = fixture.away_lineup;
    if (!awayLineup || !awayLineup.home_can_submit) {
      return NextResponse.json(
        { success: false, error: 'Away team has not received a warning or has already submitted' },
        { status: 403 }
      );
    }

    // Verify all players belong to away team
    const awayTeamId = fixture.away_team_id;
    const seasonId = fixture.season_id;
    
    const playerIds = players.map(p => p.player_id);
    const awayPlayers = await sql`
      SELECT player_id 
      FROM player_seasons 
      WHERE team_id = ${awayTeamId} 
        AND season_id = ${seasonId}
        AND player_id = ANY(${playerIds})
        AND status = 'active'
    `;

    if (awayPlayers.length !== players.length) {
      return NextResponse.json(
        { success: false, error: 'All players must belong to the away team' },
        { status: 400 }
      );
    }

    // Save lineup
    const lineupData = {
      players: players,
      locked: true,
      locked_at: new Date().toISOString(),
      locked_by: 'system',
      locked_reason: 'Submitted by home team after warning',
      submitted_by: userId,
      submitted_by_home_team: true,
      submitted_at: new Date().toISOString(),
    };

    await sql`
      UPDATE fixtures
      SET 
        away_lineup = ${JSON.stringify(lineupData)}::jsonb,
        updated_at = NOW()
      WHERE id = ${fixtureId}
    `;

    // Record the action
    await sql`
      INSERT INTO lineup_audit_log (
        fixture_id,
        team_id,
        action,
        new_lineup,
        changed_by,
        reason
      ) VALUES (
        ${fixtureId},
        ${awayTeamId},
        'created',
        ${JSON.stringify(lineupData)}::jsonb,
        ${userId},
        'Home team submitted away team lineup after warning'
      )
    `;

    console.log(`✅ Home team submitted away team lineup for fixture ${fixtureId}`);

    return NextResponse.json({
      success: true,
      message: 'Opponent lineup submitted successfully',
    });
  } catch (error: any) {
    console.error('Error submitting opponent lineup:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to submit opponent lineup' },
      { status: 500 }
    );
  }
}
