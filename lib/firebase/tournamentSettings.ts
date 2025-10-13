import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './config';

export interface TournamentSettings {
  id?: string;
  season_id: string;
  tournament_name: string;
  squad_size: number;
  tournament_system: 'match_round' | 'legacy';
  home_deadline_time: string;
  away_deadline_time: string;
  result_day_offset: number;
  result_deadline_time: string;
  has_knockout_stage: boolean;
  playoff_teams: number;
  direct_semifinal_teams: number;
  qualification_threshold: number;
  created_at?: Date;
  updated_at?: Date;
}

// Convert Firestore timestamp to Date
const convertTimestamp = (timestamp: any): Date => {
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate();
  }
  if (timestamp?.toDate) {
    return timestamp.toDate();
  }
  return new Date();
};

// Get tournament settings for a season
export const getTournamentSettings = async (seasonId: string): Promise<TournamentSettings | null> => {
  try {
    const settingsRef = collection(db, 'tournament_settings');
    const q = query(settingsRef, where('season_id', '==', seasonId));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }
    
    const doc = querySnapshot.docs[0];
    const data = doc.data();
    
    return {
      id: doc.id,
      ...data,
      created_at: data.created_at ? convertTimestamp(data.created_at) : undefined,
      updated_at: data.updated_at ? convertTimestamp(data.updated_at) : undefined,
    } as TournamentSettings;
  } catch (error: any) {
    console.error('Error getting tournament settings:', error);
    throw new Error(error.message || 'Failed to get tournament settings');
  }
};

// Create or update tournament settings for a season
export const saveTournamentSettings = async (
  seasonId: string,
  settings: Omit<TournamentSettings, 'id' | 'season_id' | 'created_at' | 'updated_at'>
): Promise<void> => {
  try {
    // Check if settings already exist for this season
    const existing = await getTournamentSettings(seasonId);
    
    const settingsData = {
      season_id: seasonId,
      ...settings,
      updated_at: serverTimestamp(),
    };
    
    if (existing && existing.id) {
      // Update existing settings
      const settingsRef = doc(db, 'tournament_settings', existing.id);
      await updateDoc(settingsRef, settingsData);
    } else {
      // Create new settings
      const settingsRef = doc(collection(db, 'tournament_settings'));
      await setDoc(settingsRef, {
        ...settingsData,
        created_at: serverTimestamp(),
      });
    }
  } catch (error: any) {
    console.error('Error saving tournament settings:', error);
    throw new Error(error.message || 'Failed to save tournament settings');
  }
};

// Delete tournament settings for a season
export const deleteTournamentSettings = async (seasonId: string): Promise<void> => {
  try {
    const existing = await getTournamentSettings(seasonId);
    
    if (existing && existing.id) {
      const settingsRef = doc(db, 'tournament_settings', existing.id);
      await updateDoc(settingsRef, {
        deleted: true,
        updated_at: serverTimestamp(),
      });
    }
  } catch (error: any) {
    console.error('Error deleting tournament settings:', error);
    throw new Error(error.message || 'Failed to delete tournament settings');
  }
};
