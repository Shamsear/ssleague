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
  limit,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './config';
import {
  RealPlayerData,
  RealPlayerStats,
  CreateRealPlayerData,
  UpdateRealPlayerData,
  UpdateRealPlayerStatsData,
} from '@/types/realPlayer';
import { getSeasonById } from './seasons';
import { getTeamById } from './teams';
import { getCategoryById } from './categories';

// Convert Firestore timestamp to Date
const convertTimestamp = (timestamp: unknown): Date => {
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate();
  }
  if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp) {
    return (timestamp as Timestamp).toDate();
  }
  return new Date();
};

// Helper function to handle team assignment changes
const handleTeamAssignment = async (
  playerId: string, 
  oldTeamId?: string | null, 
  newTeamId?: string | null
): Promise<void> => {
  try {
    // Remove from old team
    if (oldTeamId) {
      const oldTeamRef = doc(db, 'teams', oldTeamId);
      const oldTeamDoc = await getDoc(oldTeamRef);
      if (oldTeamDoc.exists()) {
        const teamData = oldTeamDoc.data();
        const realPlayers = (teamData.real_players || []).filter((id: string) => id !== playerId);
        await updateDoc(oldTeamRef, {
          real_players: realPlayers,
          real_players_count: realPlayers.length,
          updated_at: serverTimestamp(),
        });
        console.log(`❌ Removed player ${playerId} from old team ${oldTeamId}`);
      }
    }
    
    // Add to new team
    if (newTeamId) {
      const newTeamRef = doc(db, 'teams', newTeamId);
      const newTeamDoc = await getDoc(newTeamRef);
      if (newTeamDoc.exists()) {
        const teamData = newTeamDoc.data();
        const realPlayers = teamData.real_players || [];
        if (!realPlayers.includes(playerId)) {
          await updateDoc(newTeamRef, {
            real_players: [...realPlayers, playerId],
            real_players_count: realPlayers.length + 1,
            updated_at: serverTimestamp(),
          });
          console.log(`✅ Added player ${playerId} to new team ${newTeamId}`);
        }
      }
    }
  } catch (error) {
    console.error('Error handling team assignment:', error);
  }
};

// Generate custom player ID (sspslpsl0001, sspslpsl0002, etc.)
const generatePlayerId = async (): Promise<string> => {
  const prefix = 'sspslpsl';
  
  try {
    // Get all players to find the highest number
    const playersRef = collection(db, 'realplayers');
    const querySnapshot = await getDocs(playersRef);
    
    let maxNumber = 0;
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.player_id && data.player_id.startsWith(prefix)) {
        const numberPart = parseInt(data.player_id.substring(prefix.length));
        if (!isNaN(numberPart) && numberPart > maxNumber) {
          maxNumber = numberPart;
        }
      }
    });
    
    const nextNumber = maxNumber + 1;
    const paddedNumber = nextNumber.toString().padStart(4, '0');
    return `${prefix}${paddedNumber}`;
  } catch (error) {
    console.error('Error generating player ID:', error);
    // Fallback to random number if query fails
    const randomNumber = Math.floor(Math.random() * 10000);
    return `${prefix}${randomNumber.toString().padStart(4, '0')}`;
  }
};

// Initialize empty stats
const initializeStats = (): RealPlayerStats => ({
  matches_played: 0,
  matches_won: 0,
  matches_lost: 0,
  matches_drawn: 0,
  goals_scored: 0,
  assists: 0,
  clean_sheets: 0,
  win_rate: 0,
  average_rating: 0,
  current_season_matches: 0,
  current_season_wins: 0,
});

