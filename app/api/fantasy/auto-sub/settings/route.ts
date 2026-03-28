/**
 * API: Auto-Sub Settings
 * 
 * GET /api/fantasy/auto-sub/settings?team_id=xxx
 * POST /api/fantasy/auto-sub/settings
 * 
 * Manage auto-substitution settings for a team.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getAutoSubSettings,
  setAutoSubEnabled,
  setBenchPriority,
  getAutoSubstitutions
} from '@/lib/fantasy/auto-sub';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('team_id');
    const lineupId = searchParams.get('lineup_id');

    if (!teamId && !lineupId) {
      return NextResponse.json(
        { error: 'Either team_id or lineup_id is required' },
        { status: 400 }
      );
    }

    let result;

    if (lineupId) {
      // Get substitutions for a lineup
      const substitutions = await getAutoSubstitutions(lineupId);
      result = {
        success: true,
        lineup_id: lineupId,
        substitutions
      };
    } else if (teamId) {
      // Get settings for a team
      const settings = await getAutoSubSettings(teamId);
      result = {
        success: true,
        team_id: teamId,
        settings
      };
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Auto-sub settings fetch error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch auto-sub settings',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { team_id, enabled, bench_priority } = body;

    if (!team_id) {
      return NextResponse.json(
        { error: 'team_id is required' },
        { status: 400 }
      );
    }

    // Update enabled status
    if (typeof enabled === 'boolean') {
      await setAutoSubEnabled(team_id, enabled);
    }

    // Update bench priority
    if (Array.isArray(bench_priority)) {
      await setBenchPriority(team_id, bench_priority);
    }

    // Get updated settings
    const settings = await getAutoSubSettings(team_id);

    return NextResponse.json({
      success: true,
      team_id,
      settings,
      message: 'Auto-sub settings updated'
    });

  } catch (error) {
    console.error('Auto-sub settings update error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update auto-sub settings',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
