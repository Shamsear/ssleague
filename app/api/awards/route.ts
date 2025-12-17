import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

/**
 * GET /api/awards
 * Fetch awards with filters
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tournamentId = searchParams.get('tournament_id');
    const seasonId = searchParams.get('season_id');
    const awardType = searchParams.get('award_type');
    const roundNumber = searchParams.get('round_number');
    const weekNumber = searchParams.get('week_number');

    const sql = getTournamentDb();

    // Skip awards_enabled check - not all tournaments have this column
    // Awards are enabled by default if the table exists

    let query = `
      SELECT * FROM awards
      WHERE 1=1
    `;
    const params: any[] = [];

    if (tournamentId) {
      params.push(tournamentId);
      query += ` AND tournament_id = $${params.length}`;
    }

    if (seasonId) {
      params.push(seasonId);
      query += ` AND season_id = $${params.length}`;
    }

    if (awardType) {
      params.push(awardType);
      query += ` AND award_type = $${params.length}`;
    }

    if (roundNumber) {
      params.push(parseInt(roundNumber));
      query += ` AND round_number = $${params.length}`;
    }

    if (weekNumber) {
      params.push(parseInt(weekNumber));
      query += ` AND week_number = $${params.length}`;
    }

    query += ` ORDER BY created_at DESC`;

    const awards = await sql.unsafe(query, params);

    return NextResponse.json({
      success: true,
      data: awards,
    });
  } catch (error: any) {
    console.error('Error fetching awards:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/awards
 * Create or update an award
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      award_type,
      tournament_id,
      season_id,
      round_number,
      week_number,
      player_id,
      player_name,
      team_id,
      team_name,
      performance_stats,
      selected_by,
      selected_by_name,
      notes,
    } = body;

    // Validation
    if (!award_type || !tournament_id || !season_id || !selected_by) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const sql = getTournamentDb();

    // Skip awards_enabled check - not all tournaments have this column
    // Awards are enabled by default if the table exists

    // Check if award already exists
    const existing = await sql`
      SELECT * FROM awards
      WHERE tournament_id = ${tournament_id}
        AND season_id = ${season_id}
        AND award_type = ${award_type}
        ${round_number ? sql`AND round_number = ${round_number}` : sql``}
        ${week_number ? sql`AND week_number = ${week_number}` : sql``}
    `;

    const awardId = existing.length > 0 
      ? existing[0].id 
      : `award_${award_type}_${tournament_id}_${season_id}_${round_number || week_number || 'season'}_${Date.now()}`;

    if (existing.length > 0) {
      // Update existing award
      await sql`
        UPDATE awards
        SET player_id = ${player_id},
            player_name = ${player_name},
            team_id = ${team_id},
            team_name = ${team_name},
            performance_stats = ${JSON.stringify(performance_stats)},
            selected_by = ${selected_by},
            selected_by_name = ${selected_by_name},
            notes = ${notes},
            selected_at = NOW(),
            updated_at = NOW()
        WHERE id = ${existing[0].id}
      `;

      return NextResponse.json({
        success: true,
        message: 'Award updated successfully',
        data: { id: existing[0].id },
      });
    } else {
      // Create new award
      await sql`
        INSERT INTO awards (
          id, award_type, tournament_id, season_id,
          round_number, week_number,
          player_id, player_name, team_id, team_name,
          performance_stats, selected_by, selected_by_name, notes
        ) VALUES (
          ${awardId}, ${award_type}, ${tournament_id}, ${season_id},
          ${round_number}, ${week_number},
          ${player_id}, ${player_name}, ${team_id}, ${team_name},
          ${JSON.stringify(performance_stats)}, ${selected_by}, ${selected_by_name}, ${notes}
        )
      `;

      return NextResponse.json({
        success: true,
        message: 'Award created successfully',
        data: { id: awardId },
      });
    }
  } catch (error: any) {
    console.error('Error creating/updating award:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/awards?id=xxx
 * Delete an award
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Award ID is required' },
        { status: 400 }
      );
    }

    const sql = getTournamentDb();

    await sql`
      DELETE FROM awards WHERE id = ${id}
    `;

    return NextResponse.json({
      success: true,
      message: 'Award deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting award:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
