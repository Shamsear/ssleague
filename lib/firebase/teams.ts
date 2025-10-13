import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './config';
import { TeamData, CreateTeamData, UpdateTeamData, TeamStats, UpdateTeamStatsData } from '@/types/team';
import { getSeasonById } from './seasons';
import { getISTNow, timestampToIST } from '../utils/timezone';

// Convert Firestore timestamp to IST Date
const convertTimestamp = (timestamp: unknown): Date => {
  if (timestamp instanceof Timestamp) {
    return timestampToIST(timestamp);
  }
  if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp) {
    return timestampToIST(timestamp as Timestamp);
  }
  return getISTNow();
};

// Generate custom team ID (team0001, team0002, etc.)
const generateTeamId = async (): Promise<string> => {
  const prefix = 'team';
  
  try {
    // Get all teams to find the highest number
    const teamsRef = collection(db, 'teams');
    const querySnapshot = await getDocs(teamsRef);
    
    let maxNumber = 0;
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.team_id && data.team_id.startsWith(prefix)) {
        const numberPart = parseInt(data.team_id.substring(prefix.length));
        if (!isNaN(numberPart) && numberPart > maxNumber) {
          maxNumber = numberPart;
        }
      }
    });
    
    const nextNumber = maxNumber + 1;
    const paddedNumber = nextNumber.toString().padStart(4, '0');
    return `${prefix}${paddedNumber}`;
  } catch (error) {
    console.error('Error generating team ID:', error);
    // Fallback to random number if query fails
    const randomNumber = Math.floor(Math.random() * 10000);
    return `${prefix}${randomNumber.toString().padStart(4, '0')}`;
  }
};

// Initialize empty team stats
const initializeTeamStats = (): TeamStats => ({
  matches_played: 0,
  matches_won: 0,
  matches_lost: 0,
  matches_drawn: 0,
  points: 0,
  goals_scored: 0,
  goals_conceded: 0,
  goal_difference: 0,
  clean_sheets: 0,
  win_rate: 0,
});

