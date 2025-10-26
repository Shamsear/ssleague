// Fantasy League System Type Definitions
// Phase 1: Enhanced with lineups, captain system, and team bonuses

export type FantasyLeagueStatus = 'draft' | 'active' | 'completed';
export type TransferStatus = 'pending' | 'approved' | 'rejected';
export type TransferType = 'trade' | 'drop_add';
export type ScoringRuleType = 
  | 'goals_scored' 
  | 'goals_conceded' 
  | 'assists'
  | 'clean_sheet' 
  | 'motm' 
  | 'fine_goals' 
  | 'win' 
  | 'draw' 
  | 'loss'
  | 'substitution_penalty'
  | 'yellow_card'
  | 'red_card'
  | 'hat_trick'
  | 'brace'
  | 'full_90_minutes';

export type PlayerPosition = 'FWD' | 'MID' | 'DEF' | 'GK';

export type BonusType = 
  | 'win'
  | 'draw'
  | 'clean_sheet'
  | 'high_scoring'
  | 'weekly_top'
  | 'winning_streak'
  | 'top_scorer';

export interface FantasyLeague {
  id: string;
  season_id: string;
  name: string;
  status: FantasyLeagueStatus;
  draft_date?: Date;
  created_by: string;
  created_at: Date;
  updated_at?: Date;
}

export interface FantasyTeam {
  id: string;
  fantasy_league_id: string;
  team_id: string;              // Links to real team
  team_name: string;
  owner_name: string;
  owner_uid: string;
  
  // Phase 1: Affiliation (NEW)
  affiliated_real_team_id: string; // Links to real team
  affiliated_team_name: string;    // Cached for display
  
  // Phase 1: Dual Point Tracking (NEW - replaces total_points)
  fantasy_player_points: number;       // Points from drafted players only
  fantasy_team_bonus_points: number;   // Points from team performance bonuses
  fantasy_total_points: number;        // Sum of above two
  
  rank: number;
  player_count: number;         // Number of drafted players
  
  // Phase 1: Weekly tracking (NEW)
  last_lineup_update?: Date | null;
  current_matchday_points?: number;
  
  created_at: Date;
  updated_at?: Date;
}

export interface FantasyDraft {
  id: string;
  fantasy_league_id: string;
  fantasy_team_id: string;
  real_player_id: string;
  player_name: string;
  draft_price?: number;         // Optional auction price
  draft_order: number;          // Pick number in draft
  drafted_at: Date;
  drafted_by: string;           // Committee admin UID
}

export interface FantasyScoringRule {
  id: string;
  fantasy_league_id: string;
  rule_type: ScoringRuleType;
  points_value: number;         // Can be positive or negative
  description: string;
  is_active: boolean;
  
  // Phase 1: Position-specific scoring (NEW)
  applies_to_positions?: PlayerPosition[]; // If empty, applies to all
  multiplier?: number;                      // e.g., 1.5 for special conditions
  conditions?: {
    min_value?: number;                    // e.g., 3 for hat-trick
    opponent_rank?: 'top4' | 'bottom4';
    home_away?: 'home' | 'away';
  };
  
  created_at: Date;
  updated_at?: Date;
}

export interface FantasyPlayerPoints {
  id: string;
  fantasy_league_id: string;
  fantasy_team_id: string;
  real_player_id: string;
  player_name: string;
  fixture_id: string;
  round_number: number;
  
  // Match statistics
  goals_scored: number;
  goals_conceded: number;
  result: 'win' | 'draw' | 'loss';
  is_motm: boolean;
  fine_goals: number;           // Penalty/fine goals against team
  substitution_penalty: number;  // If player was substituted
  is_clean_sheet: boolean;      // No goals conceded
  
  // Points breakdown
  points_breakdown: {
    goals: number;
    conceded: number;
    result: number;
    motm: number;
    fines: number;
    clean_sheet: number;
    substitution: number;
  };
  
  total_points: number;
  calculated_at: Date;
  created_at: Date;
}

export interface FantasyTransfer {
  id: string;
  fantasy_league_id: string;
  fantasy_team_id: string;
  player_out_id: string;
  player_out_name: string;
  player_in_id: string;
  player_in_name: string;
  transfer_type: TransferType;
  transfer_reason?: string;
  requested_by: string;         // Team owner UID
  approved_by?: string;         // Committee admin UID
  status: TransferStatus;
  rejection_reason?: string;
  requested_at: Date;
  processed_at?: Date;
}

