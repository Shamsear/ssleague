import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

// Base points by star rating (same as update-points API)
const STAR_RATING_BASE_POINTS: { [key: number]: number } = {
  3: 100,
  4: 120,
  5: 145,
  6: 175,
  7: 210,
  8: 250,
  9: 300,
  10: 375,
};

export async function POST(request: NextRequest) {
  try {
    const { seasonId, players } = await request.json();

    if (!seasonId || !players || !Array.isArray(players)) {
      return NextResponse.json(
        { error: 'Missing required fields: seasonId and players array' },
        { status: 400 }
      );
    }

    const isModernSeason = (season: string) => {
      const seasonNum = parseInt(season.replace(/\D/g, '')) || 0;
      return seasonNum >= 16;
    };

    const sql = getTournamentDb();
    let updatedCount = 0;

    // Update players in Neon
    for (const player of players) {
      const { id, starRating, categoryId, categoryName } = player;
      
      if (!id || !starRating) continue;

      // Calculate base points based on star rating
      const points = STAR_RATING_BASE_POINTS[starRating] || 100;

      if (isModernSeason(seasonId)) {
        // For Season 16+: Update player_seasons table
        // Use composite ID: player_id_season_id
        const compositeId = `${id}_${seasonId}`;
        
        const result = await sql`
          UPDATE player_seasons
          SET star_rating = ${starRating}, 
              points = ${points},
              category = ${categoryName || null},
              updated_at = NOW()
          WHERE id = ${compositeId}
          RETURNING id
        `;
        
        if (result.length > 0) updatedCount++;
      } else {
        // For historical seasons: Update realplayerstats table
        const compositeId = `${id}_${seasonId}`;
        
        const result = await sql`
          UPDATE realplayerstats
          SET star_rating = ${starRating},
              points = ${points},
              category = ${categoryName || null},
              updated_at = NOW()
          WHERE id = ${compositeId}
          RETURNING id
        `;
        
        if (result.length > 0) updatedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully updated ${updatedCount} out of ${players.length} players with ratings, points, and categories`,
      updatedCount,
    });
  } catch (error) {
    console.error('Error assigning player ratings:', error);
    return NextResponse.json(
      { error: 'Failed to assign player ratings', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
