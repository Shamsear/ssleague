import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

// DELETE - Remove/reverse a penalty
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; penaltyId: string }> }
) {
    try {
        const sql = getTournamentDb();
        const { id, penaltyId } = await params;
        const body = await request.json();
        const { removal_reason, removed_by_id, removed_by_name } = body;

        // Validation
        if (!removal_reason || !removed_by_id || !removed_by_name) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields' },
                { status: 400 }
            );
        }

        if (removal_reason.length < 10) {
            return NextResponse.json(
                { success: false, error: 'Removal reason must be at least 10 characters' },
                { status: 400 }
            );
        }

        // Get penalty details before removing
        const penaltyDetails = await sql`
      SELECT * FROM tournament_penalties
      WHERE id = ${penaltyId}
      AND tournament_id = ${id}
      AND is_active = true
    `;

        if (penaltyDetails.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Penalty not found or already removed' },
                { status: 404 }
            );
        }

        const penalty = penaltyDetails[0];

        // Mark penalty as inactive (soft delete)
        await sql`
      UPDATE tournament_penalties
      SET is_active = false,
          removed_by_id = ${removed_by_id},
          removed_by_name = ${removed_by_name},
          removed_at = NOW(),
          removal_reason = ${removal_reason},
          updated_at = NOW()
      WHERE id = ${penaltyId}
    `;

        // Recalculate total active penalties for this team
        const activePenalties = await sql`
      SELECT COALESCE(SUM(points_deducted), 0) as total
      FROM tournament_penalties
      WHERE tournament_id = ${id}
      AND team_id = ${penalty.team_id}
      AND is_active = true
    `;

        const totalPenalties = activePenalties[0].total;

        // Update teamstats
        await sql`
      UPDATE teamstats
      SET points_deducted = ${totalPenalties},
          updated_at = NOW()
      WHERE tournament_id = ${id}
      AND team_id = ${penalty.team_id}
    `;

        console.log(`✅ Penalty removed: ${penalty.team_name} +${penalty.points_deducted} points restored (${removal_reason})`);

        return NextResponse.json({
            success: true,
            message: `Penalty removed - ${penalty.points_deducted} points restored to ${penalty.team_name}`,
        });
    } catch (error) {
        console.error('Error removing penalty:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to remove penalty' },
            { status: 500 }
        );
    }
}