// Leaderboard entry (computed view)
export interface FantasyLeaderboardEntry {
  rank: number;
  fantasy_team_id: string;
  team_name: string;
  owner_name: string;
  total_points: number;
  player_count: number;
  last_round_points?: number;
}

// Player stats view (for scouting)
export interface FantasyPlayerStats {
  real_player_id: string;
  player_name: string;
  fantasy_team_id?: string;     // null if not drafted
  fantasy_team_name?: string;
  total_points: number;
  matches_played: number;
  average_points: number;
  goals_scored: number;
  motm_count: number;
  is_available: boolean;        // Not drafted yet
}

// Draft assignment request (from committee)
export interface DraftAssignmentRequest {
  fantasy_league_id: string;
  assignments: Array<{
    fantasy_team_id: string;
    real_player_id: string;
    draft_order: number;
    draft_price?: number;
  }>;
}

// Scoring rules configuration
export interface ScoringRulesConfig {
  fantasy_league_id: string;
  rules: Array<{
    rule_type: ScoringRuleType;
    points_value: number;
    description: string;
  }>;
}

// ============================================================================
// PHASE 1: NEW TYPES
// ============================================================================

/**
 * Team with fantasy league fields
 */
export interface TeamWithFantasy {
  id: string;
  team_name: string;
  team_code: string;
  team_logo_url: string;
  owner_uid: string;
  manager_name: string;                    // NEW: Manager's name
  season_id: string;
  
  // Fantasy League Participation (NEW)
  fantasy_participating: boolean;          // Has team opted in?
  fantasy_joined_at: number | null;        // When joined
  fantasy_league_id: string | null;        // Current league
  
  // Fantasy Points (NEW)
  fantasy_player_points: number;
  fantasy_team_bonus_points: number;
  fantasy_total_points: number;
}

/**
 * Fantasy Lineup (NEW COLLECTION)
 * Weekly lineup with captain selection
 */
export interface FantasyLineup {
  id: string;
  fantasy_league_id: string;
  fantasy_team_id: string;
  matchday: number;
  season_id: string;
  
  // Lineup Structure (9 starters)
  starters: {
    forwards: string[];      // 2 players
    midfielders: string[];   // 3 players
    defenders: string[];     // 3 players
    goalkeeper: string;      // 1 player
  };
  
  // Captain System
  captain_id: string;          // 2x points
  vice_captain_id: string;     // Backup
  
  // Bench
  bench: string[];
  bench_order: number[];
  
  // Lock Status
  is_locked: boolean;
  locked_at: Date | null;
  lock_deadline: Date;
  
  // Points (calculated after matches)
  player_points: number;
  captain_bonus: number;
  team_bonus_points: number;
  total_points: number;
  
  created_at: Date;
  updated_at: Date;
  submitted_at: Date | null;
}

/**
 * Fantasy Team Bonus (NEW COLLECTION)
 * Passive bonuses from affiliated team performance
 */
export interface FantasyTeamBonus {
  id: string;
  fantasy_league_id: string;
  fantasy_team_id: string;
  affiliated_real_team_id: string;
  
  matchday: number;
  season_id: string;
  
  bonus_type: BonusType;
  points_awarded: number;
  reason: string;
  
  trigger_match_id: string | null;
  trigger_data: {
    home_team: string;
    away_team: string;
    score: string;
    result: 'win' | 'draw' | 'loss';
  } | null;
  
  awarded_at: Date;
  calculated_by: string;
}

/**
 * Constants
 */
export const BONUS_RULES = {
  WIN: 5,
  DRAW: 1,
  CLEAN_SHEET: 3,
  HIGH_SCORING: 2,
  WEEKLY_TOP: 10,
  WINNING_STREAK: 5,
  TOP_SCORER: 3
} as const;

export const LINEUP_REQUIREMENTS = {
  FORWARDS: 2,
  MIDFIELDERS: 3,
  DEFENDERS: 3,
  GOALKEEPER: 1,
  TOTAL_STARTERS: 9,
  MAX_BENCH: 6,
  MAX_ROSTER: 15
} as const;

export const CAPTAIN_MULTIPLIERS = {
  CAPTAIN: 2.0,
  VICE_CAPTAIN: 1.0
} as const;
