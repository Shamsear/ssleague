/**
 * Fantasy League - Weekly Challenges System
 * 
 * Rotating weekly challenges with bonus points and badges:
 * - Captain Masterclass: Captain scores 25+ points (+20 pts)
 * - Underdog Hero: Start player from bottom 3 teams who scores 15+ (+25 pts)
 * - Perfect Lineup: All 5 starters score 10+ points (+30 pts)
 * - Differential Pick: Own player <20% owned who scores 20+ (+35 pts)
 * - Budget Genius: Win with squad value under €40M (+40 pts)
 * 
 * Challenges rotate weekly and completion is detected automatically.
 */

import { neon } from '@neondatabase/serverless';

// ============================================================================
// Types
// ============================================================================

export type ChallengeType = 
  | 'captain_masterclass'
  | 'underdog_hero'
  | 'perfect_lineup'
  | 'differential_pick'
  | 'budget_genius'
  | 'clean_sweep'
  | 'comeback_king';

export interface ChallengeTemplate {
  type: ChallengeType;
  name: string;
  description: string;
  requirements: Record<string, any>;
  bonus_points: number;
  badge_name?: string;
}

export interface Challenge {
  challenge_id: string;
  league_id: string;
  round_id: string | null;
  challenge_name: string;
  challenge_description: string;
  challenge_type: string;
  requirements: Record<string, any>;
  bonus_points: number;
  badge_name: string | null;
  start_date: Date;
  end_date: Date;
  is_active: boolean;
  created_at: Date;
}

export interface ChallengeCompletion {
  completion_id: string;
  challenge_id: string;
  team_id: string;
  completed_at: Date;
  bonus_points_awarded: number;
  created_at: Date;
}

export interface ChallengeCheckResult {
  completed: boolean;
  reason?: string;
  details?: Record<string, any>;
}

// ============================================================================
// Challenge Templates
// ============================================================================

/**
 * Predefined challenge templates that rotate weekly
 */
export const CHALLENGE_TEMPLATES: ChallengeTemplate[] = [
  {
    type: 'captain_masterclass',
    name: 'Captain Masterclass',
    description: 'Your captain scores 25+ points in a single round',
    requirements: {
      min_captain_points: 25
    },
    bonus_points: 20,
    badge_name: '👑 Captain Master'
  },
  {
    type: 'underdog_hero',
    name: 'Underdog Hero',
    description: 'Start a player from bottom 3 teams who scores 15+ points',
    requirements: {
      min_player_points: 15,
      team_position_max: 3 // Bottom 3 teams
    },
    bonus_points: 25,
    badge_name: '🦸 Underdog Hero'
  },
  {
    type: 'perfect_lineup',
    name: 'Perfect Lineup',
    description: 'All 5 starting players score 10+ points',
    requirements: {
      min_points_per_player: 10,
      all_starters_required: true
    },
    bonus_points: 30,
    badge_name: '⭐ Perfect Lineup'
  },
  {
    type: 'differential_pick',
    name: 'Differential Pick',
    description: 'Own a player with <20% ownership who scores 20+ points',
    requirements: {
      max_ownership_percentage: 20,
      min_player_points: 20
    },
    bonus_points: 35,
    badge_name: '🎯 Differential Master'
  },
  {
    type: 'budget_genius',
    name: 'Budget Genius',
    description: 'Win your round with a squad value under €40M',
    requirements: {
      max_squad_value: 40000000, // €40M in cents
      must_win_round: true
    },
    bonus_points: 40,
    badge_name: '💰 Budget Genius'
  },
  {
    type: 'clean_sweep',
    name: 'Clean Sweep',
    description: 'All 5 starters score 15+ points',
    requirements: {
      min_points_per_player: 15,
      all_starters_required: true
    },
    bonus_points: 45,
    badge_name: '🧹 Clean Sweep'
  },
  {
    type: 'comeback_king',
    name: 'Comeback King',
    description: 'Win your round after being in bottom 5 previous round',
    requirements: {
      previous_position_min: 16, // Bottom 5 of 20 teams
      must_win_round: true
    },
    bonus_points: 50,
    badge_name: '👑 Comeback King'
  }
];

/**
 * Get challenge template by type
 */
export function getChallengeTemplate(type: ChallengeType): ChallengeTemplate | undefined {
  return CHALLENGE_TEMPLATES.find(t => t.type === type);
}

/**
 * Get challenge for a specific week (rotates through templates)
 */
export function getWeeklyChallengeType(weekNumber: number): ChallengeType {
  const templates = CHALLENGE_TEMPLATES;
  const index = (weekNumber - 1) % templates.length;
  return templates[index].type;
}

