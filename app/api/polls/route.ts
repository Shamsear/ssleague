import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const season_id = searchParams.get('season_id');
    const status = searchParams.get('status');
    const poll_type = searchParams.get('poll_type');
    const fixture_id = searchParams.get('fixture_id');
    const round_number = searchParams.get('round_number');
    const week_number = searchParams.get('week_number');

    const sql = getTournamentDb();

    // Build query conditions
    let query = sql`SELECT * FROM polls WHERE 1=1`;

    if (season_id) {
      query = sql`${query} AND season_id = ${season_id}`;
    }
    if (status) {
      query = sql`${query} AND status = ${status}`;
    }
    if (poll_type) {
      query = sql`${query} AND poll_type = ${poll_type}`;
    }
    if (fixture_id) {
      query = sql`${query} AND related_fixture_id = ${fixture_id}`;
    }

    // Build query with round/week filtering
    // Note: related_round_id is VARCHAR, not INTEGER
    if (round_number) {
      console.log(`🔍 Filtering by round_number: ${round_number}`);
      query = sql`${query} AND related_round_id = ${round_number.toString()}`;
    }
    if (week_number) {
      // For week-based polls, calculate round range
      const weekNum = parseInt(week_number);
      const startRound = (weekNum - 1) * 7 + 1;
      const endRound = weekNum * 7;
      console.log(`🔍 Filtering by week_number: ${week_number} (rounds ${startRound}-${endRound})`);
      query = sql`${query} AND related_round_id::integer >= ${startRound} AND related_round_id::integer <= ${endRound}`;
    }

    query = sql`${query} ORDER BY created_at DESC`;

    let polls = await query;
    console.log(`📊 Found ${polls.length} polls`);

    // Lazy closing: Auto-close expired polls when accessed
    const now = new Date();
    const pollsToClose: string[] = [];

    for (const poll of polls) {
      if (poll.status === 'active' && poll.closes_at) {
        const closesAt = new Date(poll.closes_at);
        if (closesAt < now) {
          pollsToClose.push(poll.id);
        }
      }
    }

    // Close expired polls asynchronously (non-blocking)
    if (pollsToClose.length > 0) {
      console.log(`Auto-closing ${pollsToClose.length} expired polls`);
      // Note: This would need the close API to be implemented
    }

    return NextResponse.json({
      success: true,
      data: polls,
      count: polls.length,
      auto_closed: pollsToClose.length
    });
  } catch (error: any) {
    console.error('Error fetching polls:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/polls
 * Create a new poll manually
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const sql = getTournamentDb();

    const {
      season_id,
      poll_type,
      title_en,
      title_ml,
      description_en,
      description_ml,
      options,
      closes_at,
      related_fixture_id,
      related_round_id,
      related_matchday_date,
      created_by
    } = body;

    // Validate required fields
    if (!season_id || !poll_type || !title_en || !options || !closes_at) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: season_id, poll_type, title_en, options, closes_at'
        },
        { status: 400 }
      );
    }

    const poll_id = `poll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await sql`
      INSERT INTO polls (
        poll_id, season_id, poll_type,
        title_en, title_ml, description_en, description_ml,
        related_fixture_id, related_round_id, related_matchday_date,
        options, closes_at, created_by
      ) VALUES (
        ${poll_id},
        ${season_id},
        ${poll_type},
        ${title_en},
        ${title_ml || null},
        ${description_en || null},
        ${description_ml || null},
        ${related_fixture_id || null},
        ${related_round_id || null},
        ${related_matchday_date || null},
        ${JSON.stringify(options)},
        ${closes_at},
        ${created_by || null}
      )
    `;

    console.log(`✅ Created poll: ${poll_id}`);

    return NextResponse.json({
      success: true,
      poll_id,
      message: 'Poll created successfully'
    });
  } catch (error: any) {
    console.error('Error creating poll:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
