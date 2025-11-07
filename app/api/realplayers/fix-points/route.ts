import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-helper';
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
  10: 375,
};

/**
 * Recalculate all players' points based on star rating base + match results
 * This fixes any incorrect points that were calculated using the old category system
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(['committee'], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { season_id } = body;

    if (!season_id) {
      return NextResponse.json(
        { error: 'season_id is required' },
        { status: 400 }
      );
    }

    const sql = getTournamentDb();
    
    // Get all players for this season with their match history
    const players = await sql`
      SELECT 
        ps.id,
        ps.player_id,
        ps.player_name,
        ps.season_id,
        ps.star_rating,
        ps.matches_played,
        ps.goals_scored,
        ps.goals_conceded,
        ps.processed_fixtures
      FROM player_seasons ps
      WHERE ps.season_id = ${season_id}
      ORDER BY ps.player_name
    `;

    console.log(`Found ${players.length} players in season ${season_id}`);

    const updates: any[] = [];
    const errors: any[] = [];

    for (const player of players) {
      try {
        const starRating = player.star_rating || 3;
        const basePoints = STAR_RATING_BASE_POINTS[starRating] || 100;
        
        // Calculate total GD from all matches
        // We need to get match-by-match results to calculate GD properly
        const processedFixtures = player.processed_fixtures || [];
        let totalPointsChange = 0;

        // For each fixture, we need to calculate the GD
        // However, we don't have per-fixture GD stored, only total goals scored/conceded
        // So we'll use a simplified approach: assume average GD per match
        
        const matchesPlayed = player.matches_played || 0;
        if (matchesPlayed > 0) {
          const totalGoalDifference = (player.goals_scored || 0) - (player.goals_conceded || 0);
          // Each match contributes -5 to +5 points based on GD
          // We'll distribute the total GD across matches, capped at ±5 per match
          const avgGDPerMatch = totalGoalDifference / matchesPlayed;
          const pointsPerMatch = Math.max(-5, Math.min(5, avgGDPerMatch));
          totalPointsChange = Math.round(pointsPerMatch * matchesPlayed);
        }

        const newPoints = basePoints + totalPointsChange;

        // Update player points
        await sql`
          UPDATE player_seasons
          SET points = ${newPoints},
              updated_at = NOW()
          WHERE id = ${player.id}
        `;

        updates.push({
          player_id: player.player_id,
          player_name: player.player_name,
          star_rating: starRating,
          base_points: basePoints,
          points_from_matches: totalPointsChange,
          new_points: newPoints,
          matches_played: matchesPlayed,
          gd: (player.goals_scored || 0) - (player.goals_conceded || 0)
        });

        console.log(`✅ ${player.player_name}: ${basePoints} (base) + ${totalPointsChange} (matches) = ${newPoints} points`);
      } catch (error) {
        console.error(`❌ Error updating ${player.player_name}:`, error);
        errors.push({
          player_id: player.player_id,
          player_name: player.player_name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Recalculated points for ${updates.length} players`,
      season_id,
      updates,
      errors: errors.length > 0 ? errors : undefined,
      note: 'Points calculated as: star_rating_base_points + (goal_difference distributed across matches, capped at ±5 per match)'
    });
  } catch (error) {
    console.error('Error fixing player points:', error);
    return NextResponse.json(
      { error: 'Failed to fix player points' },
      { status: 500 }
    );
  }
}
