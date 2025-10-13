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
import {
  FootballPlayerData,
  CreateFootballPlayerData,
  UpdateFootballPlayerData,
  AssignFootballPlayerToTeamData,
  UpdateFootballPlayerStatsData,
} from '@/types/footballPlayer';
import { getSeasonById } from './seasons';
import { getTeamById } from './teams';

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

// Get all football players
export const getAllFootballPlayers = async (): Promise<FootballPlayerData[]> => {
  try {
    const playersRef = collection(db, 'footballplayers');
    const q = query(playersRef, orderBy('created_at', 'desc'));
    const querySnapshot = await getDocs(q);
    
    const players: FootballPlayerData[] = [];
    for (const docSnap of querySnapshot.docs) {
      const data = docSnap.data();
      
      // Fetch season and team names
      let seasonName = '';
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
        id: docSnap.id,
        ...data,
        season_name: seasonName,
        team_name: teamName,
        team_code: teamCode,
        created_at: convertTimestamp(data.created_at),
        updated_at: convertTimestamp(data.updated_at),
      } as FootballPlayerData);
    }
    
    return players;
  } catch (error) {
    console.error('Error getting all football players:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get all football players';
    throw new Error(errorMessage);
  }
};

// Get football players by team
export const getFootballPlayersByTeam = async (teamId: string): Promise<FootballPlayerData[]> => {
  try {
    const playersRef = collection(db, 'footballplayers');
    const q = query(playersRef, where('team_id', '==', teamId));
    const querySnapshot = await getDocs(q);
    
    const players: FootballPlayerData[] = [];
    for (const docSnap of querySnapshot.docs) {
      const data = docSnap.data();
      
      let seasonName = '';
      if (data.season_id) {
        try {
          const season = await getSeasonById(data.season_id);
          seasonName = season?.name || '';
        } catch (error) {
          console.error('Error fetching season:', error);
        }
      }
      
      players.push({
        id: docSnap.id,
        ...data,
        season_name: seasonName,
        created_at: convertTimestamp(data.created_at),
        updated_at: convertTimestamp(data.updated_at),
      } as FootballPlayerData);
    }
    
    return players;
  } catch (error) {
    console.error('Error getting football players by team:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get football players by team';
    throw new Error(errorMessage);
  }
};

// Get football players by season
export const getFootballPlayersBySeason = async (seasonId: string): Promise<FootballPlayerData[]> => {
  try {
    const playersRef = collection(db, 'footballplayers');
    const q = query(playersRef, where('season_id', '==', seasonId));
    const querySnapshot = await getDocs(q);
    
    const players: FootballPlayerData[] = [];
    for (const docSnap of querySnapshot.docs) {
      const data = docSnap.data();
      
      let teamName = '';
      let teamCode = '';
      
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
        id: docSnap.id,
        ...data,
        team_name: teamName,
        team_code: teamCode,
        created_at: convertTimestamp(data.created_at),
        updated_at: convertTimestamp(data.updated_at),
      } as FootballPlayerData);
    }
    
    return players;
  } catch (error) {
    console.error('Error getting football players by season:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get football players by season';
    throw new Error(errorMessage);
  }
};

// Get available players for auction (not sold yet)
export const getAvailableFootballPlayers = async (seasonId: string): Promise<FootballPlayerData[]> => {
  try {
    const playersRef = collection(db, 'footballplayers');
    const q = query(
      playersRef,
      where('season_id', '==', seasonId),
      where('is_sold', '==', false)
    );
    const querySnapshot = await getDocs(q);
    
    const players: FootballPlayerData[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      players.push({
        id: docSnap.id,
        ...data,
        created_at: convertTimestamp(data.created_at),
        updated_at: convertTimestamp(data.updated_at),
      } as FootballPlayerData);
    });
    
    return players;
  } catch (error) {
    console.error('Error getting available football players:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get available football players';
    throw new Error(errorMessage);
  }
};

