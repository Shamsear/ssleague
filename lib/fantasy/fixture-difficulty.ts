/**
 * Fantasy League - Fixture Difficulty Calculator
 * 
 * Calculates difficulty rating (1-5 stars) for upcoming fixtures based on:
 * - Opponent rank/position
 * - Opponent form
 * - Home/away advantage
 * 
 * Difficulty Scale:
 * - 5 stars: Very Difficult (top teams, away)
 * - 4 stars: Difficult
 * - 3 stars: Moderate
 * - 2 stars: Easy
 * - 1 star: Very Easy (bottom teams, home)
 */

import { neon } from '@neondatabase/serverless';

export interface FixtureDifficulty {
  rating_id: string;
  league_id: string;
  round_id: string;
  team_id: string;
  opponent_id: string;
  difficulty_score: number; // 1-5
  opponent_rank: number;
  opponent_form_avg: number;
  is_home: boolean;
}

export interface DifficultyFactors {
  opponent_rank: number;
  opponent_form_avg: number;
  is_home: boolean;
  total_teams: number;
}

/**
 * Calculate difficulty score (1-5) based on multiple factors
 */
export function calculateDifficultyScore(factors: DifficultyFactors): number {
  const { opponent_rank, opponent_form_avg, is_home, total_teams } = factors;

  // Factor 1: Opponent Position (40% weight)
  // Top 25% = difficult, Bottom 25% = easy
  const positionPercentile = opponent_rank / total_teams;
  let positionScore: number;
  
  if (positionPercentile <= 0.25) {
    positionScore = 5; // Top 25% - very difficult
  } else if (positionPercentile <= 0.5) {
    positionScore = 4; // Top 50% - difficult
  } else if (positionPercentile <= 0.75) {
    positionScore = 3; // Top 75% - moderate
  } else {
    positionScore = 2; // Bottom 25% - easy
  }

  // Factor 2: Opponent Form (40% weight)
  // Based on average points in last 5 games
  let formScore: number;
  
  if (opponent_form_avg >= 15) {
    formScore = 5; // Excellent form
  } else if (opponent_form_avg >= 12) {
    formScore = 4; // Good form
  } else if (opponent_form_avg >= 8) {
    formScore = 3; // Average form
  } else if (opponent_form_avg >= 5) {
    formScore = 2; // Poor form
  } else {
    formScore = 1; // Very poor form
  }

  // Factor 3: Home/Away (20% weight)
  const venueScore = is_home ? -0.5 : 0.5; // Home = easier, Away = harder

  // Calculate weighted average
  const weightedScore = (positionScore * 0.4) + (formScore * 0.4) + venueScore;

  // Round to nearest integer (1-5)
  const finalScore = Math.max(1, Math.min(5, Math.round(weightedScore)));

  return finalScore;
}

/**
 * Get opponent rank in league standings
 */
async function getOpponentRank(
  leagueId: string,
  opponentId: string
): Promise<number> {
  const sql = neon(process.env.NEON_DATABASE_URL!);

  const standings = await sql`
    SELECT 
      team_id,
      ROW_NUMBER() OVER (ORDER BY total_points DESC) as rank
    FROM fantasy_teams
    WHERE league_id = ${leagueId}
  `;

  const opponent = standings.find(s => s.team_id === opponentId);
  return opponent ? Number(opponent.rank) : standings.length;
}

/**
 * Get opponent form average (last 5 games)
 */
async function getOpponentFormAvg(opponentId: string): Promise<number> {
  const sql = neon(process.env.NEON_DATABASE_URL!);

  const recentGames = await sql`
    SELECT AVG(total_points) as avg_points
    FROM fantasy_lineups
    WHERE team_id = ${opponentId}
    ORDER BY round_number DESC
    LIMIT 5
  `;

  return recentGames.length > 0 ? parseFloat(recentGames[0].avg_points || '0') : 0;
}

/**
 * Calculate and store fixture difficulty for a specific matchup
 */
