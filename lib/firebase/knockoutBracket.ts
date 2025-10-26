import { db } from './config';
import { collection, addDoc, query, where, getDocs, orderBy } from 'firebase/firestore';
import { getAdvancingTeams } from './groupStage';

export interface KnockoutMatch {
  id?: string;
  season_id: string;
  tournament_id: string;
  stage: 'round_of_16' | 'quarter_final' | 'semi_final' | 'final' | 'third_place';
  match_number: number;
  home_team_id?: string;
  home_team_name?: string;
  away_team_id?: string;
  away_team_name?: string;
  scheduled_date?: Date;
  status: 'pending' | 'scheduled' | 'in_progress' | 'completed';
  home_score?: number;
  away_score?: number;
  result?: 'home_win' | 'away_win';
  winner_id?: string;
  winner_name?: string;
  created_at: Date;
}

/**
 * Generate knockout-only bracket (no group stage)
 */
export async function generateKnockoutOnly(
  seasonId: string,
  tournamentId: string,
  teams: Array<{ id: string; name: string }>
): Promise<{ success: boolean; matches?: KnockoutMatch[]; error?: string }> {
  try {
    const totalTeams = teams.length;

    if (totalTeams < 2) {
      return {
        success: false,
        error: 'Need at least 2 teams for knockout tournament'
      };
    }

    // Determine starting stage based on number of teams
    let stage: KnockoutMatch['stage'];
    if (totalTeams === 16 || totalTeams > 8) {
      stage = 'round_of_16';
    } else if (totalTeams === 8 || totalTeams > 4) {
      stage = 'quarter_final';
    } else if (totalTeams === 4 || totalTeams > 2) {
      stage = 'semi_final';
    } else {
      stage = 'final';
    }

    // Shuffle teams for random bracket seeding
    const shuffledTeams = [...teams].sort(() => Math.random() - 0.5);

    // Create knockout matches
    const matches: KnockoutMatch[] = [];
    const requiredTeams = stage === 'round_of_16' ? 16 : 
                         stage === 'quarter_final' ? 8 : 
                         stage === 'semi_final' ? 4 : 2;
    const numberOfMatches = requiredTeams / 2;

    // Pair teams sequentially
    for (let i = 0; i < numberOfMatches; i++) {
      const homeTeam = shuffledTeams[i * 2];
      const awayTeam = shuffledTeams[i * 2 + 1];

      if (homeTeam && awayTeam) {
        matches.push({
          season_id: seasonId,
          tournament_id: tournamentId,
          stage: stage,
          match_number: i + 1,
          home_team_id: homeTeam.id,
          home_team_name: homeTeam.name,
          away_team_id: awayTeam.id,
          away_team_name: awayTeam.name,
          status: 'scheduled',
          created_at: new Date(),
        });
      } else if (homeTeam && !awayTeam) {
        // Odd number of teams - give bye to last team
        matches.push({
          season_id: seasonId,
          tournament_id: tournamentId,
          stage: stage,
          match_number: i + 1,
          home_team_id: homeTeam.id,
          home_team_name: homeTeam.name,
          status: 'completed',
          winner_id: homeTeam.id,
          winner_name: homeTeam.name,
          created_at: new Date(),
        });
      }
    }

    // Save matches to Firestore
    const matchesCollection = collection(db, 'knockout_matches');
    for (const match of matches) {
      await addDoc(matchesCollection, match);
    }

    return { success: true, matches };
  } catch (error) {
    console.error('Error generating knockout-only bracket:', error);
    return { success: false, error: 'Failed to generate knockout bracket' };
  }
}

/**
 * Generate knockout bracket from group stage results
 */
