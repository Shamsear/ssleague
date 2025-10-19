// RealPlayer represents actual human players who register and play for seasons
// Combines SQLAlchemy RealPlayer model structure with existing stats system

import { PlayerCategory } from './season';

export interface RealPlayerStats {
  // Match Statistics
  matches_played: number;
  matches_won: number;
  matches_lost: number;
  matches_drawn: number;
  
  // Performance Metrics
  goals_scored: number;
  assists: number;
  clean_sheets: number;
  potm?: number; // Player of the Match (nullable)
  
  // Win Rate
  win_rate: number; // Calculated percentage
  
  // Rating
  average_rating: number;
  
  // Season specific
  current_season_matches: number;
  current_season_wins: number;
}

export interface RealPlayerData {
  id: string; // Firestore document ID (same as player_id)
  player_id: string; // Unique player ID format: sspslpsl0001, sspslpsl0002, etc.
  
  // Personal Information (SQLAlchemy model fields)
  name: string; // Player's full name
  team?: string | null; // Previous/current team name (not team_id)
  
  // Additional personal info (existing fields)
  display_name?: string; // Nickname or preferred name
  email?: string;
  phone?: string;
  
  // Season and Category Assignment (SQLAlchemy model fields)
  season_id?: string | null; // Season association after registration
  season_name?: string; // Populated from season lookup
  category_id?: string | null; // Player category for bulk assignment
  category_name?: string; // Populated from category lookup
  team_id?: string | null; // Assigned team (Firestore reference)
  team_name?: string; // Populated from team lookup
  team_code?: string; // Populated from team lookup
  
  // Registration Tracking (SQLAlchemy model fields)
  is_registered: boolean; // Whether player has registered for a season
  registered_at?: Date | null; // When player registered for season
  created_at: Date; // When player was added to system
  updated_at?: Date; // Last update timestamp
  
  // Player Role (existing fields)
  role?: 'captain' | 'vice_captain' | 'player'; // Role within the team
  
  // Status (existing fields)
  is_active?: boolean;
  is_available?: boolean; // Available for matches
  
  // Statistics (existing fields - KEPT)
  stats?: RealPlayerStats;
  
  // Gaming Platform IDs (existing fields)
  psn_id?: string; // PlayStation Network ID for eFootball
  xbox_id?: string; // Xbox ID
  steam_id?: string; // Steam ID
  profile_image?: string; // Base64 or URL
  
  // Metadata (existing fields)
  joined_date?: Date;
  assigned_by?: string; // UID of committee admin who assigned
  notes?: string; // Admin notes about the player
  
  // Multi-season contract fields (Season 16+)
  star_rating?: number; // 3-10 stars (initially assigned, auto-updates based on points)
  points?: number; // Performance points (auto-calculated from matches)
  category?: PlayerCategory; // 'legend' or 'classic' (auto-assigned based on league-wide points ranking)
  auction_value?: number; // $ amount from WhatsApp auction
  salary_per_match?: number; // Calculated: (auction_value ÷ 100) × star_rating ÷ 10
  contract_start_season?: string; // Season ID when contract starts (e.g., "16")
  contract_end_season?: string; // Season ID when contract ends (e.g., "17") - 2 seasons total
  contract_status?: 'active' | 'expired'; // Contract status
}

export interface CreateRealPlayerData {
  // Required fields
  name: string; // Player's full name
  
  // Optional personal info
  display_name?: string;
  email?: string;
  phone?: string;
  
  // SQLAlchemy model fields
  team?: string | null; // Previous/current team name
  season_id?: string | null; // Season to register for
  category_id?: string | null; // Player category
  team_id?: string | null; // Assigned team
  is_registered?: boolean; // Default: false
  
  // Additional fields
  role?: 'captain' | 'vice_captain' | 'player';
  psn_id?: string;
  xbox_id?: string;
  steam_id?: string;
  notes?: string;
}

export interface UpdateRealPlayerData {
  // Personal information
  name?: string;
  display_name?: string;
  email?: string;
  phone?: string;
  
  // SQLAlchemy model fields
  team?: string | null;
  season_id?: string | null;
  category_id?: string | null;
  team_id?: string | null;
  is_registered?: boolean;
  registered_at?: Date | null;
  
  // Additional fields
  role?: 'captain' | 'vice_captain' | 'player';
  is_active?: boolean;
  is_available?: boolean;
  psn_id?: string;
  xbox_id?: string;
  steam_id?: string;
  profile_image?: string;
  notes?: string;
}

export interface UpdateRealPlayerStatsData {
  matches_played?: number;
  matches_won?: number;
  matches_lost?: number;
  matches_drawn?: number;
  goals_scored?: number;
  assists?: number;
  clean_sheets?: number;
  average_rating?: number;
}

// RealPlayerStatsDocument represents season-specific stats in the realplayerstats collection
// Each player can have multiple stat documents (one per season)
export interface RealPlayerStatsDocument {
  id: string; // Firestore document ID
  player_id: string; // Reference to realplayers document
  player_name: string; // Player name for easy querying
  season_id: string; // Reference to season document
  season_name?: string; // Populated from season lookup
  
  // Season-specific assignments
  team: string; // Team name for this season
  team_id?: string; // Reference to team document
  category: string; // Player category for this season (RED, BLACK, BLUE, etc.)
  
  // Season statistics
  stats: RealPlayerStats;
  
  // Metadata
  created_at: Date;
  updated_at: Date;
}
