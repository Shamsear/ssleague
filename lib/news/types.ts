import { Timestamp } from 'firebase/firestore';

// News event types that trigger auto-generation
export type NewsEventType =
  // Player registration events
  | 'player_milestone'
  | 'registration_phase_change'
  | 'confirmed_slots_filled'
  
  // Team events
  | 'team_registered'
  | 'team_players_assigned'
  | 'team_roster_complete'
  
  // Auction events
  | 'auction_scheduled'
  | 'auction_started'
  | 'auction_completed'
  | 'player_sold'
  | 'auction_highlights'
  
  // Fantasy events
  | 'fantasy_opened'
  | 'fantasy_draft_complete'
  | 'fantasy_weekly_winner'
  | 'fantasy_standings_update'
  
  // Match events
  | 'match_scheduled'
  | 'match_result'
  | 'player_of_match'
  | 'tournament_standings'
  | 'semifinals_result'
  | 'finals_result'
  
  // Season events
  | 'season_launched'
  | 'season_winner'
  
  // Manual
  | 'manual';

// News categories for filtering
export type NewsCategory =
  | 'registration'
  | 'team'
  | 'auction'
  | 'fantasy'
  | 'match'
  | 'announcement'
  | 'milestone';

// Who generated the news
export type GeneratedBy = 'ai' | 'admin';

// News item metadata (event-specific data)
export interface NewsMetadata {
  // Player registration
  player_count?: number;
  milestone_number?: number;
  phase_from?: string;
  phase_to?: string;
  
  // Team
  team_id?: string;
  team_name?: string;
  player_ids?: string[];
  
  // Auction
  auction_id?: string;
  player_id?: string;
  player_name?: string;
  team_winning?: string;
  winning_bid?: number;
  total_spent?: number;
  highlights?: Array<{
    player_name: string;
    team_name: string;
    amount: number;
  }>;
  
  // Fantasy
  fantasy_league_id?: string;
  winner_name?: string;
  winner_score?: number;
  
  // Match
  match_id?: string;
  home_team?: string;
  away_team?: string;
  home_score?: number;
  away_score?: number;
  winner?: string;
  player_of_match?: string;
  
  // Generic
  [key: string]: any;
}

// Main news item structure (Firestore)
export interface NewsItem {
  id: string;
  title: string;
  content: string; // Can be markdown
  summary?: string; // Short summary for cards
  category: NewsCategory;
  event_type: NewsEventType;
  season_id?: string;
  season_name?: string;
  
  // Publishing
  is_published: boolean;
  published_at?: Timestamp | Date;
  created_at: Timestamp | Date;
  updated_at?: Timestamp | Date;
  
  // Generation
  generated_by: GeneratedBy;
  edited_by_admin?: boolean;
  
  // Metadata
  metadata?: NewsMetadata;
  
  // Media
  image_url?: string;
  
  // SEO
  slug?: string;
}

// Input for AI news generation
export interface NewsGenerationInput {
  event_type: NewsEventType;
  category: NewsCategory;
  season_id?: string;
  season_name?: string;
  metadata: NewsMetadata;
  context?: string; // Additional context for AI
}

// AI generation result
export interface NewsGenerationResult {
  success: boolean;
  title?: string;
  content?: string;
  summary?: string;
  error?: string;
}
