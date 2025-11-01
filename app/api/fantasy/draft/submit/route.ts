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

    // Mark draft as submitted
    await fantasySql`
      UPDATE fantasy_teams
      SET draft_submitted = true,
          updated_at = CURRENT_TIMESTAMP
      WHERE team_id = ${teamId}
    `;

    console.log(`✅ Draft submitted for team: ${teamId}`);

    return NextResponse.json({
      success: true,
      message: 'Draft submitted successfully',
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
