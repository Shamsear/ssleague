import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: 'Username and password are required' },
        { status: 400 }
      );
    }

    // Query teams collection for user with matching username (owner_name)
    const teamsRef = collection(db, 'teams');
    const q = query(teamsRef, where('username', '==', username), where('role', '==', 'team'));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return NextResponse.json(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Check if password matches (should be team_name)
    let authenticatedTeam = null;
    
    for (const docSnapshot of querySnapshot.docs) {
      const teamData = docSnapshot.data();
      const isPasswordValid = await bcrypt.compare(password, teamData.password);
      
      if (isPasswordValid) {
        authenticatedTeam = {
          id: teamData.id,
          team_name: teamData.team_name,
          owner_name: teamData.owner_name,
          username: teamData.username,
          role: teamData.role,
          current_season_id: teamData.current_season_id,
          seasons: teamData.seasons || [],
          is_active: teamData.is_active,
          performance_history: teamData.performance_history || {}
        };
        break;
      }
    }

    if (!authenticatedTeam) {
      return NextResponse.json(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Login successful',
      team: authenticatedTeam
    });

  } catch (error: any) {
    console.error('Team login error:', error);
    return NextResponse.json(
      { success: false, error: 'Authentication failed' },
      { status: 500 }
    );
  }
}

// GET endpoint to verify team authentication status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');

    if (!teamId) {
      return NextResponse.json(
        { success: false, error: 'Team ID is required' },
        { status: 400 }
      );
    }

    // Query team by ID
    const teamsRef = collection(db, 'teams');
    const q = query(teamsRef, where('id', '==', teamId), where('role', '==', 'team'));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return NextResponse.json(
        { success: false, error: 'Team not found' },
        { status: 404 }
      );
    }

    const teamDoc = querySnapshot.docs[0];
    const teamData = teamDoc.data();

    return NextResponse.json({
      success: true,
      team: {
        id: teamData.id,
        team_name: teamData.team_name,
        owner_name: teamData.owner_name,
        username: teamData.username,
        role: teamData.role,
        current_season_id: teamData.current_season_id,
        seasons: teamData.seasons || [],
        is_active: teamData.is_active,
        performance_history: teamData.performance_history || {}
      }
    });

  } catch (error: any) {
    console.error('Team verification error:', error);
    return NextResponse.json(
      { success: false, error: 'Verification failed' },
      { status: 500 }
    );
  }
}