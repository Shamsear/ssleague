export type SeasonStatus = 'draft' | 'active' | 'ongoing' | 'completed';
export type SeasonType = 'single' | 'multi'; // single: seasons 1-15, multi: season 16+
export type PlayerCategory = 'legend' | 'classic';

export interface Season {
  id: string;
  name: string;
  year: string;
  season_number?: number; // For historical seasons imported from Excel
  type: SeasonType; // Determines if contracts span multiple seasons
  isActive: boolean;
  status: SeasonStatus;
  registrationOpen: boolean;
  is_team_registration_open?: boolean;
  is_player_registration_open?: boolean;
  startDate?: Date;
  endDate?: Date;
  totalTeams: number;
  totalRounds: number;
  purseAmount?: number; // Legacy: for single-season type
  maxPlayersPerTeam?: number;
  
  // Multi-season specific fields (Season 16+)
  dollar_budget?: number; // Initial $ budget for real players (default: 1000)
  euro_budget?: number; // Initial € budget for football players (default: 10000)
  min_real_players?: number; // Minimum real players per team (default: 5)
  max_real_players?: number; // Maximum real players per team (default: 7)
  max_football_players?: number; // Maximum football players per team (default: 25)
  category_fine_amount?: number; // Fine for not meeting category requirements (default: 20)
  
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSeasonData {
  name: string;
  year: string;
  season_number?: number; // Sequential season number
  type?: SeasonType; // Defaults to 'single' for historical, 'multi' for new seasons
  startDate?: Date;
  endDate?: Date;
  purseAmount?: number;
  maxPlayersPerTeam?: number;
  totalRounds?: number;
  
  // Multi-season specific (optional)
  dollar_budget?: number;
  euro_budget?: number;
  min_real_players?: number;
  max_real_players?: number;
  max_football_players?: number;
  category_fine_amount?: number;
}
