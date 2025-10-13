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
  deleteDoc,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { createMatchDaysFromFixtures } from './matchDays';
import { getISTNow, createISTTimestamp, timestampToIST } from '../utils/timezone';

export interface TournamentFixture {
  id: string;
  season_id: string;
  round_number: number;
  match_number: number; // Match number within the round (1-5 for 10 teams)
  home_team_id: string;
  away_team_id: string;
  home_team_name: string;
  away_team_name: string;
  scheduled_date?: Date;
  status: 'scheduled' | 'in_progress' | 'completed' | 'postponed' | 'cancelled';
  home_score?: number;
  away_score?: number;
  result?: 'home_win' | 'away_win' | 'draw';
  leg: 'first' | 'second'; // For 2-legged tournaments
  created_at: Date;
  updated_at: Date;
}

export interface TournamentRound {
  round_number: number;
  matches: TournamentFixture[];
  leg: 'first' | 'second';
  completed_matches: number;
  total_matches: number;
  // Deadline configuration (stored in a separate collection)
  home_fixture_deadline_time?: string; // e.g., "17:00"
  away_fixture_deadline_time?: string; // e.g., "17:00"
  result_entry_deadline_day_offset?: number; // Days after fixture date
  result_entry_deadline_time?: string; // e.g., "00:30"
  scheduled_date?: string; // YYYY-MM-DD format
}

/**
 * Round-robin algorithm (Circle method)
 * Generates fixtures where each team plays every other team
 */
function generateRoundRobinFixtures(
  teamIds: string[],
  teamNames: string[],
  seasonId: string,
  isSecondLeg: boolean = false
): TournamentFixture[] {
  const fixtures: TournamentFixture[] = [];
  const teams = teamIds.map((id, index) => ({ id, name: teamNames[index] }));
  const numTeams = teams.length;

  // If odd number of teams, add a "bye" team
  const hasABye = numTeams % 2 !== 0;
  if (hasABye) {
    teams.push({ id: 'bye', name: 'BYE' });
  }

  const totalTeams = teams.length;
  const numRounds = totalTeams - 1;
  const matchesPerRound = totalTeams / 2;

  // Use circle method for round-robin
  for (let round = 0; round < numRounds; round++) {
    const roundMatches: TournamentFixture[] = [];
    
    for (let match = 0; match < matchesPerRound; match++) {
      let home: number, away: number;

      if (match === 0) {
        // First match: team 0 stays fixed
        home = 0;
        away = round + 1;
      } else {
        // Calculate positions using circle method
        home = (round + match) % (totalTeams - 1) + 1;
        away = (round + (totalTeams - 1) - match) % (totalTeams - 1) + 1;
      }

      // Skip if either team is the "bye"
      if (teams[home].id === 'bye' || teams[away].id === 'bye') {
        continue;
      }

      // For second leg, swap home and away teams
      const homeTeam = isSecondLeg ? teams[away] : teams[home];
      const awayTeam = isSecondLeg ? teams[home] : teams[away];

      const fixtureId = `${seasonId}_${isSecondLeg ? 'leg2' : 'leg1'}_r${round + 1}_m${roundMatches.length + 1}`;

      roundMatches.push({
        id: fixtureId,
        season_id: seasonId,
        round_number: round + 1,
        match_number: roundMatches.length + 1,
        home_team_id: homeTeam.id,
        away_team_id: awayTeam.id,
        home_team_name: homeTeam.name,
        away_team_name: awayTeam.name,
        status: 'scheduled',
        leg: isSecondLeg ? 'second' : 'first',
        created_at: getISTNow(),
        updated_at: getISTNow(),
      });
    }

    fixtures.push(...roundMatches);
  }

  return fixtures;
}

/**
 * Generate all fixtures for a season (both legs if 2-legged)
 */
