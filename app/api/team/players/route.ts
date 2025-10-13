import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    // Get token cookie
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify Firebase ID token
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (error) {
      console.error('Token verification error:', error);
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }

    const uid = decodedToken.uid;

    // Get user document to verify role
    const userDoc = await adminDb.collection('users').doc(uid).get();
    
    if (!userDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    
    if (userData?.role !== 'team') {
      return NextResponse.json(
        { success: false, error: 'Access denied. Team role required.' },
        { status: 403 }
      );
    }

    // Get team's players
    const playersSnapshot = await adminDb
      .collection('players')
      .where('team_id', '==', uid)
      .get();

    const players = playersSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || '',
        position: data.position || '',
        position_group: data.position_group || '',
        nfl_team: data.nfl_team || data.team || '',
        overall_rating: data.overall_rating || 0,
        acquisition_value: data.acquisition_value || 0,
        player_id: data.player_id || null,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        players,
        count: players.length,
      },
    });

  } catch (error: any) {
    console.error('Error fetching team players:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to fetch players'
      },
      { status: 500 }
    );
  }
}
