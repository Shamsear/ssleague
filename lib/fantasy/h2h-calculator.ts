/**
 * Head-to-Head Points Calculator
 * 
 * Calculates H2H results after lineup points are calculated.
 * Compares weekly points between paired teams and awards:
 * - 3 points for a win
 * - 1 point for a draw
 * - 0 points for a loss
 * 
 * Updates H2H standings with wins/draws/losses.
 */

import { fantasySql } from '@/lib/neon/fantasy-config';

interface H2HFixture {
  fixture_id: string;
  league_id: string;
  round_id: string;
  team_a_id: string;
  team_b_id: string;
  team_a_points: number;
  team_b_points: number;
  status: string;
}

interface H2HResult {
  fixture_id: string;
  team_a_id: string;
  team_b_id: string;
  team_a_points: number;
  team_b_points: number;
  winner_id: string | null;
  is_draw: boolean;
  h2h_points_awarded: {
    team_a: number;
    team_b: number;
  };
}

/**
 * Calculate H2H results for all fixtures in a round
 * 
 * @param leagueId - The fantasy league ID
 * @param roundId - The round ID
 * @returns Array of H2H results
 */
export async function calculateH2HResults(
  leagueId: string,
  roundId: string
): Promise<H2HResult[]> {
  try {
    // 1. Get all H2H fixtures for this round
    const fixtures = await fantasySql`
      SELECT 
        fixture_id,
        league_id,
        round_id,
        team_a_id,
        team_b_id,
        status
      FROM fantasy_h2h_fixtures
      WHERE league_id = ${leagueId}
        AND round_id = ${roundId}
        AND status IN ('scheduled', 'in_progress')
    ` as H2HFixture[];

    if (fixtures.length === 0) {
      return [];
    }

    const results: H2HResult[] = [];

    // 2. Process each fixture
    for (const fixture of fixtures) {
      const result = await processH2HFixture(fixture);
      results.push(result);

      // 3. Update fixture with results
      await updateH2HFixture(result);

      // 4. Update H2H standings for both teams
      await updateH2HStandings(
        fixture.league_id,
        fixture.team_a_id,
        result.team_a_points,
        result.team_b_points,
        result.h2h_points_awarded.team_a
      );

      await updateH2HStandings(
        fixture.league_id,
        fixture.team_b_id,
        result.team_b_points,
        result.team_a_points,
        result.h2h_points_awarded.team_b
      );
    }

    return results;

  } catch (error: any) {
    console.error('Error calculating H2H results:', error);
    throw new Error(`Failed to calculate H2H results: ${error.message}`);
  }
}

/**
 * Process a single H2H fixture
 */
async function processH2HFixture(fixture: H2HFixture): Promise<H2HResult> {
  // 1. Get lineup points for team A
  const [teamALineup] = await fantasySql`
    SELECT total_points
    FROM fantasy_lineups
    WHERE team_id = ${fixture.team_a_id}
      AND round_id = ${fixture.round_id}
      AND is_locked = true
  `;

  const teamAPoints = teamALineup?.total_points || 0;

  // 2. Get lineup points for team B
  const [teamBLineup] = await fantasySql`
    SELECT total_points
    FROM fantasy_lineups
    WHERE team_id = ${fixture.team_b_id}
      AND round_id = ${fixture.round_id}
      AND is_locked = true
  `;

  const teamBPoints = teamBLineup?.total_points || 0;

  // 3. Determine winner and award H2H points
  let winnerId: string | null = null;
  let isDraw = false;
  let h2hPointsAwarded = { team_a: 0, team_b: 0 };

  if (teamAPoints > teamBPoints) {
    // Team A wins
    winnerId = fixture.team_a_id;
    h2hPointsAwarded = { team_a: 3, team_b: 0 };
  } else if (teamBPoints > teamAPoints) {
    // Team B wins
    winnerId = fixture.team_b_id;
    h2hPointsAwarded = { team_a: 0, team_b: 3 };
  } else {
    // Draw
    isDraw = true;
    h2hPointsAwarded = { team_a: 1, team_b: 1 };
  }

  return {
    fixture_id: fixture.fixture_id,
    team_a_id: fixture.team_a_id,
    team_b_id: fixture.team_b_id,
    team_a_points: teamAPoints,
    team_b_points: teamBPoints,
    winner_id: winnerId,
    is_draw: isDraw,
    h2h_points_awarded: h2hPointsAwarded
  };
}

/**
 * Update H2H fixture with results
 */
async function updateH2HFixture(result: H2HResult): Promise<void> {
  await fantasySql`
    UPDATE fantasy_h2h_fixtures
    SET 
      team_a_points = ${result.team_a_points},
      team_b_points = ${result.team_b_points},
      winner_id = ${result.winner_id},
      is_draw = ${result.is_draw},
      status = 'completed',
      updated_at = NOW()
    WHERE fixture_id = ${result.fixture_id}
  `;
}