export async function generateSeasonFixtures(
  seasonId: string,
  teamIds: string[],
  teamNames: string[],
  isTwoLegged: boolean = true
): Promise<{ success: boolean; fixtures?: TournamentFixture[]; error?: string }> {
  try {
    if (teamIds.length < 2) {
      return { success: false, error: 'At least 2 teams are required to generate fixtures' };
    }

    if (teamIds.length !== teamNames.length) {
      return { success: false, error: 'Team IDs and names arrays must have the same length' };
    }

    // Check if fixtures already exist for this season
    console.log('Checking for existing fixtures for season:', seasonId);
    let existingFixtures: TournamentFixture[] = [];
    try {
      existingFixtures = await getSeasonFixtures(seasonId);
      console.log('Found existing fixtures:', existingFixtures.length);
    } catch (error: any) {
      console.error('Error checking existing fixtures:', error);
      // If it's an index error, we can proceed assuming no fixtures exist
      if (error.message?.includes('index') || error.code === 'failed-precondition') {
        console.log('Index not ready yet, proceeding with generation...');
      } else {
        throw error;
      }
    }
    
    if (existingFixtures.length > 0) {
      return { success: false, error: 'Fixtures already exist for this season. Delete them first to regenerate.' };
    }

    // Generate first leg fixtures
    const firstLegFixtures = generateRoundRobinFixtures(teamIds, teamNames, seasonId, false);

    let allFixtures = firstLegFixtures;

    // Generate second leg fixtures if 2-legged tournament
    if (isTwoLegged) {
      const secondLegFixtures = generateRoundRobinFixtures(teamIds, teamNames, seasonId, true);
      // Adjust round numbers for second leg
      secondLegFixtures.forEach((fixture) => {
        fixture.round_number += firstLegFixtures.length / (teamIds.length / 2);
      });
      allFixtures = [...firstLegFixtures, ...secondLegFixtures];
    }

    // Save fixtures to Firestore using batch write
    console.log('Saving', allFixtures.length, 'fixtures to Firestore...');
    const batch = writeBatch(db);
    const fixturesCollection = collection(db, 'fixtures');

    allFixtures.forEach((fixture) => {
      const fixtureRef = doc(fixturesCollection, fixture.id);
      batch.set(fixtureRef, {
        ...fixture,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
    });

    console.log('Committing batch write...');
    await batch.commit();
    console.log('✅ Fixtures saved successfully');

    // Auto-create match days for each round
    const totalRounds = Math.max(...allFixtures.map(f => f.round_number));
    console.log(`Creating ${totalRounds} match days for ${totalRounds} rounds...`);
    
    try {
      const matchDayResult = await createMatchDaysFromFixtures(seasonId, totalRounds);
      if (matchDayResult.success) {
        console.log('✅ Match days created successfully');
      } else {
        console.warn('⚠️ Match days creation warning:', matchDayResult.error);
        // Don't fail fixture generation if match days already exist
      }
    } catch (error) {
      console.error('❌ Error creating match days:', error);
      // Don't fail fixture generation if match day creation fails
    }

    return { success: true, fixtures: allFixtures };
  } catch (error) {
    console.error('Error generating fixtures:', error);
    return { success: false, error: 'Failed to generate fixtures' };
  }
}

/**
 * Get all fixtures for a season
 */
export async function getSeasonFixtures(seasonId: string): Promise<TournamentFixture[]> {
  try {
    const fixturesCollection = collection(db, 'fixtures');
    const q = query(
      fixturesCollection,
      where('season_id', '==', seasonId),
      orderBy('round_number'),
      orderBy('match_number')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        created_at: data.created_at?.toDate ? timestampToIST(data.created_at) : getISTNow(),
        updated_at: data.updated_at?.toDate ? timestampToIST(data.updated_at) : getISTNow(),
        scheduled_date: data.scheduled_date?.toDate ? timestampToIST(data.scheduled_date) : undefined,
      } as TournamentFixture;
    });
  } catch (error) {
    console.error('Error fetching fixtures:', error);
    return [];
  }
}

/**
 * Get fixtures grouped by round
 */
export async function getFixturesByRounds(seasonId: string): Promise<TournamentRound[]> {
  try {
    const fixtures = await getSeasonFixtures(seasonId);
    const roundsMap = new Map<number, TournamentFixture[]>();

    fixtures.forEach((fixture) => {
      const roundKey = fixture.round_number;
      if (!roundsMap.has(roundKey)) {
        roundsMap.set(roundKey, []);
      }
      roundsMap.get(roundKey)!.push(fixture);
    });

    const rounds: TournamentRound[] = [];
    roundsMap.forEach((matches, roundNumber) => {
      const completedMatches = matches.filter((m) => m.status === 'completed').length;
      rounds.push({
        round_number: roundNumber,
        matches,
        leg: matches[0]?.leg || 'first',
        completed_matches: completedMatches,
        total_matches: matches.length,
      });
    });

    return rounds.sort((a, b) => a.round_number - b.round_number);
  } catch (error) {
    console.error('Error fetching fixtures by rounds:', error);
    return [];
  }
}

/**
 * Get a specific fixture by ID
 */
