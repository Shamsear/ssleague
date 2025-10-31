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
import { Season, CreateSeasonData, SeasonStatus, SeasonType } from '@/types/season';
import { getISTNow, timestampToIST } from '../utils/timezone';

// Convert Firestore timestamp to IST Date
const convertTimestamp = (timestamp: any): Date => {
  if (timestamp instanceof Timestamp) {
    return timestampToIST(timestamp);
  }
  if (timestamp?.toDate) {
    return timestampToIST(timestamp);
  }
  return getISTNow();
};

// Get all seasons
export const getAllSeasons = async (): Promise<Season[]> => {
  try {
    const seasonsRef = collection(db, 'seasons');
    const q = query(seasonsRef, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    
    const seasons: Season[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      seasons.push({
        id: doc.id,
        ...data,
        // Generate name from season_number if name doesn't exist
        name: data.name || (data.season_number ? `Season ${data.season_number}` : data.year || 'Unnamed Season'),
        year: data.year || (data.season_number ? `${data.season_number}` : 'N/A'),
        startDate: data.startDate ? convertTimestamp(data.startDate) : undefined,
        endDate: data.endDate ? convertTimestamp(data.endDate) : undefined,
        createdAt: convertTimestamp(data.createdAt),
        updatedAt: convertTimestamp(data.updatedAt),
      } as Season);
    });
    
    return seasons;
  } catch (error: any) {
    console.error('Error getting all seasons:', error);
    throw new Error(error.message || 'Failed to get all seasons');
  }
};

// Get active season
export const getActiveSeason = async (): Promise<Season | null> => {
  try {
    const seasonsRef = collection(db, 'seasons');
    const q = query(seasonsRef, where('isActive', '==', true));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }
    
    const doc = querySnapshot.docs[0];
    const data = doc.data();
    
    return {
      id: doc.id,
      ...data,
      // Generate name from season_number if name doesn't exist
      name: data.name || (data.season_number ? `Season ${data.season_number}` : data.year || 'Unnamed Season'),
      year: data.year || (data.season_number ? `${data.season_number}` : 'N/A'),
      startDate: data.startDate ? convertTimestamp(data.startDate) : undefined,
      endDate: data.endDate ? convertTimestamp(data.endDate) : undefined,
      createdAt: convertTimestamp(data.createdAt),
      updatedAt: convertTimestamp(data.updatedAt),
    } as Season;
  } catch (error: any) {
    console.error('Error getting active season:', error);
    throw new Error(error.message || 'Failed to get active season');
  }
};

// Get season by ID
export const getSeasonById = async (seasonId: string): Promise<Season | null> => {
  try {
    const seasonRef = doc(db, 'seasons', seasonId);
    const seasonDoc = await getDoc(seasonRef);
    
    if (!seasonDoc.exists()) {
      return null;
    }
    
    const data = seasonDoc.data();
    return {
      id: seasonDoc.id,
      ...data,
      // Generate name from season_number if name doesn't exist
      name: data.name || (data.season_number ? `Season ${data.season_number}` : data.year || 'Unnamed Season'),
      year: data.year || (data.season_number ? `${data.season_number}` : 'N/A'),
      startDate: data.startDate ? convertTimestamp(data.startDate) : undefined,
      endDate: data.endDate ? convertTimestamp(data.endDate) : undefined,
      createdAt: convertTimestamp(data.createdAt),
      updatedAt: convertTimestamp(data.updatedAt),
    } as Season;
  } catch (error: any) {
    console.error('Error getting season:', error);
    throw new Error(error.message || 'Failed to get season');
  }
};

// Create new season
export const createSeason = async (seasonData: CreateSeasonData): Promise<Season> => {
  try {
    // Use provided season_number or extract from name if it exists (e.g., "Season 16" -> 16)
    let seasonNumber: number | undefined = seasonData.season_number;
    if (!seasonNumber) {
      const match = seasonData.name?.match(/\d+/);
      if (match) {
        seasonNumber = parseInt(match[0]);
      }
    }
    
    // Generate season ID in format SSPSLS## (e.g., SSPSLS01, SSPSLS15)
    const seasonId = seasonNumber 
      ? `SSPSLS${seasonNumber.toString().padStart(2, '0')}`
      : doc(collection(db, 'seasons')).id; // Fallback to auto-generated ID if no number
    
    const seasonRef = doc(db, 'seasons', seasonId);
    
    // Determine season type (default to 'single' if not specified)
    const seasonType: SeasonType = seasonData.type || 'single';
    
    const newSeason: any = {
      name: seasonData.name,
      year: seasonData.year,
      season_number: seasonNumber,
      type: seasonType,
      isActive: false,
      status: 'draft' as SeasonStatus,
      registrationOpen: false,
      startDate: seasonData.startDate || null,
      endDate: seasonData.endDate || null,
      totalTeams: 0,
      totalRounds: seasonData.totalRounds || 0,
      purseAmount: seasonData.purseAmount || 0,
      maxPlayersPerTeam: seasonData.maxPlayersPerTeam || 11,
      // Store both formats for consistency
      createdAt: serverTimestamp(),
      created_at: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updated_at: serverTimestamp(),
    };
    
    // Add multi-season specific fields if type is 'multi'
    if (seasonType === 'multi') {
      newSeason.dollar_budget = seasonData.dollar_budget || 1000;
      newSeason.euro_budget = seasonData.euro_budget || 10000;
      newSeason.min_real_players = seasonData.min_real_players || 5;
      newSeason.max_real_players = seasonData.max_real_players || 7;
      newSeason.max_football_players = seasonData.max_football_players || 25;
      newSeason.category_fine_amount = seasonData.category_fine_amount || 20;
    }
    
    await setDoc(seasonRef, newSeason);
    
    // Fetch and return the created season
    const createdSeason = await getSeasonById(seasonRef.id);
    if (!createdSeason) {
      throw new Error('Failed to fetch created season');
    }
    
    return createdSeason;
  } catch (error: any) {
    console.error('Error creating season:', error);
    throw new Error(error.message || 'Failed to create season');
  }
};

