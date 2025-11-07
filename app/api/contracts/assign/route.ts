import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/auth-helper';
import { calculateRealPlayerSalary, getInitialPoints } from '@/lib/contracts';
import { logRealPlayerFee } from '@/lib/transaction-logger';

export async function POST(request: NextRequest) {
  try {
    // ✅ ZERO FIREBASE READS - Uses JWT claims only
    const auth = await verifyAuth(['committee_admin'], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
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
    const seasonId = teamData?.season_id || startSeason;
    const initialPoints = await getInitialPoints(starRating, seasonId);

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
    
    // Log transaction for real player fee
    await logRealPlayerFee(
      teamId,
      seasonId, // Already declared above at line 86
      playerName,
      `real_${playerName.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`, // Generate player ID
      auctionValue,
      currentDollarBalance
    );

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
