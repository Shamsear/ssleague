import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
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
 * Initialize star ratings and points for all real players
 * This should be run once to set up the rating system for existing players
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { confirm } = body;

    if (confirm !== 'INITIALIZE_ALL_PLAYERS') {
      return NextResponse.json(
        { error: 'Please confirm initialization by passing confirm: "INITIALIZE_ALL_PLAYERS"' },
        { status: 400 }
      );
    }

    // Get season_id from request
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('season_id');
    
    if (!seasonId) {
      return NextResponse.json(
        { error: 'season_id is required' },
        { status: 400 }
      );
    }
    
    // Determine if this is a modern season (16+)
    const isModernSeason = (season: string) => {
      const seasonNum = parseInt(season.replace(/\D/g, '')) || 0;
      return seasonNum >= 16;
    };
    
    const sql = getTournamentDb();
    let playersData;
    
    if (isModernSeason(seasonId)) {
      // Season 16+: Query player_seasons
      playersData = await sql`
        SELECT id, player_id, player_name, star_rating, points
        FROM player_seasons
        WHERE season_id = ${seasonId}
      `;
    } else {
      // Season 1-15: Query realplayerstats
      playersData = await sql`
        SELECT id, player_id, player_name, star_rating, points
        FROM realplayerstats
        WHERE season_id = ${seasonId}
      `;
    }

    const updates: any[] = [];
    let updatedCount = 0;
    let skippedCount = 0;

    for (const player of playersData) {
      const playerId = player.player_id;
      const currentPoints = player.points;
      const currentStarRating = player.star_rating;

      // Initialize based on existing star rating or set to 3
      let starRating = currentStarRating || 3;
      let points = currentPoints;

      // If no points set, use base points for the star rating
      if (points === undefined || points === null || points === 0) {
        points = STAR_RATING_BASE_POINTS[starRating] || 100;
      } else {
        // If points exist, recalculate star rating
        starRating = calculateStarRating(points);
      }
      
      // Skip if already has both points and matching star rating
      if (currentPoints === points && currentStarRating === starRating) {
        skippedCount++;
        continue;
      }
      
      // Update the player in Neon
      if (isModernSeason(seasonId)) {
        await sql`
          UPDATE player_seasons
          SET points = ${points}, star_rating = ${starRating}, updated_at = NOW()
          WHERE id = ${player.id}
        `;
      } else {
        await sql`
          UPDATE realplayerstats
          SET points = ${points}, star_rating = ${starRating}, updated_at = NOW()
          WHERE id = ${player.id}
        `;
      }

      updatedCount++;
      updates.push({
        player_id: playerId,
        name: player.player_name,
        points: points,
        star_rating: starRating,
      });
    }

    // After updating all players, recalculate categories
    console.log('Recalculating categories...');
    const categoryResult = await recalculateAllPlayerCategories();

    return NextResponse.json({
      success: true,
      message: `Initialized ${updatedCount} players, skipped ${skippedCount} already initialized`,
      totalPlayers: playersData.length,
      updatedCount,
      skippedCount,
      updates: updates.slice(0, 10), // Show first 10 for preview
      categoryUpdate: categoryResult,
    });
  } catch (error) {
    console.error('Error initializing player ratings:', error);
    return NextResponse.json(
      { error: 'Failed to initialize player ratings' },
      { status: 500 }
    );
  }
}

// Recalculate categories for ALL players based on league-wide ranking
async function recalculateAllPlayerCategories() {
  try {
    // Get all realplayers
    const allPlayersSnap = await adminDb.collection('realplayer').get();
    
    // Create array of players with their star ratings
    const players: Array<{ docId: string; playerId: string; starRating: number; points: number }> = [];
    
    allPlayersSnap.forEach((doc: any) => {
      const data = doc.data();
      players.push({
        docId: doc.id,
        playerId: data.player_id,
        starRating: data.star_rating || 3,
        points: data.points || 100
      });
    });
    
    // Sort by star rating (then points as tiebreaker) - highest first
    players.sort((a, b) => {
      if (b.starRating !== a.starRating) {
        return b.starRating - a.starRating;
      }
      return b.points - a.points;
    });
    
    // Calculate top 50% threshold
    const legendThreshold = Math.ceil(players.length / 2);
    
    // Update categories for all players
    const updatePromises = players.map(async (player, index) => {
      const isLegend = index < legendThreshold;
      const category = isLegend 
        ? { id: 'legend', name: 'Legend' }
        : { id: 'classic', name: 'Classic' };
      
      // Update realplayer document
      await adminDb.collection('realplayer').doc(player.docId).update({
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
