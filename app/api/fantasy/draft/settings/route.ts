import { NextRequest, NextResponse } from 'next/server';
import { fantasySql } from '@/lib/neon/fantasy-config';

/**
 * GET /api/fantasy/draft/settings?league_id=xxx
 * Get draft settings for a fantasy league
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const league_id = searchParams.get('league_id');

    if (!league_id) {
      return NextResponse.json(
        { error: 'Missing league_id parameter' },
        { status: 400 }
      );
    }

    // Get league settings from PostgreSQL
    const leagues = await fantasySql`
      SELECT * FROM fantasy_leagues
      WHERE league_id = ${league_id}
      LIMIT 1
    `;

    if (leagues.length === 0) {
      return NextResponse.json({
        settings: null,
        message: 'No league found',
      }, { status: 404 });
    }

    const league = leagues[0];

    return NextResponse.json({
      settings: {
        budget_per_team: Number(league.budget_per_team),
        max_squad_size: Number(league.max_squad_size),
        league_name: league.league_name,
        season_name: league.season_name,
        season_id: league.season_id,
      },
    });
  } catch (error) {
    console.error('Error fetching draft settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch draft settings', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/fantasy/draft/settings
 * Update draft settings for a fantasy league in PostgreSQL
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      fantasy_league_id,
      budget_per_team,
      min_squad_size,
      max_squad_size,
      require_team_affiliation,
    } = body;

    // Validate input
    if (!fantasy_league_id) {
      return NextResponse.json(
        { error: 'Missing required field: fantasy_league_id' },
        { status: 400 }
      );
    }

    // Update league settings in PostgreSQL
    const result = await fantasySql`
      UPDATE fantasy_leagues
      SET 
        budget_per_team = ${budget_per_team || 1000},
        max_squad_size = ${max_squad_size || 15},
        updated_at = NOW()
      WHERE league_id = ${fantasy_league_id}
      RETURNING *
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Fantasy league not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Draft settings updated successfully',
      settings: {
        budget_per_team: Number(result[0].budget_per_team),
        max_squad_size: Number(result[0].max_squad_size),
      },
    });
  } catch (error) {
    console.error('Error saving draft settings:', error);
    return NextResponse.json(
      { error: 'Failed to save draft settings', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
