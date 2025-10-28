import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

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

    // Update only categories in Neon (not star ratings or points)
    for (const player of players) {
      const { id, categoryId, categoryName } = player;
      
      if (!id) continue;

      if (isModernSeason(seasonId)) {
        // For Season 16+: Update player_seasons table
        // Use composite ID: player_id_season_id
        const compositeId = `${id}_${seasonId}`;
        
        const result = await sql`
          UPDATE player_seasons
          SET category = ${categoryName || null},
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
          SET category = ${categoryName || null},
              updated_at = NOW()
          WHERE id = ${compositeId}
          RETURNING id
        `;
        
        if (result.length > 0) updatedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully recalculated categories for ${updatedCount} out of ${players.length} players`,
      updatedCount,
    });
  } catch (error) {
    console.error('Error recalculating categories:', error);
    return NextResponse.json(
      { error: 'Failed to recalculate categories', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
