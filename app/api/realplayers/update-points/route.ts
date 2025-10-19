import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase/config';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';

// Base points by star rating
const STAR_RATING_BASE_POINTS: { [key: number]: number } = {
  3: 100,
  4: 120,
  5: 145,
  6: 175,
  7: 210,
  8: 250,
  9: 300,
  10: 375, // average of 350-400
};

// Calculate star rating from points
function calculateStarRating(points: number): number {
  if (points >= 350) return 10;
  if (points >= 300) return 9;
  if (points >= 250) return 8;
  if (points >= 210) return 7;
  if (points >= 175) return 6;
  if (points >= 145) return 5;
  if (points >= 120) return 4;
  return 3;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fixture_id, matchups } = body;

    if (!fixture_id || !matchups || !Array.isArray(matchups)) {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      );
    }

    const updates: any[] = [];

    // Process each matchup
    for (const matchup of matchups) {
      const { home_player_id, away_player_id, home_goals, away_goals } = matchup;

      if (home_goals === null || away_goals === null) continue;

      // Calculate goal difference
      const homeGD = home_goals - away_goals;
      const awayGD = away_goals - home_goals;

      // Cap at ±5 points per match
      const homePointsChange = Math.max(-5, Math.min(5, homeGD));
      const awayPointsChange = Math.max(-5, Math.min(5, awayGD));

      // Update home player
      const homePlayerQuery = query(
        collection(db, 'realplayer'),
        where('player_id', '==', home_player_id)
      );
      const homePlayerSnap = await getDocs(homePlayerQuery);

      if (!homePlayerSnap.empty) {
        const homePlayerDoc = homePlayerSnap.docs[0];
        const homePlayerData = homePlayerDoc.data();
        const currentPoints = homePlayerData.points || STAR_RATING_BASE_POINTS[homePlayerData.star_rating || 3];
        const newPoints = currentPoints + homePointsChange;
        const newStarRating = calculateStarRating(newPoints);

        await updateDoc(homePlayerDoc.ref, {
          points: newPoints,
          star_rating: newStarRating,
        });

        updates.push({
          player_id: home_player_id,
          name: homePlayerData.name,
          old_points: currentPoints,
          new_points: newPoints,
          points_change: homePointsChange,
          old_stars: homePlayerData.star_rating,
          new_stars: newStarRating,
        });
      }

      // Update away player
      const awayPlayerQuery = query(
        collection(db, 'realplayer'),
        where('player_id', '==', away_player_id)
      );
      const awayPlayerSnap = await getDocs(awayPlayerQuery);

      if (!awayPlayerSnap.empty) {
        const awayPlayerDoc = awayPlayerSnap.docs[0];
        const awayPlayerData = awayPlayerDoc.data();
        const currentPoints = awayPlayerData.points || STAR_RATING_BASE_POINTS[awayPlayerData.star_rating || 3];
        const newPoints = currentPoints + awayPointsChange;
        const newStarRating = calculateStarRating(newPoints);

        await updateDoc(awayPlayerDoc.ref, {
          points: newPoints,
          star_rating: newStarRating,
        });

        updates.push({
          player_id: away_player_id,
          name: awayPlayerData.name,
          old_points: currentPoints,
          new_points: newPoints,
          points_change: awayPointsChange,
          old_stars: awayPlayerData.star_rating,
          new_stars: newStarRating,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Player points and ratings updated successfully',
      updates,
    });
  } catch (error) {
    console.error('Error updating player points:', error);
    return NextResponse.json(
      { error: 'Failed to update player points' },
      { status: 500 }
    );
  }
}
