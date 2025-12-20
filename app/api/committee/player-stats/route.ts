import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const season_id = searchParams.get('season_id') || 'SSPSLS16';

    const sql = getTournamentDb();

    const players = await sql`
      SELECT 
        id,
        player_id,
        player_name,
        season_id,
        team,
        points,
        base_points,
        matches_played,
        goals_scored,
        goals_conceded,
        (goals_scored - goals_conceded) as goal_difference,
        wins,
        draws,
        losses,
        clean_sheets,
        assists,
        auction_value,
        star_rating,
        salary_per_match
      FROM player_seasons
      WHERE season_id = ${season_id}
      ORDER BY points DESC, goal_difference DESC, goals_scored DESC
    `;

    // Debug logging
    console.log('[Committee Player Stats API] Season:', season_id);
    console.log('[Committee Player Stats API] Total players:', players.length);
    if (players.length > 0) {
      console.log('[Committee Player Stats API] First player:', {
        player_id: players[0].player_id,
        player_name: players[0].player_name,
        points: players[0].points,
        base_points: players[0].base_points
      });
    }

    return NextResponse.json({ players });
  } catch (error) {
    console.error('Error fetching player stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch player stats' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      player_id,
      points,
      base_points,
      matches_played,
      goals_scored,
      goals_conceded,
      wins,
      draws,
      losses,
      clean_sheets,
      assists
    } = body;

    if (!player_id) {
      return NextResponse.json(
        { error: 'player_id is required' },
        { status: 400 }
      );
    }

    // Enforce minimum points of 100
    const validatedPoints = Math.max(100, points || 100);

    const sql = getTournamentDb();

    // Calculate star rating from points
    function calculateStarRating(pts: number): number {
      if (pts >= 350) return 10;
      if (pts >= 300) return 9;
      if (pts >= 250) return 8;
      if (pts >= 210) return 7;
      if (pts >= 175) return 6;
      if (pts >= 145) return 5;
      if (pts >= 120) return 4;
      return 3;
    }

    // Get current player data to check auction value
    const currentData = await sql`
      SELECT auction_value, star_rating, salary_per_match
      FROM player_seasons
      WHERE id = ${player_id}
    `;

    if (currentData.length === 0) {
      return NextResponse.json(
        { error: 'Player not found' },
        { status: 404 }
      );
    }

    const auctionValue = currentData[0].auction_value || 0;
    const oldStarRating = currentData[0].star_rating || 3;
    const oldSalary = parseFloat(currentData[0].salary_per_match) || 0;

    // Calculate new star rating based on validated points
    const newStarRating = calculateStarRating(validatedPoints);

    // Calculate new salary if star rating changed
    // Formula: (auction_value / 100) * star_rating / 10
    const newSalary = (auctionValue / 100) * newStarRating / 10;

    // Log the changes
    console.log('[Committee Player Stats API] Updating player:', player_id);
    console.log('  Points:', validatedPoints, points !== validatedPoints ? `(enforced minimum from ${points})` : '');
    console.log('  Star Rating:', oldStarRating, '→', newStarRating, newStarRating !== oldStarRating ? '(CHANGED)' : '');
    console.log('  Salary:', oldSalary.toFixed(2), '→', newSalary.toFixed(2), newStarRating !== oldStarRating ? '(RECALCULATED)' : '');

    await sql`
      UPDATE player_seasons
      SET
        points = ${validatedPoints},
        star_rating = ${newStarRating},
        salary_per_match = ${newSalary},
        base_points = ${base_points},
        matches_played = ${matches_played},
        goals_scored = ${goals_scored},
        goals_conceded = ${goals_conceded},
        wins = ${wins},
        draws = ${draws},
        losses = ${losses},
        clean_sheets = ${clean_sheets},
        assists = ${assists},
        updated_at = NOW()
      WHERE id = ${player_id}
    `;

    return NextResponse.json({ 
      success: true,
      starRatingChanged: newStarRating !== oldStarRating,
      oldStarRating,
      newStarRating,
      oldSalary: oldSalary.toFixed(2),
      newSalary: newSalary.toFixed(2)
    });
  } catch (error) {
    console.error('Error updating player stats:', error);
    return NextResponse.json(
      { error: 'Failed to update player stats' },
      { status: 500 }
    );
  }
}
