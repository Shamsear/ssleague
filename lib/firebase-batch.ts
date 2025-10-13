import { adminDb } from './firebase/admin';

/**
 * Batch fetch team names from Firebase
 * Uses Promise.all for parallel execution
 */
export async function batchFetchTeamNames(
  teamIds: string[],
  seasonId: string
): Promise<Map<string, string>> {
  const teamNamesMap = new Map<string, string>();
  
  if (teamIds.length === 0) return teamNamesMap;
  
  // Remove duplicates
  const uniqueTeamIds = [...new Set(teamIds)];
  
  // Fetch all team names in parallel
  const promises = uniqueTeamIds.map(async (teamId) => {
    try {
      // Try team_seasons first
      const teamSeasonId = `${teamId}_${seasonId}`;
      const teamSeasonDoc = await adminDb.collection('team_seasons').doc(teamSeasonId).get();
      
      if (teamSeasonDoc.exists) {
        const teamName = teamSeasonDoc.data()?.team_name || teamId;
        return { teamId, teamName };
      }
      
      // Fallback to users collection
      const userDoc = await adminDb.collection('users').doc(teamId).get();
      const teamName = userDoc.exists ? userDoc.data()?.teamName || teamId : teamId;
      return { teamId, teamName };
    } catch (error) {
      console.error(`Error fetching team ${teamId}:`, error);
      return { teamId, teamName: teamId };
    }
  });
  
  const results = await Promise.all(promises);
  results.forEach(({ teamId, teamName }) => {
    teamNamesMap.set(teamId, teamName);
  });
  
  return teamNamesMap;
}

/**
 * Batch fetch user/team data from Firebase
 */
export async function batchFetchUsers(
  userIds: string[]
): Promise<Map<string, any>> {
  const usersMap = new Map<string, any>();
  
  if (userIds.length === 0) return usersMap;
  
  const uniqueUserIds = [...new Set(userIds)];
  
  const promises = uniqueUserIds.map(async (userId) => {
    try {
      const doc = await adminDb.collection('users').doc(userId).get();
      return { 
        userId, 
        data: doc.exists ? doc.data() : null 
      };
    } catch (error) {
      console.error(`Error fetching user ${userId}:`, error);
      return { userId, data: null };
    }
  });
  
  const results = await Promise.all(promises);
  results.forEach(({ userId, data }) => {
    if (data) usersMap.set(userId, data);
  });
  
  return usersMap;
}

/**
 * Batch fetch team_seasons data
 */
export async function batchFetchTeamSeasons(
  teamIds: string[],
  seasonId: string
): Promise<Map<string, any>> {
  const teamSeasonsMap = new Map<string, any>();
  
  if (teamIds.length === 0) return teamSeasonsMap;
  
  const uniqueTeamIds = [...new Set(teamIds)];
  
  const promises = uniqueTeamIds.map(async (teamId) => {
    try {
      const teamSeasonId = `${teamId}_${seasonId}`;
      const doc = await adminDb.collection('team_seasons').doc(teamSeasonId).get();
      return { 
        teamId, 
        data: doc.exists ? doc.data() : null 
      };
    } catch (error) {
      console.error(`Error fetching team_season ${teamId}_${seasonId}:`, error);
      return { teamId, data: null };
    }
  });
  
  const results = await Promise.all(promises);
  results.forEach(({ teamId, data }) => {
    if (data) teamSeasonsMap.set(teamId, data);
  });
  
  return teamSeasonsMap;
}
