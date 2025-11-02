import { NextRequest, NextResponse } from 'next/server';
import { getFantasyDb } from '@/lib/neon/fantasy-config';

/**
 * POST /api/fantasy/revert-fixture-points
 * Delete fantasy points for a specific fixture
 * Used when results are being edited/reverted
 * 
 * Request body:
 * {
 *   fixture_id: string;
 *   season_id: string;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fixture_id, season_id } = body;

    if (!fixture_id || !season_id) {
      return NextResponse.json(
        { error: 'Missing required fields: fixture_id, season_id' },
        { status: 400 }
      );
    }

    const sql = getFantasyDb();

    // Get fantasy league for this season
    const leagues = await sql`
      SELECT id, league_id
      FROM fantasy_leagues
      WHERE season_id = ${season_id}
      LIMIT 1
    `;

    if (leagues.length === 0) {
      console.log('No fantasy league found for season:', season_id);
      return NextResponse.json({
        success: true,
        message: 'No fantasy league exists for this season',
        reverted: 0,
      });
    }

    const fantasyLeague = leagues[0];
    const fantasy_league_id = fantasyLeague.league_id;

    // Get all player points for this fixture before deleting
    const existingPoints = await sql`
      SELECT team_id, total_points
      FROM fantasy_player_points
      WHERE league_id = ${fantasy_league_id}
        AND fixture_id = ${fixture_id}
    `;

    if (existingPoints.length === 0) {
      console.log('No fantasy points found for fixture:', fixture_id);
      return NextResponse.json({
        success: true,
        message: 'No fantasy points to revert',
        reverted: 0,
      });
    }

    // Group points by team_id to subtract from team totals
    const teamPointsMap = new Map<string, number>();
    for (const record of existingPoints) {
      const currentTotal = teamPointsMap.get(record.team_id) || 0;
      teamPointsMap.set(record.team_id, currentTotal + record.total_points);
    }

    // Subtract points from each team's total
    for (const [teamId, pointsToSubtract] of teamPointsMap.entries()) {
      await sql`
        UPDATE fantasy_teams
        SET 
          player_points = GREATEST(0, COALESCE(player_points, 0) - ${pointsToSubtract}),
          total_points = GREATEST(0, COALESCE(total_points, 0) - ${pointsToSubtract}),
          updated_at = NOW()
        WHERE team_id = ${teamId}
      `;
      console.log(`✓ Reverted ${pointsToSubtract} points from team ${teamId}`);
    }

    // Delete fantasy_player_points records for this fixture
    const deleted = await sql`
      DELETE FROM fantasy_player_points
      WHERE league_id = ${fantasy_league_id}
        AND fixture_id = ${fixture_id}
    `;

    console.log(`✓ Deleted ${deleted.length} fantasy point records for fixture ${fixture_id}`);

    // Recalculate leaderboard ranks
    await recalculateLeaderboard(fantasy_league_id);

    return NextResponse.json({
      success: true,
      message: `Reverted fantasy points for ${existingPoints.length} player records`,
      reverted: existingPoints.length,
      teams_affected: teamPointsMap.size,
    });
  } catch (error) {
    console.error('Error reverting fantasy points:', error);
    return NextResponse.json(
      { 
        error: 'Failed to revert fantasy points',
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// Helper function to recalculate leaderboard ranks
async function recalculateLeaderboard(fantasy_league_id: string) {
  try {
    const sql = getFantasyDb();
    
    // Get all teams ordered by points
    const teams = await sql`
      SELECT id
      FROM fantasy_teams
      WHERE league_id = ${fantasy_league_id}
      ORDER BY total_points DESC, id ASC
    `;

    // Update ranks
    for (let i = 0; i < teams.length; i++) {
      await sql`
        UPDATE fantasy_teams
        SET rank = ${i + 1}, updated_at = NOW()
        WHERE id = ${teams[i].id}
      `;
    }

    console.log(`✅ Leaderboard updated for league ${fantasy_league_id}`);
  } catch (error) {
    console.error('Error recalculating leaderboard:', error);
  }
}
