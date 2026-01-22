import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

// GET - Get teams participating in a tournament
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sql = getTournamentDb();
    const { id: tournamentId } = await params;

    // Get tournament details to get season_id
    const tournament = await sql`
      SELECT season_id FROM tournaments WHERE id = ${tournamentId} LIMIT 1
    `;

    if (tournament.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tournament not found' },
        { status: 404 }
      );
    }

    const seasonId = tournament[0].season_id;

    // Get all unique teams for this season with their participation status in THIS tournament
    // Use DISTINCT ON to get one row per team, prioritizing the current tournament
    const teams = await sql`
      SELECT DISTINCT ON (team_id)
        team_id,
        team_name,
        CASE WHEN tournament_id = ${tournamentId} THEN true ELSE false END as is_participating
      FROM teamstats
      WHERE season_id = ${seasonId}
      ORDER BY team_id, 
               CASE WHEN tournament_id = ${tournamentId} THEN 0 ELSE 1 END,
               team_name ASC
    `;

    return NextResponse.json({
      success: true,
      teams,
      tournament_id: tournamentId,
      season_id: seasonId
    });
  } catch (error) {
    console.error('Error fetching tournament teams:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch teams' },
      { status: 500 }
    );
  }
}

// POST - Assign teams to tournament
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sql = getTournamentDb();
    const { id: tournamentId } = await params;
    const body = await request.json();
    const { team_ids } = body;

    if (!team_ids || !Array.isArray(team_ids)) {
      return NextResponse.json(
        { success: false, error: 'team_ids array is required' },
        { status: 400 }
      );
    }

    // Get tournament details
    const tournament = await sql`
      SELECT season_id FROM tournaments WHERE id = ${tournamentId} LIMIT 1
    `;

    if (tournament.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tournament not found' },
        { status: 404 }
      );
    }

    const seasonId = tournament[0].season_id;

    // Get currently assigned teams for this tournament
    const currentTeams = await sql`
      SELECT team_id 
      FROM teamstats
      WHERE tournament_id = ${tournamentId}
        AND season_id = ${seasonId}
    `;

    const currentTeamIds = new Set(currentTeams.map((t: any) => t.team_id));
    const newTeamIds = new Set(team_ids);

    // Determine which teams to add and which to remove
    const teamsToAdd = team_ids.filter(id => !currentTeamIds.has(id));
    const teamsToRemove = Array.from(currentTeamIds).filter(id => !newTeamIds.has(id));

    console.log(`Tournament ${tournamentId}:`);
    console.log(`  - Current teams: ${currentTeamIds.size}`);
    console.log(`  - New selection: ${newTeamIds.size}`);
    console.log(`  - To add: ${teamsToAdd.length}`);
    console.log(`  - To remove: ${teamsToRemove.length}`);

    // Remove teams that are no longer selected (preserves their stats in other tournaments)
    if (teamsToRemove.length > 0) {
      await sql`
        DELETE FROM teamstats
        WHERE tournament_id = ${tournamentId}
          AND season_id = ${seasonId}
          AND team_id = ANY(${teamsToRemove})
      `;
      console.log(`  ✅ Removed ${teamsToRemove.length} teams from tournament`);
    }

    // Add new teams to the tournament
    if (teamsToAdd.length > 0) {
      for (const teamId of teamsToAdd) {
        // Get team name from existing teamstats or teams table
        const existingTeam = await sql`
          SELECT team_name 
          FROM teamstats 
          WHERE team_id = ${teamId} 
            AND season_id = ${seasonId}
          LIMIT 1
        `;

        const teamName = existingTeam[0]?.team_name || 'Unknown Team';

        // Insert new entry with ID format: teamid_seasonid_tournamentid
        await sql`
          INSERT INTO teamstats (
            id, team_id, tournament_id, season_id, team_name,
            position, points, matches_played,
            wins, draws, losses,
            goals_for, goals_against, goal_difference,
            created_at, updated_at
          )
          VALUES (
            ${teamId + '_' + seasonId + '_' + tournamentId},
            ${teamId},
            ${tournamentId},
            ${seasonId},
            ${teamName},
            0, 0, 0,
            0, 0, 0,
            0, 0, 0,
            NOW(), NOW()
          )
          ON CONFLICT (team_id, season_id, tournament_id) 
          DO UPDATE SET
            team_name = EXCLUDED.team_name,
            updated_at = NOW()
        `;
      }
      console.log(`  ✅ Added ${teamsToAdd.length} new teams to tournament`);
    }

    return NextResponse.json({
      success: true,
      message: `Tournament updated: ${teamsToAdd.length} added, ${teamsToRemove.length} removed`,
      assigned_count: team_ids.length,
      changes: {
        added: teamsToAdd.length,
        removed: teamsToRemove.length,
        unchanged: team_ids.length - teamsToAdd.length
      }
    });
  } catch (error) {
    console.error('Error assigning teams to tournament:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to assign teams' },
      { status: 500 }
    );
  }
}

// DELETE - Remove all team assignments from tournament
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sql = getTournamentDb();
    const { id: tournamentId } = await params;

    // Remove all team assignments for this tournament
    const result = await sql`
      UPDATE teamstats
      SET tournament_id = NULL
      WHERE tournament_id = ${tournamentId}
      RETURNING team_id
    `;

    return NextResponse.json({
      success: true,
      message: 'All team assignments removed',
      removed_count: result.length
    });
  } catch (error) {
    console.error('Error removing team assignments:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to remove team assignments' },
      { status: 500 }
    );
  }
}
