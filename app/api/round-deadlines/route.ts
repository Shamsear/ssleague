import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

// GET - Fetch round deadlines
export async function GET(request: NextRequest) {
  try {
    const sql = getTournamentDb();
    const { searchParams } = new URL(request.url);
    const tournamentId = searchParams.get('tournament_id');
    const seasonId = searchParams.get('season_id');
    const roundNumber = searchParams.get('round_number');
    const leg = searchParams.get('leg');

    if (tournamentId && roundNumber && leg) {
      // Get specific round deadline by tournament_id, round_number, and leg
      const roundDeadlines = await sql`
        SELECT * FROM round_deadlines
        WHERE tournament_id = ${tournamentId}
          AND round_number = ${parseInt(roundNumber)}
          AND leg = ${leg}
        LIMIT 1
      `;
      return NextResponse.json({
        success: true,
        roundDeadline: roundDeadlines[0] || null
      });
    }

    if (tournamentId) {
      // Get all round deadlines for a tournament
      const roundDeadlines = await sql`
        SELECT * FROM round_deadlines
        WHERE tournament_id = ${tournamentId}
        ORDER BY round_number ASC, leg ASC
      `;
      return NextResponse.json({ success: true, roundDeadlines });
    }

    if (seasonId && roundNumber && leg) {
      // Get specific round deadline (legacy - for single season tournaments)
      const roundDeadlines = await sql`
        SELECT * FROM round_deadlines
        WHERE season_id = ${seasonId}
          AND round_number = ${parseInt(roundNumber)}
          AND leg = ${leg}
        LIMIT 1
      `;
      return NextResponse.json({
        success: true,
        roundDeadline: roundDeadlines[0] || null
      });
    }

    return NextResponse.json(
      { success: false, error: 'Missing required parameters' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Error fetching round deadlines:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST - Create or update round deadline
export async function POST(request: NextRequest) {
  try {
    const sql = getTournamentDb();
    const body = await request.json();
    const {
      tournament_id,
      season_id,
      round_number,
      leg,
      scheduled_date,
      round_start_time,
      home_fixture_deadline_time,
      away_fixture_deadline_time,
      result_entry_deadline_day_offset,
      result_entry_deadline_time,
      status,
      is_active
    } = body;

    if (!tournament_id || !season_id || !round_number || !leg) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: tournament_id, season_id, round_number, leg' },
        { status: 400 }
      );
    }

    // Note: Multiple rounds can be active simultaneously in the same tournament
    // This allows for overlapping rounds or parallel group stages


    // Fetch existing round deadline to preserve unspecified fields
    const existing = await sql`
      SELECT * FROM round_deadlines
      WHERE tournament_id = ${tournament_id}
        AND round_number = ${round_number}
        AND leg = ${leg}
      LIMIT 1
    `;

    const existingRecord = existing[0];

    // Helper to normalize date to YYYY-MM-DD format (no timezone conversion)
    const normalizeDateString = (dateValue: any): string | null => {
      if (!dateValue) return null;
      if (typeof dateValue === 'string') {
        // If it's already a string, extract just the date part
        return dateValue.includes('T') ? dateValue.split('T')[0] : dateValue;
      }
      if (dateValue instanceof Date) {
        // If it's a Date object, format it as YYYY-MM-DD
        const year = dateValue.getFullYear();
        const month = String(dateValue.getMonth() + 1).padStart(2, '0');
        const day = String(dateValue.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
      return null;
    };

    // Use existing values as defaults if not provided
    const finalScheduledDate = scheduled_date !== undefined
      ? normalizeDateString(scheduled_date)
      : normalizeDateString(existingRecord?.scheduled_date);
    const finalRoundStartTime = round_start_time !== undefined ? round_start_time : (existingRecord?.round_start_time || null);
    const finalHomeTime = home_fixture_deadline_time || existingRecord?.home_fixture_deadline_time || '17:00';
    const finalAwayTime = away_fixture_deadline_time || existingRecord?.away_fixture_deadline_time || '17:00';
    const finalResultOffset = result_entry_deadline_day_offset !== undefined ? result_entry_deadline_day_offset : (existingRecord?.result_entry_deadline_day_offset || 2);
    const finalResultTime = result_entry_deadline_time || existingRecord?.result_entry_deadline_time || '00:30';
    const finalStatus = status || existingRecord?.status || 'pending';

    // Upsert round deadline
    await sql`
      INSERT INTO round_deadlines (
        tournament_id,
        season_id,
        round_number,
        leg,
        scheduled_date,
        round_start_time,
        home_fixture_deadline_time,
        away_fixture_deadline_time,
        result_entry_deadline_day_offset,
        result_entry_deadline_time,
        status,
        created_at,
        updated_at
      ) VALUES (
        ${tournament_id},
        ${season_id},
        ${round_number},
        ${leg},
        ${finalScheduledDate},
        ${finalRoundStartTime},
        ${finalHomeTime},
        ${finalAwayTime},
        ${finalResultOffset},
        ${finalResultTime},
        ${finalStatus},
        NOW(),
        NOW()
      )
      ON CONFLICT (tournament_id, round_number, leg)
      DO UPDATE SET
        scheduled_date = EXCLUDED.scheduled_date,
        round_start_time = EXCLUDED.round_start_time,
        home_fixture_deadline_time = EXCLUDED.home_fixture_deadline_time,
        away_fixture_deadline_time = EXCLUDED.away_fixture_deadline_time,
        result_entry_deadline_day_offset = EXCLUDED.result_entry_deadline_day_offset,
        result_entry_deadline_time = EXCLUDED.result_entry_deadline_time,
        status = EXCLUDED.status,
        updated_at = NOW()
    `;

    return NextResponse.json({
      success: true,
      message: 'Round deadline saved successfully'
    });
  } catch (error: any) {
    console.error('Error saving round deadline:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete round deadline
export async function DELETE(request: NextRequest) {
  try {
    const sql = getTournamentDb();
    const { searchParams } = new URL(request.url);
    const tournamentId = searchParams.get('tournament_id');
    const roundNumber = searchParams.get('round_number');
    const leg = searchParams.get('leg');

    if (!tournamentId || !roundNumber || !leg) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    await sql`
      DELETE FROM round_deadlines
      WHERE tournament_id = ${tournamentId}
        AND round_number = ${parseInt(roundNumber)}
        AND leg = ${leg}
    `;

    return NextResponse.json({
      success: true,
      message: 'Round deadline deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting round deadline:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