export async function calculateFixtureDifficulty(
  leagueId: string,
  roundId: string,
  teamId: string,
  opponentId: string,
  isHome: boolean
): Promise<FixtureDifficulty> {
  const sql = neon(process.env.NEON_DATABASE_URL!);

  // Get total teams in league
  const totalTeamsResult = await sql`
    SELECT COUNT(*) as count
    FROM fantasy_teams
    WHERE league_id = ${leagueId}
  `;
  const totalTeams = Number(totalTeamsResult[0].count);

  // Get opponent rank
  const opponentRank = await getOpponentRank(leagueId, opponentId);

  // Get opponent form
  const opponentFormAvg = await getOpponentFormAvg(opponentId);

  // Calculate difficulty score
  const difficultyScore = calculateDifficultyScore({
    opponent_rank: opponentRank,
    opponent_form_avg: opponentFormAvg,
    is_home: isHome,
    total_teams: totalTeams
  });

  // Generate rating ID
  const ratingId = `rating_${leagueId}_${roundId}_${teamId}`;

  // Store in database
  await sql`
    INSERT INTO fixture_difficulty_ratings (
      rating_id,
      league_id,
      round_id,
      team_id,
      opponent_id,
      difficulty_score,
      opponent_rank,
      opponent_form_avg,
      is_home
    ) VALUES (
      ${ratingId},
      ${leagueId},
      ${roundId},
      ${teamId},
      ${opponentId},
      ${difficultyScore},
      ${opponentRank},
      ${opponentFormAvg},
      ${isHome}
    )
    ON CONFLICT (league_id, round_id, team_id)
    DO UPDATE SET
      opponent_id = ${opponentId},
      difficulty_score = ${difficultyScore},
      opponent_rank = ${opponentRank},
      opponent_form_avg = ${opponentFormAvg},
      is_home = ${isHome},
      calculated_at = NOW()
  `;

  return {
    rating_id: ratingId,
    league_id: leagueId,
    round_id: roundId,
    team_id: teamId,
    opponent_id: opponentId,
    difficulty_score: difficultyScore,
    opponent_rank: opponentRank,
    opponent_form_avg: opponentFormAvg,
    is_home: isHome
  };
}

/**
 * Calculate fixture difficulty for all H2H matchups in a round
 */
export async function calculateAllFixtureDifficulties(
  leagueId: string,
  roundId: string
): Promise<number> {
  const sql = neon(process.env.NEON_DATABASE_URL!);

  // Get all H2H fixtures for this round
  const fixtures = await sql`
    SELECT 
      fixture_id,
      team_a_id,
      team_b_id
    FROM fantasy_h2h_fixtures
    WHERE league_id = ${leagueId}
    AND round_id = ${roundId}
  `;

  let calculatedCount = 0;

  for (const fixture of fixtures) {
    try {
      // Calculate for team A (home)
      await calculateFixtureDifficulty(
        leagueId,
        roundId,
        fixture.team_a_id,
        fixture.team_b_id,
        true // home
      );
      calculatedCount++;

      // Calculate for team B (away)
      await calculateFixtureDifficulty(
        leagueId,
        roundId,
        fixture.team_b_id,
        fixture.team_a_id,
        false // away
      );
      calculatedCount++;
    } catch (error) {
      console.error(`Failed to calculate difficulty for fixture ${fixture.fixture_id}:`, error);
    }
  }

  return calculatedCount;
}

/**
 * Get fixture difficulty for a team
 */
export async function getFixtureDifficulty(
  leagueId: string,
  roundId: string,
  teamId: string
): Promise<FixtureDifficulty | null> {
  const sql = neon(process.env.NEON_DATABASE_URL!);

  const result = await sql`
    SELECT *
    FROM fixture_difficulty_ratings
    WHERE league_id = ${leagueId}
    AND round_id = ${roundId}
    AND team_id = ${teamId}
  `;

  if (result.length === 0) return null;

  const row = result[0];
  return {
    rating_id: row.rating_id,
    league_id: row.league_id,
    round_id: row.round_id,
    team_id: row.team_id,
    opponent_id: row.opponent_id,
    difficulty_score: row.difficulty_score,
    opponent_rank: row.opponent_rank,
    opponent_form_avg: parseFloat(row.opponent_form_avg),
    is_home: row.is_home
  };
}

/**
 * Get next N fixtures difficulty for a team
 */
export async function getUpcomingFixtureDifficulties(
  leagueId: string,
  teamId: string,
  n: number = 3
): Promise<FixtureDifficulty[]> {
  const sql = neon(process.env.NEON_DATABASE_URL!);

  const results = await sql`
    SELECT *
    FROM fixture_difficulty_ratings
    WHERE league_id = ${leagueId}
    AND team_id = ${teamId}
    ORDER BY round_id ASC
    LIMIT ${n}
  `;

  return results.map(row => ({
    rating_id: row.rating_id,
    league_id: row.league_id,
    round_id: row.round_id,
    team_id: row.team_id,
    opponent_id: row.opponent_id,
    difficulty_score: row.difficulty_score,
    opponent_rank: row.opponent_rank,
    opponent_form_avg: parseFloat(row.opponent_form_avg),
    is_home: row.is_home
  }));
}

/**
 * Get difficulty stars display (⭐⭐⭐⭐⭐)
 */
export function getDifficultyStars(score: number): string {
  return '⭐'.repeat(score);
}

/**
 * Get difficulty label
 */
export function getDifficultyLabel(score: number): string {
  const labels: Record<number, string> = {
    1: 'Very Easy',
    2: 'Easy',
    3: 'Moderate',
    4: 'Difficult',
    5: 'Very Difficult'
  };
  return labels[score] || 'Unknown';
}

/**
 * Get difficulty color for UI
 */
export function getDifficultyColor(score: number): string {
  const colors: Record<number, string> = {
    1: 'text-green-600',
    2: 'text-green-500',
    3: 'text-yellow-500',
    4: 'text-orange-500',
    5: 'text-red-500'
  };
  return colors[score] || 'text-gray-500';
}
