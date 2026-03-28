/**
 * API: Submit Predictions
 * 
 * POST /api/fantasy/predictions/submit
 * GET /api/fantasy/predictions/submit
 * 
 * Submit and retrieve weekly match predictions for bonus points.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  submitPredictions,
  getPredictions,
  getPredictionHistory,
  getPredictionLeaderboard,
  lockPredictions,
  calculatePredictionBonuses,
  type MatchPrediction,
  type MatchResult
} from '@/lib/fantasy/predictions';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { league_id, team_id, round_id, predictions, action, results } = body;

    // Validate required fields
    if (!league_id) {
      return NextResponse.json(
        { error: 'league_id is required' },
        { status: 400 }
      );
    }

    // Handle different actions
    if (action === 'lock') {
      // Lock predictions at deadline (committee only)
      if (!round_id) {
        return NextResponse.json(
          { error: 'round_id is required for lock action' },
          { status: 400 }
        );
      }

      const lockedCount = await lockPredictions(league_id, round_id);

      return NextResponse.json({
        success: true,
        action: 'lock',
        league_id,
        round_id,
        predictions_locked: lockedCount,
        message: `Locked ${lockedCount} predictions`
      });
    }

    if (action === 'calculate') {
      // Calculate bonus points (committee only)
      if (!round_id || !results) {
        return NextResponse.json(
          { error: 'round_id and results are required for calculate action' },
          { status: 400 }
        );
      }

      const teamsProcessed = await calculatePredictionBonuses(
        league_id,
        round_id,
        results as Record<string, MatchResult>
      );

      return NextResponse.json({
        success: true,
        action: 'calculate',
        league_id,
        round_id,
        teams_processed: teamsProcessed,
        message: `Calculated bonuses for ${teamsProcessed} teams`
      });
    }

    // Default action: submit predictions
    if (!team_id || !round_id || !predictions) {
      return NextResponse.json(
        { error: 'team_id, round_id, and predictions are required' },
        { status: 400 }
      );
    }

    // Validate predictions format
    if (typeof predictions !== 'object' || Array.isArray(predictions)) {
      return NextResponse.json(
        { error: 'predictions must be an object with match_id keys' },
        { status: 400 }
      );
    }

    // Submit predictions
    const submission = await submitPredictions(
      league_id,
      team_id,
      round_id,
      predictions as Record<string, MatchPrediction>
    );

    return NextResponse.json({
      success: true,
      submission,
      message: 'Predictions submitted successfully'
    });

  } catch (error) {
    console.error('Predictions submission error:', error);
    
    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes('already locked')) {
        return NextResponse.json(
          { error: error.message },
          { status: 409 } // Conflict
        );
      }
    }

    return NextResponse.json(
      { 
        error: 'Failed to submit predictions',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get('league_id');
    const teamId = searchParams.get('team_id');
    const roundId = searchParams.get('round_id');
    const view = searchParams.get('view'); // 'history' or 'leaderboard'

    if (!leagueId) {
      return NextResponse.json(
        { error: 'league_id is required' },
        { status: 400 }
      );
    }

    // Get leaderboard
    if (view === 'leaderboard') {
      if (!roundId) {
        return NextResponse.json(
          { error: 'round_id is required for leaderboard view' },
          { status: 400 }
        );
      }

      const leaderboard = await getPredictionLeaderboard(leagueId, roundId);

      return NextResponse.json({
        success: true,
        league_id: leagueId,
        round_id: roundId,
        leaderboard
      });
    }

    // Get history
    if (view === 'history') {
      if (!teamId) {
        return NextResponse.json(
          { error: 'team_id is required for history view' },
          { status: 400 }
        );
      }

      const history = await getPredictionHistory(leagueId, teamId);

      return NextResponse.json({
        success: true,
        league_id: leagueId,
        team_id: teamId,
        history
      });
    }

    // Get specific round predictions
    if (!teamId || !roundId) {
      return NextResponse.json(
        { error: 'team_id and round_id are required' },
        { status: 400 }
      );
    }

    const predictions = await getPredictions(leagueId, teamId, roundId);

    if (!predictions) {
      return NextResponse.json({
        success: true,
        league_id: leagueId,
        team_id: teamId,
        round_id: roundId,
        predictions: null,
        message: 'No predictions found for this round'
      });
    }

    return NextResponse.json({
      success: true,
      predictions
    });

  } catch (error) {
    console.error('Predictions fetch error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch predictions',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
