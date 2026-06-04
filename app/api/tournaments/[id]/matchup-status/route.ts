import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sql = getTournamentDb();
    const { id: tournamentId } = await params;

    // Get all fixtures with matchup status
    const fixtures = await sql`
      SELECT 
        f.id as fixture_id,
        f.round_number,
        f.match_number,
        f.home_team_id,
        f.home_team_name,
        f.away_team_id,
        f.away_team_name,
        f.status,
        f.leg,
        f.matchup_mode,
        f.matchups_created_by,
        f.matchups_created_at,
        -- Count matchups
        COALESCE((
          SELECT COUNT(*) 
          FROM matchups 
          WHERE fixture_id = f.id
        ), 0) as matchup_count,
        -- Get team that created matchups name (from user who created it)
        CASE
          WHEN f.matchups_created_by IS NOT NULL THEN
            CASE
              WHEN f.matchups_created_by = 'system_auto' THEN 'System (Auto)'
              WHEN f.home_team_id IN (
                SELECT team_id FROM team_members WHERE user_id = f.matchups_created_by
              ) THEN f.home_team_name
              WHEN f.away_team_id IN (
                SELECT team_id FROM team_members WHERE user_id = f.matchups_created_by
              ) THEN f.away_team_name
              ELSE 'Unknown'
            END
          ELSE NULL
        END as created_by_team_name,
        -- Check if lineups submitted
        EXISTS(
          SELECT 1 FROM lineups 
          WHERE fixture_id = f.id 
            AND team_id = f.home_team_id
            AND submitted_at IS NOT NULL
        ) as home_lineup_submitted,
        EXISTS(
          SELECT 1 FROM lineups 
          WHERE fixture_id = f.id 
            AND team_id = f.away_team_id
            AND submitted_at IS NOT NULL
        ) as away_lineup_submitted
      FROM fixtures f
      WHERE f.tournament_id = ${tournamentId}
        AND f.status IN ('scheduled', 'in_progress', 'completed')
      ORDER BY f.round_number ASC, f.match_number ASC
    `;

    return NextResponse.json({
      success: true,
      fixtures: fixtures,
      count: fixtures.length
    });
  } catch (error: any) {
    console.error('Error fetching matchup status:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch matchup status' },
      { status: 500 }
    );
  }
}
