import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase/config';
import { collection, query, where, getDocs, or, orderBy, limit as firestoreLimit, startAt, endAt } from 'firebase/firestore';
import { getTournamentDb } from '@/lib/neon/tournament-config';

// In-memory cache for all players (cached for 5 minutes)
let playersCache: { data: any[], timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getAllPlayers() {
  const now = Date.now();
  
  // Return cached data if still valid
  if (playersCache && (now - playersCache.timestamp) < CACHE_TTL) {
    return playersCache.data;
  }
  
  // Fetch fresh data
  const realPlayersRef = collection(db, 'realplayers');
  const playersSnapshot = await getDocs(
    query(realPlayersRef, orderBy('player_id'), firestoreLimit(500))
  );
  
  const players = playersSnapshot.docs.map(doc => ({
    id: doc.id,
    player_id: doc.data().player_id,
    name: doc.data().name,
  }));
  
  // Update cache
  playersCache = { data: players, timestamp: now };
  return players;
}

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

    // Get all players from cache or fetch
    const allPlayersData = await getAllPlayers();
    
    // Filter in memory
    const allPlayers = allPlayersData
      .filter(p => 
        p.player_id?.toLowerCase().includes(searchLower) ||
        p.name?.toLowerCase().includes(searchLower)
      )
      .slice(0, limit);

    if (allPlayers.length === 0) {
      return NextResponse.json({ 
        players: [],
        cached: true 
      });
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
      count: playersWithStatus.length,
      cached: playersCache !== null
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      }
    });
  } catch (error) {
    console.error('Error searching players:', error);
    return NextResponse.json(
      { error: 'Failed to search players' },
      { status: 500 }
    );
  }
}

// Enable edge runtime for faster response
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
