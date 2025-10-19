// FootballPlayer represents virtual/in-game players acquired through auction

export type PlayerPosition = 
  | 'GK'  // Goalkeeper
  | 'CB'  // Center Back
  | 'LB'  // Left Back
  | 'RB'  // Right Back
  | 'LWB' // Left Wing Back
  | 'RWB' // Right Wing Back
  | 'DMF' // Defensive Midfielder
  | 'CMF' // Central Midfielder
  | 'AMF' // Attacking Midfielder
  | 'LMF' // Left Midfielder
  | 'RMF' // Right Midfielder
  | 'LWF' // Left Wing Forward
  | 'RWF' // Right Wing Forward
  | 'SS'  // Second Striker
  | 'CF'; // Center Forward

export type PlayerFootedness = 'Right' | 'Left' | 'Both';

export interface FootballPlayerAttributes {
  overall_rating: number; // 1-99
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
}

export interface FootballPlayerData {
  id: string; // Firestore document ID
  
  // Basic Information
  name: string;
  full_name?: string;
  age?: number;
  nationality?: string;
  
  // Position & Attributes
  primary_position: PlayerPosition;
  secondary_positions?: PlayerPosition[];
  preferred_foot: PlayerFootedness;
  attributes: FootballPlayerAttributes;
  
  // Team Association
  team_id?: string; // Current team owning this player
  team_name?: string;
  team_code?: string;
  
  // Auction Information
  base_price: number; // Starting auction price
  sold_price?: number; // Final auction price (if sold)
  is_sold: boolean;
  auction_round?: number;
  
  // Season Information
  season_id: string;
  season_name?: string;
  
  // Status
  is_available: boolean; // Available for selection
  is_injured: boolean;
  injury_details?: string;
  suspension_matches?: number; // Games suspended
  
  // Player Image/Card
  player_image?: string; // Base64 or URL
  card_type?: 'Gold' | 'Silver' | 'Bronze' | 'Legend' | 'Featured';
  
  // Stats (accumulated during season)
  matches_played: number;
  goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
  clean_sheets: number; // For goalkeepers/defenders
  
  // Metadata
  added_by?: string; // UID of admin who added
  notes?: string;
  
  // Multi-season contract fields (Season 16+)
  auction_value?: number; // € amount from in-app auction (same as sold_price, kept for clarity)
  salary_per_half_season?: number; // Calculated: auction_value × 10%
  contract_start_season?: string; // Season ID when contract starts (e.g., "16")
  contract_end_season?: string; // Season ID when contract ends (e.g., "17") - 2 seasons total
  contract_status?: 'active' | 'expired'; // Contract status
  
  created_at: Date;
  updated_at: Date;
}

export interface CreateFootballPlayerData {
  name: string;
  full_name?: string;
  age?: number;
  nationality?: string;
  primary_position: PlayerPosition;
  secondary_positions?: PlayerPosition[];
  preferred_foot: PlayerFootedness;
  attributes: FootballPlayerAttributes;
  base_price: number;
  season_id: string;
  player_image?: string;
  card_type?: 'Gold' | 'Silver' | 'Bronze' | 'Legend' | 'Featured';
  notes?: string;
}

export interface UpdateFootballPlayerData {
  name?: string;
  full_name?: string;
  age?: number;
  nationality?: string;
  primary_position?: PlayerPosition;
  secondary_positions?: PlayerPosition[];
  preferred_foot?: PlayerFootedness;
  attributes?: Partial<FootballPlayerAttributes>;
  base_price?: number;
  is_available?: boolean;
  is_injured?: boolean;
  injury_details?: string;
  suspension_matches?: number;
  player_image?: string;
  card_type?: 'Gold' | 'Silver' | 'Bronze' | 'Legend' | 'Featured';
  notes?: string;
}

export interface AssignFootballPlayerToTeamData {
  player_id: string;
  team_id: string;
  sold_price: number;
  auction_round?: number;
}

export interface UpdateFootballPlayerStatsData {
  matches_played?: number;
  goals?: number;
  assists?: number;
  yellow_cards?: number;
  red_cards?: number;
  clean_sheets?: number;
}
