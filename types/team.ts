export interface TeamStats {
  // Match Statistics
  matches_played: number;
  matches_won: number;
  matches_lost: number;
  matches_drawn: number;
  
  // Points
  points: number; // Win=3, Draw=1, Loss=0
  
  // Goals
  goals_scored: number;
  goals_conceded: number;
  goal_difference: number;
  
  // Performance
  clean_sheets: number;
  win_rate: number; // Calculated percentage
  
  // Position
  current_position?: number; // League table position
  highest_position?: number;
  lowest_position?: number;
}

export interface TeamData {
  id: string; // Custom ID format: team0001, team0002, etc.
  team_id: string; // Same as id, kept for consistency
  team_name: string;
  team_code: string;
  owner_uid?: string;
  owner_name?: string;
  owner_email?: string;
  
  // Financial (Legacy for single-season)
  balance: number; // Legacy: single currency for single-season type
  initial_balance: number;
  total_spent: number;
  spent_amount?: number; // Alias for total_spent
  
  // Multi-season dual currency (Season 16+)
  dollar_balance?: number; // $ for real players (initial: 1000)
  euro_balance?: number; // € for football players (initial: 10000)
  dollar_spent?: number; // Total $ spent on real players
  euro_spent?: number; // Total € spent on football players
  dollar_salaries_committed?: number; // Total $ salary per match
  euro_salaries_committed?: number; // Total € salary per half-season
  
  // Season
  season_id: string;
  season_name?: string;
  
  // Players
  real_players: string[]; // Array of RealPlayer IDs (sspslpsl0001, etc.)
  football_players: string[]; // Array of FootballPlayer IDs
  real_players_count: number;
  football_players_count: number;
  players_count?: number; // Total count of all players
  
  // Optional fields that may be used in various pages
  owner_phone?: string;
  description?: string;
  
  // Team Statistics
  stats: TeamStats;
  
  // Status
  is_active: boolean;
  
  // Metadata
  logo?: string; // Base64 or URL
  team_color?: string;
  
  // Historical Performance (for teams with history across multiple seasons)
  performance_history?: {
    [seasonId: string]: {
      players_count?: number;
      season_stats?: {
        matches_played?: number;
        matches_won?: number;
        matches_drawn?: number;
        matches_lost?: number;
        total_points?: number;
        total_goals?: number;
        total_conceded?: number;
        goal_difference?: number;
      };
    };
  };
  
  created_at: Date;
  updated_at: Date;
}

export interface CreateTeamData {
  team_name: string;
  team_code: string;
  owner_uid?: string;
  owner_name?: string;
  owner_email?: string;
  initial_balance: number;
  season_id: string;
  logo?: string;
  team_color?: string;
}

export interface UpdateTeamData {
  team_name?: string;
  team_code?: string;
  owner_name?: string;
  owner_email?: string;
  initial_balance?: number;
  balance?: number;
  season_id?: string;
  is_active?: boolean;
  logo?: string;
  team_color?: string;
}

export interface UpdateTeamStatsData {
  matches_played?: number;
  matches_won?: number;
  matches_lost?: number;
  matches_drawn?: number;
  points?: number;
  goals_scored?: number;
  goals_conceded?: number;
  goal_difference?: number;
  clean_sheets?: number;
  current_position?: number;
}
