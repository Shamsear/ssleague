import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';
import { calculateRealPlayerSalary, getInitialPoints } from '@/lib/contracts';

export async function POST(request: NextRequest) {
  try {
    // Get Firebase ID token from cookie
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized - No token' },
        { status: 401 }
      );
    }

    // Verify Firebase ID token
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (err) {
      console.error('Token verification error:', err);
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Check if user is committee admin
    const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    const userData = userDoc.data();
    
    if (!userData || userData.role !== 'committee_admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Committee admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      teamId,
      playerName,
      auctionValue,
      starRating,
      startSeason,
      endSeason,
      salaryPerMatch,
      category,
    } = body;

    // Validate required fields
    if (!teamId || !playerName || !auctionValue || !starRating || !startSeason || !endSeason) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get team document
    const teamRef = adminDb.collection('teams').doc(teamId);
    const teamDoc = await teamRef.get();

    if (!teamDoc.exists) {
      return NextResponse.json(
        { error: 'Team not found' },
        { status: 404 }
      );
    }

    const teamData = teamDoc.data();
    const currentDollarBalance = teamData?.dollarBalance || 0;

    // Check if team can afford the player
    if (currentDollarBalance < auctionValue) {
      return NextResponse.json(
        { error: 'Insufficient dollar balance' },
        { status: 400 }
      );
    }

    // Calculate initial points from star rating
    const initialPoints = getInitialPoints(starRating);

    // Create player object
    const newPlayer = {
      name: playerName,
      auctionValue,
      starRating,
      categoryId: category || null, // Category ID from categories collection
      points: initialPoints,
      salaryPerMatch: salaryPerMatch || calculateRealPlayerSalary(auctionValue, starRating),
      startSeason,
      endSeason,
      assignedAt: new Date().toISOString(),
    };

    // Update team with new player
    const realPlayers = teamData?.real_players || [];
    realPlayers.push(newPlayer);

    await teamRef.update({
      real_players: realPlayers,
      real_players_count: realPlayers.length,
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: 'Player assigned successfully',
      player: newPlayer,
    });
  } catch (error) {
    console.error('Error assigning player:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to assign player' },
      { status: 500 }
    );
  }
}
