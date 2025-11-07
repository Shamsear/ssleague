import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { verifyAuth } from '@/lib/auth-helper';
import { batchGetFirebaseFields } from '@/lib/firebase/batch';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

/**
 * GET /api/admin/bulk-tiebreakers
 * Fetch all bulk tiebreakers (committee admin only)
 * 
 * Query params:
 * - status: Filter by status (comma-separated for multiple, e.g., "active,pending")
 * - seasonId: Filter by season ID
 * - roundId: Filter by specific round ID
 */
export async function GET(request: NextRequest) {
  try {
    // ✅ ZERO FIREBASE READS - Uses JWT claims only
    const auth = await verifyAuth(['admin', 'committee_admin'], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get query params for filtering
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status') || 'all';
    const seasonId = searchParams.get('seasonId');
    const roundId = searchParams.get('roundId');

    // Parse status - support comma-separated values
    const statuses = statusParam === 'all' ? [] : statusParam.split(',').map(s => s.trim());

    console.log('🔍 Bulk Tiebreakers API called with:');
    console.log('   Status param:', statusParam);
    console.log('   Parsed statuses:', statuses);
    console.log('   Season ID:', seasonId);
    console.log('   Round ID:', roundId);

    // Build the base query with conditional filters
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;
    
    if (statuses.length > 0) {
      whereClause += ` AND bt.status = ANY($${paramIndex})`;
      params.push(statuses);
      paramIndex++;
    }
    
    if (seasonId) {
      whereClause += ` AND r.season_id = $${paramIndex}`;
      params.push(seasonId);
      paramIndex++;
    }
    
    if (roundId) {
      whereClause += ` AND bt.round_id = $${paramIndex}`;
      params.push(roundId);
      paramIndex++;
    }

    // Execute the query with parameters
    const queryText = `
      SELECT 
        bt.id,
        bt.round_id,
        bt.player_id,
        bt.player_name,
        bt.player_team,
        bt.player_position,
        bt.status,
        bt.tie_amount,
        bt.tied_team_count,
        bt.current_highest_bid,
        bt.current_highest_team_id,
        bt.winning_team_id,
        bt.winning_amount,
        bt.start_time,
        bt.last_activity_time,
        bt.max_end_time,
        bt.created_at,
        bt.updated_at,
        r.position as round_position,
        r.season_id,
        r.status as round_status
      FROM bulk_tiebreakers bt
      INNER JOIN rounds r ON bt.round_id = r.id
      ${whereClause}
      ORDER BY bt.created_at DESC
    `;

    const tiebreakersResult = await sql.query(queryText, params);

    console.time('⚡ Batch fetch bulk tiebreaker teams');
    
    // Step 1: Batch fetch all bulk_tiebreaker_teams data for all tiebreakers in one query
    const tiebreakerIds = tiebreakersResult.map(t => t.id);
    let allTeamsData: any[] = [];
    
    if (tiebreakerIds.length > 0) {
      allTeamsData = await sql`
        SELECT 
          btt.*
        FROM bulk_tiebreaker_teams btt
        WHERE btt.tiebreaker_id = ANY(${tiebreakerIds})
        ORDER BY btt.current_bid DESC NULLS LAST
      `;
    }
    
    console.timeEnd('⚡ Batch fetch bulk tiebreaker teams');
    
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
        status: teamData.status,
        current_bid: teamData.current_bid,
        joined_at: teamData.joined_at,
        withdrawn_at: teamData.withdrawn_at,
      });
    }
    
    // Step 5: Build final tiebreakers array with computed fields
    const tiebreakers = tiebreakersResult.map(tiebreaker => {
      const teams = teamsByTiebreaker.get(tiebreaker.id) || [];
      const activeTeamCount = teams.filter(t => t.status === 'active').length;
      const withdrawnTeamCount = teams.filter(t => t.status === 'withdrawn').length;
      
      // Calculate time remaining if max_end_time is set
      let timeRemaining = null;
      let isExpired = false;
      
      if (tiebreaker.max_end_time) {
        const now = Date.now();
        const maxEndTime = new Date(tiebreaker.max_end_time).getTime();
        timeRemaining = Math.max(0, maxEndTime - now);
        isExpired = timeRemaining === 0;
      }

      return {
        id: tiebreaker.id,
        round_id: tiebreaker.round_id,
        player_id: tiebreaker.player_id,
        player_name: tiebreaker.player_name,
        player_team: tiebreaker.player_team,
        position: tiebreaker.player_position,
        status: tiebreaker.status,
        original_amount: tiebreaker.tie_amount,
        tied_team_count: tiebreaker.tied_team_count,
        active_team_count: activeTeamCount,
        withdrawn_team_count: withdrawnTeamCount,
        current_highest_bid: tiebreaker.current_highest_bid,
        current_highest_team_id: tiebreaker.current_highest_team_id,
        winning_team_id: tiebreaker.winning_team_id,
        winning_amount: tiebreaker.winning_amount,
        start_time: tiebreaker.start_time,
        last_activity_time: tiebreaker.last_activity_time,
        max_end_time: tiebreaker.max_end_time,
        time_remaining: timeRemaining,
        is_expired: isExpired,
        created_at: tiebreaker.created_at,
        updated_at: tiebreaker.updated_at,
        round_position: tiebreaker.round_position,
        season_id: tiebreaker.season_id,
        round_status: tiebreaker.round_status,
        teams,
        teams_count: teams.length,
        submitted_count: activeTeamCount, // For compatibility with old interface
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
    console.error('Error fetching bulk tiebreakers:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
