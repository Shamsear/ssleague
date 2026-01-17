import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

/**
 * PATCH - Mark specific matchups as NULL
 * NULL matchups:
 * - NOT counted in player statistics
 * - Still counted for salary deductions (team budget)
 * - Still counted for team statistics
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ fixtureId: string }> }
) {
    try {
        const sql = getTournamentDb();
        const { fixtureId } = await params;
        const body = await request.json();
        const { matchup_positions, is_null, updated_by, updated_by_name } = body;

        if (!Array.isArray(matchup_positions) || matchup_positions.length === 0) {
            return NextResponse.json(
                { error: 'matchup_positions array is required' },
                { status: 400 }
            );
        }

        if (typeof is_null !== 'boolean') {
            return NextResponse.json(
                { error: 'is_null boolean is required' },
                { status: 400 }
            );
        }

        // Fetch fixture to get season info
        const fixtures = await sql`
      SELECT * FROM fixtures WHERE id = ${fixtureId} LIMIT 1
    `;

        if (fixtures.length === 0) {
            return NextResponse.json(
                { error: 'Fixture not found' },
                { status: 404 }
            );
        }

        const fixture = fixtures[0];

        // Update matchups
        await sql`
      UPDATE matchups
      SET 
        is_null = ${is_null},
        updated_at = NOW()
      WHERE fixture_id = ${fixtureId}
        AND position = ANY(${matchup_positions})
    `;

        // Log in audit trail
        await sql`
      INSERT INTO fixture_audit_log (
        fixture_id,
        change_type,
        changed_by,
        changes,
        tournament_id
      ) VALUES (
        ${fixtureId},
        'matchups_marked_null',
        ${updated_by_name || 'Team Manager'},
        ${JSON.stringify({
            matchup_positions,
            is_null,
            updated_by: updated_by || 'system',
            season_id: fixture.season_id,
            round_number: fixture.round_number,
            match_number: fixture.match_number,
            note: is_null
                ? 'These matchups will not count in player stats but will count for salary and team stats'
                : 'These matchups will now count in player stats'
        })},
        ${fixture.season_id}
      )
    `;

        return NextResponse.json({
            success: true,
            message: is_null
                ? `${matchup_positions.length} matchup(s) marked as NULL`
                : `${matchup_positions.length} matchup(s) unmarked as NULL`,
            matchup_positions,
            is_null
        });
    } catch (error) {
        console.error('Error marking matchups as null:', error);
        console.error('Error details:', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        });
        return NextResponse.json(
            {
                error: 'Failed to mark matchups as null',
                details: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
}