/**
 * Update H2H standings for a team
 */
async function updateH2HStandings(
  leagueId: string,
  teamId: string,
  pointsFor: number,
  pointsAgainst: number,
  h2hPoints: number
): Promise<void> {
  // Determine match result
  const isWin = h2hPoints === 3;
  const isDraw = h2hPoints === 1;
  const isLoss = h2hPoints === 0;

  // Check if standings record exists
  const [existing] = await fantasySql`
    SELECT standing_id
    FROM fantasy_h2h_standings
    WHERE league_id = ${leagueId}
      AND team_id = ${teamId}
  `;

  if (existing) {
    // Update existing record
    await fantasySql`
      UPDATE fantasy_h2h_standings
      SET 
        matches_played = matches_played + 1,
        wins = wins + ${isWin ? 1 : 0},
        draws = draws + ${isDraw ? 1 : 0},
        losses = losses + ${isLoss ? 1 : 0},
        points = points + ${h2hPoints},
        points_for = points_for + ${pointsFor},
        points_against = points_against + ${pointsAgainst},
        points_difference = (points_for + ${pointsFor}) - (points_against + ${pointsAgainst}),
        updated_at = NOW()
      WHERE league_id = ${leagueId}
        AND team_id = ${teamId}
    `;
  } else {
    // Create new record
    const standingId = `h2h_standing_${leagueId}_${teamId}`;
    const pointsDifference = pointsFor - pointsAgainst;

    await fantasySql`
      INSERT INTO fantasy_h2h_standings (
        standing_id,
        league_id,
        team_id,
        matches_played,
        wins,
        draws,
        losses,
        points,
        points_for,
        points_against,
        points_difference,
        updated_at
      )
      VALUES (
        ${standingId},
        ${leagueId},
        ${teamId},
        1,
        ${isWin ? 1 : 0},
        ${isDraw ? 1 : 0},
        ${isLoss ? 1 : 0},
        ${h2hPoints},
        ${pointsFor},
        ${pointsAgainst},
        ${pointsDifference},
        NOW()
      )
    `;
  }
}

/**
 * Get H2H standings for a league
 */
export async function getH2HStandings(leagueId: string) {
  const standings = await fantasySql`
    SELECT 
      s.standing_id,
      s.league_id,
      s.team_id,
      t.team_name,
      s.matches_played,
      s.wins,
      s.draws,
      s.losses,
      s.points,
      s.points_for,
      s.points_against,
      s.points_difference,
      s.updated_at
    FROM fantasy_h2h_standings s
    JOIN fantasy_teams t ON s.team_id = t.team_id
    WHERE s.league_id = ${leagueId}
    ORDER BY 
      s.points DESC,
      s.points_difference DESC,
      s.points_for DESC,
      t.team_name ASC
  `;

  return standings;
}

/**
 * Get H2H record for a specific team
 */
export async function getTeamH2HRecord(leagueId: string, teamId: string) {
  const [record] = await fantasySql`
    SELECT 
      standing_id,
      league_id,
      team_id,
      matches_played,
      wins,
      draws,
      losses,
      points,
      points_for,
      points_against,
      points_difference,
      updated_at
    FROM fantasy_h2h_standings
    WHERE league_id = ${leagueId}
      AND team_id = ${teamId}
  `;

  return record || null;
}

/**
 * Get H2H fixtures for a team
 */
export async function getTeamH2HFixtures(
  leagueId: string,
  teamId: string
) {
  const fixtures = await fantasySql`
    SELECT 
      f.fixture_id,
      f.league_id,
      f.round_id,
      f.team_a_id,
      f.team_b_id,
      ta.team_name as team_a_name,
      tb.team_name as team_b_name,
      f.team_a_points,
      f.team_b_points,
      f.winner_id,
      f.is_draw,
      f.status,
      f.created_at,
      f.updated_at
    FROM fantasy_h2h_fixtures f
    JOIN fantasy_teams ta ON f.team_a_id = ta.team_id
    JOIN fantasy_teams tb ON f.team_b_id = tb.team_id
    WHERE f.league_id = ${leagueId}
      AND (f.team_a_id = ${teamId} OR f.team_b_id = ${teamId})
    ORDER BY f.round_id DESC, f.created_at DESC
  `;

  return fixtures;
}

/**
 * Reset H2H standings for a league (for new season)
 */
export async function resetH2HStandings(leagueId: string): Promise<void> {
  await fantasySql`
    DELETE FROM fantasy_h2h_standings
    WHERE league_id = ${leagueId}
  `;
}