// Update season
export const updateSeason = async (
  seasonId: string,
  updates: Partial<Season>
): Promise<void> => {
  try {
    const seasonRef = doc(db, 'seasons', seasonId);
    await updateDoc(seasonRef, {
      ...updates,
      updatedAt: serverTimestamp(),
      updated_at: serverTimestamp(),
    });
  } catch (error: any) {
    console.error('Error updating season:', error);
    throw new Error(error.message || 'Failed to update season');
  }
};

// Activate season (deactivates all other seasons)
export const activateSeason = async (seasonId: string): Promise<void> => {
  try {
    // First, deactivate all seasons
    const seasonsRef = collection(db, 'seasons');
    const querySnapshot = await getDocs(seasonsRef);
    
    const updatePromises = querySnapshot.docs.map((document) =>
      updateDoc(doc(db, 'seasons', document.id), {
        isActive: false,
        updatedAt: serverTimestamp(),
        updated_at: serverTimestamp(),
      })
    );
    
    await Promise.all(updatePromises);
    
    // Then activate the selected season
    const seasonRef = doc(db, 'seasons', seasonId);
    await updateDoc(seasonRef, {
      isActive: true,
      status: 'active',
      updatedAt: serverTimestamp(),
      updated_at: serverTimestamp(),
    });
  } catch (error: any) {
    console.error('Error activating season:', error);
    throw new Error(error.message || 'Failed to activate season');
  }
};

// Complete season
export const completeSeason = async (seasonId: string): Promise<void> => {
  try {
    const seasonRef = doc(db, 'seasons', seasonId);
    await updateDoc(seasonRef, {
      status: 'completed',
      isActive: false,
      registrationOpen: false,
      updatedAt: serverTimestamp(),
      updated_at: serverTimestamp(),
    });
    
    // ✅ AUTO-AWARD TROPHIES: Award league position trophies (Winner, Runner Up)
    // Note: This is async but we don't await it to avoid blocking season completion
    // Committee can review and add additional trophies (cups, etc.) manually
    try {
      const { awardSeasonTrophies } = await import('../award-season-trophies');
      awardSeasonTrophies(seasonId, 2).then((result) => {
        if (result.success) {
          console.log(`✅ Auto-awarded ${result.trophiesAwarded} trophies for season ${seasonId}`);
        } else {
          console.warn(`⚠️ Could not auto-award trophies: ${result.error}`);
        }
      }).catch((err) => {
        console.error('❌ Trophy auto-award failed:', err);
      });
    } catch (importError) {
      console.error('❌ Could not import trophy awarding module:', importError);
    }
  } catch (error: any) {
    console.error('Error completing season:', error);
    throw new Error(error.message || 'Failed to complete season');
  }
};

// Delete season
export const deleteSeason = async (seasonId: string): Promise<void> => {
  try {
    const seasonRef = doc(db, 'seasons', seasonId);
    await deleteDoc(seasonRef);
  } catch (error: any) {
    console.error('Error deleting season:', error);
    throw new Error(error.message || 'Failed to delete season');
  }
};

// Toggle registration
export const toggleRegistration = async (
  seasonId: string,
  registrationOpen: boolean
): Promise<void> => {
  try {
    const seasonRef = doc(db, 'seasons', seasonId);
    await updateDoc(seasonRef, {
      registrationOpen,
      updatedAt: serverTimestamp(),
    });
  } catch (error: any) {
    console.error('Error toggling registration:', error);
    throw new Error(error.message || 'Failed to toggle registration');
  }
};

// Update season status
export const updateSeasonStatus = async (
  seasonId: string,
  status: SeasonStatus
): Promise<void> => {
  try {
    const seasonRef = doc(db, 'seasons', seasonId);
    await updateDoc(seasonRef, {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error: any) {
    console.error('Error updating season status:', error);
    throw new Error(error.message || 'Failed to update season status');
  }
};
