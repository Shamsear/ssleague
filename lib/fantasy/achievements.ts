/**
 * Fantasy League Achievements System
 * 
 * Defines and manages achievements/badges that teams can unlock throughout the season.
 * Achievements are checked automatically after key events (lineup submission, points calculation, etc.)
 */

import { sql } from '@/lib/neon/config';

// Achievement types
export type AchievementCategory = 
  | 'scoring' 
  | 'lineup' 
  | 'trading' 
  | 'consistency' 
  | 'special' 
  | 'season';

export interface Achievement {
  achievement_id: string;
  name: string;
  description: string;
  badge_emoji: string;
  category: AchievementCategory;
  points_reward: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  check_condition: (teamData: TeamData) => boolean;
}

export interface TeamData {
  team_id: string;
  league_id: string;
  total_points: number;
  weekly_points: number[];
  lineup_history: any[];
  trades_made: number;
  current_rank: number;
  total_teams: number;
  captain_success_rate: number;
  perfect_lineups: number;
  highest_weekly_score: number;
  lowest_weekly_score: number;
  consecutive_wins: number;
  squad_size: number;
}

export interface UnlockedAchievement {
  team_id: string;
  achievement_id: string;
  unlocked_at: Date;
  points_awarded: number;
}

/**
 * All available achievements
 */
export const ACHIEVEMENTS: Achievement[] = [
  // Scoring Achievements
  {
    achievement_id: 'century_maker',
    name: 'Century Maker',
    description: 'Score 100+ points in a single week',
    badge_emoji: '💯',
    category: 'scoring',
    points_reward: 10,
    rarity: 'common',
    check_condition: (data) => data.highest_weekly_score >= 100
  },
  {
    achievement_id: 'double_century',
    name: 'Double Century',
    description: 'Score 200+ points in a single week',
    badge_emoji: '🔥',
    category: 'scoring',
    points_reward: 25,
    rarity: 'rare',
    check_condition: (data) => data.highest_weekly_score >= 200
  },
  {
    achievement_id: 'triple_century',
    name: 'Triple Century',
    description: 'Score 300+ points in a single week',
    badge_emoji: '⚡',
    category: 'scoring',
    points_reward: 50,
    rarity: 'epic',
    check_condition: (data) => data.highest_weekly_score >= 300
  },
  {
    achievement_id: 'perfect_400',
    name: 'Perfect 400',
    description: 'Score 400+ points in a single week',
    badge_emoji: '👑',
    category: 'scoring',
    points_reward: 100,
    rarity: 'legendary',
    check_condition: (data) => data.highest_weekly_score >= 400
  },

  // Lineup Achievements
  {
    achievement_id: 'captain_fantastic',
    name: 'Captain Fantastic',
    description: 'Captain scores 50+ points in a week',
    badge_emoji: '🎯',
    category: 'lineup',
    points_reward: 15,
    rarity: 'common',
    check_condition: (data) => data.captain_success_rate >= 0.8
  },
  {
    achievement_id: 'perfect_lineup',
    name: 'Perfect Lineup',
    description: 'All 5 starters score 15+ points',
    badge_emoji: '✨',
    category: 'lineup',
    points_reward: 20,
    rarity: 'rare',
    check_condition: (data) => data.perfect_lineups >= 1
  },
  {
    achievement_id: 'lineup_master',
    name: 'Lineup Master',
    description: 'Achieve 5 perfect lineups in a season',
    badge_emoji: '🌟',
    category: 'lineup',
    points_reward: 50,
    rarity: 'epic',
    check_condition: (data) => data.perfect_lineups >= 5
  },

  // Trading Achievements
  {
    achievement_id: 'wheeler_dealer',
    name: 'Wheeler Dealer',
    description: 'Complete 5 trades in a season',
    badge_emoji: '🤝',
    category: 'trading',
    points_reward: 15,
    rarity: 'common',
    check_condition: (data) => data.trades_made >= 5
  },
  {
    achievement_id: 'trade_master',
    name: 'Trade Master',
    description: 'Complete 10 trades in a season',
    badge_emoji: '💼',
    category: 'trading',
    points_reward: 30,
    rarity: 'rare',
    check_condition: (data) => data.trades_made >= 10
  },

  // Consistency Achievements
  {
    achievement_id: 'consistent_performer',
    name: 'Consistent Performer',
    description: 'Score 50+ points for 5 consecutive weeks',
    badge_emoji: '📈',
    category: 'consistency',
    points_reward: 25,
    rarity: 'rare',
    check_condition: (data) => {
      if (data.weekly_points.length < 5) return false;
      const last5 = data.weekly_points.slice(-5);
      return last5.every(pts => pts >= 50);
    }
  },
  {
    achievement_id: 'iron_man',
    name: 'Iron Man',
    description: 'Submit lineup every week of the season',
    badge_emoji: '🛡️',
    category: 'consistency',
    points_reward: 40,
    rarity: 'epic',
    check_condition: (data) => {
      // Check if lineup submitted for all weeks
      return data.lineup_history.length >= 10; // Assuming 10+ week season
    }
  },
  {
    achievement_id: 'winning_streak',
    name: 'Winning Streak',
    description: 'Win 5 consecutive H2H matchups',
    badge_emoji: '🔥',
    category: 'consistency',
    points_reward: 35,
    rarity: 'rare',
    check_condition: (data) => data.consecutive_wins >= 5
  },

  // Special Achievements
  {
    achievement_id: 'comeback_king',
    name: 'Comeback King',
    description: 'Move from bottom 3 to top 3 in standings',
    badge_emoji: '🚀',
    category: 'special',
    points_reward: 50,
    rarity: 'epic',
    check_condition: (data) => {
      // This requires historical rank tracking
      return false; // Implemented separately with rank history
    }
  },
  {
    achievement_id: 'giant_killer',
    name: 'Giant Killer',
    description: 'Beat the #1 ranked team in H2H',
    badge_emoji: '⚔️',
    category: 'special',
    points_reward: 30,
    rarity: 'rare',
    check_condition: (data) => {
      // This requires H2H result tracking
      return false; // Implemented separately
    }
  },
  {
    achievement_id: 'underdog_hero',
    name: 'Underdog Hero',
    description: 'Win the league from outside top 5',
    badge_emoji: '🦸',
    category: 'special',
    points_reward: 100,
    rarity: 'legendary',
    check_condition: (data) => {
      // Season-end achievement
      return false; // Checked at season end
    }
  },

  // Season Achievements
  {
    achievement_id: 'champion',
    name: 'Champion',
    description: 'Win the fantasy league',
    badge_emoji: '🏆',
    category: 'season',
    points_reward: 200,
    rarity: 'legendary',
    check_condition: (data) => data.current_rank === 1
  },
  {
    achievement_id: 'runner_up',
    name: 'Runner Up',
    description: 'Finish 2nd in the league',
    badge_emoji: '🥈',
    category: 'season',
    points_reward: 100,
    rarity: 'epic',
    check_condition: (data) => data.current_rank === 2
  },
  {
    achievement_id: 'top_three',
    name: 'Top Three',
    description: 'Finish in top 3',
    badge_emoji: '🥉',
    category: 'season',
    points_reward: 50,
    rarity: 'rare',
    check_condition: (data) => data.current_rank <= 3
  },
  {
    achievement_id: 'top_half',
    name: 'Top Half',
    description: 'Finish in top half of league',
    badge_emoji: '📊',
    category: 'season',
    points_reward: 20,
    rarity: 'common',
    check_condition: (data) => data.current_rank <= Math.ceil(data.total_teams / 2)
  }
];

