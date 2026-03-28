import { fantasySql } from '@/lib/neon/fantasy-config';
import { calculateH2HResults } from './h2h-calculator';
import { checkAchievements } from './achievements';

/**
 * Calculate points for all lineups in a round
 * Only starting 5 players earn points
 * Captain gets 2x multiplier
 * Vice-captain gets 1.5x multiplier
 * Bench players earn 0 points (unless Bench Boost active)
 * 
 * After lineup points are calculated, H2H results are also calculated
 * Then achievements are checked for all teams
 */
export async function calculateLineupPoints(leagueId: string, roundId: string) {
  try {
    // 1. Get all lineups for this round
    const lineups = await fantasySql`
      SELECT 
        lineup_id,
        team_id,
        starting_players,
        captain_id,
        vice_captain_id,
        bench_players,
        is_locked
      FROM fantasy_lineups
      WHERE league_id = ${leagueId}
        AND round_id = ${roundId}
        AND is_locked = true
    `;

    if (lineups.length === 0) {
      return {
        success: true,
        lineups_processed: 0,
        message: 'No locked lineups to process'
      };
    }

    // 2. Get scoring rules for this league
    const scoringRules = await getScoringRules(leagueId);

    let totalPointsAwarded = 0;
    let highestScoringTeam = { team_id: '', points: 0 };

    // 3. Process each lineup
    for (const lineup of lineups) {
      const lineupPoints = await processLineup(
        lineup,
        roundId,
        scoringRules
      );

      totalPointsAwarded += lineupPoints.total;

      if (lineupPoints.total > highestScoringTeam.points) {
        highestScoringTeam = {
          team_id: lineup.team_id,
          points: lineupPoints.total
        };
      }

      // 4. Update lineup total points
      await fantasySql`
        UPDATE fantasy_lineups
        SET 
          total_points = ${lineupPoints.total},
          captain_points = ${lineupPoints.captainPoints},
          vice_captain_points = ${lineupPoints.viceCaptainPoints},
          updated_at = NOW()
        WHERE lineup_id = ${lineup.lineup_id}
      `;

      // 5. Update team total points
      await updateTeamTotalPoints(lineup.team_id, leagueId);
    }

    // 6. Calculate H2H results after all lineup points are calculated
    let h2hResults = [];
    try {
      h2hResults = await calculateH2HResults(leagueId, roundId);
    } catch (error: any) {
      console.error('Error calculating H2H results:', error);
      // Don't fail the entire operation if H2H calculation fails
    }

    // 7. Check achievements for all teams after points calculation
    const achievementsUnlocked: any[] = [];
    for (const lineup of lineups) {
      try {
        const newAchievements = await checkAchievements(lineup.team_id, leagueId);
        if (newAchievements.length > 0) {
          achievementsUnlocked.push({
            team_id: lineup.team_id,
            achievements: newAchievements
          });
          console.log(`[Achievements] Team ${lineup.team_id} unlocked ${newAchievements.length} new achievement(s)`);
        }
      } catch (error: any) {
        console.error(`Error checking achievements for team ${lineup.team_id}:`, error);
        // Don't fail the entire operation if achievement checking fails
      }
    }

    return {
      success: true,
      lineups_processed: lineups.length,
      total_points_awarded: totalPointsAwarded,
      highest_scoring_team: highestScoringTeam,
      h2h_fixtures_processed: h2hResults.length,
      achievements_unlocked: achievementsUnlocked.length
    };

  } catch (error: any) {
    console.error('Error calculating lineup points:', error);
    throw new Error(`Failed to calculate lineup points: ${error.message}`);
  }
}

/**
 * Process a single lineup and calculate points
 */
