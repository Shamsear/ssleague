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

    // Save fixtures to Neon database only
    console.log('Saving', allFixtures.length, 'fixtures to Neon database...');
    
    const neonResponse = await fetch('/api/fixtures/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fixtures: allFixtures }),
    });
    
    if (!neonResponse.ok) {
      const errorText = await neonResponse.text();
      throw new Error(`Failed to save fixtures to Neon: ${errorText}`);
    }
    
    console.log('✅ Fixtures saved to Neon successfully');

    // Create round_deadlines for each unique round/leg combination
    console.log('Creating round_deadlines entries...');
    
    // Get unique round/leg combinations
    const roundsSet = new Set<string>();
    allFixtures.forEach(fixture => {
      roundsSet.add(`${fixture.round_number}_${fixture.leg}`);
    });
    
    // Create round_deadlines for each round
    const roundDeadlinePromises = Array.from(roundsSet).map(async (roundKey) => {
      const [roundNumber, leg] = roundKey.split('_');
      
      try {
        // Use absolute URL for server-side fetch
        const baseUrl = typeof window !== 'undefined' 
          ? window.location.origin 
          : process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        
        const response = await fetch(`${baseUrl}/api/round-deadlines`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            season_id: seasonId,
            round_number: parseInt(roundNumber),
            leg: leg,
            status: 'pending'
            // Deadlines will be fetched from tournament_settings by the API
          }),
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Failed to create round_deadline for round ${roundNumber} ${leg}:`, errorText);
        } else {
          const result = await response.json();
          console.log(`✅ Round deadline created for round ${roundNumber} ${leg}:`, result);
        }
      } catch (error) {
        console.error(`Error creating round_deadline for round ${roundNumber} ${leg}:`, error);
      }
    });
    
    await Promise.all(roundDeadlinePromises);
    console.log('✅ All round_deadlines created');

    return { success: true, fixtures: allFixtures };
  } catch (error) {
    console.error('Error generating fixtures:', error);
    return { success: false, error: 'Failed to generate fixtures' };
  }
}

/**
 * Get all fixtures for a season from Neon database
 */
export async function getSeasonFixtures(seasonId: string): Promise<TournamentFixture[]> {
  try {
    const response = await fetch(`/api/fixtures/season?season_id=${seasonId}`);
    
    if (!response.ok) {
      console.error('Failed to fetch fixtures from Neon');
      return [];
    }
    
    const { fixtures } = await response.json();
    
    return fixtures.map((fixture: any) => ({
      ...fixture,
      created_at: fixture.created_at ? new Date(fixture.created_at) : getISTNow(),
      updated_at: fixture.updated_at ? new Date(fixture.updated_at) : getISTNow(),
      scheduled_date: fixture.scheduled_date ? new Date(fixture.scheduled_date) : undefined,
    }));
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
 * Delete all fixtures for a season (from Neon database)
 */
export async function deleteSeasonFixtures(seasonId: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/fixtures/season?season_id=${seasonId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      console.error('Failed to delete fixtures from Neon');
      return false;
    }

    const result = await response.json();
    console.log('Fixtures, matchups, and round_deadlines deleted:', result.message);
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
 * Get round deadline configuration (from Neon)
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
    const response = await fetch(`/api/round-deadlines?season_id=${seasonId}&round_number=${roundNumber}&leg=${leg}`);
    
    if (!response.ok) {
      console.error('Failed to fetch round deadlines from Neon');
      return {
        home_fixture_deadline_time: '23:30',
        away_fixture_deadline_time: '23:45',
        result_entry_deadline_day_offset: 2,
        result_entry_deadline_time: '00:30',
      };
    }

    const { roundDeadline } = await response.json();
    
    if (!roundDeadline) {
      return {
        home_fixture_deadline_time: '23:30',
        away_fixture_deadline_time: '23:45',
        result_entry_deadline_day_offset: 2,
        result_entry_deadline_time: '00:30',
      };
    }

    return roundDeadline;
  } catch (error) {
    console.error('Error fetching round deadlines:', error);
    return null;
  }
}

/**
 * Update round deadline configuration (in Neon)
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
    const response = await fetch('/api/round-deadlines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        season_id: seasonId,
        round_number: roundNumber,
        leg,
        ...deadlines,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error || 'Failed to update round deadlines' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating round deadlines:', error);
    return { success: false, error: 'Failed to update round deadlines' };
  }
}

/**
 * Get fixtures by rounds with deadline and status information (from Neon)
 */
export async function getFixturesByRoundsWithDeadlines(
  seasonId: string
): Promise<TournamentRound[]> {
  try {
    const rounds = await getFixturesByRounds(seasonId);
    
    // Fetch deadline and status information for each round from Neon API
    const roundsWithDeadlines = await Promise.all(
      rounds.map(async (round) => {
        try {
          const response = await fetch(`/api/round-deadlines?season_id=${seasonId}&round_number=${round.round_number}&leg=${round.leg}`);
          
          let deadlineData: any = {
            home_fixture_deadline_time: '23:30',
            away_fixture_deadline_time: '23:45',
            result_entry_deadline_day_offset: 2,
            result_entry_deadline_time: '00:30',
            status: 'pending',
            is_active: false,
          };
          
          if (response.ok) {
            const { roundDeadline } = await response.json();
            if (roundDeadline) {
              deadlineData = { ...deadlineData, ...roundDeadline };
            }
          }
          
          return {
            ...round,
            ...deadlineData,
          };
        } catch (error) {
          console.error(`Error fetching deadline for round ${round.round_number}:`, error);
          return {
            ...round,
            home_fixture_deadline_time: '23:30',
            away_fixture_deadline_time: '23:45',
            result_entry_deadline_day_offset: 2,
            result_entry_deadline_time: '00:30',
            status: 'pending',
            is_active: false,
          };
        }
      })
    );

    return roundsWithDeadlines;
  } catch (error) {
    console.error('Error fetching fixtures by rounds with deadlines:', error);
    return [];
  }
}

/**
 * Update round status (in Neon)
 */
export async function updateRoundStatus(
  seasonId: string,
  roundNumber: number,
  leg: 'first' | 'second',
  status: 'pending' | 'active' | 'paused' | 'completed',
  isActive: boolean = false
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if another round is active when trying to activate this one
    if (status === 'active' && isActive) {
      const allRounds = await getFixturesByRoundsWithDeadlines(seasonId);
      const activeRound = allRounds.find((r: any) => 
        r.is_active && 
        !(r.round_number === roundNumber && r.leg === leg)
      );
      
      if (activeRound) {
        return { 
          success: false, 
          error: `Round ${activeRound.round_number} (${activeRound.leg}) is already active` 
        };
      }
    }

    // First, get the current round deadline data
    const getResponse = await fetch(`/api/round-deadlines?season_id=${seasonId}&round_number=${roundNumber}&leg=${leg}`);
    
    if (!getResponse.ok) {
      return { success: false, error: 'Failed to fetch round deadline' };
    }
    
    const { roundDeadline } = await getResponse.json();
    
    if (!roundDeadline) {
      return { success: false, error: 'Round deadline not found' };
    }

    // Update with new status
    const updateResponse = await fetch('/api/round-deadlines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        season_id: seasonId,
        round_number: roundNumber,
        leg,
        scheduled_date: roundDeadline.scheduled_date,
        home_fixture_deadline_time: roundDeadline.home_fixture_deadline_time,
        away_fixture_deadline_time: roundDeadline.away_fixture_deadline_time,
        result_entry_deadline_day_offset: roundDeadline.result_entry_deadline_day_offset,
        result_entry_deadline_time: roundDeadline.result_entry_deadline_time,
        status,
        is_active: isActive,
      }),
    });

    if (!updateResponse.ok) {
      return { success: false, error: 'Failed to update round status' };
    }

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
