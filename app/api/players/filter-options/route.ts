import { NextResponse } from 'next/server';
import { sql } from '@/lib/neon/config';

// Cache the filter options for 5 minutes
let cachedData: any = null;
let cacheTime: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const position = searchParams.get('position') || '';
    const positionGroup = searchParams.get('position_group') || '';
    const playingStyle = searchParams.get('playing_style') || '';
    const teamId = searchParams.get('team_id') || '';
    const starredOnly = searchParams.get('starred_only') === 'true';
    
    // If any filter is applied, don't use cache and build dynamic query
    if (position || positionGroup || playingStyle || teamId || starredOnly) {
      // Build WHERE conditions dynamically
      let query = `
        SELECT 
          ARRAY_AGG(DISTINCT position ORDER BY position) FILTER (WHERE position IS NOT NULL) as positions,
          ARRAY_AGG(DISTINCT position_group ORDER BY position_group) FILTER (WHERE position_group IS NOT NULL) as position_groups,
          ARRAY_AGG(DISTINCT playing_style ORDER BY playing_style) FILTER (WHERE playing_style IS NOT NULL) as playing_styles
        FROM footballplayers
        WHERE 1=1
      `;
      
      const params: any[] = [];
      let paramIndex = 1;
      
      if (position) {
        query += ` AND position = $${paramIndex}`;
        params.push(position);
        paramIndex++;
      }
      if (positionGroup) {
        query += ` AND position_group = $${paramIndex}`;
        params.push(positionGroup);
        paramIndex++;
      }
      if (playingStyle) {
        query += ` AND playing_style = $${paramIndex}`;
        params.push(playingStyle);
        paramIndex++;
      }
      if (teamId) {
        if (teamId === 'free_agent') {
          query += ` AND team_id IS NULL`;
        } else {
          query += ` AND team_id = $${paramIndex}`;
          params.push(teamId);
          paramIndex++;
        }
      }
      if (starredOnly) {
        query += ` AND is_starred = true`;
      }
      
      // Use sql.query for dynamic queries with parameters
      const result = await sql.query(query, params);
      
      const data = {
        positions: result[0]?.positions || [],
        positionGroups: result[0]?.position_groups || [],
        playingStyles: result[0]?.playing_styles || []
      };
      
      return NextResponse.json({
        success: true,
        data,
        cached: false
      });
    }
    
    // Return cached data if still valid (for general filter options)
    const now = Date.now();
    if (cachedData && (now - cacheTime) < CACHE_DURATION) {
      return NextResponse.json({
        success: true,
        data: cachedData,
        cached: true
      });
    }

    // Fetch all distinct values in a single query for better performance
    const result = await sql`
      SELECT 
        ARRAY_AGG(DISTINCT position ORDER BY position) FILTER (WHERE position IS NOT NULL) as positions,
        ARRAY_AGG(DISTINCT position_group ORDER BY position_group) FILTER (WHERE position_group IS NOT NULL) as position_groups,
        ARRAY_AGG(DISTINCT playing_style ORDER BY playing_style) FILTER (WHERE playing_style IS NOT NULL) as playing_styles
      FROM footballplayers
    `;
    
    const data = {
      positions: result[0].positions || [],
      positionGroups: result[0].position_groups || [],
      playingStyles: result[0].playing_styles || []
    };

    // Update cache
    cachedData = data;
    cacheTime = now;

    return NextResponse.json({
      success: true,
      data,
      cached: false
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
      }
    });
  } catch (error: any) {
    console.error('Error fetching filter options:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch filter options'
      },
      { status: 500 }
    );
  }
}
