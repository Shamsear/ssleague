/**
 * Tiebreaker Type Definitions
 * For Last Person Standing tiebreaker auction system
 */

export type TiebreakerStatus = 'pending' | 'active' | 'completed' | 'cancelled' | 'auto_finalize_pending';

export type TeamTiebreakerStatus = 'active' | 'withdrawn';

export interface Tiebreaker {
  id: string;
  round_id: string;
  round_name: string;
  season_id: string;
  player_name: string;
  player_team: string;
  player_position: string;
  status: TiebreakerStatus;
  tie_amount: number;
  tied_team_count: number;
  current_highest_bid: number;
  current_highest_team_id: string | null;
  start_time: string | null;
  last_activity_time: string | null;
  max_end_time: string | null;
  time_remaining: string | null;
  created_at: string;
}

export interface TiebreakerTeam {
  team_id: string;
  team_name: string;
  status: TeamTiebreakerStatus;
  current_bid: number | null;
  is_you?: boolean;
  joined_at: string;
  withdrawn_at: string | null;
}

export interface TiebreakerBid {
  id?: string;
  team_id: string;
  team_name: string;
  bid_amount: number;
  bid_time: string;
  is_you?: boolean;
}

export interface MyTiebreakerStatus {
  status: TeamTiebreakerStatus;
  current_bid: number | null;
  you_are_highest: boolean;
  can_bid: boolean;
  can_withdraw: boolean;
  joined_at: string;
  withdrawn_at: string | null;
}

export interface TiebreakerStatistics {
  active_teams: number;
  withdrawn_teams: number;
  total_bids: number;
}

export interface TiebreakerDetails {
  tiebreaker: Tiebreaker;
  my_status?: MyTiebreakerStatus;
  statistics: TiebreakerStatistics;
  participating_teams: TiebreakerTeam[];
  recent_bids: TiebreakerBid[];
}

export interface TiebreakerListResponse {
  all: Tiebreaker[];
  grouped: {
    active: Tiebreaker[];
    completed: Tiebreaker[];
    pending: Tiebreaker[];
    cancelled: Tiebreaker[];
  };
  count: {
    total: number;
    active: number;
    completed: number;
    pending: number;
    cancelled: number;
  };
}

export interface PlaceBidRequest {
  bid_amount: number;
}

export interface PlaceBidResponse {
  tiebreaker_id: string;
  player_name: string;
  your_bid: number;
  current_highest_bid: number;
  you_are_highest: boolean;
  teams_remaining: number;
  is_winner: boolean;
  message: string;
}

export interface WithdrawResponse {
  tiebreaker_id: string;
  player_name: string;
  withdrawn: boolean;
  teams_remaining: number;
  is_winner_determined: boolean;
  message: string;
}

export interface StartTiebreakerResponse {
  tiebreaker_id: string;
  status: TiebreakerStatus;
  player_name: string;
  tie_amount: number;
  starting_bid: number;
  participating_teams: TiebreakerTeam[];
  start_time: string;
  max_end_time: string;
}

export interface FinalizeTiebreakerResponse {
  tiebreaker_id: string;
  status: TiebreakerStatus;
  winner_team_id: string;
  winner_team_name: string;
  final_bid: number;
  player_name: string;
  message: string;
}

// WebSocket event types (for future real-time implementation)
export interface TiebreakerBidEvent {
  type: 'tiebreaker:bid';
  tiebreaker_id: string;
  team_id: string;
  team_name: string;
  bid_amount: number;
  new_highest_bid: number;
  teams_remaining: number;
}

export interface TiebreakerWithdrawEvent {
  type: 'tiebreaker:withdraw';
  tiebreaker_id: string;
  team_id: string;
  team_name: string;
  teams_remaining: number;
  is_winner_determined: boolean;
  winner_team_id?: string;
}

export interface TiebreakerCompleteEvent {
  type: 'tiebreaker:complete';
  tiebreaker_id: string;
  winner_team_id: string;
  winner_team_name: string;
  final_bid: number;
}

export type TiebreakerEvent = 
  | TiebreakerBidEvent 
  | TiebreakerWithdrawEvent 
  | TiebreakerCompleteEvent;
