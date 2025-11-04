import { Timestamp } from 'firebase/firestore';

// Language options
export type NewsLanguage = 'en' | 'ml';

// Tone variations
export type NewsTone = 'neutral' | 'funny' | 'harsh' | 'dramatic';

// Reporter personas
export interface ReporterPersona {
  name_en: string;
  name_ml: string;
  style: string;
  personality: string;
}

export const REPORTERS: Record<NewsLanguage, ReporterPersona> = {
  en: {
    name_en: 'Alex Thompson',
    name_ml: 'അലക്സ് തോംസൺ',
    style: 'Professional sports journalist',
    personality: 'Witty, analytical, knows when to be serious or sarcastic'
  },
  ml: {
    name_en: 'Rajesh Nair',
    name_ml: 'രാജേഷ് നായർ',
    style: 'Local sports commentator',
    personality: 'Passionate, entertaining, connects with Malayalam audience'
  }
};

// News event types that trigger auto-generation
export type NewsEventType =
  // Player registration events
  | 'player_milestone'
  | 'registration_phase_change'
  | 'registration_opening'
  | 'registration_extended'
  | 'registration_closed'
  | 'waitlist_opened'
  | 'waitlist_promoted'
  | 'early_bird_surge'
  
  // Team events
  | 'team_formed'
  | 'team_players_assigned'
  | 'team_roster_complete'
  | 'team_captain_announced' // Fantasy only
  | 'team_budget_crisis'
  | 'team_budget_surplus'
  | 'star_signing'
  | 'surprise_signing'
  | 'player_released'
  
  // Auction events
  | 'auction_scheduled'
  | 'auction_started'
  | 'auction_completed'
  | 'player_sold'
  | 'auction_highlights'
  | 'tiebreaker_battle' // For tiebreaker rounds
  | 'last_person_standing' // For open bidding bulk tiebreakers
  | 'record_breaking_bid'
  | 'bargain_steal'
  | 'player_unsold'
  | 'last_second_snipe'
  | 'overpay_disaster'
  | 'budget_depletion'
  
  // Contract & Transfer events
  | 'contract_expiring'
  | 'contract_extended'
  | 'free_agent_available'
  | 'transfer_completed'
  | 'transfer_rumor'
  
  // Fantasy events
  | 'fantasy_opened'
  | 'fantasy_draft_complete'
  | 'fantasy_weekly_winner'
  | 'fantasy_standings_update'
  | 'fantasy_captain_fail'
  | 'fantasy_hero'
  | 'fantasy_bust'
  | 'fantasy_perfect_week'
  | 'fantasy_disaster_week'
  
  // Lineup events
  | 'lineup_locked'
  | 'lineup_not_submitted'
  | 'lineup_auto_locked'
  | 'category_violation'
  | 'substitution_made'
  
  // Match events
  | 'match_scheduled'
  | 'match_result'
  | 'comeback_victory'
  | 'thrashing'
  | 'last_gasp_winner'
  | 'penalty_drama'
  | 'upset_shock'
  | 'hat_trick'
  | 'clean_sheet_masterclass'
  | 'goalkeeper_howler'
  | 'red_card_controversy'
  | 'tactical_masterclass'
  | 'tactical_disaster'
  | 'unbeaten_run'
  | 'losing_streak'
  | 'draw_bore'
  | 'player_of_match'
  | 'semifinals_result'
  | 'finals_result'
  
  // Player performance events
  | 'player_form_explosion'
  | 'player_form_crisis'
  | 'star_rating_upgrade'
  | 'star_rating_downgrade'
  | 'category_promotion'
  | 'category_demotion'
  | 'player_debut'
  | 'player_injury'
  | 'player_return'
  | 'player_milestone_goals'
  | 'player_milestone_assists'
  
  // Standings events
  | 'tournament_standings'
  | 'league_leaders_change'
  | 'relegation_battle'
  | 'top_4_race'
  | 'golden_boot_race'
  | 'golden_glove_race'
  
  // Awards events
  | 'awards_nominations'
  | 'golden_boot_winner'
  | 'golden_glove_winner'
  | 'best_attacker_winner'
  | 'best_midfielder_winner'
  | 'best_defender_winner'
  | 'best_goalkeeper_winner'
  | 'most_assists_winner'
  | 'manager_of_season'
  
  // Season events
  | 'season_launched'
  | 'season_format_reveal'
  | 'season_rules_change'
  | 'mid_season_review'
  | 'season_winner'
  | 'season_stats_recap'
  
  // Poll results
  | 'poll_results'
  
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
  
  // Language & Tone
  language: NewsLanguage;
  tone: NewsTone;
  reporter_name: string;
  
  // Metadata
  metadata?: NewsMetadata;
  
  // Media
  image_url?: string;
  
  // Poll integration
  has_poll?: boolean;
  poll_id?: string;
  
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
  language?: NewsLanguage; // Default 'en'
  tone?: NewsTone; // Auto-determined if not provided
}

// AI generation result
export interface NewsGenerationResult {
  success: boolean;
  title?: string;
  content?: string;
  summary?: string;
  error?: string;
}

// ============================================
// POLL SYSTEM TYPES
// ============================================

export type PollType = 
  | 'match_prediction'
  | 'player_of_match'
  | 'daily_player'
  | 'daily_team'
  | 'weekly_player'
  | 'weekly_team'
  | 'weekly_manager'
  | 'season_golden_boot'
  | 'season_golden_glove'
  | 'season_champion'
  | 'season_best_signing'
  | 'season_breakout_player'
  | 'season_manager';

export type PollStatus = 'active' | 'closed';

export interface PollOption {
  id: string;
  text_en: string;
  text_ml?: string;
  team_id?: string;
  player_id?: string;
  votes: number;
  percentage?: number;
}

export interface Poll {
  id: string;
  poll_id: string;
  news_id?: string;
  season_id: string;
  
  poll_type: PollType;
  title_en: string;
  title_ml?: string;
  description_en?: string;
  description_ml?: string;
  
  // Related entities
  related_fixture_id?: string;
  related_round_id?: string;
  related_matchday_date?: string;
  
  options: PollOption[];
  
  status: PollStatus;
  opens_at: Date | string;
  closes_at: Date | string;
  result_announced_at?: Date | string;
  
  winning_option_id?: string;
  total_votes: number;
  
  created_at: Date | string;
  created_by?: string;
}

export interface PollVote {
  id: string;
  poll_id: string;
  user_id: string;
  user_name?: string;
  selected_option_id: string;
  is_correct?: boolean;
  voted_at: Date | string;
}
