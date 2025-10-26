import { NextRequest, NextResponse } from 'next/server';
import { fantasySql } from '@/lib/neon/fantasy-config';
import { getTournamentDb } from '@/lib/neon/tournament-config';

/**
 * GET /api/fantasy/leagues?season_id=xxx
 * Get or create fantasy league for a season
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const season_id = searchParams.get('season_id');

    if (!season_id) {
      return NextResponse.json(
        { error: 'Missing season_id parameter' },
        { status: 400 }
      );
    }

    // Get season data from Neon tournament database
    const tournamentSql = getTournamentDb();
    const seasons = await tournamentSql`
      SELECT season_number, description, code
      FROM seasons
      WHERE id = ${season_id}
      LIMIT 1
    `;

    if (seasons.length === 0) {
      return NextResponse.json(
        { error: 'Season not found' },
        { status: 404 }
      );
    }

    const seasonData = seasons[0];
    const seasonNumber = seasonData.season_number || seasonData.code || season_id.slice(0, 8);
    const seasonName = seasonData.description || seasonData.season_number || season_id;
    
    // Generate readable league ID like SSPSLFLS16
    const league_id = `SSPSLFLS${seasonNumber}`;

    // Check if league exists
    const existing = await fantasySql`
      SELECT * FROM fantasy_leagues
      WHERE league_id = ${league_id}
      LIMIT 1
    `;

    if (existing.length > 0) {
      return NextResponse.json({ league: existing[0] });
    }

    // Create new league
    const result = await fantasySql`
      INSERT INTO fantasy_leagues (
        league_id,
        season_id,
        season_name,
        league_name,
        budget_per_team,
        max_squad_size,
        max_transfers_per_window,
        points_cost_per_transfer,
        is_active
      ) VALUES (
        ${league_id},
        ${season_id},
        ${seasonName},
        ${'Fantasy League - ' + seasonName},
        100.00,
        15,
        2,
        4,
        true
      )
      RETURNING *
    `;

    return NextResponse.json({ league: result[0], created: true });
  } catch (error) {
    console.error('Error fetching/creating fantasy league:', error);
    return NextResponse.json(
      { error: 'Failed to fetch/create fantasy league' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/fantasy/leagues
 * Create or update a fantasy league
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      league_id,
      season_id,
      season_name,
      budget_per_team = 100.00,
      max_squad_size = 15,
      max_transfers_per_window = 2,
      points_cost_per_transfer = 4,
    } = body;

    if (!league_id || !season_id) {
      return NextResponse.json(
        { error: 'Missing required fields: league_id, season_id' },
        { status: 400 }
      );
    }

    const result = await fantasySql`
      INSERT INTO fantasy_leagues (
        league_id,
        season_id,
        season_name,
        league_name,
        budget_per_team,
        max_squad_size,
        max_transfers_per_window,
        points_cost_per_transfer,
        is_active
      ) VALUES (
        ${league_id},
        ${season_id},
        ${season_name || season_id},
        ${'Fantasy League - ' + (season_name || season_id)},
        ${budget_per_team},
        ${max_squad_size},
        ${max_transfers_per_window},
        ${points_cost_per_transfer},
        true
      )
      ON CONFLICT (league_id)
      DO UPDATE SET
        budget_per_team = EXCLUDED.budget_per_team,
        max_squad_size = EXCLUDED.max_squad_size,
        max_transfers_per_window = EXCLUDED.max_transfers_per_window,
        points_cost_per_transfer = EXCLUDED.points_cost_per_transfer,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    return NextResponse.json({ success: true, league: result[0] });
  } catch (error) {
    console.error('Error creating/updating fantasy league:', error);
    return NextResponse.json(
      { error: 'Failed to create/update fantasy league' },
      { status: 500 }
    );
  }
}
