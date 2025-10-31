import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

/**
 * GET /api/polls
 * Fetch polls with filters
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const season_id = searchParams.get('season_id');
    const status = searchParams.get('status');
    const poll_type = searchParams.get('poll_type');
    const fixture_id = searchParams.get('fixture_id');
    const round_id = searchParams.get('round_id');
    
    const sql = getTournamentDb();
    
    let conditions = [];
    let params: any = {};
    
    if (season_id) {
      conditions.push('season_id = $season_id');
      params.season_id = season_id;
    }
    if (status) {
      conditions.push('status = $status');
      params.status = status;
    }
    if (poll_type) {
      conditions.push('poll_type = $poll_type');
      params.poll_type = poll_type;
    }
    if (fixture_id) {
      conditions.push('related_fixture_id = $fixture_id');
      params.fixture_id = fixture_id;
    }
    if (round_id) {
      conditions.push('related_round_id = $round_id');
      params.round_id = round_id;
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    const polls = await sql.unsafe(`
      SELECT * FROM polls
      ${whereClause}
      ORDER BY created_at DESC
    `, params);
    
    // Lazy closing: Auto-close expired polls when accessed
    const now = new Date();
    const pollsToClose: string[] = [];
    
    for (const poll of polls) {
      if (!poll.is_closed && poll.closes_at) {
        const closesAt = new Date(poll.closes_at);
        if (closesAt < now) {
          pollsToClose.push(poll.id);
        }
      }
    }
    
    // Close expired polls asynchronously (non-blocking)
    if (pollsToClose.length > 0) {
      fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/polls/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poll_ids: pollsToClose })
      }).catch(err => console.error('Failed to auto-close polls:', err));
    }
    
    return NextResponse.json({ 
      success: true, 
      polls,
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
