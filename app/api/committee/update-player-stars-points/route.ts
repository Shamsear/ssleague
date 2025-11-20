import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-helper';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import { calculateRealPlayerSalary } from '@/lib/contracts';

interface PlayerUpdate {
  player_id: string;
  season_id: string;
  star_rating: number;
  points: number;
}

export async function POST(request: NextRequest) {
  try {
    // Verify committee admin auth
    const auth = await verifyAuth(['committee_admin'], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { updates } = body;

    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json(
        { error: 'Missing required field: updates array' },
        { status: 400 }
      );
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No updates provided' },
        { status: 400 }
      );
    }

    // Validate updates
    for (const update of updates) {
      const { player_id, season_id, star_rating, points } = update;
      
      if (!player_id || !season_id) {
        return NextResponse.json(
          { error: 'Each update must have player_id and season_id' },
          { status: 400 }
        );
      }

      if (star_rating < 3 || star_rating > 10) {
        return NextResponse.json(
          { error: 'Star rating must be between 3 and 10' },
          { status: 400 }
        );
      }

      if (points < 0) {
        return NextResponse.json(
          { error: 'Points cannot be negative' },
          { status: 400 }
        );
      }
    }

    const sql = getTournamentDb();
    const results = [];

    // Process each update
    for (const update of updates) {
      const { player_id, season_id, star_rating, points } = update;
      
      try {
        const compositeId = `${player_id}_${season_id}`;
        
        // First, get current player data to calculate salary
        const playerData = await sql`
          SELECT 
            id,
            player_id,
            player_name,
            team_id,
            auction_value,
            star_rating as current_star_rating,
            points as current_points,
            salary_per_match as current_salary
          FROM player_seasons
          WHERE id = ${compositeId}
        `;

        if (playerData.length === 0) {
          results.push({
            player_id,
            season_id,
            success: false,
            error: 'Player not found in season'
          });
          continue;
        }

        const player = playerData[0];
        
        // Calculate new salary based on new star rating
        let newSalary = null;
        if (player.team_id && player.auction_value) {
          // Only calculate salary if player is assigned to a team and has auction value
          newSalary = calculateRealPlayerSalary(player.auction_value, star_rating);
        }

        // Update player with new star rating, points, and calculated salary
        await sql`
          UPDATE player_seasons
          SET 
            star_rating = ${star_rating},
            points = ${points},
            salary_per_match = ${newSalary},
            updated_at = NOW()
          WHERE id = ${compositeId}
        `;

        results.push({
          player_id,
          season_id,
          player_name: player.player_name,
          previous_star_rating: player.current_star_rating,
          new_star_rating: star_rating,
          previous_points: player.current_points,
          new_points: points,
          previous_salary: player.current_salary,
          new_salary: newSalary,
          success: true
        });

        console.log(`✅ Updated ${player.player_name}: ${star_rating}⭐, ${points} pts${newSalary ? `, ₹${newSalary}/match` : ''}`);
        
      } catch (error) {
        console.error(`Failed to update player ${player_id}:`, error);
        results.push({
          player_id,
          season_id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      message: `Updated ${successCount} player(s)${failCount > 0 ? `, ${failCount} failed` : ''}`,
      results,
      summary: {
        total: updates.length,
        successful: successCount,
        failed: failCount
      }
    });

  } catch (error) {
    console.error('Error updating player stars and points:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update players' },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to fetch players for a season with current ratings
 */
export async function GET(request: NextRequest) {
  try {
    // Verify committee admin auth
    const auth = await verifyAuth(['committee_admin'], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('seasonId');
    const search = searchParams.get('search') || '';
    const teamId = searchParams.get('teamId');
    const category = searchParams.get('category');

    if (!seasonId) {
      return NextResponse.json(
        { error: 'seasonId is required' },
        { status: 400 }
      );
    }

    const sql = getTournamentDb();
    
    // Build query with filters using Neon SQL template
    let players;
    
    if (search && teamId && category) {
      players = await sql`
        SELECT 
          ps.id,
          ps.player_id,
          ps.player_name,
          ps.team_id,
          ps.team as team_name,
          ps.category,
          ps.star_rating,
          ps.points,
          ps.auction_value,
          ps.salary_per_match,
          ps.status,
          ps.updated_at
        FROM player_seasons ps
        WHERE ps.season_id = ${seasonId}
          AND ps.player_name ILIKE ${`%${search}%`}
          AND ps.team_id = ${teamId}
          AND ps.category = ${category}
        ORDER BY ps.player_name ASC
        LIMIT 500
      `;
    } else if (search && teamId) {
      players = await sql`
        SELECT 
          ps.id,
          ps.player_id,
          ps.player_name,
          ps.team_id,
          ps.team as team_name,
          ps.category,
          ps.star_rating,
          ps.points,
          ps.auction_value,
          ps.salary_per_match,
          ps.status,
          ps.updated_at
        FROM player_seasons ps
        WHERE ps.season_id = ${seasonId}
          AND ps.player_name ILIKE ${`%${search}%`}
          AND ps.team_id = ${teamId}
        ORDER BY ps.player_name ASC
        LIMIT 500
      `;
    } else if (search && category) {
      players = await sql`
        SELECT 
          ps.id,
          ps.player_id,
          ps.player_name,
          ps.team_id,
          ps.team as team_name,
          ps.category,
          ps.star_rating,
          ps.points,
          ps.auction_value,
          ps.salary_per_match,
          ps.status,
          ps.updated_at
        FROM player_seasons ps
        WHERE ps.season_id = ${seasonId}
          AND ps.player_name ILIKE ${`%${search}%`}
          AND ps.category = ${category}
        ORDER BY ps.player_name ASC
        LIMIT 500
      `;
    } else if (teamId && category) {
      players = await sql`
        SELECT 
          ps.id,
          ps.player_id,
          ps.player_name,
          ps.team_id,
          ps.team as team_name,
          ps.category,
          ps.star_rating,
          ps.points,
          ps.auction_value,
          ps.salary_per_match,
          ps.status,
          ps.updated_at
        FROM player_seasons ps
        WHERE ps.season_id = ${seasonId}
          AND ps.team_id = ${teamId}
          AND ps.category = ${category}
        ORDER BY ps.player_name ASC
        LIMIT 500
      `;
    } else if (search) {
      players = await sql`
        SELECT 
          ps.id,
          ps.player_id,
          ps.player_name,
          ps.team_id,
          ps.team as team_name,
          ps.category,
          ps.star_rating,
          ps.points,
          ps.auction_value,
          ps.salary_per_match,
          ps.status,
          ps.updated_at
        FROM player_seasons ps
        WHERE ps.season_id = ${seasonId}
          AND ps.player_name ILIKE ${`%${search}%`}
        ORDER BY ps.player_name ASC
        LIMIT 500
      `;
    } else if (teamId) {
      players = await sql`
        SELECT 
          ps.id,
          ps.player_id,
          ps.player_name,
          ps.team_id,
          ps.team as team_name,
          ps.category,
          ps.star_rating,
          ps.points,
          ps.auction_value,
          ps.salary_per_match,
          ps.status,
          ps.updated_at
        FROM player_seasons ps
        WHERE ps.season_id = ${seasonId}
          AND ps.team_id = ${teamId}
        ORDER BY ps.player_name ASC
        LIMIT 500
      `;
    } else if (category) {
      players = await sql`
        SELECT 
          ps.id,
          ps.player_id,
          ps.player_name,
          ps.team_id,
          ps.team as team_name,
          ps.category,
          ps.star_rating,
          ps.points,
          ps.auction_value,
          ps.salary_per_match,
          ps.status,
          ps.updated_at
        FROM player_seasons ps
        WHERE ps.season_id = ${seasonId}
          AND ps.category = ${category}
        ORDER BY ps.player_name ASC
        LIMIT 500
      `;
    } else {
      players = await sql`
        SELECT 
          ps.id,
          ps.player_id,
          ps.player_name,
          ps.team_id,
          ps.team as team_name,
          ps.category,
          ps.star_rating,
          ps.points,
          ps.auction_value,
          ps.salary_per_match,
          ps.status,
          ps.updated_at
        FROM player_seasons ps
        WHERE ps.season_id = ${seasonId}
        ORDER BY ps.player_name ASC
        LIMIT 500
      `;
    }

    return NextResponse.json({
      success: true,
      data: players,
      total: players.length
    });

  } catch (error) {
    console.error('Error fetching players:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch players' },
      { status: 500 }
    );
  }
}