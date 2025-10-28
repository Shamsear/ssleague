import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase/config';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
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

// Recalculate categories for ALL players in a season based on league-wide ranking
// Top 50% by points = Legend, Bottom 50% = Classic
async function recalculateAllPlayerCategories(season_id: string) {
  try {
    // Get all realplayers for this specific season
    const allPlayersQuery = query(
      collection(db, 'realplayer'),
      where('season_id', '==', season_id)
    );
    const allPlayersSnap = await getDocs(allPlayersQuery);
    
    // Create array of players with their star ratings
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
    
    // Sort by points (most granular metric) - highest first
    // Star rating is derived from points, so points is the source of truth
    players.sort((a, b) => b.points - a.points);
    
    // Calculate top 50% threshold
    const legendThreshold = Math.ceil(players.length / 2);
    
    // Update categories for all players
    const updatePromises = players.map(async (player, index) => {
      const isLegend = index < legendThreshold;
      const category = isLegend 
        ? { id: 'legend', name: 'Legend' }
        : { id: 'classic', name: 'Classic' };
      
      // Update realplayer document
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
        const oldStarRating = homePlayerData.star_rating || 3;

        const updateData: any = {
          points: newPoints,
          star_rating: newStarRating,
        };

        // Recalculate salary if star rating changed and player has auction value
        if (newStarRating !== oldStarRating && homePlayerData.auction_value) {
          const newSalary = calculateRealPlayerSalary(homePlayerData.auction_value, newStarRating);
          updateData.salary_per_match = newSalary;
        }

        // Update realplayer (LIFETIME data: total points, star rating)
        // Note: Category will be recalculated league-wide after all updates
        await updateDoc(homePlayerDoc.ref, updateData);

        // Update realplayerstats in Neon (SEASON-SPECIFIC stats)
        const sql = getTournamentDb();
        const statsId = `${home_player_id}_${season_id}`;
        
        // Update star rating in Neon stats
        await sql`
          UPDATE realplayerstats
          SET
            star_rating = ${newStarRating},
            updated_at = NOW()
          WHERE id = ${statsId}
        `;

        updates.push({
          player_id: home_player_id,
          name: homePlayerData.name,
          old_points: currentPoints,
          new_points: newPoints,
          points_change: homePointsChange,
          old_stars: oldStarRating,
          new_stars: newStarRating,
          salary_updated: newStarRating !== oldStarRating
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
        const oldStarRating = awayPlayerData.star_rating || 3;

        const updateData: any = {
          points: newPoints,
          star_rating: newStarRating,
        };

        // Recalculate salary if star rating changed and player has auction value
        if (newStarRating !== oldStarRating && awayPlayerData.auction_value) {
          const newSalary = calculateRealPlayerSalary(awayPlayerData.auction_value, newStarRating);
          updateData.salary_per_match = newSalary;
        }

        // Update realplayer (LIFETIME data: total points, star rating)
        // Note: Category will be recalculated league-wide after all updates
        await updateDoc(awayPlayerDoc.ref, updateData);

        // Update realplayerstats in Neon (SEASON-SPECIFIC stats)
        const sql = getTournamentDb();
        const statsId = `${away_player_id}_${season_id}`;
        
        // Update star rating in Neon stats
        await sql`
          UPDATE realplayerstats
          SET
            star_rating = ${newStarRating},
            updated_at = NOW()
          WHERE id = ${statsId}
        `;

        updates.push({
          player_id: away_player_id,
          name: awayPlayerData.name,
          old_points: currentPoints,
          new_points: newPoints,
          points_change: awayPointsChange,
          old_stars: oldStarRating,
          new_stars: newStarRating,
          salary_updated: newStarRating !== oldStarRating
        });
      }
    }

    // DISABLED: Auto-recalculation of categories after match
    // Categories are now only updated when admin manually triggers it via the recalculate page
    // This keeps categories stable and prevents them from changing after every match
    // console.log(`Recalculating categories for all players in season ${season_id}...`);
    // const categoryResult = await recalculateAllPlayerCategories(season_id);
    
    // if (!categoryResult.success) {
    //   console.error('Failed to recalculate categories:', categoryResult.error);
    // } else {
    //   console.log(`Categories recalculated: ${categoryResult.legendCount} Legend / ${categoryResult.totalPlayers! - categoryResult.legendCount!} Classic`);
    // }

    return NextResponse.json({
      success: true,
      message: 'Player points and ratings updated successfully (categories not auto-updated)',
      updates,
      // categoryUpdate: categoryResult
    });
  } catch (error) {
    console.error('Error updating player points:', error);
    return NextResponse.json(
      { error: 'Failed to update player points' },
      { status: 500 }
    );
  }
}
