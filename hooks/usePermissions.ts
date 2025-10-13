import { useAuth } from '@/contexts/AuthContext';
import {
  hasPermission,
  canAccessSeason,
  canModifySeason,
  canViewSeasonData,
  getAccessibleSeasons,
  getSeasonPermissionLevel,
  Permission,
} from '@/lib/permissions';
import { useMemo } from 'react';

/**
 * Hook to check if user has a specific permission
 */
export const useHasPermission = (permission: Permission): boolean => {
  const { user } = useAuth();
  return useMemo(() => hasPermission(user, permission), [user, permission]);
};

/**
 * Hook to check if user can access a specific season
 */
export const useCanAccessSeason = (seasonId: string): boolean => {
  const { user } = useAuth();
  return useMemo(() => canAccessSeason(user, seasonId), [user, seasonId]);
};

/**
 * Hook to check if user can modify a specific season
 */
export const useCanModifySeason = (seasonId: string): boolean => {
  const { user } = useAuth();
  return useMemo(() => canModifySeason(user, seasonId), [user, seasonId]);
};

/**
 * Hook to check if user can view season data
 */
export const useCanViewSeasonData = (seasonId: string): boolean => {
  const { user } = useAuth();
  return useMemo(() => canViewSeasonData(user, seasonId), [user, seasonId]);
};

/**
 * Hook to get accessible seasons for current user
 */
export const useAccessibleSeasons = (): 'all' | string[] => {
  const { user } = useAuth();
  return useMemo(() => getAccessibleSeasons(user), [user]);
};

/**
 * Hook to get permission level for a season
 */
export const useSeasonPermissionLevel = (seasonId: string): 'none' | 'view' | 'modify' | 'full' => {
  const { user } = useAuth();
  return useMemo(() => getSeasonPermissionLevel(user, seasonId), [user, seasonId]);
};

/**
 * Hook to check if user is super admin
 */
export const useIsSuperAdmin = (): boolean => {
  const { user } = useAuth();
  return user?.role === 'super_admin';
};

/**
 * Hook to check if user is committee admin
 */
export const useIsCommitteeAdmin = (): boolean => {
  const { user } = useAuth();
  return user?.role === 'committee_admin';
};

/**
 * Hook to get current user's season ID (for committee admins)
 */
export const useUserSeasonId = (): string | null => {
  const { user } = useAuth();
  if (user?.role === 'committee_admin') {
    return (user as any).seasonId || null;
  }
  return null;
};

/**
 * Combined permissions hook
 */
export const usePermissions = () => {
  const { user } = useAuth();
  
  return {
    user,
    isSuperAdmin: user?.role === 'super_admin',
    isCommitteeAdmin: user?.role === 'committee_admin',
    isTeam: user?.role === 'team',
    userSeasonId: user?.role === 'committee_admin' ? (user as any).seasonId : null,
    hasPermission: (permission: Permission) => hasPermission(user, permission),
    canAccessSeason: (seasonId: string) => canAccessSeason(user, seasonId),
    canModifySeason: (seasonId: string) => canModifySeason(user, seasonId),
    canViewSeasonData: (seasonId: string) => canViewSeasonData(user, seasonId),
    getSeasonPermissionLevel: (seasonId: string) => getSeasonPermissionLevel(user, seasonId),
    accessibleSeasons: getAccessibleSeasons(user),
  };
};
