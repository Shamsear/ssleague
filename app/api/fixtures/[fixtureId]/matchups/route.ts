import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fixtureId: string }> }
) {
  try {
    const sql = getTournamentDb();
    const { fixtureId } = await params;

    // Get matchups for this fixture
    const matchups = await sql`
      SELECT * FROM matchups
      WHERE fixture_id = ${fixtureId}
      ORDER BY position ASC
    `;

    return NextResponse.json({ matchups });
  } catch (error) {
    console.error('Error fetching matchups:', error);
    return NextResponse.json(
      { error: 'Failed to fetch matchups' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ fixtureId: string }> }
) {
  try {
    const sql = getTournamentDb();
    const { fixtureId } = await params;
    const body = await request.json();
    const { matchups, created_by } = body;

    console.log('📥 Received matchups data:', {
      fixtureId,
      created_by,
      matchupsCount: matchups?.length,
      isArray: Array.isArray(matchups),
      firstMatchup: matchups?.[0]
    });

    // Validate
    if (!matchups || !Array.isArray(matchups) || matchups.length === 0) {
      console.error('❌ Validation failed:', { matchups, isArray: Array.isArray(matchups), length: matchups?.length });
      return NextResponse.json(
        { error: 'Invalid matchups data' },
        { status: 400 }
      );
    }

    // Get fixture to extract season_id and round_number
    const fixtures = await sql`
      SELECT season_id, round_number FROM fixtures WHERE id = ${fixtureId} LIMIT 1
    `;
    
    if (fixtures.length === 0) {
      return NextResponse.json(
        { error: 'Fixture not found' },
        { status: 404 }
      );
    }
    
    const seasonId = fixtures[0].season_id;
    const roundNumber = fixtures[0].round_number;

    // Delete existing matchups for this fixture
    await sql`
      DELETE FROM matchups
      WHERE fixture_id = ${fixtureId}
    `;

    // Insert new matchups
    for (const matchup of matchups) {
      await sql`
        INSERT INTO matchups (
          fixture_id,
          season_id,
          round_number,
          home_player_id,
          home_player_name,
          away_player_id,
          away_player_name,
          position,
          match_duration,
          created_by,
          created_at
        ) VALUES (
          ${fixtureId},
          ${seasonId},
          ${roundNumber},
          ${matchup.home_player_id},
          ${matchup.home_player_name},
          ${matchup.away_player_id},
          ${matchup.away_player_name},
          ${matchup.position},
          ${matchup.match_duration || 6},
          ${created_by},
          NOW()
        )
      `;
    }

    return NextResponse.json({ success: true, message: 'Matchups created successfully' });
  } catch (error: any) {
    console.error('Error creating matchups:', error);
    console.error('Error details:', error.message, error.stack);
    return NextResponse.json(
      { error: 'Failed to create matchups', details: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ fixtureId: string }> }
) {
  try {
    const sql = getTournamentDb();
    const { fixtureId } = await params;
    const body = await request.json();
    const { matchups } = body;

    // Validate
    if (!matchups || !Array.isArray(matchups) || matchups.length === 0) {
      return NextResponse.json(
        { error: 'Invalid matchups data' },
        { status: 400 }
      );
    }

    // Update existing matchups
    for (const matchup of matchups) {
      await sql`
        UPDATE matchups
        SET 
          away_player_id = ${matchup.away_player_id},
          away_player_name = ${matchup.away_player_name},
          match_duration = ${matchup.match_duration || 6},
          updated_at = NOW()
        WHERE fixture_id = ${fixtureId}
        AND position = ${matchup.position}
      `;
    }

    return NextResponse.json({ success: true, message: 'Matchups updated successfully' });
  } catch (error) {
    console.error('Error updating matchups:', error);
    return NextResponse.json(
      { error: 'Failed to update matchups' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ fixtureId: string }> }
) {
  try {
    const sql = getTournamentDb();
    const { fixtureId } = await params;
    const body = await request.json();
    const { results, entered_by } = body;

    // Validate
    if (!results || !Array.isArray(results) || results.length === 0) {
      return NextResponse.json(
        { error: 'Invalid results data' },
        { status: 400 }
      );
    }

    // Check result entry deadline
    const fixtures = await sql`
      SELECT f.season_id, f.round_number, f.leg
      FROM fixtures f
      WHERE f.id = ${fixtureId}
      LIMIT 1
    `;
    
    if (fixtures.length === 0) {
      return NextResponse.json(
        { error: 'Fixture not found' },
        { status: 404 }
      );
    }
    
    const { season_id, round_number, leg } = fixtures[0];
    
    // Get round deadlines
    const deadlines = await sql`
      SELECT scheduled_date, result_entry_deadline_time, result_entry_deadline_day_offset
      FROM round_deadlines
      WHERE season_id = ${season_id}
      AND round_number = ${round_number}
      AND leg = ${leg}
      LIMIT 1
    `;
    
    if (deadlines.length > 0 && deadlines[0].scheduled_date) {
      const deadline = deadlines[0];
      
      // Calculate result entry deadline
      const resultDate = new Date(deadline.scheduled_date);
      resultDate.setDate(resultDate.getDate() + (deadline.result_entry_deadline_day_offset || 2));
      const resultDateStr = resultDate.toISOString().split('T')[0];
      const resultDeadline = new Date(`${resultDateStr}T${deadline.result_entry_deadline_time}:00+05:30`);
      
      const now = new Date();
      
      // Check if deadline has passed
      if (now >= resultDeadline) {
        return NextResponse.json(
          { 
            error: 'Result entry deadline has passed',
            deadline: resultDeadline.toISOString()
          },
          { status: 403 }
        );
      }
    }

    // Update match results (MOTM is now at fixture level, not matchup level)
    for (const result of results) {
      await sql`
        UPDATE matchups
        SET 
          home_goals = ${result.home_goals},
          away_goals = ${result.away_goals},
          result_entered_by = ${entered_by},
          result_entered_at = NOW(),
          updated_at = NOW()
        WHERE fixture_id = ${fixtureId}
        AND position = ${result.position}
      `;
    }

    // Calculate total scores from all matchups
    let totalHomeScore = 0;
    let totalAwayScore = 0;
    for (const result of results) {
      totalHomeScore += result.home_goals;
      totalAwayScore += result.away_goals;
    }

    // Determine match result
    let matchResult: 'home_win' | 'away_win' | 'draw';
    if (totalHomeScore > totalAwayScore) {
      matchResult = 'home_win';
    } else if (totalAwayScore > totalHomeScore) {
      matchResult = 'away_win';
    } else {
      matchResult = 'draw';
    }

    // Update fixture with scores, result, and status
    await sql`
      UPDATE fixtures
      SET 
        home_score = ${totalHomeScore},
        away_score = ${totalAwayScore},
        result = ${matchResult},
        status = 'completed', 
        updated_at = NOW()
      WHERE id = ${fixtureId}
    `;

    return NextResponse.json({ 
      success: true, 
      message: 'Results saved successfully',
      fixture_status: 'completed'
    });
  } catch (error) {
    console.error('Error saving results:', error);
    return NextResponse.json(
      { error: 'Failed to save results' },
      { status: 500 }
    );
  }
}