// ============================================================================
// Challenge Checking Logic
// ============================================================================

export interface LineupData {
  lineup_id: string;
  team_id: string;
  round_id: string;
  starting_players: string[];
  captain_id: string;
  vice_captain_id: string;
  total_points: number;
  captain_points: number;
}

export interface PlayerPerformance {
  player_id: string;
  points: number;
  team_id: string;
  ownership_percentage: number;
}

export interface TeamStanding {
  team_id: string;
  position: number;
  total_points: number;
}

export interface SquadData {
  team_id: string;
  total_value: number; // in cents
  players: Array<{
    player_id: string;
    purchase_price: number;
  }>;
}

/**
 * Check if Captain Masterclass challenge is completed
 */
export function checkCaptainMasterclass(
  lineup: LineupData,
  requirements: Record<string, any>
): ChallengeCheckResult {
  const minPoints = requirements.min_captain_points || 25;
  
  if (lineup.captain_points >= minPoints) {
    return {
      completed: true,
      details: {
        captain_points: lineup.captain_points,
        required_points: minPoints
      }
    };
  }
  
  return {
    completed: false,
    reason: `Captain scored ${lineup.captain_points} points (need ${minPoints}+)`
  };
}

/**
 * Check if Underdog Hero challenge is completed
 */
export function checkUnderdogHero(
  lineup: LineupData,
  playerPerformances: PlayerPerformance[],
  teamStandings: TeamStanding[],
  requirements: Record<string, any>
): ChallengeCheckResult {
  const minPoints = requirements.min_player_points || 15;
  const maxPosition = requirements.team_position_max || 3;
  
  // Get bottom 3 teams
  const sortedStandings = [...teamStandings].sort((a, b) => b.position - a.position);
  const bottomTeams = sortedStandings.slice(0, maxPosition).map(s => s.team_id);
  
  // Check if any starting player is from bottom teams and scored enough
  for (const playerId of lineup.starting_players) {
    const performance = playerPerformances.find(p => p.player_id === playerId);
    if (performance && bottomTeams.includes(performance.team_id)) {
      if (performance.points >= minPoints) {
        return {
          completed: true,
          details: {
            player_id: playerId,
            player_points: performance.points,
            player_team: performance.team_id,
            required_points: minPoints
          }
        };
      }
    }
  }
  
  return {
    completed: false,
    reason: `No player from bottom ${maxPosition} teams scored ${minPoints}+ points`
  };
}

/**
 * Check if Perfect Lineup challenge is completed
 */
export function checkPerfectLineup(
  lineup: LineupData,
  playerPerformances: PlayerPerformance[],
  requirements: Record<string, any>
): ChallengeCheckResult {
  const minPointsPerPlayer = requirements.min_points_per_player || 10;
  
  const playerScores: Record<string, number> = {};
  let allAboveThreshold = true;
  
  for (const playerId of lineup.starting_players) {
    const performance = playerPerformances.find(p => p.player_id === playerId);
    const points = performance?.points || 0;
    playerScores[playerId] = points;
    
    if (points < minPointsPerPlayer) {
      allAboveThreshold = false;
    }
  }
  
  if (allAboveThreshold) {
    return {
      completed: true,
      details: {
        player_scores: playerScores,
        required_points: minPointsPerPlayer
      }
    };
  }
  
  return {
    completed: false,
    reason: `Not all starters scored ${minPointsPerPlayer}+ points`,
    details: { player_scores: playerScores }
  };
}

/**
 * Check if Differential Pick challenge is completed
 */
export function checkDifferentialPick(
  lineup: LineupData,
  playerPerformances: PlayerPerformance[],
  requirements: Record<string, any>
): ChallengeCheckResult {
  const maxOwnership = requirements.max_ownership_percentage || 20;
  const minPoints = requirements.min_player_points || 20;
  
  // Check all starting players
  for (const playerId of lineup.starting_players) {
    const performance = playerPerformances.find(p => p.player_id === playerId);
    if (performance) {
      if (performance.ownership_percentage < maxOwnership && performance.points >= minPoints) {
        return {
          completed: true,
          details: {
            player_id: playerId,
            player_points: performance.points,
            ownership_percentage: performance.ownership_percentage,
            required_points: minPoints,
            max_ownership: maxOwnership
          }
        };
      }
    }
  }
  
  return {
    completed: false,
    reason: `No player with <${maxOwnership}% ownership scored ${minPoints}+ points`
  };
}

/**
 * Check if Budget Genius challenge is completed
 */
