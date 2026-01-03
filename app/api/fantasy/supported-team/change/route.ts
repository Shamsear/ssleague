import { NextRequest, NextResponse } from 'next/server';
import { fantasySql } from '@/lib/neon/fantasy-config';

/**
 * POST /api/fantasy/supported-team/change
 * Change the supported team during an active window
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            user_id,
            new_supported_team_id,
            new_supported_team_name,
            reason,
        } = body;

        console.log('🔄 Supported team change request:', { user_id, new_supported_team_id, new_supported_team_name });

        if (!user_id || !new_supported_team_id || !new_supported_team_name) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Get user's fantasy team
        const teams = await fantasySql`
      SELECT * FROM fantasy_teams
      WHERE owner_uid = ${user_id} AND is_enabled = true
      LIMIT 1
    `;

        if (teams.length === 0) {
            return NextResponse.json(
                { error: 'No fantasy team found' },
                { status: 404 }
            );
        }

        const team = teams[0];
        const teamId = team.team_id;
        const leagueId = team.league_id;

        // Check if there's an active window that allows supported team changes
        const activeWindows = await fantasySql`
      SELECT * FROM transfer_windows
      WHERE league_id = ${leagueId}
        AND is_active = true
        AND allow_supported_team_change = true
      LIMIT 1
    `;

        if (activeWindows.length === 0) {
            return NextResponse.json(
                { error: 'No active window for supported team changes' },
                { status: 400 }
            );
        }

        const window = activeWindows[0];

        // Check if team has already changed their supported team in this window
        const existingChanges = await fantasySql`
      SELECT * FROM supported_team_changes
      WHERE team_id = ${teamId}
        AND window_id = ${window.window_id}
      LIMIT 1
    `;

        if (existingChanges.length > 0) {
            return NextResponse.json(
                {
                    error: 'You have already changed your supported team in this window',
                    previous_change: {
                        old_team: existingChanges[0].old_supported_team_name,
                        new_team: existingChanges[0].new_supported_team_name,
                        changed_at: existingChanges[0].changed_at,
                    },
                },
                { status: 400 }
            );
        }

        // Check if the new supported team is the same as current
        if (team.supported_team_id === new_supported_team_id) {
            return NextResponse.json(
                { error: 'This is already your supported team' },
                { status: 400 }
            );
        }

        // Store old values
        const oldSupportedTeamId = team.supported_team_id;
        const oldSupportedTeamName = team.supported_team_name;

        // Generate change ID
        const changeId = `stc_${teamId}_${Date.now()}`;

        // Update the fantasy team's supported team
        await fantasySql`
      UPDATE fantasy_teams
      SET supported_team_id = ${new_supported_team_id},
          supported_team_name = ${new_supported_team_name},
          updated_at = NOW()
      WHERE team_id = ${teamId}
    `;

        // Record the change
        await fantasySql`
      INSERT INTO supported_team_changes (
        change_id, league_id, team_id, window_id,
        old_supported_team_id, old_supported_team_name,
        new_supported_team_id, new_supported_team_name,
        changed_by, reason
      ) VALUES (
        ${changeId}, ${leagueId}, ${teamId}, ${window.window_id},
        ${oldSupportedTeamId}, ${oldSupportedTeamName},
        ${new_supported_team_id}, ${new_supported_team_name},
        ${user_id}, ${reason || 'Team preference change'}
      )
    `;

        console.log(`✅ Supported team changed: ${oldSupportedTeamName || 'None'} → ${new_supported_team_name}`);

        return NextResponse.json({
            success: true,
            message: 'Supported team changed successfully',
            change: {
                old_team: oldSupportedTeamName || 'None',
                new_team: new_supported_team_name,
                is_free: true,
            },
        });
    } catch (error) {
        console.error('❌ Supported team change error:', error);
        return NextResponse.json(
            { error: 'Failed to change supported team', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/fantasy/supported-team/change
 * Check if user can change supported team and get current status
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const user_id = searchParams.get('user_id');

        if (!user_id) {
            return NextResponse.json(
                { error: 'User ID is required' },
                { status: 400 }
            );
        }

        // Get user's fantasy team
        const teams = await fantasySql`
      SELECT * FROM fantasy_teams
      WHERE owner_uid = ${user_id} AND is_enabled = true
      LIMIT 1
    `;

        if (teams.length === 0) {
            return NextResponse.json(
                { error: 'No fantasy team found' },
                { status: 404 }
            );
        }

        const team = teams[0];
        const teamId = team.team_id;
        const leagueId = team.league_id;

        // Check for active window
        const activeWindows = await fantasySql`
      SELECT * FROM transfer_windows
      WHERE league_id = ${leagueId}
        AND is_active = true
        AND allow_supported_team_change = true
      LIMIT 1
    `;

        const hasActiveWindow = activeWindows.length > 0;
        const window = hasActiveWindow ? activeWindows[0] : null;

        // Check if already changed
        let hasChanged = false;
        let previousChange = null;

        if (hasActiveWindow && window) {
            const changes = await fantasySql`
        SELECT * FROM supported_team_changes
        WHERE team_id = ${teamId}
          AND window_id = ${window.window_id}
        LIMIT 1
      `;

            if (changes.length > 0) {
                hasChanged = true;
                previousChange = {
                    old_team: changes[0].old_supported_team_name,
                    new_team: changes[0].new_supported_team_name,
                    changed_at: changes[0].changed_at,
                };
            }
        }

        return NextResponse.json({
            can_change: hasActiveWindow && !hasChanged,
            current_supported_team: {
                id: team.supported_team_id,
                name: team.supported_team_name,
            },
            active_window: hasActiveWindow ? {
                window_id: window.window_id,
                window_name: window.window_name,
                closes_at: window.closes_at,
            } : null,
            has_changed: hasChanged,
            previous_change: previousChange,
        });
    } catch (error) {
        console.error('❌ Error checking supported team change status:', error);
        return NextResponse.json(
            { error: 'Failed to check status', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
