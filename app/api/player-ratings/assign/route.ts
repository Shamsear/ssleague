import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import { getMinimumAuctionValue, calculateRealPlayerSalary } from '@/lib/contracts';
import { adminDb } from '@/lib/firebase/admin';

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
    
    // Fetch star rating configuration from Firebase
    const seasonDoc = await adminDb.collection('seasons').doc(seasonId).get();
    const seasonData = seasonDoc.exists ? seasonDoc.data() : null;
    const starRatingConfigArray = seasonData?.star_rating_config || [];
    
    // Create a map for quick lookup
    const configMap = new Map<number, { auctionValue: number; points: number }>();
    if (Array.isArray(starRatingConfigArray)) {
      starRatingConfigArray.forEach((config: any) => {
        configMap.set(config.star_rating, {
          auctionValue: config.base_auction_value || getMinimumAuctionValue(config.star_rating),
          points: config.starting_points || STAR_RATING_BASE_POINTS[config.star_rating] || 100,
        });
      });
    }
    
    console.log(`Loaded star rating config from Firebase for ${starRatingConfigArray.length} star ratings`);
    if (starRatingConfigArray.length === 0) {
      console.warn('No star rating config found in Firebase, will use fallback values');
    }

    // Update players in Neon
    for (const player of players) {
      const { id, starRating, categoryId, categoryName } = player;
      
      if (!id || !starRating) continue;

      // Get config from database or use fallback
      const config = configMap.get(starRating);
      const points = config?.points || STAR_RATING_BASE_POINTS[starRating] || 100;
      const auctionValue = config?.auctionValue || getMinimumAuctionValue(starRating);
      
      // Calculate salary based on auction value and star rating
      const salaryPerMatch = calculateRealPlayerSalary(auctionValue, starRating);
      
      console.log(`Player ${id}: ${starRating}★ → Auction: $${auctionValue}, Points: ${points}, Salary: $${salaryPerMatch.toFixed(2)}/match`);

      if (isModernSeason(seasonId)) {
        // For Season 16+: Update player_seasons table
        // Use composite ID: player_id_season_id
        const compositeId = `${id}_${seasonId}`;
        
        const result = await sql`
          UPDATE player_seasons
          SET star_rating = ${starRating}, 
              points = ${points},
              auction_value = ${auctionValue},
              salary_per_match = ${salaryPerMatch},
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
              auction_value = ${auctionValue},
              salary_per_match = ${salaryPerMatch},
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
      message: `Successfully updated ${updatedCount} out of ${players.length} players with ratings, points, auction values, and categories`,
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
