import { NextRequest, NextResponse } from 'next/server';
import { getAuctionDb } from '@/lib/neon/auction-config';
import { verifyAuth } from '@/lib/auth-helper';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify authentication
    const auth = await verifyAuth(['admin', 'committee_admin']);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: roundId } = await params;
    const sql = getAuctionDb();

    // Get round details
    const roundResult = await sql`
      SELECT id, position, max_bids_per_team, status, season_id
      FROM rounds
      WHERE id = ${roundId}
    `;

    if (roundResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Round not found' },
        { status: 404 }
      );
    }

    const round = roundResult[0];

    // Get all teams registered for this season
    const teamsResult = await sql`
      SELECT 
        t.id as team_id,
        t.name as team_name,
        t.firebase_uid
      FROM teams t
      WHERE t.season_id = ${round.season_id}
      ORDER BY t.name ASC
    `;

    // Get submissions for this round
    const submissionsResult = await sql`
      SELECT 
        team_id,
        submitted_at,
        bid_count,
        is_locked
      FROM bid_submissions
      WHERE round_id = ${roundId}
    `;

    // Create a map of submissions by team_id
    const submissionsMap = new Map();
    submissionsResult.forEach(sub => {
      submissionsMap.set(sub.team_id, sub);
    });

    // Combine team data with submission data
    const teamSubmissions = teamsResult.map(team => {
      const submission = submissionsMap.get(team.team_id);
      return {
        team_id: team.team_id,
        team_name: team.team_name,
        has_submitted: !!submission,
        submitted_at: submission?.submitted_at || null,
        bid_count: submission?.bid_count || 0,
        is_locked: submission?.is_locked || false,
      };
    });

    // Calculate statistics
    const totalTeams = teamsResult.length;
    const submittedTeams = teamSubmissions.filter(t => t.has_submitted).length;
    const pendingTeams = totalTeams - submittedTeams;

    return NextResponse.json({
      success: true,
      round: {
        id: round.id,
        position: round.position,
        max_bids_per_team: round.max_bids_per_team,
        status: round.status,
      },
      stats: {
        total_teams: totalTeams,
        submitted: submittedTeams,
        pending: pendingTeams,
        submission_rate: totalTeams > 0 ? Math.round((submittedTeams / totalTeams) * 100) : 0,
      },
      teams: teamSubmissions,
    });
  } catch (error: any) {
    console.error('Error fetching round submissions:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
