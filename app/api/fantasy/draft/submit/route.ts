import { NextRequest, NextResponse } from 'next/server';
import { fantasySql } from '@/lib/neon/fantasy-config';

/**
 * POST /api/fantasy/draft/submit
 * Submit draft (mark as complete for admin review)
 */
export async function POST(request: NextRequest) {
  try {
    const { user_id } = await request.json();

    if (!user_id) {
      return NextResponse.json(
        { error: 'Missing required parameter: user_id' },
        { status: 400 }
      );
    }

    // Get user's fantasy team
    const fantasyTeams = await fantasySql`
      SELECT * FROM fantasy_teams
      WHERE owner_uid = ${user_id} AND is_enabled = true
      LIMIT 1
    `;

    if (fantasyTeams.length === 0) {
      return NextResponse.json(
        { error: 'No fantasy team found for this user' },
        { status: 404 }
      );
    }

    const team = fantasyTeams[0];
    const teamId = team.team_id;
    const leagueId = team.league_id;

    // Get league settings to check squad size limits
    const leagues = await fantasySql`
      SELECT min_squad_size, max_squad_size FROM fantasy_leagues
      WHERE league_id = ${leagueId}
      LIMIT 1
    `;

    if (leagues.length === 0) {
      return NextResponse.json(
        { error: 'League not found' },
        { status: 404 }
      );
    }

    const minSquadSize = Number(leagues[0].min_squad_size || 11);
    const maxSquadSize = Number(leagues[0].max_squad_size || 15);

    // Count players in squad
    const squadCount = await fantasySql`
      SELECT COUNT(*) as player_count
      FROM fantasy_squad
      WHERE team_id = ${teamId} AND league_id = ${leagueId}
    `;

    const playerCount = Number(squadCount[0]?.player_count || 0);

    // Validate squad size
    if (playerCount < minSquadSize) {
      return NextResponse.json(
        { 
          error: 'Squad size too small',
          message: `You need at least ${minSquadSize} players to submit your draft. You currently have ${playerCount} player${playerCount !== 1 ? 's' : ''}.`,
          current: playerCount,
          required: minSquadSize
        },
        { status: 400 }
      );
    }

    if (playerCount > maxSquadSize) {
      return NextResponse.json(
        { 
          error: 'Squad size too large',
          message: `You can have at most ${maxSquadSize} players. You currently have ${playerCount} players.`,
          current: playerCount,
          maximum: maxSquadSize
        },
        { status: 400 }
      );
    }

    // Mark draft as submitted
    await fantasySql`
      UPDATE fantasy_teams
      SET draft_submitted = true,
          updated_at = CURRENT_TIMESTAMP
      WHERE team_id = ${teamId}
    `;

    console.log(`✅ Draft submitted for team: ${teamId} (${playerCount} players)`);

    return NextResponse.json({
      success: true,
      message: 'Draft submitted successfully',
      player_count: playerCount
    });
  } catch (error) {
    console.error('Error submitting draft:', error);
    return NextResponse.json(
      { error: 'Failed to submit draft', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/fantasy/draft/submit
 * Unsubmit draft (enable editing again)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const user_id = searchParams.get('user_id');

    if (!user_id) {
      return NextResponse.json(
        { error: 'Missing required parameter: user_id' },
        { status: 400 }
      );
    }

    // Get user's fantasy team
    const fantasyTeams = await fantasySql`
      SELECT * FROM fantasy_teams
      WHERE owner_uid = ${user_id} AND is_enabled = true
      LIMIT 1
    `;

    if (fantasyTeams.length === 0) {
      return NextResponse.json(
        { error: 'No fantasy team found for this user' },
        { status: 404 }
      );
    }

    const team = fantasyTeams[0];
    const teamId = team.team_id;

    // Unsubmit draft (allow editing)
    await fantasySql`
      UPDATE fantasy_teams
      SET draft_submitted = false,
          updated_at = CURRENT_TIMESTAMP
      WHERE team_id = ${teamId}
    `;

    console.log(`✅ Draft unsubmitted (edit enabled) for team: ${teamId}`);

    return NextResponse.json({
      success: true,
      message: 'Draft unlocked for editing',
    });
  } catch (error) {
    console.error('Error unsubmitting draft:', error);
    return NextResponse.json(
      { error: 'Failed to unlock draft', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
