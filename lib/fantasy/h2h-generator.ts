/**
 * Head-to-Head Fixtures Generator
 * 
 * Generates random pairings for fantasy league H2H matchups each round.
 * Attempts to avoid repeat matchups when possible.
 */

import { neon } from '@neondatabase/serverless';
import { v4 as uuidv4 } from 'uuid';

interface Team {
  team_id: string;
  team_name: string;
}

interface H2HFixture {
  fixture_id: string;
  league_id: string;
  round_id: string;
  team_a_id: string;
  team_b_id: string;
  status: 'scheduled' | 'in_progress' | 'completed';
}

interface PastMatchup {
  team_a_id: string;
  team_b_id: string;
}

/**
 * Generate H2H fixtures for a specific round
 * 
 * @param leagueId - The fantasy league ID
 * @param roundId - The round ID for these fixtures
 * @returns Array of created fixtures
 */
export async function generateH2HFixtures(
  leagueId: string,
  roundId: string
): Promise<H2HFixture[]> {
  const sql = neon(process.env.FANTASY_DATABASE_URL!);

  // 1. Get all teams in the league
  const teams = await sql`
    SELECT team_id, team_name
    FROM fantasy_teams
    WHERE league_id = ${leagueId}
    AND is_enabled = true
    ORDER BY team_id
  ` as Team[];

  if (teams.length === 0) {
    throw new Error('No teams found in league');
  }

  if (teams.length === 1) {
    throw new Error('Cannot generate H2H fixtures with only 1 team');
  }

  // 2. Get past matchups to avoid repeats
  const pastMatchups = await getPastMatchups(leagueId);

  // 3. Generate pairings
  const pairings = generatePairings(teams, pastMatchups);

  // 4. Create fixtures in database
  const fixtures: H2HFixture[] = [];

  for (const pairing of pairings) {
    const fixtureId = `h2h_${leagueId}_${roundId}_${uuidv4().substring(0, 8)}`;

    await sql`
      INSERT INTO fantasy_h2h_fixtures (
        fixture_id,
        league_id,
        round_id,
        team_a_id,
        team_b_id,
        status
      ) VALUES (
        ${fixtureId},
        ${leagueId},
        ${roundId},
        ${pairing.team_a_id},
        ${pairing.team_b_id},
        'scheduled'
      )
    `;

    fixtures.push({
      fixture_id: fixtureId,
      league_id: leagueId,
      round_id: roundId,
      team_a_id: pairing.team_a_id,
      team_b_id: pairing.team_b_id,
      status: 'scheduled'
    });
  }

  return fixtures;
}

/**
 * Get past matchups to avoid repeats
 */
async function getPastMatchups(leagueId: string): Promise<PastMatchup[]> {
  const sql = neon(process.env.FANTASY_DATABASE_URL!);

  const matchups = await sql`
    SELECT team_a_id, team_b_id
    FROM fantasy_h2h_fixtures
    WHERE league_id = ${leagueId}
  ` as PastMatchup[];

  return matchups;
}

/**
 * Generate random pairings, avoiding repeat matchups when possible
 * 
 * Algorithm:
 * 1. Shuffle teams randomly
 * 2. Pair adjacent teams (1-2, 3-4, 5-6, etc.)
 * 3. If odd number of teams, last team gets a bye (no matchup)
 * 4. Check against past matchups and swap if needed
 */
function generatePairings(
  teams: Team[],
  pastMatchups: PastMatchup[]
): Array<{ team_a_id: string; team_b_id: string }> {
  // Shuffle teams randomly
  const shuffled = [...teams].sort(() => Math.random() - 0.5);

  const pairings: Array<{ team_a_id: string; team_b_id: string }> = [];

  // Pair adjacent teams
  for (let i = 0; i < shuffled.length - 1; i += 2) {
    const teamA = shuffled[i];
    const teamB = shuffled[i + 1];

    // Check if this matchup has occurred before
    const hasPlayed = hasTeamsPlayed(teamA.team_id, teamB.team_id, pastMatchups);

    if (hasPlayed && i + 2 < shuffled.length) {
      // Try to swap with next team to avoid repeat
      const teamC = shuffled[i + 2];
      const hasPlayedAC = hasTeamsPlayed(teamA.team_id, teamC.team_id, pastMatchups);

      if (!hasPlayedAC) {
        // Swap B and C
        shuffled[i + 1] = teamC;
        shuffled[i + 2] = teamB;
        pairings.push({
          team_a_id: teamA.team_id,
          team_b_id: teamC.team_id
        });
        continue;
      }
    }

    // Use original pairing (either no repeat or couldn't avoid it)
    pairings.push({
      team_a_id: teamA.team_id,
      team_b_id: teamB.team_id
    });
  }

  // If odd number of teams, last team has no matchup (bye week)
  // This is acceptable - they just don't get H2H points this round

  return pairings;
}

/**
 * Check if two teams have played each other before
 */
function hasTeamsPlayed(
  teamAId: string,
  teamBId: string,
  pastMatchups: PastMatchup[]
): boolean {
  return pastMatchups.some(
    (m) =>
      (m.team_a_id === teamAId && m.team_b_id === teamBId) ||
      (m.team_a_id === teamBId && m.team_b_id === teamAId)
  );
}

/**
 * Get H2H fixtures for a specific round
 */
export async function getH2HFixtures(
  leagueId: string,
  roundId: string
): Promise<H2HFixture[]> {
  const sql = neon(process.env.FANTASY_DATABASE_URL!);

  const fixtures = await sql`
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
    ORDER BY created_at
  ` as H2HFixture[];

  return fixtures;
}

/**
 * Get all H2H fixtures for a league
 */
export async function getAllH2HFixtures(leagueId: string): Promise<H2HFixture[]> {
  const sql = neon(process.env.FANTASY_DATABASE_URL!);

  const fixtures = await sql`
    SELECT 
      fixture_id,
      league_id,
      round_id,
      team_a_id,
      team_b_id,
      status
    FROM fantasy_h2h_fixtures
    WHERE league_id = ${leagueId}
    ORDER BY round_id, created_at
  ` as H2HFixture[];

  return fixtures;
}

/**
 * Delete H2H fixtures for a specific round (for regeneration)
 */
export async function deleteH2HFixtures(
  leagueId: string,
  roundId: string
): Promise<void> {
  const sql = neon(process.env.FANTASY_DATABASE_URL!);

  await sql`
    DELETE FROM fantasy_h2h_fixtures
    WHERE league_id = ${leagueId}
    AND round_id = ${roundId}
  `;
}

/**
 * Check if H2H fixtures already exist for a round
 */
export async function h2hFixturesExist(
  leagueId: string,
  roundId: string
): Promise<boolean> {
  const sql = neon(process.env.FANTASY_DATABASE_URL!);

  const result = await sql`
    SELECT COUNT(*) as count
    FROM fantasy_h2h_fixtures
    WHERE league_id = ${leagueId}
    AND round_id = ${roundId}
  ` as Array<{ count: number }>;

  return Number(result[0].count) > 0;
}
