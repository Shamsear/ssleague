import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import { adminDb } from '@/lib/firebase/admin';

// GET - Fetch players for a specific team and season
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('seasonId');

    if (!seasonId) {
      return NextResponse.json(
        { success: false, message: 'Season ID is required' },
        { status: 400 }
      );
    }

    const sql = getTournamentDb();

    // Fetch players assigned to this team for the given season from player_seasons
    const playerSeasons = await sql`
      SELECT 
        player_id,
        player_name,
        team,
        category,
        star_rating,
        points,
        registration_status
      FROM player_seasons
      WHERE team_id = ${teamId} 
        AND season_id = ${seasonId} 
        AND registration_status = 'active'
      ORDER BY player_name ASC
    `;

    if (playerSeasons.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    // Fetch full player details from Firebase
    const playerIds = playerSeasons.map(ps => ps.player_id);
    const playerDocs = await adminDb.collection('realplayers')
      .where('player_id', 'in', playerIds)
      .get();
    
    // Create a map of player details by player_id
    const playerDetailsMap = new Map();
    playerDocs.docs.forEach(doc => {
      const data = doc.data();
      playerDetailsMap.set(data.player_id, data);
    });

    // Combine player_seasons data with Firebase player details
    const enrichedPlayers = playerSeasons.map(ps => {
      const details = playerDetailsMap.get(ps.player_id) || {};
      return {
        id: ps.player_id,
        player_id: ps.player_id,
        name: ps.player_name,
        photo_url: details.photoUrl || details.photo_url,
        email: details.email,
        phone: details.phone,
        date_of_birth: details.dateOfBirth || details.date_of_birth,
        place: details.place,
        nationality: details.nationality,
        is_active: details.is_active !== false,
        is_available: details.is_available !== false,
        category: ps.category,
        star_rating: ps.star_rating,
        points: ps.points,
        status: ps.registration_status,
      };
    });

    return NextResponse.json({
      success: true,
      data: enrichedPlayers,
    });
  } catch (error: any) {
    console.error('Error fetching team players:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch team players' },
      { status: 500 }
    );
  }
}
