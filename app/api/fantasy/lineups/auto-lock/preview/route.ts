import { NextRequest, NextResponse } from 'next/server';
import { fantasySql } from '@/lib/neon/fantasy-config';

/**
 * POST /api/fantasy/lineups/auto-lock/preview
 * Preview auto-lock impact without executing
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { league_id, round_id } = body;

    if (!league_id) {
      return NextResponse.json(
        { error: 'Missing required parameter: league_id' },
        { status: 400 }
      );
    }

    // Get all teams in the league
    const teams = await fantasySql`
      SELECT team_id, team_name, owner_name
      FROM fantasy_teams
      WHERE fantasy_league_id = ${league_id}
    `;

    // Get all lineups for this round (or current round if not specified)
    const lineups = await fantasySql`
      SELECT 
        fl.lineup_id,
        fl.team_id,
        fl.round_id,
        fl.starting_player_ids,
        fl.bench_player_ids,
        fl.captain_player_id,
        fl.vice_captain_player_id,
        fl.is_locked,
        fl.submitted_at,
        ft.team_name,
        ft.owner_name
      FROM fantasy_lineups fl
      JOIN fantasy_teams ft ON fl.team_id = ft.team_id
      WHERE fl.league_id = ${league_id}
        ${round_id ? fantasySql`AND fl.round_id = ${round_id}` : fantasySql``}
      ORDER BY ft.team_name
    `;

    const teamsWithLineups = new Set(lineups.map((l: any) => l.team_id));
    const teamsWithoutLineups = teams.filter((t: any) => !teamsWithLineups.has(t.team_id));

    // Categorize lineups
    const alreadyLocked = lineups.filter((l: any) => l.is_locked);
    const toBeLockedComplete = lineups.filter((l: any) => 
      !l.is_locked && 
      l.starting_player_ids?.length === 5 &&
      l.captain_player_id &&
      l.vice_captain_player_id
    );
    const toBeLockedIncomplete = lineups.filter((l: any) => 
      !l.is_locked && (
        l.starting_player_ids?.length !== 5 ||
        !l.captain_player_id ||
        !l.vice_captain_player_id
      )
    );

    // Detailed lineup status
    const lineupDetails = lineups.map((lineup: any) => {
      const startingCount = lineup.starting_player_ids?.length || 0;
      const benchCount = lineup.bench_player_ids?.length || 0;
      const hasCaptain = !!lineup.captain_player_id;
      const hasVC = !!lineup.vice_captain_player_id;
      const isComplete = startingCount === 5 && hasCaptain && hasVC;

      const issues = [];
      if (startingCount !== 5) issues.push(`${startingCount}/5 starters`);
      if (!hasCaptain) issues.push('No captain');
      if (!hasVC) issues.push('No vice-captain');

      return {
        team_name: lineup.team_name,
        owner_name: lineup.owner_name,
        status: lineup.is_locked ? 'Locked' : (isComplete ? 'Ready to Lock' : 'Incomplete'),
        starting_players: startingCount,
        bench_players: benchCount,
        has_captain: hasCaptain,
        has_vice_captain: hasVC,
        is_complete: isComplete,
        is_locked: lineup.is_locked,
        issues: issues.length > 0 ? issues : null,
        submitted_at: lineup.submitted_at,
      };
    });

    // Generate warnings
    const warnings = [];

    if (teamsWithoutLineups.length > 0) {
      warnings.push({
        type: 'no_lineup',
        severity: 'critical',
        message: `${teamsWithoutLineups.length} team(s) have not submitted any lineup`,
        teams: teamsWithoutLineups.map((t: any) => ({
          team_name: t.team_name,
          owner_name: t.owner_name,
        })),
      });
    }

    if (toBeLockedIncomplete.length > 0) {
      warnings.push({
        type: 'incomplete_lineups',
        severity: 'high',
        message: `${toBeLockedIncomplete.length} lineup(s) are incomplete but will be locked`,
        teams: toBeLockedIncomplete.map((l: any) => {
          const issues = [];
          if ((l.starting_player_ids?.length || 0) !== 5) {
            issues.push(`${l.starting_player_ids?.length || 0}/5 starters`);
          }
          if (!l.captain_player_id) issues.push('No captain');
          if (!l.vice_captain_player_id) issues.push('No VC');
          
          return {
            team_name: l.team_name,
            issues: issues.join(', '),
          };
        }),
      });
    }

    const completionRate = teams.length > 0 
      ? Math.round((lineups.length / teams.length) * 100) 
      : 0;

    if (completionRate < 80) {
      warnings.push({
        type: 'low_completion',
        severity: 'medium',
        message: `Only ${completionRate}% of teams have submitted lineups`,
      });
    }

    return NextResponse.json({
      success: true,
      preview: {
        summary: {
          total_teams: teams.length,
          lineups_submitted: lineups.length,
          completion_rate: completionRate,
          already_locked: alreadyLocked.length,
          to_be_locked_complete: toBeLockedComplete.length,
          to_be_locked_incomplete: toBeLockedIncomplete.length,
          teams_without_lineups: teamsWithoutLineups.length,
        },
        lock_impact: {
          teams_will_be_locked: toBeLockedComplete.length + toBeLockedIncomplete.length,
          teams_already_locked: alreadyLocked.length,
          teams_remain_unlocked: 0, // All unlocked lineups will be locked
        },
        lineup_details: lineupDetails,
        teams_without_lineups: teamsWithoutLineups.map((t: any) => ({
          team_name: t.team_name,
          owner_name: t.owner_name,
        })),
        incomplete_lineups: toBeLockedIncomplete.map((l: any) => {
          const issues = [];
          if ((l.starting_player_ids?.length || 0) !== 5) {
            issues.push(`Only ${l.starting_player_ids?.length || 0} starters selected`);
          }
          if (!l.captain_player_id) issues.push('No captain selected');
          if (!l.vice_captain_player_id) issues.push('No vice-captain selected');
          
          return {
            team_name: l.team_name,
            owner_name: l.owner_name,
            issues,
          };
        }),
        warnings,
        can_lock: true, // Can always lock, but warnings show issues
      },
    });
  } catch (error) {
    console.error('Error generating auto-lock preview:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate preview', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
