import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase/config';
import { collection, query, where, getDocs, or, orderBy, limit as firestoreLimit } from 'firebase/firestore';
import { getTournamentDb } from '@/lib/neon/tournament-config';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const term = searchParams.get('term');
    const seasonId = searchParams.get('seasonId');
    const limit = parseInt(searchParams.get('limit') || '20');

    if (!term || term.length < 2) {
      return NextResponse.json({ players: [] });
    }

    if (!seasonId) {
      return NextResponse.json(
        { error: 'Season ID is required' },
        { status: 400 }
      );
    }

    const searchLower = term.toLowerCase();

    // Search in Firebase realplayers collection
    const realPlayersRef = collection(db, 'realplayers');
    
    // Get all players and filter in memory (Firebase doesn't support LIKE queries)
    const playersSnapshot = await getDocs(
      query(realPlayersRef, orderBy('player_id'), firestoreLimit(200))
    );
    
    const allPlayers = playersSnapshot.docs
      .map(doc => ({
        id: doc.id,
        player_id: doc.data().player_id,
        name: doc.data().name,
      }))
      .filter(p => 
        p.player_id?.toLowerCase().includes(searchLower) ||
        p.name?.toLowerCase().includes(searchLower)
      )
      .slice(0, limit);

    if (allPlayers.length === 0) {
      return NextResponse.json({ players: [] });
    }

    // Get player IDs for batch status check
    const playerIds = allPlayers.map(p => p.player_id);

    // Check registration status in Neon (batch query)
    const sql = getTournamentDb();
    const registeredPlayers = await sql`
      SELECT DISTINCT player_id
      FROM realplayerstats
      WHERE season_id = ${seasonId}
        AND player_id = ANY(${playerIds})
    `;

    const registeredPlayerIds = new Set(
      registeredPlayers.map((r: any) => r.player_id)
    );

    // Map players with status
    const playersWithStatus = allPlayers.map(player => ({
      ...player,
      status: registeredPlayerIds.has(player.player_id) 
        ? 'registered_current' 
        : 'available',
      status_text: registeredPlayerIds.has(player.player_id)
        ? 'Already Registered'
        : 'Available'
    }));

    return NextResponse.json({ 
      players: playersWithStatus,
      count: playersWithStatus.length
    });
  } catch (error) {
    console.error('Error searching players:', error);
    return NextResponse.json(
      { error: 'Failed to search players' },
      { status: 500 }
    );
  }
}
