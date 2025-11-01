import { NextRequest, NextResponse } from 'next/server';
import { fantasySql } from '@/lib/neon/fantasy-config';
import { adminDb } from '@/lib/firebase/admin';

/**
 * POST /api/fantasy/teams/claim
 * Allow teams to claim their admin-registered fantasy team by providing their team_id
 * This updates the owner_uid so they can log in
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, team_id } = body;

    if (!user_id || !team_id) {
      return NextResponse.json(
        { error: 'user_id and team_id are required' },
        { status: 400 }
      );
    }

    // Verify the user owns this team in Firebase
    const userDoc = await adminDb.collection('users').doc(user_id).get();
    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data()!;
    
    // Check if this team document exists in Firebase and belongs to this user
    const teamDoc = await adminDb.collection('teams').doc(team_id).get();
    if (!teamDoc.exists) {
      return NextResponse.json(
        { error: 'Team not found' },
        { status: 404 }
      );
    }

    const teamData = teamDoc.data()!;
    
    // Verify team ownership (check uid field or if they're the owner)
    if (teamData.uid && teamData.uid !== user_id) {
      return NextResponse.json(
        { error: 'You do not own this team' },
        { status: 403 }
      );
    }

    // Find the fantasy team
    const fantasyTeams = await fantasySql`
      SELECT * FROM fantasy_teams
      WHERE team_id = ${team_id}
      LIMIT 1
    `;

    if (fantasyTeams.length === 0) {
      return NextResponse.json(
        { error: 'Fantasy team not found' },
        { status: 404 }
      );
    }

    const fantasyTeam = fantasyTeams[0];

    // Update the owner_uid
    await fantasySql`
      UPDATE fantasy_teams
      SET owner_uid = ${user_id},
          owner_name = ${userData.username || userData.teamName || fantasyTeam.owner_name},
          updated_at = NOW()
      WHERE team_id = ${team_id}
    `;

    // Also update the Firebase team document to store the uid
    await adminDb.collection('teams').doc(team_id).update({
      uid: user_id,
      updated_at: new Date()
    });

    console.log(`✅ Fantasy team claimed: ${team_id} by ${userData.username || userData.teamName}`);

    return NextResponse.json({
      success: true,
      message: 'Successfully claimed your fantasy team!',
      team: {
        id: fantasyTeam.team_id,
        team_name: fantasyTeam.team_name,
        league_id: fantasyTeam.league_id
      }
    });

  } catch (error) {
    console.error('Error claiming fantasy team:', error);
    return NextResponse.json(
      { error: 'Failed to claim fantasy team', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
