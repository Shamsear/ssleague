import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getTournamentDb } from '@/lib/neon/tournament-config';

// Recalculate categories for a specific season
// Top 50% by points = Legend, Bottom 50% = Classic
async function recalculateSeasonCategories(season_id: string) {
  try {
    console.log(`Recalculating categories for season: ${season_id}`);
    
    // Determine if this is a modern season (16+)
    const isModernSeason = (season: string) => {
      const seasonNum = parseInt(season.replace(/\D/g, '')) || 0;
      return seasonNum >= 16;
    };
    
    const sql = getTournamentDb();
    let allPlayersData;
    
    if (isModernSeason(season_id)) {
      // Season 16+: Query player_seasons
      allPlayersData = await sql`
        SELECT id, player_id, player_name, star_rating, points, category
        FROM player_seasons
        WHERE season_id = ${season_id}
      `;
    } else {
      // Season 1-15: Query realplayerstats
      allPlayersData = await sql`
        SELECT id, player_id, player_name, star_rating, points, category
        FROM realplayerstats
        WHERE season_id = ${season_id}
      `;
    }
    
    if (allPlayersData.length === 0) {
      return { 
        success: false, 
        error: `No players found for season ${season_id}` 
      };
    }
    
    // Create array of players with their star ratings
    const players = allPlayersData.map((player: any) => ({
      id: player.id,
      playerId: player.player_id,
      playerName: player.player_name,
      starRating: player.star_rating || 3,
      points: player.points || 100,
      oldCategory: player.category || 'unknown'
    }));
    
    console.log(`Found ${players.length} players in season ${season_id}`);
    
    // Sort by points (most granular metric) - highest first
    // Star rating is derived from points, so points is the source of truth
    players.sort((a, b) => b.points - a.points);
    
    // Calculate top 50% threshold
    const legendThreshold = Math.ceil(players.length / 2);
    
    console.log(`Legend threshold: Top ${legendThreshold} players out of ${players.length}`);
    
    // Update categories for all players
    const updates: any[] = [];
    const updatePromises = players.map(async (player, index) => {
      const isLegend = index < legendThreshold;
      const newCategory = isLegend ? 'legend' : 'classic';
      const newCategoryName = isLegend ? 'Legend' : 'Classic';
      
      // Update in Neon
      if (isModernSeason(season_id)) {
        await sql`
          UPDATE player_seasons
          SET category = ${newCategory}, updated_at = NOW()
          WHERE id = ${player.id}
        `;
      } else {
        await sql`
          UPDATE realplayerstats
          SET category = ${newCategory}, updated_at = NOW()
          WHERE id = ${player.id}
        `;
      }
      
      updates.push({
        playerId: player.playerId,
        playerName: player.playerName,
        starRating: player.starRating,
        points: player.points,
        oldCategory: player.oldCategory,
        newCategory: newCategory,
        rank: index + 1
      });
      
      return { 
        playerId: player.playerId, 
        category: newCategoryName, 
        rank: index + 1 
      };
    });
    
    await Promise.all(updatePromises);
    
    const legendCount = updates.filter(u => u.newCategory === 'legend').length;
    const classicCount = updates.filter(u => u.newCategory === 'classic').length;
    
    console.log(`✅ Categories updated: ${legendCount} Legend / ${classicCount} Classic`);
    
    return { 
      success: true, 
      totalPlayers: players.length, 
      legendCount,
      classicCount,
      updates 
    };
  } catch (error) {
    console.error('Error recalculating categories:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to recalculate categories' 
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { season_id } = body;

    if (!season_id) {
      return NextResponse.json(
        { error: 'season_id is required' },
        { status: 400 }
      );
    }

    const result = await recalculateSeasonCategories(season_id);
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: `Categories recalculated for season ${season_id}`,
      ...result
    });
  } catch (error) {
    console.error('Error in recalculate-categories API:', error);
    return NextResponse.json(
      { error: 'Failed to recalculate categories' },
      { status: 500 }
    );
  }
}
