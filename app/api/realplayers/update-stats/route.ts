import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

interface MatchupResult {
  position: number;
  home_player_id: string;
  home_player_name: string;
  away_player_id: string;
  away_player_name: string;
  home_goals: number;
  away_goals: number;
}

/**
 * Update or create realplayerstats for players based on match results
 * Tracks: goals scored, goals conceded, matches played, wins, draws, losses, MOTM awards
 * Handles result edits by tracking processed fixtures to prevent duplicate counting
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { season_id, fixture_id, matchups, motm_player_id } = body;

    if (!season_id || !fixture_id || !matchups || !Array.isArray(matchups)) {
      return NextResponse.json(
        { error: 'Invalid request data. Required: season_id, fixture_id, matchups[], motm_player_id (optional)' },
        { status: 400 }
      );
    }

    const updates: any[] = [];

    // Process each matchup
    for (const matchup of matchups as MatchupResult[]) {
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

      // Check if this player won MOTM (compare with fixture-level MOTM)
      const homePlayerMotm = motm_player_id === home_player_id;
      const awayPlayerMotm = motm_player_id === away_player_id;

      // Update home player stats
      await updatePlayerStats({
        player_id: home_player_id,
        player_name: home_player_name,
        season_id,
        fixture_id,
        goals_scored: home_goals,
        goals_conceded: away_goals,
        won: homeWon,
        draw,
        lost: awayWon,
        motm: homePlayerMotm
      });

      updates.push({
        player_id: home_player_id,
        name: home_player_name,
        goals_scored: home_goals,
        goals_conceded: away_goals,
        result: homeWon ? 'W' : draw ? 'D' : 'L',
        motm: homePlayerMotm
      });

      // Update away player stats
      await updatePlayerStats({
        player_id: away_player_id,
        player_name: away_player_name,
        season_id,
        fixture_id,
        goals_scored: away_goals,
        goals_conceded: home_goals,
        won: awayWon,
        draw,
        lost: homeWon,
        motm: awayPlayerMotm
      });

      updates.push({
        player_id: away_player_id,
        name: away_player_name,
        goals_scored: away_goals,
        goals_conceded: home_goals,
        result: awayWon ? 'W' : draw ? 'D' : 'L',
        motm: awayPlayerMotm
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Player stats updated successfully',
      updates,
    });
  } catch (error) {
    console.error('Error updating player stats:', error);
    return NextResponse.json(
      { error: 'Failed to update player stats' },
      { status: 500 }
    );
  }
}

/**
 * Update or create player stats in Neon DB
 * Uses upsert to handle both new and existing stats
 */
async function updatePlayerStats(data: {
  player_id: string;
  player_name: string;
  season_id: string;
  fixture_id: string;
  goals_scored: number;
  goals_conceded: number;
  won: boolean;
  draw: boolean;
  lost: boolean;
  motm: boolean;
}) {
  const sql = getTournamentDb();
  const { player_id, player_name, season_id, fixture_id, goals_scored, goals_conceded, won, draw, lost, motm } = data;

  const statsId = `${player_id}_${season_id}`;

  // Get current stats if exists
  const existing = await sql`
    SELECT * FROM realplayerstats WHERE id = ${statsId} LIMIT 1
  `;

  if (existing.length > 0) {
    const current = existing[0];
    
    // Update existing stats
    await sql`
      UPDATE realplayerstats
      SET
        matches_played = ${(current.matches_played || 0) + 1},
        goals_scored = ${(current.goals_scored || 0) + goals_scored},
        assists = ${current.assists || 0},
        wins = ${(current.wins || 0) + (won ? 1 : 0)},
        draws = ${(current.draws || 0) + (draw ? 1 : 0)},
        losses = ${(current.losses || 0) + (lost ? 1 : 0)},
        motm_awards = ${(current.motm_awards || 0) + (motm ? 1 : 0)},
        points = ${calculatePoints(
          (current.wins || 0) + (won ? 1 : 0),
          (current.draws || 0) + (draw ? 1 : 0),
          (current.motm_awards || 0) + (motm ? 1 : 0),
          (current.goals_scored || 0) + goals_scored
        )},
        updated_at = NOW()
      WHERE id = ${statsId}
    `;
  } else {
    // Insert new stats
    const points = calculatePoints(
      won ? 1 : 0,
      draw ? 1 : 0,
      motm ? 1 : 0,
      goals_scored
    );

    await sql`
      INSERT INTO realplayerstats (
        id, player_id, season_id, player_name,
        matches_played, goals_scored, assists, wins, draws, losses,
        motm_awards, points, created_at, updated_at
      )
      VALUES (
        ${statsId}, ${player_id}, ${season_id}, ${player_name},
        1, ${goals_scored}, 0, ${won ? 1 : 0}, ${draw ? 1 : 0}, ${lost ? 1 : 0},
        ${motm ? 1 : 0}, ${points}, NOW(), NOW()
      )
    `;
  }
}

/**
 * Calculate total points: (Wins × 3) + (Draws × 1) + (MOTM × 3) + (Goals × 1)
 */
function calculatePoints(wins: number, draws: number, motm: number, goals: number): number {
  return (wins * 3) + (draws * 1) + (motm * 3) + (goals * 1);
}