/**
 * Check all achievements for a team
 */
export async function checkAchievements(
  teamId: string,
  leagueId: string
): Promise<UnlockedAchievement[]> {
  // Get team data
  const teamData = await getTeamData(teamId, leagueId);
  
  // Get already unlocked achievements
  const unlocked = await getUnlockedAchievements(teamId);
  const unlockedIds = new Set(unlocked.map(a => a.achievement_id));
  
  // Check each achievement
  const newlyUnlocked: UnlockedAchievement[] = [];
  
  for (const achievement of ACHIEVEMENTS) {
    // Skip if already unlocked
    if (unlockedIds.has(achievement.achievement_id)) {
      continue;
    }
    
    // Check condition
    if (achievement.check_condition(teamData)) {
      // Award achievement
      const result = await awardAchievement(teamId, achievement);
      newlyUnlocked.push(result);
    }
  }
  
  return newlyUnlocked;
}

/**
 * Get team data for achievement checking
 */
async function getTeamData(teamId: string, leagueId: string): Promise<TeamData> {
  // Get team info
  const teamResult = await sql`
    SELECT 
      team_id,
      league_id,
      total_points,
      trades_made
    FROM fantasy_teams
    WHERE team_id = ${teamId}
    AND league_id = ${leagueId}
  `;
  
  if (teamResult.length === 0) {
    throw new Error('Team not found');
  }
  
  const team = teamResult[0];
  
  // Get weekly points
  const weeklyPoints = await sql`
    SELECT total_points
    FROM fantasy_lineups
    WHERE team_id = ${teamId}
    AND league_id = ${leagueId}
    ORDER BY round_number ASC
  `;
  
  // Get lineup history
  const lineupHistory = await sql`
    SELECT *
    FROM fantasy_lineups
    WHERE team_id = ${teamId}
    AND league_id = ${leagueId}
    ORDER BY round_number ASC
  `;
  
  // Get current rank
  const rankResult = await sql`
    SELECT 
      team_id,
      ROW_NUMBER() OVER (ORDER BY total_points DESC) as rank
    FROM fantasy_teams
    WHERE league_id = ${leagueId}
  `;
  
  const currentRank = rankResult.find((r: any) => r.team_id === teamId)?.rank || 0;
  
  // Get total teams
  const totalTeamsResult = await sql`
    SELECT COUNT(*) as count
    FROM fantasy_teams
    WHERE league_id = ${leagueId}
  `;
  
  const totalTeams = Number(totalTeamsResult[0].count);
  
  // Calculate stats
  const weeklyPointsArray = weeklyPoints.map((w: any) => Number(w.total_points));
  const highestWeeklyScore = Math.max(...weeklyPointsArray, 0);
  const lowestWeeklyScore = weeklyPointsArray.length > 0 ? Math.min(...weeklyPointsArray) : 0;
  
  // Get squad size
  const squadResult = await sql`
    SELECT COUNT(*) as count
    FROM fantasy_squad
    WHERE team_id = ${teamId}
  `;
  
  const squadSize = Number(squadResult[0].count);
  
  return {
    team_id: teamId,
    league_id: leagueId,
    total_points: Number(team.total_points),
    weekly_points: weeklyPointsArray,
    lineup_history: lineupHistory,
    trades_made: Number(team.trades_made || 0),
    current_rank: Number(currentRank),
    total_teams: totalTeams,
    captain_success_rate: 0.8, // TODO: Calculate from lineup history
    perfect_lineups: 0, // TODO: Calculate from lineup history
    highest_weekly_score: highestWeeklyScore,
    lowest_weekly_score: lowestWeeklyScore,
    consecutive_wins: 0, // TODO: Calculate from H2H results
    squad_size: squadSize
  };
}

