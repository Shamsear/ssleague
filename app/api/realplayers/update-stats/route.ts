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
        motm: homePlayerMotm,
        clean_sheet: away_goals === 0
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
        motm: awayPlayerMotm,
        clean_sheet: home_goals === 0
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
  clean_sheet: boolean;
}) {
  const sql = getTournamentDb();
  const { player_id, player_name, season_id, fixture_id, goals_scored, goals_conceded, won, draw, lost, motm, clean_sheet } = data;

  const statsId = `${player_id}_${season_id}`;

  // Get current stats from player_seasons table
  const existing = await sql`
    SELECT * FROM player_seasons WHERE id = ${statsId} LIMIT 1
  `;
  
  if (existing.length === 0) {
    console.warn(`Player ${player_name} (${player_id}) not found in player_seasons for season ${season_id}`);
    console.warn('Skipping stats update - player may not be registered for this season');
    return;
  }
  
  const current = existing[0];
  
  // Check if this fixture has already been processed for this player
  let processedFixtures = [];
  try {
    processedFixtures = current.processed_fixtures ? 
      (Array.isArray(current.processed_fixtures) ? current.processed_fixtures : JSON.parse(current.processed_fixtures)) 
      : [];
  } catch (e) {
    console.warn(`Failed to parse processed_fixtures for player ${player_name}, treating as empty array`);
    processedFixtures = [];
  }
  
  if (processedFixtures.includes(fixture_id)) {
    console.log(`✓ Fixture ${fixture_id} already processed for player ${player_name}, skipping duplicate update`);
    return;
  }
  
  console.log(`Processing fixture ${fixture_id} for player ${player_name} (${processedFixtures.length} fixtures already processed)`);

  // Add fixture to processed list
  const updatedProcessedFixtures = [...processedFixtures, fixture_id];
  
  // Update existing stats in player_seasons
  // NOTE: Points are NOT updated here - they are managed separately via /api/realplayers/update-points
  // which uses star rating base points + goal difference (+5 to -5 per match)
  await sql`
    UPDATE player_seasons
    SET
      matches_played = ${(current.matches_played || 0) + 1},
      goals_scored = ${(current.goals_scored || 0) + goals_scored},
      goals_conceded = ${(current.goals_conceded || 0) + goals_conceded},
      assists = ${current.assists || 0},
      wins = ${(current.wins || 0) + (won ? 1 : 0)},
      draws = ${(current.draws || 0) + (draw ? 1 : 0)},
      losses = ${(current.losses || 0) + (lost ? 1 : 0)},
      clean_sheets = ${(current.clean_sheets || 0) + (clean_sheet ? 1 : 0)},
      motm_awards = ${(current.motm_awards || 0) + (motm ? 1 : 0)},
      processed_fixtures = ${JSON.stringify(updatedProcessedFixtures)}::jsonb,
      updated_at = NOW()
    WHERE id = ${statsId}
  `;
  
  console.log(`✓ Updated stats for ${player_name}: +${goals_scored} goals, match ${won ? 'W' : draw ? 'D' : 'L'}`);
}