export function checkBudgetGenius(
  lineup: LineupData,
  squad: SquadData,
  teamStandings: TeamStanding[],
  requirements: Record<string, any>
): ChallengeCheckResult {
  const maxSquadValue = requirements.max_squad_value || 40000000; // €40M
  const mustWin = requirements.must_win_round || false;
  
  // Check squad value
  if (squad.total_value >= maxSquadValue) {
    return {
      completed: false,
      reason: `Squad value €${(squad.total_value / 1000000).toFixed(1)}M exceeds €${(maxSquadValue / 1000000).toFixed(1)}M`
    };
  }
  
  // Check if won the round (if required)
  if (mustWin) {
    const teamStanding = teamStandings.find(s => s.team_id === lineup.team_id);
    if (!teamStanding || teamStanding.position !== 1) {
      return {
        completed: false,
        reason: 'Did not win the round'
      };
    }
  }
  
  return {
    completed: true,
    details: {
      squad_value: squad.total_value,
      max_allowed: maxSquadValue,
      position: teamStandings.find(s => s.team_id === lineup.team_id)?.position
    }
  };
}

/**
 * Check if Clean Sweep challenge is completed
 */
export function checkCleanSweep(
  lineup: LineupData,
  playerPerformances: PlayerPerformance[],
  requirements: Record<string, any>
): ChallengeCheckResult {
  const minPointsPerPlayer = requirements.min_points_per_player || 15;
  
  const playerScores: Record<string, number> = {};
  let allAboveThreshold = true;
  
  for (const playerId of lineup.starting_players) {
    const performance = playerPerformances.find(p => p.player_id === playerId);
    const points = performance?.points || 0;
    playerScores[playerId] = points;
    
    if (points < minPointsPerPlayer) {
      allAboveThreshold = false;
    }
  }
  
  if (allAboveThreshold) {
    return {
      completed: true,
      details: {
        player_scores: playerScores,
        required_points: minPointsPerPlayer
      }
    };
  }
  
  return {
    completed: false,
    reason: `Not all starters scored ${minPointsPerPlayer}+ points`,
    details: { player_scores: playerScores }
  };
}

/**
 * Check if Comeback King challenge is completed
 */
export function checkComebackKing(
  lineup: LineupData,
  currentStandings: TeamStanding[],
  previousStandings: TeamStanding[],
  requirements: Record<string, any>
): ChallengeCheckResult {
  const minPreviousPosition = requirements.previous_position_min || 16;
  const mustWin = requirements.must_win_round || false;
  
  // Check previous position
  const previousStanding = previousStandings.find(s => s.team_id === lineup.team_id);
  if (!previousStanding || previousStanding.position < minPreviousPosition) {
    return {
      completed: false,
      reason: `Was not in bottom 5 last round (position: ${previousStanding?.position || 'N/A'})`
    };
  }
  
  // Check if won this round
  if (mustWin) {
    const currentStanding = currentStandings.find(s => s.team_id === lineup.team_id);
    if (!currentStanding || currentStanding.position !== 1) {
      return {
        completed: false,
        reason: 'Did not win the round'
      };
    }
  }
  
  return {
    completed: true,
    details: {
      previous_position: previousStanding.position,
      current_position: currentStandings.find(s => s.team_id === lineup.team_id)?.position
    }
  };
}

/**
 * Main challenge checker - routes to specific checker based on type
 */
export function checkChallengeCompletion(
  challengeType: ChallengeType,
  requirements: Record<string, any>,
  data: {
    lineup: LineupData;
    playerPerformances: PlayerPerformance[];
    teamStandings: TeamStanding[];
    previousStandings?: TeamStanding[];
    squad: SquadData;
  }
): ChallengeCheckResult {
  switch (challengeType) {
    case 'captain_masterclass':
      return checkCaptainMasterclass(data.lineup, requirements);
    
    case 'underdog_hero':
      return checkUnderdogHero(
        data.lineup,
        data.playerPerformances,
        data.teamStandings,
        requirements
      );
    
    case 'perfect_lineup':
      return checkPerfectLineup(data.lineup, data.playerPerformances, requirements);
    
    case 'differential_pick':
      return checkDifferentialPick(data.lineup, data.playerPerformances, requirements);
    
    case 'budget_genius':
      return checkBudgetGenius(data.lineup, data.squad, data.teamStandings, requirements);
    
    case 'clean_sweep':
      return checkCleanSweep(data.lineup, data.playerPerformances, requirements);
    
    case 'comeback_king':
      if (!data.previousStandings) {
        return {
          completed: false,
          reason: 'Previous standings not available'
        };
      }
      return checkComebackKing(
        data.lineup,
        data.teamStandings,
        data.previousStandings,
        requirements
      );
    
    default:
      return {
        completed: false,
        reason: 'Unknown challenge type'
      };
  }
}

// ============================================================================
// Database Operations
// ============================================================================

