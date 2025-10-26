import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

/**
 * Revert player stats when a fixture is deleted
 * Removes the fixture from processed_fixtures and subtracts the stats
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { season_id, fixture_id, matchups } = body;

    if (!season_id || !fixture_id || !matchups || !Array.isArray(matchups)) {
      return NextResponse.json(
        { error: 'Invalid request data. Required: season_id, fixture_id, matchups[]' },
        { status: 400 }
      );
    }

    const reverted: any[] = [];

    // Process each matchup to revert stats
    for (const matchup of matchups) {
      const {
        home_player_id,
        home_player_name,
        away_player_id,
        away_player_name,
        home_goals,
        away_goals
      } = matchup;

      if (home_goals === null || away_goals === null) continue;

      // Determine match result
      const homeWon = home_goals > away_goals;
      const awayWon = away_goals > home_goals;
      const draw = home_goals === away_goals;

      // Revert home player stats
      await revertPlayerStats({
        player_id: home_player_id,
        player_name: home_player_name,
        season_id,
        fixture_id,
        goals_scored: home_goals,
        goals_conceded: away_goals,
        won: homeWon,
        draw,
        lost: awayWon,
      });

      reverted.push({
        player_id: home_player_id,
        name: home_player_name,
        goals_reverted: -home_goals,
        result: homeWon ? 'W' : draw ? 'D' : 'L',
      });

      // Revert away player stats
      await revertPlayerStats({
        player_id: away_player_id,
        player_name: away_player_name,
        season_id,
        fixture_id,
        goals_scored: away_goals,
        goals_conceded: home_goals,
        won: awayWon,
        draw,
        lost: homeWon,
      });

      reverted.push({
        player_id: away_player_id,
        name: away_player_name,
        goals_reverted: -away_goals,
        result: awayWon ? 'W' : draw ? 'D' : 'L',
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Fixture stats reverted successfully',
      reverted,
    });
  } catch (error) {
    console.error('Error reverting fixture stats:', error);
    return NextResponse.json(
      { error: 'Failed to revert fixture stats' },
      { status: 500 }
    );
  }
}

/**
 * Revert stats for a single player in Neon DB
 */
async function revertPlayerStats(data: {
  player_id: string;
  player_name: string;
  season_id: string;
  fixture_id: string;
  goals_scored: number;
  goals_conceded: number;
  won: boolean;
  draw: boolean;
  lost: boolean;
}) {
  const sql = getTournamentDb();
  const { player_id, season_id, goals_scored, won, draw, lost } = data;

  const statsId = `${player_id}_${season_id}`;

  // Get current stats
  const existing = await sql`
    SELECT * FROM realplayerstats WHERE id = ${statsId} LIMIT 1
  `;

  if (existing.length === 0) {
    console.warn(`No stats found for ${statsId}, nothing to revert`);
    return;
  }

  const current = existing[0];

  // Subtract the stats
  const newMatchesPlayed = Math.max(0, (current.matches_played || 0) - 1);
  const newGoalsScored = Math.max(0, (current.goals_scored || 0) - goals_scored);
  const newWins = Math.max(0, (current.wins || 0) - (won ? 1 : 0));
  const newDraws = Math.max(0, (current.draws || 0) - (draw ? 1 : 0));
  const newLosses = Math.max(0, (current.losses || 0) - (lost ? 1 : 0));

  // Recalculate points
  const newPoints = calculatePoints(newWins, newDraws, current.motm_awards || 0, newGoalsScored);

  // Update stats
  await sql`
    UPDATE realplayerstats
    SET
      matches_played = ${newMatchesPlayed},
      goals_scored = ${newGoalsScored},
      wins = ${newWins},
      draws = ${newDraws},
      losses = ${newLosses},
      points = ${newPoints},
      updated_at = NOW()
    WHERE id = ${statsId}
  `;

  console.log(`✅ Reverted stats for player ${player_id}: -${goals_scored} goals, match count -1`);
}

/**
 * Calculate total points: (Wins × 3) + (Draws × 1) + (MOTM × 3) + (Goals × 1)
 */
function calculatePoints(wins: number, draws: number, motm: number, goals: number): number {
  return (wins * 3) + (draws * 1) + (motm * 3) + (goals * 1);
}
