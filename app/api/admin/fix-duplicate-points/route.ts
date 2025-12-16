import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

const sql = getTournamentDb();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'analyze') {
      // Find players with duplicate stats by comparing player_seasons with actual matchup data
      const duplicates = await sql`
        WITH all_player_matches AS (
          SELECT 
            home_player_id as player_id, 
            season_id, 
            fixture_id, 
            home_goals as goals_scored
          FROM matchups 
          WHERE home_player_id IS NOT NULL AND result_entered_at IS NOT NULL
          UNION ALL
          SELECT 
            away_player_id as player_id, 
            season_id, 
            fixture_id, 
            away_goals as goals_scored
          FROM matchups 
          WHERE away_player_id IS NOT NULL AND result_entered_at IS NOT NULL
        ),
        player_actual_stats AS (
          SELECT 
            player_id,
            season_id,
            COUNT(DISTINCT fixture_id) as actual_matches,
            SUM(COALESCE(goals_scored, 0)) as actual_goals
          FROM all_player_matches
          GROUP BY player_id, season_id
        )
        SELECT 
          ps.id,
          ps.player_id,
          ps.player_name,
          ps.season_id,
          ps.points as current_points,
          ps.goals_scored as current_goals,
          COALESCE(pas.actual_goals, 0) as correct_goals,
          ps.goals_scored - COALESCE(pas.actual_goals, 0) as goals_difference,
          ps.matches_played as current_matches,
          COALESCE(pas.actual_matches, 0) as correct_matches,
          jsonb_array_length(COALESCE(ps.processed_fixtures, '[]'::jsonb)) as recorded_fixtures
        FROM player_seasons ps
        LEFT JOIN player_actual_stats pas ON ps.player_id = pas.player_id AND ps.season_id = pas.season_id
        WHERE ps.season_id = 'SSPSLS16'
          AND (
            ps.goals_scored != COALESCE(pas.actual_goals, 0)
            OR ps.matches_played != COALESCE(pas.actual_matches, 0)
          )
        ORDER BY goals_difference DESC NULLS LAST
      `;

      return NextResponse.json({ duplicates });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error analyzing duplicate points:', error);
    return NextResponse.json(
      { error: 'Failed to analyze duplicate points' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'fix_all') {
      // Recalculate all player stats from matchups table
      const result = await sql`
        WITH all_player_matches AS (
          SELECT 
            home_player_id as player_id, 
            season_id, 
            fixture_id, 
            home_goals as goals_scored
          FROM matchups 
          WHERE home_player_id IS NOT NULL AND result_entered_at IS NOT NULL
          UNION ALL
          SELECT 
            away_player_id as player_id, 
            season_id, 
            fixture_id, 
            away_goals as goals_scored
          FROM matchups 
          WHERE away_player_id IS NOT NULL AND result_entered_at IS NOT NULL
        ),
        player_actual_stats AS (
          SELECT 
            player_id,
            season_id,
            COUNT(DISTINCT fixture_id) as actual_matches,
            SUM(COALESCE(goals_scored, 0)) as actual_goals,
            jsonb_agg(DISTINCT fixture_id ORDER BY fixture_id) as fixture_ids
          FROM all_player_matches
          GROUP BY player_id, season_id
        )
        UPDATE player_seasons ps
        SET 
          goals_scored = pas.actual_goals,
          matches_played = pas.actual_matches,
          processed_fixtures = pas.fixture_ids,
          updated_at = NOW()
        FROM player_actual_stats pas
        WHERE ps.player_id = pas.player_id 
          AND ps.season_id = pas.season_id
          AND ps.season_id = 'SSPSLS16'
          AND (
            ps.goals_scored != pas.actual_goals
            OR ps.matches_played != pas.actual_matches
          )
        RETURNING ps.id, ps.player_name, ps.goals_scored, ps.matches_played
      `;

      return NextResponse.json({
        success: true,
        fixed: result.map((r: any) => r.id),
        count: result.length,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error fixing duplicate points:', error);
    return NextResponse.json(
      { error: 'Failed to fix duplicate points' },
      { status: 500 }
    );
  }
}
