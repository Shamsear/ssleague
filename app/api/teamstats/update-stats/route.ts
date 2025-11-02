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
  man_of_the_match?: 'home' | 'away' | null;
}

/**
 * Update team stats in Firebase based on fixture results
 * Tracks: matches_played, wins, draws, losses, goals_for, goals_against
 * Handles result edits by tracking processed fixtures to prevent duplicate counting
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { season_id, fixture_id, home_team_id, away_team_id, matchups } = body;

    if (!season_id || !fixture_id || !home_team_id || !away_team_id || !matchups || !Array.isArray(matchups)) {
      return NextResponse.json(
        { error: 'Invalid request data. Required: season_id, fixture_id, home_team_id, away_team_id, matchups[]' },
        { status: 400 }
      );
    }

    // Calculate aggregate scores
    let homeTeamGoals = 0;
    let awayTeamGoals = 0;

    for (const matchup of matchups as MatchupResult[]) {
      if (matchup.home_goals !== null && matchup.away_goals !== null) {
        homeTeamGoals += matchup.home_goals;
        awayTeamGoals += matchup.away_goals;
      }
    }

    // Determine match result
    const homeWon = homeTeamGoals > awayTeamGoals;
    const awayWon = awayTeamGoals > homeTeamGoals;
    const draw = homeTeamGoals === awayTeamGoals;

    // Update home team stats
    await updateTeamStats({
      team_id: home_team_id,
      season_id,
      fixture_id,
      goals_for: homeTeamGoals,
      goals_against: awayTeamGoals,
      won: homeWon,
      draw,
      lost: awayWon
    });

    // Update away team stats
    await updateTeamStats({
      team_id: away_team_id,
      season_id,
      fixture_id,
      goals_for: awayTeamGoals,
      goals_against: homeTeamGoals,
      won: awayWon,
      draw,
      lost: homeWon
    });

    // Get tournament_id from fixture to recalculate positions for this tournament only
    const sql = getTournamentDb();
    const [fixture] = await sql`
      SELECT tournament_id FROM fixtures WHERE id = ${fixture_id} LIMIT 1
    `;
    
    if (fixture && fixture.tournament_id) {
      await recalculatePositions(season_id, fixture.tournament_id);
    }

    return NextResponse.json({
      success: true,
      message: 'Team stats updated successfully',
      updates: {
        home: {
          team_id: home_team_id,
          goals_for: homeTeamGoals,
          goals_against: awayTeamGoals,
          result: homeWon ? 'W' : draw ? 'D' : 'L'
        },
        away: {
          team_id: away_team_id,
          goals_for: awayTeamGoals,
          goals_against: homeTeamGoals,
          result: awayWon ? 'W' : draw ? 'D' : 'L'
        }
      }
    });
  } catch (error) {
    console.error('Error updating team stats:', error);
    return NextResponse.json(
      { error: 'Failed to update team stats' },
      { status: 500 }
    );
  }
}

/**
 * Recalculate and update positions for all teams in a specific tournament within a season
 * Teams are ranked by: points DESC, goal_difference DESC, goals_for DESC
 */
async function recalculatePositions(season_id: string, tournament_id: string) {
  const sql = getTournamentDb();
  
  // Get all teams in this tournament and season, ordered by ranking criteria
  const teams = await sql`
    SELECT id, points, goal_difference, goals_for
    FROM teamstats
    WHERE season_id = ${season_id}
      AND tournament_id = ${tournament_id}
    ORDER BY 
      points DESC,
      goal_difference DESC,
      goals_for DESC
  `;
  
  // Update each team's position
  for (let i = 0; i < teams.length; i++) {
    const position = i + 1;
    await sql`
      UPDATE teamstats
      SET position = ${position}
      WHERE id = ${teams[i].id}
    `;
  }
  
  console.log(`✓ Recalculated positions for ${teams.length} teams in tournament ${tournament_id}, season ${season_id}`);
}

/**
 * Update team stats in Neon database (only if stats already exist)
 * Tracks processed fixtures to prevent duplicate counting when results are edited
 */
async function updateTeamStats(data: {
  team_id: string;
  season_id: string;
  fixture_id: string;
  goals_for: number;
  goals_against: number;
  won: boolean;
  draw: boolean;
  lost: boolean;
}) {
  const sql = getTournamentDb();
  const { team_id, season_id, fixture_id, goals_for, goals_against, won, draw, lost } = data;

  // Construct composite ID: team_id_seasonId
  const statsId = `${team_id}_${season_id}`;

  // Check if stats exist in Neon
  const existing = await sql`
    SELECT * FROM teamstats WHERE id = ${statsId} LIMIT 1
  `;

  if (existing.length > 0) {
    const current = existing[0];
    const processedFixtures = current.processed_fixtures || [];
    
    // Check if this fixture was already processed
    const existingFixture = processedFixtures.find((f: any) => f.fixture_id === fixture_id);
    
    if (existingFixture) {
      console.log(`✓ Fixture ${fixture_id} already processed for team ${team_id}, skipping`);
      return; // Already processed, skip to prevent duplicates
    }
    
    // New fixture - add stats
    const updatedProcessedFixtures = [...processedFixtures, { fixture_id, goals_for, goals_against, won, draw, lost }];
    
    const newMatches = (current.matches_played || 0) + 1;
    const newGoalsFor = (current.goals_for || 0) + goals_for;
    const newGoalsAgainst = (current.goals_against || 0) + goals_against;
    const newWins = (current.wins || 0) + (won ? 1 : 0);
    const newDraws = (current.draws || 0) + (draw ? 1 : 0);
    const newLosses = (current.losses || 0) + (lost ? 1 : 0);
    const newGoalDifference = newGoalsFor - newGoalsAgainst;
    const newPoints = (newWins * 3) + newDraws;
    
    // Calculate current form (last 5 results, most recent last)
    const currentFormStr = current.current_form || '';
    const resultChar = won ? 'W' : draw ? 'D' : 'L';
    const newForm = (currentFormStr + resultChar).slice(-5); // Keep last 5
    
    // Calculate win streak (consecutive wins)
    const newWinStreak = won ? (current.win_streak || 0) + 1 : 0;
    
    // Calculate unbeaten streak (consecutive wins/draws)
    const newUnbeatenStreak = (won || draw) ? (current.unbeaten_streak || 0) + 1 : 0;
    
    await sql`
      UPDATE teamstats
      SET
        matches_played = ${newMatches},
        wins = ${newWins},
        draws = ${newDraws},
        losses = ${newLosses},
        goals_for = ${newGoalsFor},
        goals_against = ${newGoalsAgainst},
        goal_difference = ${newGoalDifference},
        points = ${newPoints},
        current_form = ${newForm},
        win_streak = ${newWinStreak},
        unbeaten_streak = ${newUnbeatenStreak},
        processed_fixtures = ${JSON.stringify(updatedProcessedFixtures)}::jsonb,
        updated_at = NOW()
      WHERE id = ${statsId}
    `;
    
    console.log(`✓ Updated team stats for ${team_id}: +${goals_for} GF, +${goals_against} GA, ${won ? 'W' : draw ? 'D' : 'L'}, Form: ${newForm}`);
  } else {
    // Stats don't exist - skip creation (stats should already exist before fixtures)
    console.warn(`⚠ Team stats not found for ${statsId}, skipping update. Stats must be created before processing fixtures.`);
  }
}
