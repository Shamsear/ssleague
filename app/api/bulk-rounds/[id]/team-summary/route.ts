import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

/**
 * GET /api/bulk-rounds/:id/team-summary
 * Get team summary for bulk round (slots needed, players selected)
 * Committee admin only
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: roundId } = await params;

    console.log('[Team Summary] Fetching for round ID:', roundId);

    // Initialize database connection inside the function to avoid build-time errors
    const sql = neon(process.env.DATABASE_URL || process.env.NEON_AUCTION_DB_URL || process.env.NEON_DATABASE_URL!);

    // Get round details to find season_id
    const roundResult = await sql`
      SELECT season_id, status
      FROM rounds
      WHERE id = ${roundId}
      LIMIT 1
    `;

    if (roundResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Round not found' },
        { status: 404 }
      );
    }

    const round = roundResult[0];
    const seasonId = round.season_id;

    // Get all teams for the season from Neon database with dynamic slot information
    console.log('[Team Summary] Fetching teams for season:', seasonId);
    let teamsResult: Array<{ 
      id: string; 
      name: string; 
      football_total_slots: number;
      football_base_slots: number;
      football_purchased_slots: number;
    }> = [];
    
    try {
      const neonTeams = await sql`
        SELECT 
          id, 
          name,
          football_total_slots,
          football_base_slots,
          football_purchased_slots
        FROM teams
        WHERE season_id = ${seasonId}
        ORDER BY name
      `;
      
      console.log('[Team Summary] Found teams in Neon:', neonTeams.length);
      
      teamsResult = neonTeams.map((team: any) => ({
        id: team.id,
        name: team.name || team.id,
        football_total_slots: team.football_total_slots || 25,
        football_base_slots: team.football_base_slots || 25,
        football_purchased_slots: team.football_purchased_slots || 0,
      }));
    } catch (neonError: any) {
      console.error('[Team Summary] Neon error:', neonError);
      // Return empty array if query fails
      teamsResult = [];
    }

    // Get bid counts per team for this round
    const bidsResult = await sql`
      SELECT 
        team_id,
        COUNT(DISTINCT player_id) as players_selected
      FROM round_bids
      WHERE round_id = ${roundId}
      GROUP BY team_id
    `;

    // Create a map of team_id to bid count
    const bidCountMap = new Map(
      bidsResult.map((row: any) => [row.team_id, parseInt(row.players_selected)])
    );

    // Get current squad sizes for all teams (no season filter needed - teams are already season-specific)
    const teamIds = teamsResult.map((t: any) => t.id);
    let squadSizeMap = new Map<string, number>();
    
    if (teamIds.length > 0) {
      const squadSizes = await sql`
        SELECT 
          team_id,
          COUNT(*) as squad_size
        FROM footballplayers
        WHERE team_id = ANY(${teamIds})
        GROUP BY team_id
      `;
      
      console.log('[Team Summary] Squad sizes:', squadSizes);
      
      squadSizeMap = new Map(
        squadSizes.map((row: any) => [row.team_id, parseInt(row.squad_size)])
      );
    }

    // Build team summary with remaining slots calculation using dynamic slots
    const teams = teamsResult.map((team: any) => {
      const currentSquadSize = squadSizeMap.get(team.id) || 0;
      const maxSquadSize = team.football_total_slots || 25; // Use team-specific slots
      const remainingSlots = Math.max(0, maxSquadSize - currentSquadSize);
      
      return {
        team_id: team.id,
        team_name: team.name,
        slots_needed: remainingSlots,
        current_squad_size: currentSquadSize,
        max_squad_size: maxSquadSize,
        football_base_slots: team.football_base_slots || 25,
        football_purchased_slots: team.football_purchased_slots || 0,
        football_total_slots: maxSquadSize,
        players_selected: bidCountMap.get(team.id) || 0,
        bids_submitted: bidCountMap.get(team.id) || 0,
      };
    });

    console.log('[Team Summary] Returning teams:', teams.length);

    return NextResponse.json({
      success: true,
      data: {
        teams,
        round_status: round.status,
        season_id: seasonId,
        debug: {
          teams_found: teamsResult.length,
          bids_found: bidsResult.length,
        },
      },
    });
  } catch (error: any) {
    console.error('[Team Summary] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch team summary' },
      { status: 500 }
    );
  }
}