export async function getFixture(fixtureId: string): Promise<TournamentFixture | null> {
  try {
    const fixtureRef = doc(db, 'fixtures', fixtureId);
    const fixtureDoc = await getDoc(fixtureRef);

    if (!fixtureDoc.exists()) {
      return null;
    }

    const data = fixtureDoc.data();
    return {
      ...data,
      id: fixtureDoc.id,
      created_at: data.created_at?.toDate ? timestampToIST(data.created_at) : getISTNow(),
      updated_at: data.updated_at?.toDate ? timestampToIST(data.updated_at) : getISTNow(),
      scheduled_date: data.scheduled_date?.toDate ? timestampToIST(data.scheduled_date) : undefined,
    } as TournamentFixture;
  } catch (error) {
    console.error('Error fetching fixture:', error);
    return null;
  }
}

/**
 * Update fixture result
 */
export async function updateFixtureResult(
  fixtureId: string,
  homeScore: number,
  awayScore: number
): Promise<boolean> {
  try {
    const fixtureRef = doc(db, 'fixtures', fixtureId);

    let result: 'home_win' | 'away_win' | 'draw';
    if (homeScore > awayScore) {
      result = 'home_win';
    } else if (awayScore > homeScore) {
      result = 'away_win';
    } else {
      result = 'draw';
    }

    await setDoc(
      fixtureRef,
      {
        home_score: homeScore,
        away_score: awayScore,
        result,
        status: 'completed',
        updated_at: serverTimestamp(),
      },
      { merge: true }
    );

    return true;
  } catch (error) {
    console.error('Error updating fixture result:', error);
    return false;
  }
}

/**
 * Update fixture status
 */
export async function updateFixtureStatus(
  fixtureId: string,
  status: TournamentFixture['status']
): Promise<boolean> {
  try {
    const fixtureRef = doc(db, 'fixtures', fixtureId);
    await setDoc(
      fixtureRef,
      {
        status,
        updated_at: serverTimestamp(),
      },
      { merge: true }
    );

    return true;
  } catch (error) {
    console.error('Error updating fixture status:', error);
    return false;
  }
}

/**
 * Delete all fixtures for a season
 */
export async function deleteSeasonFixtures(seasonId: string): Promise<boolean> {
  try {
    const fixtures = await getSeasonFixtures(seasonId);

    const batch = writeBatch(db);
    fixtures.forEach((fixture) => {
      const fixtureRef = doc(db, 'fixtures', fixture.id);
      batch.delete(fixtureRef);
    });

    await batch.commit();
    return true;
  } catch (error) {
    console.error('Error deleting fixtures:', error);
    return false;
  }
}

/**
 * Get team fixtures (all matches for a specific team)
 */
export async function getTeamFixtures(
  seasonId: string,
  teamId: string
): Promise<TournamentFixture[]> {
  try {
    const allFixtures = await getSeasonFixtures(seasonId);
    return allFixtures.filter(
      (fixture) =>
        fixture.home_team_id === teamId || fixture.away_team_id === teamId
    );
  } catch (error) {
    console.error('Error fetching team fixtures:', error);
    return [];
  }
}

/**
 * Get round deadline configuration
 */
export async function getRoundDeadlines(
  seasonId: string,
  roundNumber: number,
  leg: 'first' | 'second'
): Promise<{
  home_fixture_deadline_time: string;
  away_fixture_deadline_time: string;
  result_entry_deadline_day_offset: number;
  result_entry_deadline_time: string;
  scheduled_date?: string;
} | null> {
  try {
    const roundId = `${seasonId}_r${roundNumber}_${leg}`;
    const roundRef = doc(db, 'round_deadlines', roundId);
    const roundDoc = await getDoc(roundRef);

    if (!roundDoc.exists()) {
      // Return default values if not set
      return {
        home_fixture_deadline_time: '17:00',
        away_fixture_deadline_time: '17:00',
        result_entry_deadline_day_offset: 2,
        result_entry_deadline_time: '00:30',
      };
    }

    return roundDoc.data() as any;
  } catch (error) {
    console.error('Error fetching round deadlines:', error);
    return null;
  }
}

/**
 * Update round deadline configuration
 */
