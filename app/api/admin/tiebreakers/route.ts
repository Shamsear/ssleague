import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getAuthToken } from '@/lib/auth/token-helper';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { batchGetFirebaseFields } from '@/lib/firebase/batch';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

/**
 * GET /api/admin/tiebreakers
 * Fetch all tiebreakers (committee admin only)
 */
export async function GET(request: NextRequest) {
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

    // Check if user is committee admin
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    if (userData?.role !== 'admin' && userData?.role !== 'committee_admin') {
      return NextResponse.json(
        { success: false, error: 'Access denied. Committee admin only.' },
        { status: 403 }
      );
    }
    // Get query params for filtering
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status') || 'all';
    const seasonId = searchParams.get('seasonId');

    // Parse status - support comma-separated values
    const statuses = statusParam === 'all' ? [] : statusParam.split(',').map(s => s.trim());

    console.log('🔍 Tiebreakers API called with:');
    console.log('   Status param:', statusParam);
    console.log('   Parsed statuses:', statuses);
    console.log('   Season ID:', seasonId);

    // Build the base query with conditional filters
    let whereClause = '';
    const params: any[] = [];
    
    if (statuses.length > 0 && seasonId) {
      whereClause = 'WHERE t.status = ANY($1) AND r.season_id = $2';
      params.push(statuses, seasonId);
    } else if (statuses.length > 0) {
      whereClause = 'WHERE t.status = ANY($1)';
      params.push(statuses);
    } else if (seasonId) {
      whereClause = 'WHERE r.season_id = $1';
      params.push(seasonId);
    }

    // Execute the query with parameters
    const queryText = `
      SELECT 
        t.*,
        p.name as player_name,
        p.position,
        p.overall_rating,
        r.position as round_position,
        r.season_id,
        COUNT(DISTINCT tt.id) as teams_count,
        COUNT(DISTINCT tt.id) FILTER (WHERE tt.submitted = true) as submitted_count
      FROM tiebreakers t
      INNER JOIN footballplayers p ON t.player_id = p.id
      INNER JOIN rounds r ON t.round_id = r.id
      LEFT JOIN team_tiebreakers tt ON t.id = tt.tiebreaker_id
      ${whereClause}
      GROUP BY t.id, p.name, p.position, p.overall_rating, r.position, r.season_id
      ORDER BY t.created_at DESC
    `;

    const tiebreakersResult = await sql.query(queryText, params);

    console.time('⚡ Batch fetch team tiebreakers');
    
    // Step 1: Batch fetch all team_tiebreakers data for all tiebreakers in one query
    const tiebreakerIds = tiebreakersResult.map(t => t.id);
    let allTeamsData: any[] = [];
    
    if (tiebreakerIds.length > 0) {
      allTeamsData = await sql`
        SELECT 
          tt.*,
          b.team_id
        FROM team_tiebreakers tt
        INNER JOIN bids b ON b.id::text = tt.original_bid_id
        WHERE tt.tiebreaker_id = ANY(${tiebreakerIds})
      `;
    }
    
    console.timeEnd('⚡ Batch fetch team tiebreakers');
    
    // Step 2: Collect all unique team IDs
    const allTeamIds = Array.from(new Set(allTeamsData.map(t => t.team_id)));
    
    console.time('⚡ Batch fetch team names from Firebase');
    
    // Step 3: Batch fetch team names from Firebase
    const teamNamesMap = await batchGetFirebaseFields<{ name: string }>(
      'teams',
      allTeamIds,
      ['name']
    );
    
    console.timeEnd('⚡ Batch fetch team names from Firebase');
    
    // Step 4: Group teams by tiebreaker_id
    const teamsByTiebreaker = new Map<number, any[]>();
    for (const teamData of allTeamsData) {
      if (!teamsByTiebreaker.has(teamData.tiebreaker_id)) {
        teamsByTiebreaker.set(teamData.tiebreaker_id, []);
      }
      
      const teamName = teamNamesMap.get(teamData.team_id)?.name || teamData.team_id;
      
      teamsByTiebreaker.get(teamData.tiebreaker_id)!.push({
        team_id: teamData.team_id,
        team_name: teamName,
        submitted: teamData.submitted,
        new_bid_amount: teamData.new_bid_amount,
        submitted_at: teamData.submitted_at,
      });
    }
    
    // Step 5: Build final tiebreakers array
    const tiebreakers = tiebreakersResult.map(tiebreaker => {
      const teams = teamsByTiebreaker.get(tiebreaker.id) || [];
      
      // Calculate time remaining (null duration means no time limit)
      const createdAt = new Date(tiebreaker.created_at);
      let expiresAt = null;
      let timeRemaining = null;
      let isExpired = false;
      
      if (tiebreaker.duration_minutes !== null) {
        expiresAt = new Date(createdAt.getTime() + tiebreaker.duration_minutes * 60 * 1000);
        timeRemaining = Math.max(0, expiresAt.getTime() - Date.now());
        isExpired = timeRemaining === 0;
      }

      return {
        ...tiebreaker,
        teams,
        expiresAt: expiresAt ? expiresAt.toISOString() : null,
        timeRemaining,
        isExpired,
        hasTimeLimit: tiebreaker.duration_minutes !== null,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        tiebreakers,
        total: tiebreakers.length,
      },
    });
  } catch (error: any) {
    console.error('Error fetching tiebreakers:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
