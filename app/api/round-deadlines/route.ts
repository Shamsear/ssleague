import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.NEON_DATABASE_URL!);

// GET - Fetch round_deadlines by season_id, round_number, and leg
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const seasonId = searchParams.get('season_id');
    const roundNumber = searchParams.get('round_number');
    const leg = searchParams.get('leg') || 'first';

    if (!seasonId) {
      return NextResponse.json(
        { error: 'season_id is required' },
        { status: 400 }
      );
    }

    let roundDeadlines;

    if (roundNumber) {
      // Fetch specific round
      roundDeadlines = await sql`
        SELECT * FROM round_deadlines
        WHERE season_id = ${seasonId}
          AND round_number = ${parseInt(roundNumber)}
          AND leg = ${leg}
        LIMIT 1
      `;
    } else {
      // Fetch all rounds for season
      roundDeadlines = await sql`
        SELECT * FROM round_deadlines
        WHERE season_id = ${seasonId}
        ORDER BY round_number ASC, leg ASC
      `;
    }

    if (roundNumber && roundDeadlines.length === 0) {
      return NextResponse.json({ roundDeadline: null });
    }

    return NextResponse.json({ 
      roundDeadline: roundNumber ? roundDeadlines[0] : null,
      roundDeadlines: roundNumber ? null : roundDeadlines 
    });
  } catch (error) {
    console.error('Error fetching round_deadlines:', error);
    return NextResponse.json(
      { error: 'Failed to fetch round_deadlines' },
      { status: 500 }
    );
  }
}

// POST - Create or update round_deadlines
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      season_id, 
      round_number, 
      leg = 'first',
      scheduled_date,
      home_fixture_deadline_time,
      away_fixture_deadline_time,
      result_entry_deadline_day_offset,
      result_entry_deadline_time,
      status = 'pending',
      is_active = false
    } = body;

    if (!season_id || !round_number) {
      return NextResponse.json(
        { error: 'season_id and round_number are required' },
        { status: 400 }
      );
    }

    // Fetch tournament settings for defaults if not provided
    let homeTime = home_fixture_deadline_time;
    let awayTime = away_fixture_deadline_time;
    let resultOffset = result_entry_deadline_day_offset;
    let resultTime = result_entry_deadline_time;

    if (!homeTime || !awayTime || resultOffset === undefined || !resultTime) {
      const settingsResult = await sql`
        SELECT home_deadline_time, away_deadline_time, result_day_offset, result_deadline_time
        FROM tournament_settings
        WHERE season_id = ${season_id}
        LIMIT 1
      `;

      if (settingsResult.length > 0) {
        const settings = settingsResult[0];
        homeTime = homeTime || settings.home_deadline_time || '23:30';
        awayTime = awayTime || settings.away_deadline_time || '23:45';
        resultOffset = resultOffset !== undefined ? resultOffset : (settings.result_day_offset ?? 2);
        resultTime = resultTime || settings.result_deadline_time || '00:30';
      } else {
        // Ultimate fallback defaults
        homeTime = homeTime || '23:30';
        awayTime = awayTime || '23:45';
        resultOffset = resultOffset !== undefined ? resultOffset : 2;
        resultTime = resultTime || '00:30';
      }
    }

    // Upsert
    console.log('Inserting round_deadline:', {
      season_id,
      round_number,
      leg,
      scheduled_date,
      homeTime,
      awayTime,
      resultOffset,
      resultTime,
      status
    });
    
    await sql`
      INSERT INTO round_deadlines (
        season_id,
        round_number,
        leg,
        scheduled_date,
        home_fixture_deadline_time,
        away_fixture_deadline_time,
        result_entry_deadline_day_offset,
        result_entry_deadline_time,
        status,
        is_active,
        created_at,
        updated_at
      ) VALUES (
        ${season_id},
        ${round_number},
        ${leg},
        ${scheduled_date || null},
        ${homeTime},
        ${awayTime},
        ${resultOffset},
        ${resultTime},
        ${status},
        ${is_active},
        NOW(),
        NOW()
      )
      ON CONFLICT (season_id, round_number, leg) DO UPDATE SET
        scheduled_date = EXCLUDED.scheduled_date,
        home_fixture_deadline_time = EXCLUDED.home_fixture_deadline_time,
        away_fixture_deadline_time = EXCLUDED.away_fixture_deadline_time,
        result_entry_deadline_day_offset = EXCLUDED.result_entry_deadline_day_offset,
        result_entry_deadline_time = EXCLUDED.result_entry_deadline_time,
        status = EXCLUDED.status,
        is_active = EXCLUDED.is_active,
        updated_at = NOW()
    `;
    
    console.log('Round deadline inserted successfully');

    return NextResponse.json({ 
      success: true,
      message: 'Round deadline saved successfully' 
    });
  } catch (error: any) {
    console.error('Error saving round_deadlines:', error);
    console.error('Error details:', error.message, error.stack);
    return NextResponse.json(
      { error: 'Failed to save round_deadlines', details: error.message },
      { status: 500 }
    );
  }
}