async function processLineup(
  lineup: any,
  roundId: string,
  scoringRules: ScoringRule[]
) {
  let totalPoints = 0;
  let captainPoints = 0;
  let viceCaptainPoints = 0;

  const startingPlayers = lineup.starting_players;
  const captainId = lineup.captain_id;
  const viceCaptainId = lineup.vice_captain_id;

  // Check if Bench Boost is active
  const benchBoostActive = await isPowerUpActive(
    lineup.team_id,
    'bench_boost',
    roundId
  );

  // Check if Triple Captain is active
  const tripleCaptainActive = await isPowerUpActive(
    lineup.team_id,
    'triple_captain',
    roundId
  );

  // 1. Calculate points for starting 5
  for (const playerId of startingPlayers) {
    const playerPoints = await calculatePlayerPoints(
      playerId,
      roundId,
      scoringRules
    );

    // Apply multipliers
    let multiplier = 1.0;
    let isCaptain = false;
    let isViceCaptain = false;

    if (playerId === captainId) {
      multiplier = tripleCaptainActive ? 3.0 : 2.0;
      isCaptain = true;
    } else if (playerId === viceCaptainId) {
      multiplier = 1.5;
      isViceCaptain = true;
    }

    // Apply form multiplier
    const formMultiplier = await getPlayerFormMultiplier(playerId);
    const finalPoints = playerPoints * multiplier * formMultiplier;

    totalPoints += finalPoints;

    if (isCaptain) {
      captainPoints = finalPoints;
    } else if (isViceCaptain) {
      viceCaptainPoints = finalPoints;
    }

    // Record individual player points
    await recordPlayerPoints(lineup.team_id, playerId, roundId, {
      base_points: playerPoints,
      multiplier,
      form_multiplier: formMultiplier,
      final_points: finalPoints,
      is_captain: isCaptain,
      is_vice_captain: isViceCaptain,
      is_bench: false
    });
  }

  // 2. Process bench players (0 points unless Bench Boost)
  if (benchBoostActive) {
    const benchPlayers = lineup.bench_players;
    for (const playerId of benchPlayers) {
      const playerPoints = await calculatePlayerPoints(
        playerId,
        roundId,
        scoringRules
      );

      const formMultiplier = await getPlayerFormMultiplier(playerId);
      const finalPoints = playerPoints * formMultiplier;

      totalPoints += finalPoints;

      await recordPlayerPoints(lineup.team_id, playerId, roundId, {
        base_points: playerPoints,
        multiplier: 1.0,
        form_multiplier: formMultiplier,
        final_points: finalPoints,
        is_captain: false,
        is_vice_captain: false,
        is_bench: true
      });
    }
  } else {
    // Record 0 points for bench players
    const benchPlayers = lineup.bench_players;
    for (const playerId of benchPlayers) {
      await recordPlayerPoints(lineup.team_id, playerId, roundId, {
        base_points: 0,
        multiplier: 0,
        form_multiplier: 1.0,
        final_points: 0,
        is_captain: false,
        is_vice_captain: false,
        is_bench: true
      });
    }
  }

  return {
    total: totalPoints,
    captainPoints,
    viceCaptainPoints
  };
}

/**
 * Calculate base points for a player in a round
 */
async function calculatePlayerPoints(
  playerId: string,
  roundId: string,
  scoringRules: ScoringRule[]
): Promise<number> {
  // Get player performance in this round
  const [performance] = await fantasySql`
    SELECT 
      goals,
      assists,
      clean_sheet,
      yellow_cards,
      red_cards,
      minutes_played,
      motm,
      own_goals
    FROM round_players
    WHERE real_player_id = ${playerId}
      AND round_id = ${roundId}
  `;

  if (!performance) {
    return 0; // Player didn't play
  }

  let points = 0;

  // Apply scoring rules
  for (const rule of scoringRules) {
    const value = performance[rule.stat_type] || 0;
    points += value * rule.points_per_unit;
  }

  return Math.max(0, points); // Ensure non-negative
}

/**
 * Get player form multiplier
 */
async function getPlayerFormMultiplier(playerId: string): Promise<number> {
  const [player] = await fantasySql`
    SELECT form_multiplier
    FROM fantasy_players
    WHERE real_player_id = ${playerId}
  `;

  return player?.form_multiplier || 1.0;
}

/**
 * Check if a power-up is active for a team in a round
 */
