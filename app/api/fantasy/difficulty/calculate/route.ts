/**
 * API: Calculate Fixture Difficulty
 * 
 * POST /api/fantasy/difficulty/calculate
 * 
 * Calculates fixture difficulty ratings for all H2H matchups in a round.
 * Should be run before each round starts.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  calculateAllFixtureDifficulties,
  calculateFixtureDifficulty,
  getFixtureDifficulty,
  getUpcomingFixtureDifficulties
} from '@/lib/fantasy/fixture-difficulty';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { league_id, round_id, team_id, opponent_id, is_home } = body;

    // Validate input
    if (!league_id) {
      return NextResponse.json(
        { error: 'league_id is required' },
        { status: 400 }
      );
    }

    let result;

    if (team_id && opponent_id && typeof is_home === 'boolean') {
      // Calculate for specific matchup
      if (!round_id) {
        return NextResponse.json(
          { error: 'round_id is required for specific matchup' },
          { status: 400 }
        );
      }

      const difficulty = await calculateFixtureDifficulty(
        league_id,
        round_id,
        team_id,
        opponent_id,
        is_home
      );

      result = {
        success: true,
        difficulty,
        message: 'Fixture difficulty calculated'
      };
    } else if (round_id) {
      // Calculate for all matchups in round
      const calculatedCount = await calculateAllFixtureDifficulties(
        league_id,
        round_id
      );

      result = {
        success: true,
        league_id,
        round_id,
        fixtures_calculated: calculatedCount,
        message: `Calculated difficulty for ${calculatedCount} fixtures`
      };
    } else {
      return NextResponse.json(
        { error: 'Either round_id or (team_id, opponent_id, is_home) is required' },
        { status: 400 }
      );
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Difficulty calculation error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to calculate fixture difficulty',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/fantasy/difficulty/calculate
 * 
 * Get fixture difficulty for a team
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get('league_id');
    const roundId = searchParams.get('round_id');
    const teamId = searchParams.get('team_id');
    const upcoming = searchParams.get('upcoming');

    if (!leagueId || !teamId) {
      return NextResponse.json(
        { error: 'league_id and team_id are required' },
        { status: 400 }
      );
    }

    let result;

    if (upcoming === 'true') {
      // Get upcoming fixtures
      const upcomingCount = parseInt(searchParams.get('count') || '3');
      const difficulties = await getUpcomingFixtureDifficulties(
        leagueId,
        teamId,
        upcomingCount
      );

      result = {
        success: true,
        team_id: teamId,
        upcoming_fixtures: difficulties
      };
    } else if (roundId) {
      // Get specific round
      const difficulty = await getFixtureDifficulty(leagueId, roundId, teamId);

      result = {
        success: true,
        team_id: teamId,
        round_id: roundId,
        difficulty
      };
    } else {
      return NextResponse.json(
        { error: 'Either round_id or upcoming=true is required' },
        { status: 400 }
      );
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Difficulty fetch error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch fixture difficulty',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