export async function generateKnockoutBracket(
  seasonId: string,
  tournamentId: string,
  numberOfGroups: number,
  teamsAdvancingPerGroup: number
): Promise<{ success: boolean; matches?: KnockoutMatch[]; error?: string }> {
  try {
    // Get teams advancing from groups
    const advancingTeams = await getAdvancingTeams(
      seasonId,
      tournamentId,
      teamsAdvancingPerGroup
    );

    const totalTeams = advancingTeams.length;

    if (totalTeams < 2) {
      return {
        success: false,
        error: 'Not enough teams to create knockout bracket'
      };
    }

    // Determine knockout stage format based on number of teams
    let stage: KnockoutMatch['stage'];
    if (totalTeams === 16) {
      stage = 'round_of_16';
    } else if (totalTeams === 8) {
      stage = 'quarter_final';
    } else if (totalTeams === 4) {
      stage = 'semi_final';
    } else if (totalTeams === 2) {
      stage = 'final';
    } else {
      return {
        success: false,
        error: `Invalid number of teams (${totalTeams}). Must be 2, 4, 8, or 16.`
      };
    }

    // Sort teams by group for seeding
    // Typical seeding: Group winners play group runners-up from different groups
    const sortedTeams = [...advancingTeams].sort((a, b) => {
      if (a.position !== b.position) return a.position - b.position;
      return a.group_name.localeCompare(b.group_name);
    });

    // Create pairings
    const matches: KnockoutMatch[] = [];
    const numberOfMatches = totalTeams / 2;

    // For standard World Cup-style seeding:
    // 1A vs 2B, 1B vs 2A, 1C vs 2D, 1D vs 2C, etc.
    if (teamsAdvancingPerGroup === 2 && totalTeams >= 4) {
      const winners = sortedTeams.filter(t => t.position === 1);
      const runnersUp = sortedTeams.filter(t => t.position === 2);

      // Pair winners with runners-up from different groups
      for (let i = 0; i < winners.length && i < runnersUp.length; i++) {
        // Ensure teams from same group don't meet
        let opponentIndex = i;
        if (winners[i].group_name === runnersUp[opponentIndex].group_name) {
          opponentIndex = (i + 1) % runnersUp.length;
        }

        matches.push({
          season_id: seasonId,
          tournament_id: tournamentId,
          stage: stage,
          match_number: i + 1,
          home_team_id: winners[i].team_id,
          home_team_name: winners[i].team_name,
          away_team_id: runnersUp[opponentIndex].team_id,
          away_team_name: runnersUp[opponentIndex].team_name,
          status: 'scheduled',
          created_at: new Date(),
        });
      }
    } else {
      // Simple sequential pairing
      for (let i = 0; i < numberOfMatches; i++) {
        const homeTeam = sortedTeams[i * 2];
        const awayTeam = sortedTeams[i * 2 + 1];

        if (homeTeam && awayTeam) {
          matches.push({
            season_id: seasonId,
            tournament_id: tournamentId,
            stage: stage,
            match_number: i + 1,
            home_team_id: homeTeam.team_id,
            home_team_name: homeTeam.team_name,
            away_team_id: awayTeam.team_id,
            away_team_name: awayTeam.team_name,
            status: 'scheduled',
            created_at: new Date(),
          });
        }
      }
    }

    // Save matches to Firestore
    const matchesCollection = collection(db, 'knockout_matches');

    for (const match of matches) {
      await addDoc(matchesCollection, match);
    }

    return { success: true, matches };
  } catch (error) {
    console.error('Error generating knockout bracket:', error);
    return { success: false, error: 'Failed to generate knockout bracket' };
  }
}

/**
 * Get knockout matches for a tournament
 */
export async function getKnockoutMatches(
  seasonId: string,
  tournamentId: string
): Promise<Record<KnockoutMatch['stage'], KnockoutMatch[]>> {
  try {
    const matchesCollection = collection(db, 'knockout_matches');
    const q = query(
      matchesCollection,
      where('season_id', '==', seasonId),
      where('tournament_id', '==', tournamentId),
      orderBy('match_number')
    );

    const snapshot = await getDocs(q);
    const matches: KnockoutMatch[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as KnockoutMatch));

    // Organize by stage
    const stages: Record<KnockoutMatch['stage'], KnockoutMatch[]> = {
      round_of_16: [],
      quarter_final: [],
      semi_final: [],
      final: [],
      third_place: []
    };

    matches.forEach(match => {
      stages[match.stage].push(match);
    });

    return stages;
  } catch (error) {
    console.error('Error fetching knockout matches:', error);
    return {
      round_of_16: [],
      quarter_final: [],
      semi_final: [],
      final: [],
      third_place: []
    };
  }
}

/**
 * Progress winners to next round
 */
export async function progressToNextRound(
  seasonId: string,
  tournamentId: string,
  currentStage: KnockoutMatch['stage']
): Promise<{ success: boolean; newMatches?: KnockoutMatch[]; error?: string }> {
  try {
    // Get completed matches from current stage
    const allMatches = await getKnockoutMatches(seasonId, tournamentId);
    const currentMatches = allMatches[currentStage].filter(m => m.status === 'completed' && m.winner_id);

    if (currentMatches.length === 0) {
      return {
        success: false,
        error: 'No completed matches to progress from'
      };
    }

    // Determine next stage
    const stageOrder: KnockoutMatch['stage'][] = [
      'round_of_16',
      'quarter_final',
      'semi_final',
      'final'
    ];
    const currentIndex = stageOrder.indexOf(currentStage);
    
    if (currentIndex === -1 || currentIndex === stageOrder.length - 1) {
      return {
        success: false,
        error: 'Cannot progress beyond final'
      };
    }

    const nextStage = stageOrder[currentIndex + 1];

    // Create next round matches from winners
    const newMatches: KnockoutMatch[] = [];
    const numberOfMatches = currentMatches.length / 2;

    for (let i = 0; i < numberOfMatches; i++) {
      const match1 = currentMatches[i * 2];
      const match2 = currentMatches[i * 2 + 1];

      if (match1 && match2 && match1.winner_id && match2.winner_id) {
        newMatches.push({
          season_id: seasonId,
          tournament_id: tournamentId,
          stage: nextStage,
          match_number: i + 1,
          home_team_id: match1.winner_id,
          home_team_name: match1.winner_name,
          away_team_id: match2.winner_id,
          away_team_name: match2.winner_name,
          status: 'scheduled',
          created_at: new Date(),
        });
      }
    }

    // Save new matches
    const matchesCollection = collection(db, 'knockout_matches');
    for (const match of newMatches) {
      await addDoc(matchesCollection, match);
    }

    return { success: true, newMatches };
  } catch (error) {
    console.error('Error progressing to next round:', error);
    return { success: false, error: 'Failed to progress to next round' };
  }
}

/**
 * Get stage display name
 */
export function getStageName(stage: KnockoutMatch['stage']): string {
  const names: Record<KnockoutMatch['stage'], string> = {
    round_of_16: 'Round of 16',
    quarter_final: 'Quarter Finals',
    semi_final: 'Semi Finals',
    final: 'Final',
    third_place: 'Third Place Playoff'
  };
  return names[stage];
}
