import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getAuthToken } from '@/lib/auth/token-helper';
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
    const token = await getAuthToken(request);

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

    // Get user's team ID from team_seasons collection or teams table
    let userTeamId: string | null = null;
    if (userData?.role !== 'admin' && userData?.role !== 'committee_admin') {
      // Get the season_id first to look up team
      const tiebreakerCheck = await sql`
        SELECT t.round_id FROM tiebreakers t WHERE t.id = ${tiebreakerId}
      `;
      
      if (tiebreakerCheck.length > 0) {
        const roundCheck = await sql`
          SELECT season_id FROM rounds WHERE id = ${tiebreakerCheck[0].round_id}
        `;
        const seasonId = roundCheck[0]?.season_id;
        
        if (seasonId) {
          // Try team_seasons collection first
          let teamSeasonId = `${userId}_${seasonId}`;
          let teamSeasonDoc = await adminDb.collection('team_seasons').doc(teamSeasonId).get();
          
          // Fallback 1: Query by user_id field
          if (!teamSeasonDoc.exists) {
            const teamSeasonQuery = await adminDb.collection('team_seasons')
              .where('user_id', '==', userId)
              .where('season_id', '==', seasonId)
              .where('status', '==', 'registered')
              .limit(1)
              .get();
            
            if (!teamSeasonQuery.empty) {
              teamSeasonDoc = teamSeasonQuery.docs[0];
            }
          }
          
          if (teamSeasonDoc.exists) {
            const teamSeasonData = teamSeasonDoc.data();
            userTeamId = teamSeasonData?.team_id || null;
          }
          
          // Fallback 2: Check Neon teams table
          if (!userTeamId) {
            const teamResult = await sql`
              SELECT id FROM teams WHERE firebase_uid = ${userId} AND season_id = ${seasonId} LIMIT 1
            `;
            if (teamResult.length > 0) {
              userTeamId = teamResult[0].id;
            }
          }
        }
      }
    }

    // Fetch tiebreaker details
    const tiebreakerResult = await sql`
      SELECT 
        t.*,
        p.name as player_name,
        p.position,
        p.overall_rating,
        p.team_name as player_team,
        r.position as round_position,
        r.round_type
      FROM tiebreakers t
      INNER JOIN footballplayers p ON t.player_id = p.id
      LEFT JOIN rounds r ON t.round_id = r.id
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
    // Note: original_bid_id can reference either bids or round_bids table
    // We get team_id and team_name directly from team_tiebreakers (already stored there)
    const teamTiebreakersResult = await sql`
      SELECT 
        tt.*
      FROM team_tiebreakers tt
      WHERE tt.tiebreaker_id = ${tiebreakerId}
      ORDER BY tt.submitted DESC, tt.new_bid_amount DESC NULLS LAST
    `;

    // Fetch team balances from team_seasons (team_name already comes from bids)
    const teamData: any[] = [];
    for (const tt of teamTiebreakersResult) {
      try {
        // First, get firebase_uid from teams table using team_id
        const teamUserResult = await sql`
          SELECT firebase_uid FROM teams WHERE id = ${tt.team_id} AND season_id = ${seasonId} LIMIT 1
        `;
        
        let teamSeasonDoc: any = null;
        let teamSeasonId = '';
        
        if (teamUserResult.length > 0) {
          const userIdFromTeam = teamUserResult[0].firebase_uid;
          
          // Try direct lookup with userId_seasonId format
          teamSeasonId = `${userIdFromTeam}_${seasonId}`;
          teamSeasonDoc = await adminDb.collection('team_seasons').doc(teamSeasonId).get();
          
          // Fallback: Query by user_id field
          if (!teamSeasonDoc.exists) {
            const teamSeasonQuery = await adminDb.collection('team_seasons')
              .where('user_id', '==', userIdFromTeam)
              .where('season_id', '==', seasonId)
              .where('status', '==', 'registered')
              .limit(1)
              .get();
            
            if (!teamSeasonQuery.empty) {
              teamSeasonDoc = teamSeasonQuery.docs[0];
              teamSeasonId = teamSeasonDoc.id;
            }
          }
        } else {
          // Fallback: Try to query team_seasons by team_id
          const teamSeasonQuery = await adminDb.collection('team_seasons')
            .where('team_id', '==', tt.team_id)
            .where('season_id', '==', seasonId)
            .where('status', '==', 'registered')
            .limit(1)
            .get();
          
          if (!teamSeasonQuery.empty) {
            teamSeasonDoc = teamSeasonQuery.docs[0];
            teamSeasonId = teamSeasonDoc.id;
          }
        }
        
        if (teamSeasonDoc && teamSeasonDoc.exists) {
          const data = teamSeasonDoc.data();
          
          // Determine currency system and get appropriate balance
          const currencySystem = data?.currency_system || 'single';
          const isDualCurrency = currencySystem === 'dual';
          
          let teamBalance = 0;
          if (isDualCurrency) {
            // For dual currency, use football_budget (since this is for football players)
            teamBalance = data?.football_budget || 0;
          } else {
            // For single currency, use budget
            teamBalance = data?.budget || 0;
          }
          
          teamData.push({
            ...tt,
            team_name: tt.team_name || data?.team_name || tt.team_id,
            team_balance: teamBalance,
            is_current_user: tt.team_id === userTeamId, // Mark if this is the current user's team
          });
        } else {
          teamData.push({
            ...tt,
            team_name: tt.team_name || tt.team_id,
            team_balance: 0,
            is_current_user: tt.team_id === userTeamId,
          });
        }
      } catch (error) {
        console.error(`Error fetching team ${tt.team_id}:`, error);
        teamData.push({
          ...tt,
          team_name: tt.team_name || tt.team_id,
          team_balance: 0,
          is_current_user: tt.team_id === userTeamId,
        });
      }
    }

    // Check if user has access
    // Committee admin can view all
    // Team users can only view tiebreakers they're involved in
    if (userData?.role !== 'admin' && userData?.role !== 'committee_admin') {
      if (!userTeamId) {
        return NextResponse.json(
          { success: false, error: 'Team not found for user' },
          { status: 403 }
        );
      }
      
      // Check if user's team is part of this tiebreaker
      const isInvolvedTeam = teamData.some((t) => t.team_id === userTeamId);

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
