import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'analyze') {
      // Find players with duplicate points by comparing player_seasons with actual round_players data
      const duplicates = await sql`
        WITH player_actual_stats AS (
          SELECT 
            rp.player_id,
            rp.season_id,
            COUNT(DISTINCT rp.fixture_id) as actual_fixtures_played,
            SUM(rp.points) as actual_total_points,
            SUM(rp.goals_scored) as actual_goals,
            SUM(rp.assists) as actual_assists,
            SUM(CASE WHEN rp.goals_conceded = 0 THEN 1 ELSE 0 END) as actual_clean_sheets
          FROM round_players rp
          WHERE rp.points IS NOT NULL
          GROUP BY rp.player_id, rp.season_id
        )
        SELECT 
          ps.id,
          ps.player_id,
          rpl.name as player_name,
          ps.season_id,
          ps.total_points as current_points,
          pas.actual_total_points as correct_points,
          ps.total_points - pas.actual_total_points as points_difference,
          ps.goals_scored as current_goals,
          pas.actual_goals as correct_goals,
          ps.assists as current_assists,
          pas.actual_assists as correct_assists,
          array_length(ps.processed_fixtures, 1) as recorded_fixtures,
          pas.actual_fixtures_played as actual_fixtures
        FROM player_seasons ps
        JOIN player_actual_stats pas ON ps.player_id = pas.player_id AND ps.season_id = pas.season_id
        JOIN realplayers rpl ON ps.player_id = rpl.id
        WHERE ps.total_points != pas.actual_total_points
          OR ps.goals_scored != pas.actual_goals
          OR ps.assists != pas.actual_assists
        ORDER BY points_difference DESC
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
      // Recalculate all player stats from round_players
      const result = await sql`
        WITH player_actual_stats AS (
          SELECT 
            rp.player_id,
            rp.season_id,
            COUNT(DISTINCT rp.fixture_id) as fixtures_played,
            SUM(rp.points) as total_points,
            SUM(rp.goals_scored) as goals_scored,
            SUM(rp.assists) as assists,
            SUM(CASE WHEN rp.goals_conceded = 0 THEN 1 ELSE 0 END) as clean_sheets,
            SUM(rp.goals_conceded) as goals_conceded,
            SUM(rp.yellow_cards) as yellow_cards,
            SUM(rp.red_cards) as red_cards,
            array_agg(DISTINCT rp.fixture_id ORDER BY rp.fixture_id) as fixture_ids
          FROM round_players rp
          WHERE rp.points IS NOT NULL
          GROUP BY rp.player_id, rp.season_id
        )
        UPDATE player_seasons ps
        SET 
          total_points = pas.total_points,
          goals_scored = pas.goals_scored,
          assists = pas.assists,
          clean_sheets = pas.clean_sheets,
          goals_conceded = pas.goals_conceded,
          yellow_cards = pas.yellow_cards,
          red_cards = pas.red_cards,
          processed_fixtures = pas.fixture_ids,
          updated_at = NOW()
        FROM player_actual_stats pas
        WHERE ps.player_id = pas.player_id 
          AND ps.season_id = pas.season_id
          AND (
            ps.total_points != pas.total_points
            OR ps.goals_scored != pas.goals_scored
            OR ps.assists != pas.assists
          )
        RETURNING ps.id
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
