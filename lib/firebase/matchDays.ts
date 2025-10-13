import { db } from './config';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  writeBatch,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { getISTNow, timestampToIST } from '../utils/timezone';

export type MatchDayStatus = 'pending' | 'active' | 'paused' | 'completed';
export type MatchDayPhase = 'home_fixtures' | 'away_fixtures' | 'result_entry' | 'closed';

export interface MatchDayDeadline {
  home_fixture_deadline: Date;
  away_fixture_deadline: Date;
  result_entry_deadline: Date;
}

export interface MatchDay {
  id: string;
  season_id: string;
  match_day_number: number;
  round_number: number; // Links to fixtures.round_number
  status: MatchDayStatus;
  is_active: boolean;
  
  // Deadline times (time of day, not specific date)
  home_fixture_deadline_time: string; // e.g., "17:00" (5:00 PM)
  away_fixture_deadline_time: string; // e.g., "17:00" (5:00 PM)
  result_entry_deadline_hours: number; // Hours after start (e.g., 48 for 2 days)
  
  // Actual calculated deadlines (when match day starts)
  deadlines?: MatchDayDeadline;
  current_phase?: MatchDayPhase;
  
  // Timestamps
  started_at?: Date;
  paused_at?: Date;
  resumed_at?: Date;
  completed_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface DeadlineStatus {
  phase: MatchDayPhase;
  can_create_home_fixtures: boolean;
  can_create_away_fixtures: boolean;
  can_enter_results: boolean;
  next_deadline?: Date;
  time_until_next?: string;
}

/**
 * Calculate deadline status for a match day
 */
export function calculateDeadlineStatus(matchDay: MatchDay): DeadlineStatus | null {
  if (!matchDay.is_active || !matchDay.started_at || !matchDay.deadlines) {
    return null;
  }

  const now = getISTNow();
  const homeDeadline = matchDay.deadlines.home_fixture_deadline;
  const awayDeadline = matchDay.deadlines.away_fixture_deadline;
  const resultDeadline = matchDay.deadlines.result_entry_deadline;

  let phase: MatchDayPhase = 'closed';
  let canCreateHome = false;
  let canCreateAway = false;
  let canEnterResults = false;
  let nextDeadline: Date | undefined;

  if (now < homeDeadline) {
    phase = 'home_fixtures';
    canCreateHome = true;
    nextDeadline = homeDeadline;
  } else if (now < awayDeadline) {
    phase = 'away_fixtures';
    canCreateHome = true;
    canCreateAway = true;
    nextDeadline = awayDeadline;
  } else if (now < resultDeadline) {
    phase = 'result_entry';
    canEnterResults = true;
    nextDeadline = resultDeadline;
  } else {
    phase = 'closed';
  }

  return {
    phase,
    can_create_home_fixtures: canCreateHome,
    can_create_away_fixtures: canCreateAway,
    can_enter_results: canEnterResults,
    next_deadline: nextDeadline,
  };
}

/**
 * Calculate deadlines based on start time
 */
function calculateDeadlines(
  startedAt: Date,
  homeTime: string,
  awayTime: string,
  resultHours: number
): MatchDayDeadline {
  const [homeHour, homeMin] = homeTime.split(':').map(Number);
  const [awayHour, awayMin] = awayTime.split(':').map(Number);

  // Home deadline: same day at specified time
  const homeDeadline = new Date(startedAt);
  homeDeadline.setHours(homeHour, homeMin, 0, 0);
  
  // If start time is after deadline time, move to next day
  if (homeDeadline <= startedAt) {
    homeDeadline.setDate(homeDeadline.getDate() + 1);
  }

  // Away deadline: same day as home deadline at specified time
  const awayDeadline = new Date(homeDeadline);
  awayDeadline.setHours(awayHour, awayMin, 0, 0);
  
  // If away time is before home time, move to next day
  if (awayDeadline <= homeDeadline) {
    awayDeadline.setDate(awayDeadline.getDate() + 1);
  }

  // Result deadline: X hours after start
  const resultDeadline = new Date(startedAt);
  resultDeadline.setHours(resultDeadline.getHours() + resultHours);

  return {
    home_fixture_deadline: homeDeadline,
    away_fixture_deadline: awayDeadline,
    result_entry_deadline: resultDeadline,
  };
}

/**
 * Create match days from fixtures - called automatically after fixture generation
 */
export async function createMatchDaysFromFixtures(
  seasonId: string,
  totalRounds: number,
  homeDeadlineTime: string = '17:00',
  awayDeadlineTime: string = '17:00',
  resultDeadlineHours: number = 48
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if match days already exist
    const existing = await getSeasonMatchDays(seasonId);
    if (existing.length > 0) {
      return { success: false, error: 'Match days already exist for this season' };
    }

    const batch = writeBatch(db);
    const matchDaysCollection = collection(db, 'match_days');

    // Create one match day for each round
    for (let i = 1; i <= totalRounds; i++) {
      const matchDayRef = doc(matchDaysCollection);
      batch.set(matchDayRef, {
        season_id: seasonId,
        match_day_number: i,
        round_number: i, // Link to fixtures round_number
        status: 'pending',
        is_active: false,
        home_fixture_deadline_time: homeDeadlineTime,
        away_fixture_deadline_time: awayDeadlineTime,
        result_entry_deadline_hours: resultDeadlineHours,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
    }

    await batch.commit();
    return { success: true };
  } catch (error) {
    console.error('Error creating match days:', error);
    return { success: false, error: 'Failed to create match days' };
  }
}

/**
 * Get all match days for a season
 */
export async function getSeasonMatchDays(seasonId: string): Promise<MatchDay[]> {
  try {
    const matchDaysCollection = collection(db, 'match_days');
    const q = query(
      matchDaysCollection,
      where('season_id', '==', seasonId),
      orderBy('match_day_number', 'asc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        created_at: data.created_at?.toDate ? timestampToIST(data.created_at) : getISTNow(),
        updated_at: data.updated_at?.toDate ? timestampToIST(data.updated_at) : getISTNow(),
        started_at: data.started_at?.toDate ? timestampToIST(data.started_at) : undefined,
        paused_at: data.paused_at?.toDate ? timestampToIST(data.paused_at) : undefined,
        resumed_at: data.resumed_at?.toDate ? timestampToIST(data.resumed_at) : undefined,
        completed_at: data.completed_at?.toDate ? timestampToIST(data.completed_at) : undefined,
        deadlines: data.deadlines ? {
          home_fixture_deadline: data.deadlines.home_fixture_deadline?.toDate ? timestampToIST(data.deadlines.home_fixture_deadline) : undefined,
          away_fixture_deadline: data.deadlines.away_fixture_deadline?.toDate ? timestampToIST(data.deadlines.away_fixture_deadline) : undefined,
          result_entry_deadline: data.deadlines.result_entry_deadline?.toDate ? timestampToIST(data.deadlines.result_entry_deadline) : undefined,
        } : undefined,
      } as MatchDay;
    });
  } catch (error) {
    console.error('Error fetching match days:', error);
    return [];
  }
}

/**
 * Get active match day for a season
 */
export async function getActiveMatchDay(seasonId: string): Promise<MatchDay | null> {
  try {
    const matchDaysCollection = collection(db, 'match_days');
    const q = query(
      matchDaysCollection,
      where('season_id', '==', seasonId),
      where('is_active', '==', true)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;

    const doc = snapshot.docs[0];
    const data = doc.data();
    
    return {
      ...data,
      id: doc.id,
      created_at: data.created_at?.toDate ? timestampToIST(data.created_at) : getISTNow(),
      updated_at: data.updated_at?.toDate ? timestampToIST(data.updated_at) : getISTNow(),
      started_at: data.started_at?.toDate ? timestampToIST(data.started_at) : undefined,
      paused_at: data.paused_at?.toDate ? timestampToIST(data.paused_at) : undefined,
      resumed_at: data.resumed_at?.toDate ? timestampToIST(data.resumed_at) : undefined,
      completed_at: data.completed_at?.toDate ? timestampToIST(data.completed_at) : undefined,
      deadlines: data.deadlines ? {
        home_fixture_deadline: data.deadlines.home_fixture_deadline?.toDate ? timestampToIST(data.deadlines.home_fixture_deadline) : undefined,
        away_fixture_deadline: data.deadlines.away_fixture_deadline?.toDate ? timestampToIST(data.deadlines.away_fixture_deadline) : undefined,
        result_entry_deadline: data.deadlines.result_entry_deadline?.toDate ? timestampToIST(data.deadlines.result_entry_deadline) : undefined,
      } : undefined,
    } as MatchDay;
  } catch (error) {
    console.error('Error fetching active match day:', error);
    return null;
  }
}

/**
 * Start a match day
 */
export async function startMatchDay(matchDayId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const matchDayRef = doc(db, 'match_days', matchDayId);
    const matchDayDoc = await getDoc(matchDayRef);

    if (!matchDayDoc.exists()) {
      return { success: false, error: 'Match day not found' };
    }

    const matchDay = matchDayDoc.data() as MatchDay;

    // Check if another match day is active
    const activeMatchDay = await getActiveMatchDay(matchDay.season_id);
    if (activeMatchDay && activeMatchDay.id !== matchDayId) {
      return { success: false, error: 'Another match day is already active' };
    }

    // Calculate deadlines using IST
    const startedAt = getISTNow();
    const deadlines = calculateDeadlines(
      startedAt,
      matchDay.home_fixture_deadline_time,
      matchDay.away_fixture_deadline_time,
      matchDay.result_entry_deadline_hours
    );

    await updateDoc(matchDayRef, {
      status: 'active',
      is_active: true,
      started_at: serverTimestamp(),
      deadlines: {
        home_fixture_deadline: Timestamp.fromDate(deadlines.home_fixture_deadline),
        away_fixture_deadline: Timestamp.fromDate(deadlines.away_fixture_deadline),
        result_entry_deadline: Timestamp.fromDate(deadlines.result_entry_deadline),
      },
      updated_at: serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    console.error('Error starting match day:', error);
    return { success: false, error: 'Failed to start match day' };
  }
}

/**
 * Pause a match day
 */
export async function pauseMatchDay(matchDayId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const matchDayRef = doc(db, 'match_days', matchDayId);
    await updateDoc(matchDayRef, {
      status: 'paused',
      paused_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    console.error('Error pausing match day:', error);
    return { success: false, error: 'Failed to pause match day' };
  }
}

/**
 * Resume a match day
 */
export async function resumeMatchDay(matchDayId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const matchDayRef = doc(db, 'match_days', matchDayId);
    await updateDoc(matchDayRef, {
      status: 'active',
      resumed_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    console.error('Error resuming match day:', error);
    return { success: false, error: 'Failed to resume match day' };
  }
}

/**
 * Complete a match day
 */
export async function completeMatchDay(matchDayId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const matchDayRef = doc(db, 'match_days', matchDayId);
    await updateDoc(matchDayRef, {
      status: 'completed',
      is_active: false,
      completed_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    console.error('Error completing match day:', error);
    return { success: false, error: 'Failed to complete match day' };
  }
}

/**
 * Restart a match day (from paused or completed)
 */
export async function restartMatchDay(matchDayId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const matchDayRef = doc(db, 'match_days', matchDayId);
    const matchDayDoc = await getDoc(matchDayRef);

    if (!matchDayDoc.exists()) {
      return { success: false, error: 'Match day not found' };
    }

    const matchDay = matchDayDoc.data() as MatchDay;

    // Check if another match day is active
    const activeMatchDay = await getActiveMatchDay(matchDay.season_id);
    if (activeMatchDay && activeMatchDay.id !== matchDayId) {
      return { success: false, error: 'Another match day is already active' };
    }

    // Recalculate deadlines from current time in IST
    const startedAt = getISTNow();
    const deadlines = calculateDeadlines(
      startedAt,
      matchDay.home_fixture_deadline_time,
      matchDay.away_fixture_deadline_time,
      matchDay.result_entry_deadline_hours
    );

    await updateDoc(matchDayRef, {
      status: 'active',
      is_active: true,
      started_at: serverTimestamp(),
      paused_at: null,
      deadlines: {
        home_fixture_deadline: Timestamp.fromDate(deadlines.home_fixture_deadline),
        away_fixture_deadline: Timestamp.fromDate(deadlines.away_fixture_deadline),
        result_entry_deadline: Timestamp.fromDate(deadlines.result_entry_deadline),
      },
      updated_at: serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    console.error('Error restarting match day:', error);
    return { success: false, error: 'Failed to restart match day' };
  }
}

/**
 * Get all match days (alias for getSeasonMatchDays)
 */
export async function getAllMatchDays(seasonId: string): Promise<MatchDay[]> {
  return getSeasonMatchDays(seasonId);
}

/**
 * Update match day deadlines
 */
export async function updateMatchDayDeadlines(
  matchDayId: string,
  homeTime: string,
  awayTime: string,
  resultHours: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const matchDayRef = doc(db, 'match_days', matchDayId);
    const matchDayDoc = await getDoc(matchDayRef);

    if (!matchDayDoc.exists()) {
      return { success: false, error: 'Match day not found' };
    }

    const matchDay = matchDayDoc.data() as MatchDay;
    const updateData: any = {
      home_fixture_deadline_time: homeTime,
      away_fixture_deadline_time: awayTime,
      result_entry_deadline_hours: resultHours,
      updated_at: serverTimestamp(),
    };

    // If match day is active, recalculate deadlines
    if (matchDay.is_active && matchDay.started_at) {
      const deadlines = calculateDeadlines(
        matchDay.started_at.toDate(),
        homeTime,
        awayTime,
        resultHours
      );

      updateData.deadlines = {
        home_fixture_deadline: Timestamp.fromDate(deadlines.home_fixture_deadline),
        away_fixture_deadline: Timestamp.fromDate(deadlines.away_fixture_deadline),
        result_entry_deadline: Timestamp.fromDate(deadlines.result_entry_deadline),
      };
    }

    await updateDoc(matchDayRef, updateData);
    return { success: true };
  } catch (error) {
    console.error('Error updating match day deadlines:', error);
    return { success: false, error: 'Failed to update deadlines' };
  }
}

/**
 * Delete all match days for a season
 */
export async function deleteSeasonMatchDays(seasonId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const matchDays = await getSeasonMatchDays(seasonId);
    const batch = writeBatch(db);

    matchDays.forEach((matchDay) => {
      const matchDayRef = doc(db, 'match_days', matchDay.id);
      batch.delete(matchDayRef);
    });

    await batch.commit();
    return { success: true };
  } catch (error) {
    console.error('Error deleting match days:', error);
    return { success: false, error: 'Failed to delete match days' };
  }
}

/**
 * Sync match days from existing fixtures (for migration/repair)
 */
export async function syncMatchDaysFromFixtures(
  seasonId: string
): Promise<{ success: boolean; created: number; error?: string }> {
  try {
    // Import getSeasonFixtures here to avoid circular dependency
    const { getSeasonFixtures } = await import('./fixtures');
    
    // Get existing fixtures
    const fixtures = await getSeasonFixtures(seasonId);
    if (fixtures.length === 0) {
      return { success: false, created: 0, error: 'No fixtures found. Generate fixtures first.' };
    }

    // Get unique round numbers
    const rounds = [...new Set(fixtures.map(f => f.round_number))].sort((a, b) => a - b);
    console.log(`Found ${rounds.length} rounds in fixtures:`, rounds);

    // Check existing match days
    const existingMatchDays = await getSeasonMatchDays(seasonId);
    const existingRounds = new Set(existingMatchDays.map(md => md.round_number));
    
    // Create match days for rounds that don't have them
    const batch = writeBatch(db);
    const matchDaysCollection = collection(db, 'match_days');
    let created = 0;

    for (const roundNum of rounds) {
      if (!existingRounds.has(roundNum)) {
        const matchDayRef = doc(matchDaysCollection);
        batch.set(matchDayRef, {
          season_id: seasonId,
          match_day_number: roundNum,
          round_number: roundNum,
          status: 'pending',
          is_active: false,
          home_fixture_deadline_time: '17:00',
          away_fixture_deadline_time: '17:00',
          result_entry_deadline_hours: 48,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        });
        created++;
      }
    }

    if (created > 0) {
      await batch.commit();
      console.log(`✅ Created ${created} match days`);
    } else {
      console.log('ℹ️ All match days already exist');
    }

    return { success: true, created };
  } catch (error) {
    console.error('Error syncing match days:', error);
    return { success: false, created: 0, error: 'Failed to sync match days' };
  }
}
