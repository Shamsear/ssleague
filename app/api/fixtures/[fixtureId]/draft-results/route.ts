import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

/**
 * PUT /api/fixtures/[fixtureId]/draft-results
 * Save fixture results as draft (no calculations, no status changes)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ fixtureId: string }> }
) {
  try {
    const sql = getTournamentDb();
    const { fixtureId } = await params;
    const body = await request.json();
    const { results, entered_by, motm_player_id, motm_player_name, home_penalty_goals, away_penalty_goals } = body;

    // Validate
    if (!results || !Array.isArray(results) || results.length === 0) {
      return NextResponse.json(
        { error: 'Invalid results data' },
        { status: 400 }
      );
    }

    console.log(`💾 Saving draft results for fixture ${fixtureId}`);

    // Update match results in matchups (goals only, no status changes)
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

    // Calculate total scores for display purposes (but don't update fixture status)
    let totalHomeScore = 0;
    let totalAwayScore = 0;
    for (const result of results) {
      totalHomeScore += result.home_goals;
      totalAwayScore += result.away_goals;
    }

    // Update fixture with draft results and MOTM (but keep status as is, don't mark as completed)
    await sql`
      UPDATE fixtures
      SET 
        home_score = ${totalHomeScore},
        away_score = ${totalAwayScore},
        motm_player_id = ${motm_player_id || null},
        motm_player_name = ${motm_player_name || null},
        home_penalty_goals = ${home_penalty_goals || 0},
        away_penalty_goals = ${away_penalty_goals || 0},
        updated_at = NOW()
      WHERE id = ${fixtureId}
    `;

    console.log(`✅ Draft saved: ${totalHomeScore}-${totalAwayScore}`);

    return NextResponse.json({ 
      success: true, 
      message: 'Draft saved successfully',
      home_score: totalHomeScore,
      away_score: totalAwayScore,
      is_draft: true
    });
  } catch (error) {
    console.error('Error saving draft results:', error);
    return NextResponse.json(
      { error: 'Failed to save draft results' },
      { status: 500 }
    );
  }
}
