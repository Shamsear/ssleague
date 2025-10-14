import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { cookies } from 'next/headers';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

/**
 * GET /api/tiebreakers/[id]
 * Fetch tiebreaker details with team submissions
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify Firebase ID token
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (error) {
      console.error('Token verification error:', error);
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }

    const userId = decodedToken.uid;
    const { id: tiebreakerId } = await params;

    // Get user role from Firestore
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();

    // Fetch tiebreaker details
    const tiebreakerResult = await sql`
      SELECT 
        t.*,
        p.name as player_name,
        p.position,
        p.overall_rating,
        p.team_name as player_team,
        r.position as round_position
      FROM tiebreakers t
      INNER JOIN footballplayers p ON t.player_id = p.id
      INNER JOIN rounds r ON t.round_id = r.id
      WHERE t.id = ${tiebreakerId}
    `;

    if (tiebreakerResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tiebreaker not found' },
        { status: 404 }
      );
    }

    const tiebreaker = tiebreakerResult[0];

    // Get the season_id from the round (fetch once)
    const roundResult = await sql`
      SELECT season_id FROM rounds WHERE id = ${tiebreaker.round_id}
    `;
    const seasonId = roundResult[0]?.season_id;

    if (!seasonId) {
      return NextResponse.json(
        { success: false, error: 'Season not found for this tiebreaker' },
        { status: 404 }
      );
    }

    // Fetch team tiebreaker records
    const teamTiebreakersResult = await sql`
      SELECT 
        tt.*,
        b.team_id
      FROM team_tiebreakers tt
      INNER JOIN bids b ON tt.original_bid_id = b.id
      WHERE tt.tiebreaker_id = ${tiebreakerId}
      ORDER BY tt.submitted DESC, tt.new_bid_amount DESC NULLS LAST
    `;

    // Fetch team names and balances from team_seasons
    const teamData: any[] = [];
    for (const tt of teamTiebreakersResult) {
      try {
        const teamSeasonId = `${tt.team_id}_${seasonId}`;
        const teamSeasonDoc = await adminDb.collection('team_seasons').doc(teamSeasonId).get();
        
        if (teamSeasonDoc.exists) {
          const data = teamSeasonDoc.data();
          console.log(`Team ${tt.team_id} data:`, { team_name: data?.team_name, budget: data?.budget });
          teamData.push({
            ...tt,
            team_name: data?.team_name || tt.team_id,
            team_balance: data?.budget || 0,
          });
        } else {
          console.warn(`Team season doc not found for ${teamSeasonId}`);
          teamData.push({
            ...tt,
            team_name: tt.team_id,
            team_balance: 0,
          });
        }
      } catch (error) {
        console.error(`Error fetching team ${tt.team_id}:`, error);
        teamData.push({
          ...tt,
          team_name: tt.team_id,
          team_balance: 0,
        });
      }
    }

    // Check if user has access
    // Committee admin can view all
    // Team users can only view tiebreakers they're involved in
    if (userData?.role !== 'admin' && userData?.role !== 'committee_admin') {
      // Use userId directly as team_id (since team_id in bids is the user's UID)
      const isInvolvedTeam = teamData.some((t) => t.team_id === userId);

      if (!isInvolvedTeam) {
        return NextResponse.json(
          { success: false, error: 'Access denied' },
          { status: 403 }
        );
      }
    }

    // Calculate statistics
    const submittedCount = teamData.filter((t) => t.submitted).length;
    const totalTeams = teamData.length;

    return NextResponse.json({
      success: true,
      data: {
        tiebreaker,
        teamTiebreakers: teamData,
        stats: {
          submittedCount,
          totalTeams,
          isResolved: tiebreaker.status === 'resolved',
          isExpired: tiebreaker.status === 'excluded',
        },
      },
    });
  } catch (error: any) {
    console.error('Error fetching tiebreaker:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
