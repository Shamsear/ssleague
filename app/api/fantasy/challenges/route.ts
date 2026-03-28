/**
 * API: Fantasy Challenges
 * GET /api/fantasy/challenges - Get active challenges and completions
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getActiveChallenges,
  getTeamChallengeCompletions,
  getChallengeLeaderboard
} from '@/lib/fantasy/challenges';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get('league_id');
    const teamId = searchParams.get('team_id');
    const view = searchParams.get('view'); // 'leaderboard' or default

    if (!leagueId) {
      return NextResponse.json(
        { error: 'league_id is required' },
        { status: 400 }
      );
    }

    // Get leaderboard view
    if (view === 'leaderboard') {
      const leaderboard = await getChallengeLeaderboard(leagueId);
      return NextResponse.json({
        success: true,
        league_id: leagueId,
        leaderboard
      });
    }

    // Get active challenges
    const challenges = await getActiveChallenges(leagueId);

    // If team_id provided, also get their completions
    let completions = [];
    if (teamId) {
      completions = await getTeamChallengeCompletions(leagueId, teamId);
    }

    return NextResponse.json({
      success: true,
      league_id: leagueId,
      team_id: teamId,
      challenges,
      completions
    });

  } catch (error: any) {
    console.error('Error fetching challenges:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch challenges',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}