/**
 * Get unlocked achievements for a team
 */
export async function getUnlockedAchievements(teamId: string): Promise<UnlockedAchievement[]> {
  const results = await sql`
    SELECT 
      team_id,
      achievement_id,
      unlocked_at,
      points_awarded
    FROM fantasy_team_achievements
    WHERE team_id = ${teamId}
    ORDER BY unlocked_at DESC
  `;
  
  return results.map((r: any) => ({
    team_id: r.team_id,
    achievement_id: r.achievement_id,
    unlocked_at: r.unlocked_at,
    points_awarded: Number(r.points_awarded)
  }));
}

/**
 * Award an achievement to a team
 */
async function awardAchievement(
  teamId: string,
  achievement: Achievement
): Promise<UnlockedAchievement> {
  // Insert achievement record
  await sql`
    INSERT INTO fantasy_team_achievements (
      team_id,
      achievement_id,
      unlocked_at,
      points_awarded
    ) VALUES (
      ${teamId},
      ${achievement.achievement_id},
      NOW(),
      ${achievement.points_reward}
    )
    ON CONFLICT (team_id, achievement_id) DO NOTHING
  `;
  
  // Award bonus points to team
  await sql`
    UPDATE fantasy_teams
    SET total_points = total_points + ${achievement.points_reward}
    WHERE team_id = ${teamId}
  `;
  
  console.log(`[Achievements] ${teamId} unlocked: ${achievement.name} (+${achievement.points_reward} pts)`);
  
  return {
    team_id: teamId,
    achievement_id: achievement.achievement_id,
    unlocked_at: new Date(),
    points_awarded: achievement.points_reward
  };
}

/**
 * Get achievement details by ID
 */
export function getAchievementById(achievementId: string): Achievement | undefined {
  return ACHIEVEMENTS.find(a => a.achievement_id === achievementId);
}

/**
 * Get all achievements with unlock status for a team
 */
export async function getAchievementsWithStatus(teamId: string) {
  const unlocked = await getUnlockedAchievements(teamId);
  const unlockedIds = new Set(unlocked.map(a => a.achievement_id));
  
  return ACHIEVEMENTS.map(achievement => ({
    ...achievement,
    is_unlocked: unlockedIds.has(achievement.achievement_id),
    unlocked_at: unlocked.find(u => u.achievement_id === achievement.achievement_id)?.unlocked_at
  }));
}

/**
 * Get achievements by category
 */
export function getAchievementsByCategory(category: AchievementCategory): Achievement[] {
  return ACHIEVEMENTS.filter(a => a.category === category);
}

/**
 * Get achievements by rarity
 */
export function getAchievementsByRarity(rarity: Achievement['rarity']): Achievement[] {
  return ACHIEVEMENTS.filter(a => a.rarity === rarity);
}

/**
 * Calculate achievement completion percentage for a team
 */
export async function getAchievementProgress(teamId: string): Promise<{
  total: number;
  unlocked: number;
  percentage: number;
  points_earned: number;
}> {
  const unlocked = await getUnlockedAchievements(teamId);
  const pointsEarned = unlocked.reduce((sum, a) => sum + a.points_awarded, 0);
  
  return {
    total: ACHIEVEMENTS.length,
    unlocked: unlocked.length,
    percentage: Math.round((unlocked.length / ACHIEVEMENTS.length) * 100),
    points_earned: pointsEarned
  };
}
