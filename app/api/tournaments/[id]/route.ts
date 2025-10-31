import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import { generateSeasonActiveNews, generateSeasonCompleteNews } from '@/lib/news/season-events';

// GET - Get a single tournament by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sql = getTournamentDb();
    const { id } = await params;

    const tournaments = await sql`
      SELECT * FROM tournaments
      WHERE id = ${id}
      LIMIT 1
    `;

    if (tournaments.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tournament not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, tournament: tournaments[0] });
  } catch (error) {
    console.error('Error fetching tournament:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch tournament' },
      { status: 500 }
    );
  }
}

// PATCH - Update tournament
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sql = getTournamentDb();
    const { id } = await params;
    const body = await request.json();
    
    const {
      tournament_name,
      tournament_code,
      status,
      start_date,
      end_date,
      description,
      is_primary,
      display_order,
      include_in_fantasy,
      include_in_awards,
    } = body;

    const result = await sql`
      UPDATE tournaments
      SET
        tournament_name = COALESCE(${tournament_name}, tournament_name),
        tournament_code = COALESCE(${tournament_code}, tournament_code),
        status = COALESCE(${status}, status),
        start_date = COALESCE(${start_date}::timestamp, start_date),
        end_date = COALESCE(${end_date}::timestamp, end_date),
        description = COALESCE(${description}, description),
        is_primary = COALESCE(${is_primary}::boolean, is_primary),
        display_order = COALESCE(${display_order}::integer, display_order),
        include_in_fantasy = COALESCE(${include_in_fantasy}::boolean, include_in_fantasy),
        include_in_awards = COALESCE(${include_in_awards}::boolean, include_in_awards),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tournament not found' },
        { status: 404 }
      );
    }

    const updatedTournament = result[0];
    const seasonName = updatedTournament.season_id.replace('SSPSLS', 'Season ');

    // Auto-generate news on status change (non-blocking)
    if (status && updatedTournament.is_primary) {
      if (status === 'active') {
        generateSeasonActiveNews(updatedTournament.season_id, seasonName).catch(error => {
          console.error('Failed to generate season active news:', error);
        });
      } else if (status === 'completed') {
        generateSeasonCompleteNews(updatedTournament.season_id, seasonName).catch(error => {
          console.error('Failed to generate season complete news:', error);
        });
      }
    }

    return NextResponse.json({
      success: true,
      tournament: updatedTournament,
      message: 'Tournament updated successfully',
    });
  } catch (error) {
    console.error('Error updating tournament:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update tournament' },
      { status: 500 }
    );
  }
}

// DELETE - Delete tournament (cascades to all related data)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sql = getTournamentDb();
    const { id } = await params;

    const result = await sql`
      DELETE FROM tournaments
      WHERE id = ${id}
      RETURNING id
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tournament not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Tournament and all related data deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting tournament:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete tournament' },
      { status: 500 }
    );
  }
}