export async function updateRoundDeadlines(
  seasonId: string,
  roundNumber: number,
  leg: 'first' | 'second',
  deadlines: {
    home_fixture_deadline_time: string;
    away_fixture_deadline_time: string;
    result_entry_deadline_day_offset: number;
    result_entry_deadline_time: string;
    scheduled_date?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const roundId = `${seasonId}_r${roundNumber}_${leg}`;
    const roundRef = doc(db, 'round_deadlines', roundId);

    await setDoc(
      roundRef,
      {
        season_id: seasonId,
        round_number: roundNumber,
        leg,
        ...deadlines,
        updated_at: serverTimestamp(),
      },
      { merge: true }
    );

    return { success: true };
  } catch (error) {
    console.error('Error updating round deadlines:', error);
    return { success: false, error: 'Failed to update round deadlines' };
  }
}

/**
 * Get fixtures by rounds with deadline and status information
 */
export async function getFixturesByRoundsWithDeadlines(
  seasonId: string
): Promise<TournamentRound[]> {
  try {
    const rounds = await getFixturesByRounds(seasonId);
    
    // Fetch deadline and status information for each round
    const roundsWithDeadlines = await Promise.all(
      rounds.map(async (round) => {
        const roundId = `${seasonId}_r${round.round_number}_${round.leg}`;
        const roundRef = doc(db, 'round_deadlines', roundId);
        const roundDoc = await getDoc(roundRef);
        
        let deadlineData: any = {
          home_fixture_deadline_time: '17:00',
          away_fixture_deadline_time: '17:00',
          result_entry_deadline_day_offset: 2,
          result_entry_deadline_time: '00:30',
          status: 'pending',
          is_active: false,
        };
        
        if (roundDoc.exists()) {
          deadlineData = { ...deadlineData, ...roundDoc.data() };
        }
        
        return {
          ...round,
          ...deadlineData,
        };
      })
    );

    return roundsWithDeadlines;
  } catch (error) {
    console.error('Error fetching fixtures by rounds with deadlines:', error);
    return [];
  }
}

/**
 * Update round status
 */
export async function updateRoundStatus(
  seasonId: string,
  roundNumber: number,
  leg: 'first' | 'second',
  status: 'pending' | 'active' | 'paused' | 'completed',
  isActive: boolean = false
): Promise<{ success: boolean; error?: string }> {
  try {
    const roundId = `${seasonId}_r${roundNumber}_${leg}`;
    const roundRef = doc(db, 'round_deadlines', roundId);

    // Check if another round is active when trying to activate this one
    if (status === 'active' && isActive) {
      const allRounds = await getFixturesByRoundsWithDeadlines(seasonId);
      const activeRound = allRounds.find((r: any) => r.is_active && `${seasonId}_r${r.round_number}_${r.leg}` !== roundId);
      
      if (activeRound) {
        return { 
          success: false, 
          error: `Round ${activeRound.round_number} (${activeRound.leg}) is already active` 
        };
      }
    }

    await setDoc(
      roundRef,
      {
        season_id: seasonId,
        round_number: roundNumber,
        leg,
        status,
        is_active: isActive,
        updated_at: serverTimestamp(),
      },
      { merge: true }
    );

    return { success: true };
  } catch (error) {
    console.error('Error updating round status:', error);
    return { success: false, error: 'Failed to update round status' };
  }
}

/**
 * Start a round
 */
export async function startRound(
  seasonId: string,
  roundNumber: number,
  leg: 'first' | 'second'
): Promise<{ success: boolean; error?: string }> {
  return updateRoundStatus(seasonId, roundNumber, leg, 'active', true);
}

/**
 * Pause a round
 */
export async function pauseRound(
  seasonId: string,
  roundNumber: number,
  leg: 'first' | 'second'
): Promise<{ success: boolean; error?: string }> {
  return updateRoundStatus(seasonId, roundNumber, leg, 'paused', false);
}

/**
 * Resume a round
 */
export async function resumeRound(
  seasonId: string,
  roundNumber: number,
  leg: 'first' | 'second'
): Promise<{ success: boolean; error?: string }> {
  return updateRoundStatus(seasonId, roundNumber, leg, 'active', true);
}

/**
 * Complete a round
 */
export async function completeRound(
  seasonId: string,
  roundNumber: number,
  leg: 'first' | 'second'
): Promise<{ success: boolean; error?: string }> {
  return updateRoundStatus(seasonId, roundNumber, leg, 'completed', false);
}

/**
 * Restart a round
 */
export async function restartRound(
  seasonId: string,
  roundNumber: number,
  leg: 'first' | 'second'
): Promise<{ success: boolean; error?: string }> {
  return updateRoundStatus(seasonId, roundNumber, leg, 'active', true);
}
