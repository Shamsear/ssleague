/**
 * Fantasy Achievements API
 * GET /api/fantasy/achievements - Get achievements with status for a team
 * GET /api/fantasy/achievements/progress - Get achievement progress
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  getAchievementsWithStatus, 
  getAchievementProgress,
  checkAchievements 
} from '@/lib/fantasy/achievements';

/**
 * GET /api/fantasy/achievements
 * Get all achievements with unlock status for a team
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('team_id');
    const action = searchParams.get('action');

    if (!teamId) {
      return NextResponse.json(
        { error: 'team_id is required' },
        { status: 400 }
      );
    }

    // Get achievement progress
    if (action === 'progress') {
      const progress = await getAchievementProgress(teamId);
      return NextResponse.json({ progress });
    }

    // Get achievements with status (default)
    const achievements = await getAchievementsWithStatus(teamId);
    return NextResponse.json({ achievements });

  } catch (error: any) {
    console.error('Error fetching achievements:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch achievements' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/fantasy/achievements
 * Manually trigger achievement check for a team
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { team_id, league_id } = body;

    if (!team_id || !league_id) {
      return NextResponse.json(
        { error: 'team_id and league_id are required' },
        { status: 400 }
      );
    }

    const newAchievements = await checkAchievements(team_id, league_id);

    return NextResponse.json({
      success: true,
      achievements_unlocked: newAchievements.length,
      new_achievements: newAchievements
    });

  } catch (error: any) {
    console.error('Error checking achievements:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check achievements' },
      { status: 500 }
    );
  }
}