/**
 * Create a new challenge for a league/round
 */
export async function createChallenge(
  leagueId: string,
  roundId: string | null,
  template: ChallengeTemplate,
  startDate: Date,
  endDate: Date
): Promise<Challenge> {
  const sql = neon(process.env.DATABASE_URL!);
  
  const challengeId = `challenge_${leagueId}_${roundId || 'season'}_${template.type}_${Date.now()}`;
  
  const result = await sql`
    INSERT INTO fantasy_challenges (
      challenge_id,
      league_id,
      round_id,
      challenge_name,
      challenge_description,
      challenge_type,
      requirements,
      bonus_points,
      badge_name,
      start_date,
      end_date,
      is_active
    ) VALUES (
      ${challengeId},
      ${leagueId},
      ${roundId},
      ${template.name},
      ${template.description},
      ${template.type},
      ${JSON.stringify(template.requirements)},
      ${template.bonus_points},
      ${template.badge_name || null},
      ${startDate.toISOString()},
      ${endDate.toISOString()},
      true
    )
    RETURNING *
  `;
  
  return result[0] as Challenge;
}

/**
 * Record challenge completion
 */
export async function recordChallengeCompletion(
  challengeId: string,
  teamId: string,
  bonusPoints: number
): Promise<ChallengeCompletion> {
  const sql = neon(process.env.DATABASE_URL!);
  
  const completionId = `completion_${challengeId}_${teamId}_${Date.now()}`;
  
  // Check if already completed
  const existing = await sql`
    SELECT * FROM fantasy_challenge_completions
    WHERE challenge_id = ${challengeId}
    AND team_id = ${teamId}
  `;
  
  if (existing.length > 0) {
    return existing[0] as ChallengeCompletion;
  }
  
  const result = await sql`
    INSERT INTO fantasy_challenge_completions (
      completion_id,
      challenge_id,
      team_id,
      bonus_points_awarded
    ) VALUES (
      ${completionId},
      ${challengeId},
      ${teamId},
      ${bonusPoints}
    )
    RETURNING *
  `;
  
  return result[0] as ChallengeCompletion;
}

/**
 * Get active challenges for a league
 */
export async function getActiveChallenges(leagueId: string): Promise<Challenge[]> {
  const sql = neon(process.env.DATABASE_URL!);
  
  const result = await sql`
    SELECT * FROM fantasy_challenges
    WHERE league_id = ${leagueId}
    AND is_active = true
    AND start_date <= NOW()
    AND end_date >= NOW()
    ORDER BY start_date DESC
  `;
  
  return result as Challenge[];
}

/**
 * Get challenge completions for a team
 */
export async function getTeamChallengeCompletions(
  teamId: string,
  leagueId?: string
): Promise<ChallengeCompletion[]> {
  const sql = neon(process.env.DATABASE_URL!);
  
  if (leagueId) {
    const result = await sql`
      SELECT cc.* FROM fantasy_challenge_completions cc
      JOIN fantasy_challenges c ON cc.challenge_id = c.challenge_id
      WHERE cc.team_id = ${teamId}
      AND c.league_id = ${leagueId}
      ORDER BY cc.completed_at DESC
    `;
    return result as ChallengeCompletion[];
  }
  
  const result = await sql`
    SELECT * FROM fantasy_challenge_completions
    WHERE team_id = ${teamId}
    ORDER BY completed_at DESC
  `;
  
  return result as ChallengeCompletion[];
}

/**
 * Get challenge leaderboard (teams with most completions)
 */
export async function getChallengeLeaderboard(
  leagueId: string
): Promise<Array<{ team_id: string; completions: number; total_bonus_points: number }>> {
  const sql = neon(process.env.DATABASE_URL!);
  
  const result = await sql`
    SELECT 
      cc.team_id,
      COUNT(cc.completion_id) as completions,
      SUM(cc.bonus_points_awarded) as total_bonus_points
    FROM fantasy_challenge_completions cc
    JOIN fantasy_challenges c ON cc.challenge_id = c.challenge_id
    WHERE c.league_id = ${leagueId}
    GROUP BY cc.team_id
    ORDER BY completions DESC, total_bonus_points DESC
  `;
  
  return result as Array<{ team_id: string; completions: number; total_bonus_points: number }>;
}

/**
 * Award bonus points to team for challenge completion
 */
export async function awardChallengeBonus(
  teamId: string,
  bonusPoints: number
): Promise<void> {
  const sql = neon(process.env.DATABASE_URL!);
  
  await sql`
    UPDATE fantasy_teams
    SET total_points = total_points + ${bonusPoints}
    WHERE team_id = ${teamId}
  `;
}
