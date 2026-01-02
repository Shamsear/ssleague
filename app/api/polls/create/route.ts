import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import { sendNotificationToSeason } from '@/lib/notifications/send-notification';

/**
 * POST /api/polls/create
 * Create a custom poll with full configuration
 * 
 * This is for manual poll creation by admins with complete customization
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const sql = getTournamentDb();

    const {
      // Required fields
      season_id,
      question_en,
      question_ml,
      options, // Array of { text_en, text_ml, metadata? }
      closes_at,

      // Optional fields
      poll_type = 'custom',
      description_en,
      description_ml,
      allow_multiple = false,
      allow_change_vote = true,
      show_results_before_close = false,
      metadata = {},

      // Admin info
      created_by,
      created_by_name,
    } = body;

    // Validation
    if (!season_id) {
      return NextResponse.json(
        { success: false, error: 'season_id is required' },
        { status: 400 }
      );
    }

    if (!question_en || !question_ml) {
      return NextResponse.json(
        { success: false, error: 'Both question_en and question_ml are required' },
        { status: 400 }
      );
    }

    if (!options || !Array.isArray(options) || options.length < 2) {
      return NextResponse.json(
        { success: false, error: 'At least 2 options are required' },
        { status: 400 }
      );
    }

    // Validate options
    for (const option of options) {
      if (!option.text_en || !option.text_ml) {
        return NextResponse.json(
          { success: false, error: 'All options must have both text_en and text_ml' },
          { status: 400 }
        );
      }
    }

    if (!closes_at) {
      return NextResponse.json(
        { success: false, error: 'closes_at is required' },
        { status: 400 }
      );
    }

    // Validate closes_at is in the future
    const closesAtDate = new Date(closes_at);
    if (closesAtDate <= new Date()) {
      return NextResponse.json(
        { success: false, error: 'closes_at must be in the future' },
        { status: 400 }
      );
    }

    // Generate IDs
    const pollId = `poll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Prepare options for storage
    const pollOptions = options.map((opt: any, idx: number) => ({
      id: opt.id || `option_${idx + 1}`,
      text_en: opt.text_en,
      text_ml: opt.text_ml,
      player_id: opt.player_id || null,
      team_id: opt.team_id || null,
      votes: 0
    }));

    // Determine related_round_id
    // For round-based polls (POTD, TOD): use round_number directly
    // For week-based polls (POTW, TOW): use first round of the week
    let relatedRoundId = null;
    if (metadata?.round_number) {
      relatedRoundId = metadata.round_number;
    } else if (metadata?.week_number) {
      // Calculate first round of the week
      relatedRoundId = (metadata.week_number - 1) * 7 + 1;
    }

    // Insert poll (matching schema from /api/polls POST)
    await sql`
      INSERT INTO polls (
        poll_id, season_id, poll_type,
        title_en, title_ml, description_en, description_ml,
        related_fixture_id, related_round_id, related_matchday_date,
        options, closes_at, created_by
      ) VALUES (
        ${pollId},
        ${season_id},
        ${poll_type},
        ${question_en},
        ${question_ml},
        ${description_en || null},
        ${description_ml || null},
        ${null},
        ${relatedRoundId},
        ${null},
        ${JSON.stringify(pollOptions)},
        ${closes_at},
        ${created_by || 'admin'}
      )
    `;

    console.log(`✅ Custom poll created: ${pollId} with ${options.length} options`);

    // Fetch the created poll
    const [createdPoll] = await sql`
      SELECT * FROM polls WHERE poll_id = ${pollId}
    `;

    // Send FCM notification to all teams in the season
    try {
      await sendNotificationToSeason(
        {
          title: '🗳️ New Poll Created!',
          body: question_en,
          url: `/polls/${pollId}`,
          icon: '/logo.png',
          data: {
            type: 'poll_created',
            poll_id: pollId,
            poll_type,
            closes_at,
          }
        },
        season_id
      );
    } catch (notifError) {
      console.error('Failed to send poll creation notification:', notifError);
      // Don't fail the request
    }

    return NextResponse.json({
      success: true,
      message: 'Poll created successfully',
      poll: createdPoll,
    });
  } catch (error: any) {
    console.error('Error creating custom poll:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create poll' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/polls/create
 * Get poll creation templates and suggestions
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const season_id = searchParams.get('season_id');

    // Poll type templates
    const templates = {
      match_prediction: {
        name: 'Match Prediction',
        description: 'Who will win the match?',
        typical_options: ['Home Team Wins', 'Away Team Wins', 'Draw'],
        duration: '2 hours (closes when match starts)',
      },
      player_of_match: {
        name: 'Player of the Match',
        description: 'Who was the best player?',
        typical_options: 'List of players who participated',
        duration: '24 hours',
      },
      daily_best_player: {
        name: 'Best Player of the Day',
        description: 'Who performed best today?',
        typical_options: 'Players who played today',
        duration: '24 hours',
      },
      daily_best_team: {
        name: 'Best Team of the Day',
        description: 'Which team played best today?',
        typical_options: 'Teams that played today',
        duration: '24 hours',
      },
      weekly_top_player: {
        name: 'Top Player of the Week',
        description: 'Best player of the week',
        typical_options: 'Top performing players',
        duration: '7 days',
      },
      weekly_top_team: {
        name: 'Top Team of the Week',
        description: 'Best team of the week',
        typical_options: 'All teams',
        duration: '7 days',
      },
      season_champion: {
        name: 'Season Champion Prediction',
        description: 'Who will win the tournament?',
        typical_options: 'All teams',
        duration: 'Until finals',
      },
      season_mvp: {
        name: 'Season MVP',
        description: 'Most valuable player of the season',
        typical_options: 'Top players',
        duration: 'Until season ends',
      },
      custom: {
        name: 'Custom Poll',
        description: 'Create your own poll',
        typical_options: 'Your custom options',
        duration: 'Your choice',
      },
    };

    // Get available data for poll creation if season_id provided
    let availableData = null;
    if (season_id) {
      const sql = getTournamentDb();

      // Get teams
      const teams = await sql`
        SELECT DISTINCT t.id, t.name
        FROM teams t
        JOIN fixtures f ON f.home_team_id = t.id OR f.away_team_id = t.id
        WHERE f.season_id = ${season_id}
        ORDER BY t.name
      `;

      // Get top players
      const players = await sql`
        SELECT DISTINCT p.id, p.current_name as name, p.star_rating
        FROM players p
        JOIN fixture_participation fp ON fp.player_id = p.id
        JOIN fixtures f ON f.id = fp.fixture_id
        WHERE f.season_id = ${season_id}
        ORDER BY p.star_rating DESC
        LIMIT 30
      `;

      availableData = {
        teams: teams,
        players: players,
      };
    }

    return NextResponse.json({
      success: true,
      templates,
      available_data: availableData,
    });
  } catch (error: any) {
    console.error('Error fetching poll templates:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
