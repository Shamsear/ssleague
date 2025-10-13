export type SeasonStatus = 'draft' | 'active' | 'ongoing' | 'completed';

export interface Season {
  id: string;
  name: string;
  year: string;
  isActive: boolean;
  status: SeasonStatus;
  registrationOpen: boolean;
  is_team_registration_open?: boolean;
  is_player_registration_open?: boolean;
  startDate?: Date;
  endDate?: Date;
  totalTeams: number;
  totalRounds: number;
  purseAmount?: number;
  maxPlayersPerTeam?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSeasonData {
  name: string;
  year: string;
  startDate?: Date;
  endDate?: Date;
  purseAmount?: number;
  maxPlayersPerTeam?: number;
  totalRounds?: number;
}
