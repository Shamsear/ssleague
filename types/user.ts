export type UserRole = 'super_admin' | 'committee_admin' | 'team';

export interface BaseUser {
  uid: string;
  email: string;
  username: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  isApproved: boolean; // Super admin approval status (required for team accounts)
  approvedBy?: string; // UID of super admin who approved
  approvedAt?: Date; // When the account was approved
}

export interface SuperAdmin extends BaseUser {
  role: 'super_admin';
  permissions: string[];
}

export interface CommitteeAdmin extends BaseUser {
  role: 'committee_admin';
  seasonId: string; // Each committee admin is assigned to a specific season
  seasonName?: string;
  seasonYear?: string;
  committeeId?: string;
  committeeName?: string;
  permissions: string[];
  canManageTeams: boolean;
  canManageAuctions: boolean;
}

export interface Team extends BaseUser {
  role: 'team';
  teamName: string;
  teamLogo?: string;
  players: string[];
  committeeId?: string;
}

export type User = SuperAdmin | CommitteeAdmin | Team;

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}