// Get all teams
export const getAllTeams = async (): Promise<TeamData[]> => {
  try {
    // Use team_seasons collection instead of teams
    const teamsRef = collection(db, 'team_seasons');
    
    // Query with orderBy using joined_at field
    let querySnapshot;
    try {
      const q = query(teamsRef, orderBy('joined_at', 'desc'));
      querySnapshot = await getDocs(q);
    } catch (orderByError) {
      // Fallback to simple query without orderBy if index doesn't exist
      querySnapshot = await getDocs(teamsRef);
    }
    
    const teams: TeamData[] = [];
    for (const docSnap of querySnapshot.docs) {
      const data = docSnap.data();
      
      // Fetch season name if season_id exists
      let seasonName = '';
      if (data.season_id) {
        try {
          const season = await getSeasonById(data.season_id);
          seasonName = season?.name || '';
        } catch (error) {
          console.error('Error fetching season:', error);
        }
      }
      
      // Map team_seasons data structure to TeamData structure
      // Calculate total spent: Initial Budget - Current Budget
      // TODO: Get initial budget from season settings or team creation data
      // For now, assuming 15000 based on current team budgets (14925, 14827 suggest 15000 start)
      const initialBudget = data.initial_budget || 15000;
      const currentBudget = data.budget || 0;
      const totalSpent = initialBudget - currentBudget;
      
      const teamData = {
        id: docSnap.id,
        team_id: docSnap.id,
        team_name: data.team_name || 'Unknown Team',
        team_code: data.team_code || data.team_name?.substring(0, 3).toUpperCase() || 'UNK',
        owner_name: data.username || data.owner_name || '',
        owner_email: data.team_email || data.owner_email || '',
        balance: currentBudget,
        initial_balance: initialBudget,
        total_spent: totalSpent,
        season_id: data.season_id || '',
        season_name: seasonName,
        real_players: data.real_players || [],
        football_players: data.football_players || [],
        real_players_count: data.players_count || 0,
        football_players_count: data.football_players_count || 0,
        players_count: data.players_count || 0,
        stats: data.stats || {
          matches_played: 0,
          matches_won: 0,
          matches_lost: 0,
          matches_drawn: 0,
          points: 0,
          goals_scored: 0,
          goals_conceded: 0,
          goal_difference: 0,
          clean_sheets: 0,
          win_rate: 0,
        },
        is_active: data.status === 'registered' || data.is_active !== false,
        logo: data.team_logo || data.logo || null,
        team_color: data.team_color || null,
        created_at: convertTimestamp(data.joined_at || data.created_at),
        updated_at: convertTimestamp(data.updated_at || data.joined_at),
      } as TeamData;
      
      teams.push(teamData);
    }
    
    return teams;
  } catch (error) {
    console.error('Error getting all teams:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get all teams';
    throw new Error(errorMessage);
  }
};

// Get teams by season
export const getTeamsBySeason = async (seasonId: string): Promise<TeamData[]> => {
  try {
    const teamsRef = collection(db, 'team_seasons');
    const q = query(
      teamsRef,
      where('season_id', '==', seasonId),
      orderBy('joined_at', 'desc')
    );
    const querySnapshot = await getDocs(q);
    
    const teams: TeamData[] = [];
    for (const docSnap of querySnapshot.docs) {
      const data = docSnap.data();
      
      // Fetch season name
      let seasonName = '';
      if (data.season_id) {
        try {
          const season = await getSeasonById(data.season_id);
          seasonName = season?.name || '';
        } catch (error) {
          console.error('Error fetching season:', error);
        }
      }
      
      // Map team_seasons data structure to TeamData structure (same as getAllTeams)
      // Calculate total spent: Initial Budget - Current Budget
      // TODO: Get initial budget from season settings or team creation data  
      const initialBudget = data.initial_budget || 15000;
      const currentBudget = data.budget || 0;
      const totalSpent = initialBudget - currentBudget;
      
      const teamData = {
        id: docSnap.id,
        team_id: docSnap.id,
        team_name: data.team_name || 'Unknown Team',
        team_code: data.team_code || data.team_name?.substring(0, 3).toUpperCase() || 'UNK',
        owner_name: data.username || data.owner_name || '',
        owner_email: data.team_email || data.owner_email || '',
        balance: currentBudget,
        initial_balance: initialBudget,
        total_spent: totalSpent,
        season_id: data.season_id || '',
        season_name: seasonName,
        real_players: data.real_players || [],
        football_players: data.football_players || [],
        real_players_count: data.players_count || 0,
        football_players_count: data.football_players_count || 0,
        players_count: data.players_count || 0,
        stats: data.stats || {
          matches_played: 0,
          matches_won: 0,
          matches_lost: 0,
          matches_drawn: 0,
          points: 0,
          goals_scored: 0,
          goals_conceded: 0,
          goal_difference: 0,
          clean_sheets: 0,
          win_rate: 0,
        },
        is_active: data.status === 'registered' || data.is_active !== false,
        logo: data.team_logo || data.logo || null,
        team_color: data.team_color || null,
        created_at: convertTimestamp(data.joined_at || data.created_at),
        updated_at: convertTimestamp(data.updated_at || data.joined_at),
      } as TeamData;
      
      teams.push(teamData);
    }
    
    return teams;
  } catch (error) {
    console.error('Error getting teams by season:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get teams by season';
    throw new Error(errorMessage);
  }
};

// Get team by ID
export const getTeamById = async (teamId: string): Promise<TeamData | null> => {
  try {
    // Use team_seasons collection instead of teams
    const teamRef = doc(db, 'team_seasons', teamId);
    const teamDoc = await getDoc(teamRef);
    
    if (!teamDoc.exists()) {
      return null;
    }
    
    const data = teamDoc.data();
    
    // Fetch season name
    let seasonName = '';
    if (data.season_id) {
      try {
        const season = await getSeasonById(data.season_id);
        seasonName = season?.name || '';
      } catch (error) {
        console.error('Error fetching season:', error);
      }
    }
    
    // Map team_seasons data structure to TeamData structure (same as getAllTeams)
    // Calculate total spent: Initial Budget - Current Budget
    // TODO: Get initial budget from season settings or team creation data
    const initialBudget = data.initial_budget || 15000;
    const currentBudget = data.budget || 0;
    const totalSpent = initialBudget - currentBudget;
    
    return {
      id: teamDoc.id,
      team_id: teamDoc.id,
      team_name: data.team_name || 'Unknown Team',
      team_code: data.team_code || data.team_name?.substring(0, 3).toUpperCase() || 'UNK',
      owner_name: data.username || data.owner_name || '',
      owner_email: data.team_email || data.owner_email || '',
      balance: currentBudget,
      initial_balance: initialBudget,
      total_spent: totalSpent,
      season_id: data.season_id || '',
      season_name: seasonName,
      real_players: data.real_players || [],
      football_players: data.football_players || [],
      real_players_count: data.players_count || 0,
      football_players_count: data.football_players_count || 0,
      players_count: data.players_count || 0,
      stats: data.stats || {
        matches_played: 0,
        matches_won: 0,
        matches_lost: 0,
        matches_drawn: 0,
        points: 0,
        goals_scored: 0,
        goals_conceded: 0,
        goal_difference: 0,
        clean_sheets: 0,
        win_rate: 0,
      },
      is_active: data.status === 'registered' || data.is_active !== false,
      logo: data.team_logo || data.logo || null,
      team_color: data.team_color || null,
      created_at: convertTimestamp(data.joined_at || data.created_at),
      updated_at: convertTimestamp(data.updated_at || data.joined_at),
    } as TeamData;
  } catch (error) {
    console.error('Error getting team:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get team';
    throw new Error(errorMessage);
  }
};

// Check if team code is available
export const isTeamCodeAvailable = async (
  teamCode: string,
  excludeTeamId?: string
): Promise<boolean> => {
  try {
    const teamsRef = collection(db, 'teams');
    const q = query(teamsRef, where('team_code', '==', teamCode.toUpperCase()));
    const querySnapshot = await getDocs(q);
    
    // If excluding a team (for updates), check if any other team has this code
    if (excludeTeamId) {
      return querySnapshot.docs.every(doc => doc.id === excludeTeamId);
    }
    
    return querySnapshot.empty;
  } catch (error) {
    console.error('Error checking team code availability:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to check team code availability';
    throw new Error(errorMessage);
  }
};

// Create new team
export const createTeam = async (teamData: CreateTeamData): Promise<TeamData> => {
  try {
    // Check if team code is available
    const codeAvailable = await isTeamCodeAvailable(teamData.team_code);
    if (!codeAvailable) {
      throw new Error('Team code is already taken. Please choose another.');
    }
    
    // Generate custom team ID
    const teamId = await generateTeamId();
    
    // Create document with team_id as the document ID
    const teamRef = doc(db, 'teams', teamId);
    
    const newTeam = {
      team_id: teamId,
      team_name: teamData.team_name,
      team_code: teamData.team_code.toUpperCase(),
      owner_uid: teamData.owner_uid || null,
      owner_name: teamData.owner_name || null,
      owner_email: teamData.owner_email || null,
      username: teamData.owner_name || null, // Store as username for consistency
      balance: teamData.initial_balance,
      initial_balance: teamData.initial_balance,
      total_spent: 0,
      season_id: teamData.season_id,
      real_players: [],
      football_players: [],
      real_players_count: 0,
      football_players_count: 0,
      stats: initializeTeamStats(),
      is_active: true,
      logo: teamData.logo || null,
      team_color: teamData.team_color || null,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    };
    
    await setDoc(teamRef, newTeam);
    
    // Update season's total teams count
    try {
      const seasonRef = doc(db, 'seasons', teamData.season_id);
      const seasonDoc = await getDoc(seasonRef);
      if (seasonDoc.exists()) {
        const currentTotal = seasonDoc.data().totalTeams || 0;
        await updateDoc(seasonRef, {
          totalTeams: currentTotal + 1,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error('Error updating season team count:', error);
    }
    
    // Fetch and return the created team
    const createdTeam = await getTeamById(teamId);
    if (!createdTeam) {
      throw new Error('Failed to fetch created team');
    }
    
    return createdTeam;
  } catch (error) {
    console.error('Error creating team:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create team';
    throw new Error(errorMessage);
  }
};

// Update team
export const updateTeam = async (
  teamId: string,
  updates: UpdateTeamData
): Promise<void> => {
  try {
    // If updating team code, check availability
    if (updates.team_code) {
      const codeAvailable = await isTeamCodeAvailable(updates.team_code, teamId);
      if (!codeAvailable) {
        throw new Error('Team code is already taken. Please choose another.');
      }
      updates.team_code = updates.team_code.toUpperCase();
    }
    
    const teamRef = doc(db, 'teams', teamId);
    await updateDoc(teamRef, {
      ...updates,
      updated_at: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating team:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update team';
    throw new Error(errorMessage);
  }
};

// Toggle team active status
export const toggleTeamStatus = async (
  teamId: string,
  isActive: boolean
): Promise<void> => {
  try {
    const teamRef = doc(db, 'teams', teamId);
    await updateDoc(teamRef, {
      is_active: isActive,
      updated_at: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error toggling team status:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to toggle team status';
    throw new Error(errorMessage);
  }
};

// Delete team
export const deleteTeam = async (teamId: string): Promise<void> => {
  try {
    // Get team data before deleting to update season count
    const team = await getTeamById(teamId);
    
    const teamRef = doc(db, 'teams', teamId);
    await deleteDoc(teamRef);
    
    // Update season's total teams count
    if (team && team.season_id) {
      try {
        const seasonRef = doc(db, 'seasons', team.season_id);
        const seasonDoc = await getDoc(seasonRef);
        if (seasonDoc.exists()) {
          const currentTotal = seasonDoc.data().totalTeams || 0;
          await updateDoc(seasonRef, {
            totalTeams: Math.max(0, currentTotal - 1),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (error) {
        console.error('Error updating season team count:', error);
      }
    }
  } catch (error) {
    console.error('Error deleting team:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete team';
    throw new Error(errorMessage);
  }
};

// Get team statistics
export const getTeamStatistics = async (): Promise<{
  totalTeams: number;
  activeTeams: number;
  inactiveTeams: number;
  totalPlayers: number;
}> => {
  try {
    const teams = await getAllTeams();
    
    const stats = {
      totalTeams: teams.length,
      activeTeams: teams.filter(t => t.is_active).length,
      inactiveTeams: teams.filter(t => !t.is_active).length,
      totalPlayers: teams.reduce((sum, t) => sum + (t.players_count || 0), 0),
    };
    
    return stats;
  } catch (error) {
    console.error('Error getting team statistics:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get team statistics';
    throw new Error(errorMessage);
  }
};

// Update team player count
export const updateTeamPlayerCount = async (
  teamId: string,
  playerCount: number
): Promise<void> => {
  try {
    const teamRef = doc(db, 'teams', teamId);
    await updateDoc(teamRef, {
      players_count: playerCount,
      updated_at: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating team player count:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update team player count';
    throw new Error(errorMessage);
  }
};

// Update team balance
export const updateTeamBalance = async (
  teamId: string,
  balance: number
): Promise<void> => {
  try {
    const teamRef = doc(db, 'teams', teamId);
    await updateDoc(teamRef, {
      balance,
      updated_at: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating team balance:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update team balance';
    throw new Error(errorMessage);
  }
};

// Update team stats
export const updateTeamStats = async (
  teamId: string,
  statsUpdates: UpdateTeamStatsData
): Promise<void> => {
  try {
    const team = await getTeamById(teamId);
    if (!team) {
      throw new Error('Team not found');
    }
    
    const updatedStats = {
      ...team.stats,
      ...statsUpdates,
    };
    
    // Auto-calculate derived fields
    if (updatedStats.goals_scored !== undefined && updatedStats.goals_conceded !== undefined) {
      updatedStats.goal_difference = updatedStats.goals_scored - updatedStats.goals_conceded;
    }
    
    if (updatedStats.matches_played > 0) {
      updatedStats.win_rate = (updatedStats.matches_won / updatedStats.matches_played) * 100;
    }
    
    const teamRef = doc(db, 'teams', teamId);
    await updateDoc(teamRef, {
      stats: updatedStats,
      updated_at: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating team stats:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update team stats';
    throw new Error(errorMessage);
  }
};
