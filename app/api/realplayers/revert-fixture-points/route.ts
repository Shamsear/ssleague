import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase/config';
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { calculateRealPlayerSalary } from '@/lib/contracts';
import { getTournamentDb } from '@/lib/neon/tournament-config';

// Base points by star rating
const STAR_RATING_BASE_POINTS: { [key: number]: number } = {
  3: 100,
  4: 120,
  5: 145,
  6: 175,
  7: 210,
  8: 250,
  9: 300,
  10: 350,
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

/**
 * Revert player points when a fixture is deleted
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fixture_id, season_id, matchups } = body;

    if (!fixture_id || !season_id || !matchups || !Array.isArray(matchups)) {
      return NextResponse.json(
        { error: 'Invalid request data. Required: fixture_id, season_id, matchups[]' },
        { status: 400 }
      );
    }

    const reverted: any[] = [];

    // Process each matchup
    for (const matchup of matchups) {
      const { home_player_id, away_player_id, home_goals, away_goals } = matchup;

      if (home_goals === null || away_goals === null) continue;

      // Calculate goal difference (need to SUBTRACT these points)
      const homeGD = home_goals - away_goals;
      const awayGD = away_goals - home_goals;

      // Cap at ±5 points per match (same as when adding)
      const homePointsChange = Math.max(-5, Math.min(5, homeGD));
      const awayPointsChange = Math.max(-5, Math.min(5, awayGD));

      // Revert home player points
      const homeResult = await revertPlayerPoints(home_player_id, homePointsChange, season_id);
      if (homeResult) {
        reverted.push({
          player_id: home_player_id,
          ...homeResult,
          points_change: -homePointsChange, // Negative because we're reverting
        });
      }

      // Revert away player points  
      const awayResult = await revertPlayerPoints(away_player_id, awayPointsChange, season_id);
      if (awayResult) {
        reverted.push({
          player_id: away_player_id,
          ...awayResult,
          points_change: -awayPointsChange, // Negative because we're reverting
        });
      }
    }

    // Recalculate categories for ALL players after reverting
    console.log('Recalculating categories for all players...');
    const categoryResult = await recalculateAllPlayerCategories();

    return NextResponse.json({
      success: true,
      message: 'Player points reverted successfully',
      reverted,
      categoryUpdate: categoryResult
    });
  } catch (error) {
    console.error('Error reverting player points:', error);
    return NextResponse.json(
      { error: 'Failed to revert player points' },
      { status: 500 }
    );
  }
}

async function revertPlayerPoints(playerId: string, pointsChange: number, seasonId: string) {
  // Get player from realplayer collection
  const playerQuery = query(
    collection(db, 'realplayer'),
    where('player_id', '==', playerId)
  );
  const playerSnap = await getDocs(playerQuery);

  if (playerSnap.empty) {
    console.warn(`Player ${playerId} not found in realplayer collection`);
    return null;
  }

  const playerDoc = playerSnap.docs[0];
  const playerData = playerDoc.data();
  const currentPoints = playerData.points || STAR_RATING_BASE_POINTS[playerData.star_rating || 3];
  
  // SUBTRACT the points that were added (reverse the change)
  const newPoints = currentPoints - pointsChange;
  const newStarRating = calculateStarRating(newPoints);
  const oldStarRating = playerData.star_rating || 3;

  const updateData: any = {
    points: newPoints,
    star_rating: newStarRating,
  };

  // Recalculate salary if star rating changed
  if (newStarRating !== oldStarRating && playerData.auction_value) {
    const newSalary = calculateRealPlayerSalary(playerData.auction_value, newStarRating);
    updateData.salary_per_match = newSalary;
  }

  // Update realplayer (LIFETIME data)
  await updateDoc(playerDoc.ref, updateData);

  // Update realplayerstats in Neon (SEASON-SPECIFIC star rating)
  const sql = getTournamentDb();
  const statsId = `${playerId}_${seasonId}`;
  
  // Update star rating in Neon stats
  await sql`
    UPDATE realplayerstats
    SET
      star_rating = ${newStarRating},
      updated_at = NOW()
    WHERE id = ${statsId}
  `;

  return {
    name: playerData.name,
    old_points: currentPoints,
    new_points: newPoints,
    old_stars: oldStarRating,
    new_stars: newStarRating,
    salary_updated: newStarRating !== oldStarRating
  };
}

// Recalculate categories for ALL players
async function recalculateAllPlayerCategories() {
  try {
    const allPlayersQuery = query(collection(db, 'realplayer'));
    const allPlayersSnap = await getDocs(allPlayersQuery);

    const players: Array<{ docId: string; playerId: string; starRating: number; points: number }> = [];

    allPlayersSnap.forEach(doc => {
      const data = doc.data();
      players.push({
        docId: doc.id,
        playerId: data.player_id,
        starRating: data.star_rating || 3,
        points: data.points || 100
      });
    });

    players.sort((a, b) => {
      if (b.starRating !== a.starRating) {
        return b.starRating - a.starRating;
      }
      return b.points - a.points;
    });

    const legendThreshold = Math.ceil(players.length / 2);

    const updatePromises = players.map(async (player, index) => {
      const isLegend = index < legendThreshold;
      const category = isLegend
        ? { id: 'legend', name: 'Legend' }
        : { id: 'classic', name: 'Classic' };

      const playerDoc = doc(db, 'realplayer', player.docId);
      await updateDoc(playerDoc, {
        category_id: category.id,
        category_name: category.name
      });

      return { playerId: player.playerId, category: category.name, rank: index + 1 };
    });

    await Promise.all(updatePromises);

    return { success: true, totalPlayers: players.length, legendCount: legendThreshold };
  } catch (error) {
    console.error('Error recalculating categories:', error);
    return { success: false, error: 'Failed to recalculate categories' };
  }
}