// Get football player by ID
export const getFootballPlayerById = async (playerId: string): Promise<FootballPlayerData | null> => {
  try {
    const playerRef = doc(db, 'footballplayers', playerId);
    const playerDoc = await getDoc(playerRef);
    
    if (!playerDoc.exists()) {
      return null;
    }
    
    const data = playerDoc.data();
    
    // Fetch season and team names
    let seasonName = '';
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
      id: playerDoc.id,
      ...data,
      season_name: seasonName,
      team_name: teamName,
      team_code: teamCode,
      created_at: convertTimestamp(data.created_at),
      updated_at: convertTimestamp(data.updated_at),
    } as FootballPlayerData;
  } catch (error) {
    console.error('Error getting football player:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get football player';
    throw new Error(errorMessage);
  }
};

// Create new football player
export const createFootballPlayer = async (
  playerData: CreateFootballPlayerData,
  addedBy?: string
): Promise<FootballPlayerData> => {
  try {
    const playerRef = doc(collection(db, 'footballplayers'));
    
    const newPlayer = {
      name: playerData.name,
      full_name: playerData.full_name || null,
      age: playerData.age || null,
      nationality: playerData.nationality || null,
      primary_position: playerData.primary_position,
      secondary_positions: playerData.secondary_positions || [],
      preferred_foot: playerData.preferred_foot,
      attributes: playerData.attributes,
      team_id: null,
      team_name: null,
      team_code: null,
      base_price: playerData.base_price,
      sold_price: null,
      is_sold: false,
      auction_round: null,
      season_id: playerData.season_id,
      is_available: true,
      is_injured: false,
      injury_details: null,
      suspension_matches: 0,
      player_image: playerData.player_image || null,
      card_type: playerData.card_type || 'Gold',
      matches_played: 0,
      goals: 0,
      assists: 0,
      yellow_cards: 0,
      red_cards: 0,
      clean_sheets: 0,
      added_by: addedBy || null,
      notes: playerData.notes || null,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    };
    
    await setDoc(playerRef, newPlayer);
    
    // Fetch and return the created player
    const createdPlayer = await getFootballPlayerById(playerRef.id);
    if (!createdPlayer) {
      throw new Error('Failed to fetch created player');
    }
    
    return createdPlayer;
  } catch (error) {
    console.error('Error creating football player:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create football player';
    throw new Error(errorMessage);
  }
};

// Update football player
export const updateFootballPlayer = async (
  playerId: string,
  updates: UpdateFootballPlayerData
): Promise<void> => {
  try {
    const playerRef = doc(db, 'footballplayers', playerId);
    await updateDoc(playerRef, {
      ...updates,
      updated_at: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating football player:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update football player';
    throw new Error(errorMessage);
  }
};

// Assign football player to team (after auction)
export const assignFootballPlayerToTeam = async (
  assignData: AssignFootballPlayerToTeamData
): Promise<void> => {
  try {
    const { player_id, team_id, sold_price, auction_round } = assignData;
    
    // Get team details
    const team = await getTeamById(team_id);
    if (!team) {
      throw new Error('Team not found');
    }
    
    // Update player with team information
    const playerRef = doc(db, 'footballplayers', player_id);
    await updateDoc(playerRef, {
      team_id,
      team_name: team.team_name,
      team_code: team.team_code,
      sold_price,
      is_sold: true,
      auction_round: auction_round || null,
      updated_at: serverTimestamp(),
    });
    
    // Update team's football_players array and balance
    const teamRef = doc(db, 'teams', team_id);
    const teamDoc = await getDoc(teamRef);
    if (teamDoc.exists()) {
      const teamData = teamDoc.data();
      const footballPlayers = teamData.football_players || [];
      const newBalance = teamData.balance - sold_price;
      const totalSpent = (teamData.total_spent || 0) + sold_price;
      
      await updateDoc(teamRef, {
        football_players: [...footballPlayers, player_id],
        football_players_count: footballPlayers.length + 1,
        balance: newBalance,
        total_spent: totalSpent,
        updated_at: serverTimestamp(),
      });
    }
  } catch (error) {
    console.error('Error assigning football player to team:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to assign football player to team';
    throw new Error(errorMessage);
  }
};

// Release football player from team
export const releaseFootballPlayerFromTeam = async (playerId: string): Promise<void> => {
  try {
    const player = await getFootballPlayerById(playerId);
    if (!player) {
      throw new Error('Player not found');
    }
    
    // Remove from team if assigned
    if (player.team_id) {
      const teamRef = doc(db, 'teams', player.team_id);
      const teamDoc = await getDoc(teamRef);
      if (teamDoc.exists()) {
        const teamData = teamDoc.data();
        const footballPlayers = (teamData.football_players || []).filter((id: string) => id !== playerId);
        
        await updateDoc(teamRef, {
          football_players: footballPlayers,
          football_players_count: footballPlayers.length,
          updated_at: serverTimestamp(),
        });
      }
    }
    
    // Update player to remove team association
    const playerRef = doc(db, 'footballplayers', playerId);
    await updateDoc(playerRef, {
      team_id: null,
      team_name: null,
      team_code: null,
      is_sold: false,
      sold_price: null,
      updated_at: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error releasing football player from team:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to release football player from team';
    throw new Error(errorMessage);
  }
};

// Update football player stats
export const updateFootballPlayerStats = async (
  playerId: string,
  statsUpdates: UpdateFootballPlayerStatsData
): Promise<void> => {
  try {
    const playerRef = doc(db, 'footballplayers', playerId);
    await updateDoc(playerRef, {
      ...statsUpdates,
      updated_at: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating football player stats:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update football player stats';
    throw new Error(errorMessage);
  }
};

// Delete football player
export const deleteFootballPlayer = async (playerId: string): Promise<void> => {
  try {
    const player = await getFootballPlayerById(playerId);
    
    // Remove from team if assigned
    if (player && player.team_id) {
      try {
        const teamRef = doc(db, 'teams', player.team_id);
        const teamDoc = await getDoc(teamRef);
        if (teamDoc.exists()) {
          const teamData = teamDoc.data();
          const footballPlayers = (teamData.football_players || []).filter((id: string) => id !== playerId);
          
          await updateDoc(teamRef, {
            football_players: footballPlayers,
            football_players_count: footballPlayers.length,
            updated_at: serverTimestamp(),
          });
        }
      } catch (error) {
        console.error('Error removing player from team:', error);
      }
    }
    
    const playerRef = doc(db, 'footballplayers', playerId);
    await deleteDoc(playerRef);
  } catch (error) {
    console.error('Error deleting football player:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete football player';
    throw new Error(errorMessage);
  }
};

// Get football player statistics summary
export const getFootballPlayerStatistics = async (seasonId?: string): Promise<{
  totalPlayers: number;
  soldPlayers: number;
  unsoldPlayers: number;
  totalValue: number;
  averagePrice: number;
  byPosition: Record<string, number>;
}> => {
  try {
    let players: FootballPlayerData[];
    
    if (seasonId) {
      players = await getFootballPlayersBySeason(seasonId);
    } else {
      players = await getAllFootballPlayers();
    }
    
    const soldPlayers = players.filter(p => p.is_sold);
    const totalValue = soldPlayers.reduce((sum, p) => sum + (p.sold_price || 0), 0);
    
    // Count by position
    const byPosition: Record<string, number> = {};
    players.forEach(player => {
      byPosition[player.primary_position] = (byPosition[player.primary_position] || 0) + 1;
    });
    
    const stats = {
      totalPlayers: players.length,
      soldPlayers: soldPlayers.length,
      unsoldPlayers: players.length - soldPlayers.length,
      totalValue,
      averagePrice: soldPlayers.length > 0 ? totalValue / soldPlayers.length : 0,
      byPosition,
    };
    
    return stats;
  } catch (error) {
    console.error('Error getting football player statistics:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get football player statistics';
    throw new Error(errorMessage);
  }
};

// Bulk create football players
export const bulkCreateFootballPlayers = async (
  playersData: CreateFootballPlayerData[],
  addedBy?: string
): Promise<FootballPlayerData[]> => {
  try {
    const createdPlayers: FootballPlayerData[] = [];
    
    for (const playerData of playersData) {
      const player = await createFootballPlayer(playerData, addedBy);
      createdPlayers.push(player);
    }
    
    return createdPlayers;
  } catch (error) {
    console.error('Error bulk creating football players:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to bulk create football players';
    throw new Error(errorMessage);
  }
};
