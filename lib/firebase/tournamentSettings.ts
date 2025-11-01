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

// Get tournament settings for a season from Neon
export const getTournamentSettings = async (seasonId: string): Promise<TournamentSettings | null> => {
  try {
    const response = await fetch(`/api/tournament-settings?season_id=${seasonId}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch tournament settings');
    }
    
    const { settings } = await response.json();
    
    if (!settings) {
      return null;
    }
    
    return {
      ...settings,
      created_at: settings.created_at ? new Date(settings.created_at) : undefined,
      updated_at: settings.updated_at ? new Date(settings.updated_at) : undefined,
    } as TournamentSettings;
  } catch (error: any) {
    console.error('Error getting tournament settings:', error);
    throw new Error(error.message || 'Failed to get tournament settings');
  }
};

// Create or update tournament settings for a season in Neon
export const saveTournamentSettings = async (
  seasonId: string,
  settings: Omit<TournamentSettings, 'id' | 'season_id' | 'created_at' | 'updated_at'>
): Promise<void> => {
  try {
    const response = await fetch('/api/tournament-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        season_id: seasonId,
        ...settings,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save tournament settings');
    }
  } catch (error: any) {
    console.error('Error saving tournament settings:', error);
    throw new Error(error.message || 'Failed to save tournament settings');
  }
};

// Delete tournament settings for a season from Neon
export const deleteTournamentSettings = async (seasonId: string): Promise<void> => {
  try {
    const response = await fetch(`/api/tournament-settings?season_id=${seasonId}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete tournament settings');
    }
  } catch (error: any) {
    console.error('Error deleting tournament settings:', error);
    throw new Error(error.message || 'Failed to delete tournament settings');
  }
};
