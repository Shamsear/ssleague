import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase/config';
import { collection, query, getDocs, where } from 'firebase/firestore';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('seasonId');

    // Get all players or players from a specific season
    const playersRef = collection(db, 'real_players');
    let q;
    
    if (seasonId) {
      q = query(playersRef, where('season_id', '==', seasonId));
    } else {
      q = playersRef;
    }

    const querySnapshot = await getDocs(q);
    
    // Extract unique categories
    const categoriesSet = new Set<string>();
    const categoryStats = new Map<string, {
      count: number;
      seasons: Set<string>;
      teams: Set<string>;
    }>();

    querySnapshot.docs.forEach(doc => {
      const player = doc.data();
      const category = player.category?.trim();
      
      if (category) {
        categoriesSet.add(category);
        
        if (!categoryStats.has(category)) {
          categoryStats.set(category, {
            count: 0,
            seasons: new Set(),
            teams: new Set()
          });
        }
        
        const stats = categoryStats.get(category)!;
        stats.count++;
        
        if (player.season_id) {
          stats.seasons.add(player.season_id);
        }
        
        if (player.team_name) {
          stats.teams.add(player.team_name);
        }
      }
    });

    // Convert to array and add statistics
    const categories = Array.from(categoriesSet).sort().map(category => {
      const stats = categoryStats.get(category)!;
      return {
        category,
        player_count: stats.count,
        seasons_used: Array.from(stats.seasons),
        teams_used: Array.from(stats.teams),
        seasons_count: stats.seasons.size,
        teams_count: stats.teams.size
      };
    });

    return NextResponse.json({
      success: true,
      categories,
      total_categories: categories.length,
      summary: {
        total_players: querySnapshot.size,
        season_filter: seasonId || 'all',
        most_used_category: categories.length > 0 ? 
          categories.reduce((prev, current) => (prev.player_count > current.player_count) ? prev : current) : 
          null
      }
    });

  } catch (error: any) {
    console.error('Error fetching player categories:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch player categories' },
      { status: 500 }
    );
  }
}