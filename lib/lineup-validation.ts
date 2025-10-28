import { getTournamentDb } from '@/lib/neon/tournament-config';

export interface LineupValidationResult {
  isValid: boolean;
  errors: string[];
  classicPlayerCount: number;
}

export interface LineupData {
  starting_xi: string[];
  substitutes: string[];
}

/**
 * Validate lineup meets all requirements
 */
export async function validateLineup(
  lineup: LineupData,
  seasonId: string,
  teamId: string
): Promise<LineupValidationResult> {
  const errors: string[] = [];
  const sql = getTournamentDb();

  // 1. Check starting XI count
  if (!lineup.starting_xi || lineup.starting_xi.length !== 5) {
    errors.push('Starting XI must have exactly 5 players');
  }

  // 2. Check substitutes count
  if (!lineup.substitutes || lineup.substitutes.length !== 2) {
    errors.push('Substitutes must have exactly 2 players');
  }

  if (errors.length > 0) {
    return {
      isValid: false,
      errors,
      classicPlayerCount: 0,
    };
  }

  // 3. Check for duplicate players
  const allPlayers = [...lineup.starting_xi, ...lineup.substitutes];
  const uniquePlayers = new Set(allPlayers);
  
  if (uniquePlayers.size !== allPlayers.length) {
    errors.push('Duplicate players found in lineup');
  }

  // 4. Check if all players belong to the team and are registered for season
  const playerChecks = await sql`
    SELECT player_id, category
    FROM player_seasons
    WHERE player_id = ANY(${allPlayers})
    AND season_id = ${seasonId}
    AND team_id = ${teamId}
  `;

  if (playerChecks.length !== allPlayers.length) {
    errors.push('Some players are not eligible for this team/season');
  }

  // 5. Count classic category players
  const classicCount = playerChecks.filter(
    (p: any) => p.category === 'classic'
  ).length;

  if (classicCount < 2) {
    errors.push('Lineup must include at least 2 classic category players');
  }

  return {
    isValid: errors.length === 0,
    errors,
    classicPlayerCount: classicCount,
  };
}

/**
 * Check if lineup can still be edited (deadline not passed)
 */
export async function isLineupEditable(
  fixtureId: string
): Promise<{ editable: boolean; reason?: string }> {
  const sql = getTournamentDb();

  // Get fixture and round deadline info
  const result = await sql`
    SELECT 
      f.round_number,
      f.season_id,
      f.tournament_id,
      rd.scheduled_date,
      rd.home_fixture_deadline_time,
      rd.status as round_status
    FROM fixtures f
    LEFT JOIN round_deadlines rd ON 
      f.round_number = rd.round_number 
      AND f.season_id = rd.season_id
    WHERE f.id = ${fixtureId}
    LIMIT 1
  `;

  if (result.length === 0) {
    return { editable: false, reason: 'Fixture not found' };
  }

  const fixture = result[0];

  // Check if round has started
  if (fixture.scheduled_date) {
    const roundStart = new Date(fixture.scheduled_date);
    const now = new Date();
    const oneHourAfterStart = new Date(roundStart.getTime() + 60 * 60 * 1000);

    // If more than 1 hour has passed since round start, lineup is locked
    if (now > oneHourAfterStart) {
      return { editable: false, reason: 'Lineup deadline has passed (1 hour after round start)' };
    }
  }

  return { editable: true };
}

/**
 * Check if a team has submitted lineup for a fixture
 */
export async function hasSubmittedLineup(
  fixtureId: string,
  teamId: string
): Promise<boolean> {
  const sql = getTournamentDb();

  const result = await sql`
    SELECT id 
    FROM lineups
    WHERE fixture_id = ${fixtureId}
    AND team_id = ${teamId}
    LIMIT 1
  `;

  return result.length > 0;
}

/**
 * Get lineup status for a fixture (both teams)
 */
export async function getFixtureLineupStatus(fixtureId: string) {
  const sql = getTournamentDb();

  const fixture = await sql`
    SELECT 
      id,
      home_team_id,
      away_team_id,
      home_team_name,
      away_team_name,
      round_number,
      season_id
    FROM fixtures
    WHERE id = ${fixtureId}
    LIMIT 1
  `;

  if (fixture.length === 0) {
    return null;
  }

  const fix = fixture[0];

  // Check both team lineups
  const lineups = await sql`
    SELECT 
      team_id,
      is_valid,
      is_locked,
      warning_given,
      selected_by_opponent,
      submitted_at,
      classic_player_count
    FROM lineups
    WHERE fixture_id = ${fixtureId}
    AND team_id IN (${fix.home_team_id}, ${fix.away_team_id})
  `;

  const homeLineup = lineups.find((l: any) => l.team_id === fix.home_team_id);
  const awayLineup = lineups.find((l: any) => l.team_id === fix.away_team_id);

  return {
    fixture: fix,
    homeTeam: {
      id: fix.home_team_id,
      name: fix.home_team_name,
      hasLineup: !!homeLineup,
      lineupStatus: homeLineup || null,
    },
    awayTeam: {
      id: fix.away_team_id,
      name: fix.away_team_name,
      hasLineup: !!awayLineup,
      lineupStatus: awayLineup || null,
    },
  };
}

/**
 * Validate substitution
 */
export async function validateSubstitution(
  lineupId: string,
  playerOut: string,
  playerIn: string
): Promise<{ valid: boolean; error?: string }> {
  const sql = getTournamentDb();

  // Get lineup
  const lineup = await sql`
    SELECT 
      starting_xi,
      substitutes,
      is_locked
    FROM lineups
    WHERE id = ${lineupId}
    LIMIT 1
  `;

  if (lineup.length === 0) {
    return { valid: false, error: 'Lineup not found' };
  }

  const lineupData = lineup[0];
  const startingXI = lineupData.starting_xi as string[];
  const subs = lineupData.substitutes as string[];

  // Check if player_out is in starting XI
  if (!startingXI.includes(playerOut)) {
    return { valid: false, error: 'Player to substitute out is not in starting XI' };
  }

  // Check if player_in is in substitutes
  if (!subs.includes(playerIn)) {
    return { valid: false, error: 'Player to substitute in is not in substitutes' };
  }

  return { valid: true };
}

/**
 * Generate lineup ID
 */
export function generateLineupId(fixtureId: string, teamId: string): string {
  return `lineup_${fixtureId}_${teamId}`;
}