// Get all real players
export const getAllRealPlayers = async (): Promise<RealPlayerData[]> => {
  try {
    const playersRef = collection(db, 'realplayers');
    const q = query(playersRef, orderBy('created_at', 'desc'));
    const querySnapshot = await getDocs(q);
    
    // Collect all unique season and team IDs
    const seasonIds = new Set<string>();
    const teamIds = new Set<string>();
    
    querySnapshot.docs.forEach(docSnap => {
      const data = docSnap.data();
      if (data.season_id) seasonIds.add(data.season_id);
      if (data.team_id) teamIds.add(data.team_id);
    });
    
    // Batch fetch all seasons and teams
    const seasonMap = new Map<string, { name: string }>();
    const teamMap = new Map<string, { team_name: string; team_code: string }>();
    
    // Fetch all seasons in parallel
    const seasonPromises = Array.from(seasonIds).map(async (seasonId) => {
      try {
        const season = await getSeasonById(seasonId);
        if (season) {
          seasonMap.set(seasonId, { name: season.name });
        }
      } catch (error) {
        console.error(`Error fetching season ${seasonId}:`, error);
      }
    });
    
    // Fetch all teams in parallel
    const teamPromises = Array.from(teamIds).map(async (teamId) => {
      try {
        const team = await getTeamById(teamId);
        if (team) {
          teamMap.set(teamId, { team_name: team.team_name, team_code: team.team_code });
        }
      } catch (error) {
        console.error(`Error fetching team ${teamId}:`, error);
      }
    });
    
    // Wait for all fetches to complete
    await Promise.all([...seasonPromises, ...teamPromises]);
    
    // Build players array using cached data
    const players: RealPlayerData[] = [];
    for (const docSnap of querySnapshot.docs) {
      const data = docSnap.data();
      
      // Fetch season, team, and category names from cache
      let seasonName = '';
      let categoryName = '';
      let teamName = '';
      let teamCode = '';
      
      if (data.season_id && seasonMap.has(data.season_id)) {
        seasonName = seasonMap.get(data.season_id)!.name;
      }
      
      if (data.category_id) {
        try {
          const category = await getCategoryById(data.category_id);
          categoryName = category?.name || '';
        } catch (error) {
          console.error('Error fetching category:', error);
        }
      }
      
      if (data.team_id && teamMap.has(data.team_id)) {
        const team = teamMap.get(data.team_id)!;
        teamName = team.team_name;
        teamCode = team.team_code;
      }
      
      players.push({
        ...data,
        id: data.player_id,
        season_name: seasonName,
        category_name: categoryName,
        team_name: teamName,
        team_code: teamCode,
        joined_date: data.joined_date ? convertTimestamp(data.joined_date) : undefined,
        registered_at: data.registered_at ? convertTimestamp(data.registered_at) : null,
        created_at: convertTimestamp(data.created_at),
        updated_at: data.updated_at ? convertTimestamp(data.updated_at) : undefined,
      } as RealPlayerData);
    }
    
    return players;
  } catch (error) {
    console.error('Error getting all real players:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get all real players';
    throw new Error(errorMessage);
  }
};

// Get real players by team
export const getRealPlayersByTeam = async (teamId: string): Promise<RealPlayerData[]> => {
  try {
    const playersRef = collection(db, 'realplayers');
    const q = query(playersRef, where('team_id', '==', teamId));
    const querySnapshot = await getDocs(q);
    
    const players: RealPlayerData[] = [];
    for (const docSnap of querySnapshot.docs) {
      const data = docSnap.data();
      
      let seasonName = '';
      let categoryName = '';
      
      if (data.season_id) {
        try {
          const season = await getSeasonById(data.season_id);
          seasonName = season?.name || '';
        } catch (error) {
          console.error('Error fetching season:', error);
        }
      }
      
      if (data.category_id) {
        try {
          const category = await getCategoryById(data.category_id);
          categoryName = category?.name || '';
        } catch (error) {
          console.error('Error fetching category:', error);
        }
      }
      
      players.push({
        ...data,
        id: data.player_id,
        season_name: seasonName,
        category_name: categoryName,
        joined_date: data.joined_date ? convertTimestamp(data.joined_date) : undefined,
        registered_at: data.registered_at ? convertTimestamp(data.registered_at) : null,
        created_at: convertTimestamp(data.created_at),
        updated_at: data.updated_at ? convertTimestamp(data.updated_at) : undefined,
      } as RealPlayerData);
    }
    
    return players;
  } catch (error) {
    console.error('Error getting real players by team:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get real players by team';
    throw new Error(errorMessage);
  }
};

// Get real players by season
export const getRealPlayersBySeason = async (seasonId: string): Promise<RealPlayerData[]> => {
  try {
    const playersRef = collection(db, 'realplayers');
    const q = query(playersRef, where('season_id', '==', seasonId));
    const querySnapshot = await getDocs(q);
    
    const players: RealPlayerData[] = [];
    for (const docSnap of querySnapshot.docs) {
      const data = docSnap.data();
      
      let categoryName = '';
      let teamName = '';
      let teamCode = '';
      
      if (data.category_id) {
        try {
          const category = await getCategoryById(data.category_id);
          categoryName = category?.name || '';
        } catch (error) {
          console.error('Error fetching category:', error);
        }
      }
      
      if (data.team_id) {
        try {
          const team = await getTeamById(data.team_id);
          teamName = team?.team_name || '';
          teamCode = team?.team_code || '';
        } catch (error) {
          console.error('Error fetching team:', error);
        }
      }
      
      players.push({
        ...data,
        id: data.player_id,
        category_name: categoryName,
        team_name: teamName,
        team_code: teamCode,
        joined_date: data.joined_date ? convertTimestamp(data.joined_date) : undefined,
        registered_at: data.registered_at ? convertTimestamp(data.registered_at) : null,
        created_at: convertTimestamp(data.created_at),
        updated_at: data.updated_at ? convertTimestamp(data.updated_at) : undefined,
      } as RealPlayerData);
    }
    
    return players;
  } catch (error) {
    console.error('Error getting real players by season:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get real players by season';
    throw new Error(errorMessage);
  }
};

// Get real player by ID
export const getRealPlayerById = async (playerId: string): Promise<RealPlayerData | null> => {
  try {
    const playersRef = collection(db, 'realplayers');
    const q = query(playersRef, where('player_id', '==', playerId));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }
    
    const data = querySnapshot.docs[0].data();
    
    // Fetch season, team, and category names
    let seasonName = '';
    let categoryName = '';
    let teamName = '';
    let teamCode = '';
    
    if (data.season_id) {
      try {
        const season = await getSeasonById(data.season_id);
        seasonName = season?.name || '';
      } catch (error) {
        console.error('Error fetching season:', error);
      }
    }
    
    if (data.category_id) {
      try {
        const category = await getCategoryById(data.category_id);
        categoryName = category?.name || '';
      } catch (error) {
        console.error('Error fetching category:', error);
      }
    }
    
    if (data.team_id) {
      try {
        const team = await getTeamById(data.team_id);
        teamName = team?.team_name || '';
        teamCode = team?.team_code || '';
      } catch (error) {
        console.error('Error fetching team:', error);
      }
    }
    
    return {
      ...data,
      id: data.player_id,
      season_name: seasonName,
      category_name: categoryName,
      team_name: teamName,
      team_code: teamCode,
      joined_date: data.joined_date ? convertTimestamp(data.joined_date) : undefined,
      registered_at: data.registered_at ? convertTimestamp(data.registered_at) : null,
      created_at: convertTimestamp(data.created_at),
      updated_at: data.updated_at ? convertTimestamp(data.updated_at) : undefined,
    } as RealPlayerData;
  } catch (error) {
    console.error('Error getting real player:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get real player';
    throw new Error(errorMessage);
  }
};

// Create new real player
export const createRealPlayer = async (
  playerData: CreateRealPlayerData,
  assignedBy?: string
): Promise<RealPlayerData> => {
  try {
    // First, check if a player with the same name already exists
    console.log(`🔍 Checking for existing player with name: ${playerData.name}`);
    const existingPlayersQuery = query(
      collection(db, 'realplayers'),
      where('name', '==', playerData.name),
      limit(1)
    );
    const existingPlayersSnapshot = await getDocs(existingPlayersQuery);
    
    if (!existingPlayersSnapshot.empty) {
      const existingPlayer = existingPlayersSnapshot.docs[0];
      const existingData = existingPlayer.data();
      const playerId = existingData.player_id;
      
      console.log(`✅ Found existing player: ${playerData.name} with ID: ${playerId}`);
      
      // Update existing player with new data if provided
      const updatedData: any = {
        // Update fields that might have changed
        season_id: playerData.season_id || existingData.season_id,
        category_id: playerData.category_id || existingData.category_id,
        team_id: playerData.team_id || existingData.team_id,
        team: playerData.team || existingData.team,
        display_name: playerData.display_name || existingData.display_name,
        email: playerData.email || existingData.email,
        phone: playerData.phone || existingData.phone,
        psn_id: playerData.psn_id || existingData.psn_id,
        xbox_id: playerData.xbox_id || existingData.xbox_id,
        steam_id: playerData.steam_id || existingData.steam_id,
        notes: playerData.notes || existingData.notes,
        is_registered: playerData.is_registered ?? existingData.is_registered,
        updated_at: serverTimestamp()
      };
      
      // Only update if there are actual changes
      const hasChanges = Object.keys(updatedData).some(key => {
        if (key === 'updated_at') return false;
        return updatedData[key] !== existingData[key];
      });
      
      if (hasChanges) {
        await updateDoc(doc(db, 'realplayers', playerId), updatedData);
        console.log(`📝 Updated existing player: ${playerData.name}`);
      }
      
      // Handle team assignment if team_id changed
      if (playerData.team_id && playerData.team_id !== existingData.team_id) {
        await handleTeamAssignment(playerId, existingData.team_id, playerData.team_id);
      }
      
      // Return the existing/updated player
      const updatedPlayer = await getRealPlayerById(playerId);
      if (!updatedPlayer) {
        throw new Error('Failed to fetch updated player');
      }
      
      return updatedPlayer;
    }
    
    // No existing player found, create new one
    console.log(`🆕 Creating new player: ${playerData.name}`);
    const playerId = await generatePlayerId();
    
    // Create document with player_id as the document ID
    const playerRef = doc(db, 'realplayers', playerId);
    
    const newPlayer = {
      player_id: playerId,
      
      // SQLAlchemy model fields
      name: playerData.name,
      team: playerData.team || null, // Previous/current team name
      season_id: playerData.season_id || null,
      category_id: playerData.category_id || null,
      team_id: playerData.team_id || null, // Assigned team reference
      is_registered: playerData.is_registered || false,
      registered_at: playerData.is_registered ? serverTimestamp() : null,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
      
      // Additional fields
      display_name: playerData.display_name || null,
      email: playerData.email || null,
      phone: playerData.phone || null,
      role: playerData.role || 'player',
      is_active: true,
      is_available: true,
      stats: initializeStats(),
      psn_id: playerData.psn_id || null,
      xbox_id: playerData.xbox_id || null,
      steam_id: playerData.steam_id || null,
      profile_image: null,
      joined_date: serverTimestamp(),
      assigned_by: assignedBy || null,
      notes: playerData.notes || null,
    };
    
    await setDoc(playerRef, newPlayer);
    
    // Update team's real_players array if team_id is provided
    if (playerData.team_id) {
      try {
        const teamRef = doc(db, 'teams', playerData.team_id);
        const teamDoc = await getDoc(teamRef);
        if (teamDoc.exists()) {
          const teamData = teamDoc.data();
          const realPlayers = teamData.real_players || [];
          await updateDoc(teamRef, {
            real_players: [...realPlayers, playerId],
            real_players_count: realPlayers.length + 1,
            updated_at: serverTimestamp(),
          });
        }
      } catch (error) {
        console.error('Error updating team real players:', error);
      }
    }
    
    // Fetch and return the created player
    const createdPlayer = await getRealPlayerById(playerId);
    if (!createdPlayer) {
      throw new Error('Failed to fetch created player');
    }
    
    return createdPlayer;
  } catch (error) {
    console.error('Error creating real player:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create real player';
    throw new Error(errorMessage);
  }
};

// Update real player
export const updateRealPlayer = async (
  playerId: string,
  updates: UpdateRealPlayerData
): Promise<void> => {
  try {
    const playerRef = doc(db, 'realplayers', playerId);
    
    // If team_id is being updated, handle the team associations
    if (updates.team_id !== undefined) {
      const player = await getRealPlayerById(playerId);
      if (player && player.team_id !== updates.team_id) {
        await handleTeamAssignment(playerId, player.team_id, updates.team_id);
      }
    }
    
    await updateDoc(playerRef, {
      ...updates,
      updated_at: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating real player:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update real player';
    throw new Error(errorMessage);
  }
};

// Update real player stats
export const updateRealPlayerStats = async (
  playerId: string,
  statsUpdates: UpdateRealPlayerStatsData
): Promise<void> => {
  try {
    const player = await getRealPlayerById(playerId);
    if (!player) {
      throw new Error('Player not found');
    }
    
    // Initialize stats if not present
    const currentStats = player.stats || initializeStats();
    
    const updatedStats = {
      ...currentStats,
      ...statsUpdates,
    };
    
    // Calculate win rate
    if (updatedStats.matches_played && updatedStats.matches_played > 0 && updatedStats.matches_won !== undefined) {
      updatedStats.win_rate = (updatedStats.matches_won / updatedStats.matches_played) * 100;
    }
    
    const playerRef = doc(db, 'realplayers', playerId);
    await updateDoc(playerRef, {
      stats: updatedStats,
      updated_at: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating real player stats:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update real player stats';
    throw new Error(errorMessage);
  }
};

// Delete real player
export const deleteRealPlayer = async (playerId: string): Promise<void> => {
  try {
    const player = await getRealPlayerById(playerId);
    
    // Remove from team if assigned
    if (player && player.team_id) {
      try {
        const teamRef = doc(db, 'teams', player.team_id);
        const teamDoc = await getDoc(teamRef);
        if (teamDoc.exists()) {
          const teamData = teamDoc.data();
          const realPlayers = (teamData.real_players || []).filter((id: string) => id !== playerId);
          await updateDoc(teamRef, {
            real_players: realPlayers,
            real_players_count: realPlayers.length,
            updated_at: serverTimestamp(),
          });
        }
      } catch (error) {
        console.error('Error removing player from team:', error);
      }
    }
    
    const playerRef = doc(db, 'realplayers', playerId);
    await deleteDoc(playerRef);
  } catch (error) {
    console.error('Error deleting real player:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete real player';
    throw new Error(errorMessage);
  }
};

// Get real player statistics summary
export const getRealPlayerStatistics = async (): Promise<{
  totalPlayers: number;
  activePlayers: number;
  inactivePlayers: number;
  assignedPlayers: number;
  unassignedPlayers: number;
}> => {
  try {
    const players = await getAllRealPlayers();
    
    const stats = {
      totalPlayers: players.length,
      activePlayers: players.filter(p => p.is_active).length,
      inactivePlayers: players.filter(p => !p.is_active).length,
      assignedPlayers: players.filter(p => p.team_id).length,
      unassignedPlayers: players.filter(p => !p.team_id).length,
    };
    
    return stats;
  } catch (error) {
    console.error('Error getting real player statistics:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get real player statistics';
    throw new Error(errorMessage);
  }
};
