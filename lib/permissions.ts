import { User, CommitteeAdmin, SuperAdmin } from '@/types/user';

export type Permission = 
  | 'view_seasons'
  | 'manage_seasons'
  | 'view_teams'
  | 'manage_teams'
  | 'view_players'
  | 'manage_players'
  | 'view_auctions'
  | 'manage_auctions'
  | 'view_users'
  | 'manage_users'
  | 'create_invites'
  | 'manage_invites';

/**
 * Check if a user has a specific permission
 */
export const hasPermission = (user: User | null, permission: Permission): boolean => {
  if (!user) return false;

  // Super admin has all permissions
  if (user.role === 'super_admin') {
    return true;
  }

  // Committee admin has specific permissions
  if (user.role === 'committee_admin') {
    const admin = user as CommitteeAdmin;
    
    switch (permission) {
      case 'view_seasons':
        return true; // Can view all seasons
      case 'manage_seasons':
        return false; // Cannot manage seasons
      case 'view_teams':
      case 'manage_teams':
        return admin.canManageTeams;
      case 'view_players':
      case 'manage_players':
        return true; // All admins can manage players
      case 'view_auctions':
      case 'manage_auctions':
        return admin.canManageAuctions;
      case 'view_users':
        return true; // Can view users in their season
      case 'manage_users':
      case 'create_invites':
      case 'manage_invites':
        return false; // Only super admin
      default:
        return false;
    }
  }

  // Teams have no admin permissions
  return false;
};

/**
 * Check if a user can access a specific season
 */
export const canAccessSeason = (user: User | null, seasonId: string): boolean => {
  if (!user) return false;

  // Super admin can access all seasons
  if (user.role === 'super_admin') {
    return true;
  }

  // Committee admin can only access their assigned season
  if (user.role === 'committee_admin') {
    const admin = user as CommitteeAdmin;
    return admin.seasonId === seasonId;
  }

  // Teams can view their season
  if (user.role === 'team') {
    // Teams are typically associated with seasons through other means
    // This would need to be implemented based on your team structure
    return true;
  }

  return false;
};

/**
 * Check if a user can modify a specific season
 */
export const canModifySeason = (user: User | null, seasonId: string): boolean => {
  if (!user) return false;

  // Only super admin can modify seasons
  if (user.role === 'super_admin') {
    return true;
  }

  // Committee admins can modify content within their season, but not the season itself
  if (user.role === 'committee_admin') {
    const admin = user as CommitteeAdmin;
    return admin.seasonId === seasonId; // Can modify content in their season
  }

  return false;
};

/**
 * Check if a user can view data for a specific season
 */
export const canViewSeasonData = (user: User | null, seasonId: string): boolean => {
  if (!user) return false;

  // Super admin can view all
  if (user.role === 'super_admin') {
    return true;
  }

  // Committee admin can view their season's data
  if (user.role === 'committee_admin') {
    const admin = user as CommitteeAdmin;
    return admin.seasonId === seasonId;
  }

  return false;
};

/**
 * Get accessible seasons for a user
 * Returns 'all' for super admin, or array of season IDs for committee admin
 */
export const getAccessibleSeasons = (user: User | null): 'all' | string[] => {
  if (!user) return [];

  if (user.role === 'super_admin') {
    return 'all';
  }

  if (user.role === 'committee_admin') {
    const admin = user as CommitteeAdmin;
    return [admin.seasonId];
  }

  return [];
};

/**
 * Filter seasons based on user permissions
 */
export const filterSeasonsByPermission = <T extends { id: string }>(
  user: User | null,
  seasons: T[]
): T[] => {
  if (!user) return [];

  const accessibleSeasons = getAccessibleSeasons(user);
  
  if (accessibleSeasons === 'all') {
    return seasons;
  }

  return seasons.filter(season => accessibleSeasons.includes(season.id));
};

/**
 * Get permission level for a season
 */
export const getSeasonPermissionLevel = (
  user: User | null,
  seasonId: string
): 'none' | 'view' | 'modify' | 'full' => {
  if (!user) return 'none';

  if (user.role === 'super_admin') {
    return 'full'; // Full control over all seasons
  }

  if (user.role === 'committee_admin') {
    const admin = user as CommitteeAdmin;
    if (admin.seasonId === seasonId) {
      return 'modify'; // Can modify content within their season
    } else {
      return 'view'; // Can view other seasons but not modify
    }
  }

  return 'none';
};

/**
 * Require specific permission or throw error
 */
export const requirePermission = (user: User | null, permission: Permission): void => {
  if (!hasPermission(user, permission)) {
    throw new Error(`You don't have permission to: ${permission}`);
  }
};

/**
 * Require season access or throw error
 */
export const requireSeasonAccess = (user: User | null, seasonId: string): void => {
  if (!canAccessSeason(user, seasonId)) {
    throw new Error('You don\'t have access to this season');
  }
};

/**
 * Get display name for permission level
 */
export const getPermissionLevelDisplay = (level: 'none' | 'view' | 'modify' | 'full'): string => {
  switch (level) {
    case 'full':
      return 'Full Access';
    case 'modify':
      return 'Can Modify';
    case 'view':
      return 'View Only';
    case 'none':
      return 'No Access';
  }
};
