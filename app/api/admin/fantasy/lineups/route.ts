import { NextRequest, NextResponse } from 'next/server';
import { fantasySql } from '@/lib/neon/fantasy-config';
import { verifyAuth } from '@/lib/auth-helper';

/**
 * GET /api/admin/fantasy/lineups?league_id={id}
 * Get all teams' lineups for a fantasy league (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const authResult = await verifyAuth(['committee_admin', 'admin'], request);
    if (!authResult.authenticated) {
      console.error('Unauthorized access to lineups API');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const league_id = searchParams.get('league_id');

    if (!league_id) {
      console.error('Missing league_id parameter');
      return NextResponse.json(
        { error: 'league_id is required' },
        { status: 400 }
      );
    }

    console.log(`Fetching lineups for league: ${league_id}`);

    // Get all teams in the league
    let teams;
    try {
      teams = await fantasySql`
        SELECT 
          ft.team_id,
          ft.team_name,
          ft.owner_uid,
          COALESCE(ft.total_points, 0) as total_points,
          COALESCE(ft.draft_submitted, false) as draft_submitted
        FROM fantasy_teams ft
        WHERE ft.league_id = ${league_id}
          AND ft.is_enabled = true
        ORDER BY ft.team_name ASC
      `;
      console.log(`Found ${teams.length} teams`);
    } catch (sqlError) {
      console.error('SQL Error fetching teams:', sqlError);
      throw sqlError;
    }

    // Get all squad members with lineup info for these teams
    const teamIds = teams.map(t => t.team_id);
    
    if (teamIds.length === 0) {
      console.log('No teams found, returning empty result');
      return NextResponse.json({
        teams: [],
        summary: {
          total_teams: 0,
          teams_with_complete_lineup: 0,
          teams_without_lineup: 0,
          teams_missing_captain: 0,
          teams_missing_vice_captain: 0,
          teams_wrong_starters: 0,
        },
        league_id,
      });
    }

    // Get squads for all teams (fantasy database doesn't have player details)
    let squads = [];
    if (teamIds.length > 0) {
      try {
        squads = await fantasySql`
          SELECT 
            fs.team_id,
            fs.real_player_id,
            fs.player_name,
            fs.position,
            fs.real_team_name as player_team,
            COALESCE(fs.is_starting, true) as is_starting,
            COALESCE(fs.is_captain, false) as is_captain,
            COALESCE(fs.is_vice_captain, false) as is_vice_captain,
            fs.squad_id
          FROM fantasy_squad fs
          WHERE fs.league_id = ${league_id}
          ORDER BY fs.team_id, fs.is_starting DESC NULLS LAST, fs.is_captain DESC NULLS LAST, fs.is_vice_captain DESC NULLS LAST, fs.acquired_at ASC
        `;
        console.log(`Found ${squads.length} squad members`);
      } catch (sqlError) {
        console.error('SQL Error fetching squads:', sqlError);
        throw sqlError;
      }
    }

    // Organize squads by team
    const teamsWithLineups = teams.map(team => {
      const teamSquad = squads.filter(s => s.team_id === team.team_id);
      const starters = teamSquad.filter(p => p.is_starting);
      const subs = teamSquad.filter(p => !p.is_starting);
      const captain = teamSquad.find(p => p.is_captain);
      const viceCaptain = teamSquad.find(p => p.is_vice_captain);

      return {
        team_id: team.team_id,
        team_name: team.team_name,
        owner_uid: team.owner_uid,
        total_points: team.total_points,
        draft_submitted: team.draft_submitted,
        squad_size: teamSquad.length,
        starters_count: starters.length,
        has_captain: !!captain,
        has_vice_captain: !!viceCaptain,
        lineup_complete: starters.length === 5 && !!captain && !!viceCaptain,
        starters: starters.map(p => ({
          player_id: p.real_player_id,
          player_name: p.player_name,
          position: p.position,
          team: p.player_team,
          is_captain: p.is_captain,
          is_vice_captain: p.is_vice_captain,
        })),
        substitutes: subs.map(p => ({
          player_id: p.real_player_id,
          player_name: p.player_name,
          position: p.position,
          team: p.player_team,
        })),
        captain: captain ? {
          player_id: captain.real_player_id,
          player_name: captain.player_name,
          position: captain.position,
          team: captain.player_team,
        } : null,
        vice_captain: viceCaptain ? {
          player_id: viceCaptain.real_player_id,
          player_name: viceCaptain.player_name,
          position: viceCaptain.position,
          team: viceCaptain.player_team,
        } : null,
      };
    });

    // Calculate summary stats
    const summary = {
      total_teams: teams.length,
      teams_with_complete_lineup: teamsWithLineups.filter(t => t.lineup_complete).length,
      teams_without_lineup: teamsWithLineups.filter(t => !t.lineup_complete).length,
      teams_missing_captain: teamsWithLineups.filter(t => !t.has_captain).length,
      teams_missing_vice_captain: teamsWithLineups.filter(t => !t.has_vice_captain).length,
      teams_wrong_starters: teamsWithLineups.filter(t => t.starters_count !== 5).length,
    };

    console.log(`Successfully fetched lineups for ${teams.length} teams`);

    return NextResponse.json({
      teams: teamsWithLineups,
      summary,
      league_id,
    });
  } catch (error) {
    console.error('Error fetching lineups:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      { 
        error: 'Failed to fetch lineups',
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