async function isPowerUpActive(
  teamId: string,
  powerUpType: string,
  roundId: string
): Promise<boolean> {
  const [usage] = await fantasySql`
    SELECT usage_id
    FROM fantasy_power_up_usage
    WHERE team_id = ${teamId}
      AND power_up_type = ${powerUpType}
      AND round_id = ${roundId}
  `;

  return !!usage;
}

/**
 * Record individual player points
 */
async function recordPlayerPoints(
  teamId: string,
  playerId: string,
  roundId: string,
  pointsData: {
    base_points: number;
    multiplier: number;
    form_multiplier: number;
    final_points: number;
    is_captain: boolean;
    is_vice_captain: boolean;
    is_bench: boolean;
  }
) {
  const pointsId = `points_${teamId}_${playerId}_${roundId}_${Date.now()}`;

  await fantasySql`
    INSERT INTO fantasy_player_points (
      points_id,
      team_id,
      real_player_id,
      round_id,
      base_points,
      multiplier,
      form_multiplier,
      final_points,
      is_captain,
      is_vice_captain,
      is_bench,
      created_at
    )
    VALUES (
      ${pointsId},
      ${teamId},
      ${playerId},
      ${roundId},
      ${pointsData.base_points},
      ${pointsData.multiplier},
      ${pointsData.form_multiplier},
      ${pointsData.final_points},
      ${pointsData.is_captain},
      ${pointsData.is_vice_captain},
      ${pointsData.is_bench},
      NOW()
    )
    ON CONFLICT (team_id, real_player_id, round_id)
    DO UPDATE SET
      base_points = ${pointsData.base_points},
      multiplier = ${pointsData.multiplier},
      form_multiplier = ${pointsData.form_multiplier},
      final_points = ${pointsData.final_points},
      is_captain = ${pointsData.is_captain},
      is_vice_captain = ${pointsData.is_vice_captain},
      is_bench = ${pointsData.is_bench},
      updated_at = NOW()
  `;
}

/**
 * Update team's total points
 */
async function updateTeamTotalPoints(teamId: string, leagueId: string) {
  // Sum all lineup points for this team
  const [result] = await fantasySql`
    SELECT COALESCE(SUM(total_points), 0) as total
    FROM fantasy_lineups
    WHERE team_id = ${teamId}
      AND league_id = ${leagueId}
  `;

  const totalPoints = result?.total || 0;

  await fantasySql`
    UPDATE fantasy_teams
    SET 
      total_points = ${totalPoints},
      updated_at = NOW()
    WHERE team_id = ${teamId}
  `;
}

/**
 * Get scoring rules for a league
 */
async function getScoringRules(leagueId: string): Promise<ScoringRule[]> {
  const rules = await fantasySql`
    SELECT 
      stat_type,
      points_per_unit
    FROM fantasy_scoring_rules
    WHERE league_id = ${leagueId}
    ORDER BY stat_type
  `;

  return rules as ScoringRule[];
}

/**
 * Calculate points for a specific team's lineup
 */
export async function calculateTeamLineupPoints(
  teamId: string,
  roundId: string
): Promise<number> {
  const [lineup] = await fantasySql`
    SELECT 
      lineup_id,
      team_id,
      league_id,
      starting_players,
      captain_id,
      vice_captain_id,
      bench_players,
      is_locked
    FROM fantasy_lineups
    WHERE team_id = ${teamId}
      AND round_id = ${roundId}
      AND is_locked = true
  `;

  if (!lineup) {
    return 0;
  }

  const scoringRules = await getScoringRules(lineup.league_id);
  const lineupPoints = await processLineup(lineup, roundId, scoringRules);

  // Update lineup points
  await fantasySql`
    UPDATE fantasy_lineups
    SET 
      total_points = ${lineupPoints.total},
      captain_points = ${lineupPoints.captainPoints},
      vice_captain_points = ${lineupPoints.viceCaptainPoints},
      updated_at = NOW()
    WHERE lineup_id = ${lineup.lineup_id}
  `;

  // Update team total
  await updateTeamTotalPoints(teamId, lineup.league_id);

  return lineupPoints.total;
}

// Types
interface ScoringRule {
  stat_type: string;
  points_per_unit: number;
}
