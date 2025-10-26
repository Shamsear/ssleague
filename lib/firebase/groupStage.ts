import { db } from './config';
import { collection, addDoc, query, where, getDocs, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';

export interface GroupFixture {
  id?: string;
  season_id: string;
  tournament_id: string;
  group_name: string; // 'A', 'B', 'C', etc.
  round: number;
  home_team_id: string;
  home_team_name: string;
  away_team_id: string;
  away_team_name: string;
  scheduled_date?: Date;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  home_score?: number;
  away_score?: number;
  result?: 'home_win' | 'away_win' | 'draw';
  created_at: Date;
}

export interface GroupStanding {
  group_name: string;
  team_id: string;
  team_name: string;
  matches_played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
  position: number;
}

/**
 * Generate round-robin fixtures for a single group
 */
function generateRoundRobinFixtures(
  teams: Array<{ id: string; name: string }>,
  groupName: string,
  seasonId: string,
  tournamentId: string
): GroupFixture[] {
  const fixtures: GroupFixture[] = [];
  const teamCount = teams.length;
  
  if (teamCount < 2) return fixtures;
  
  // Round-robin algorithm
  const rounds = teamCount % 2 === 0 ? teamCount - 1 : teamCount;
  const matchesPerRound = Math.floor(teamCount / 2);
  
  // Create a copy of teams array for rotation
  const teamList = [...teams];
  
  for (let round = 0; round < rounds; round++) {
    for (let match = 0; match < matchesPerRound; match++) {
      const homeIndex = match;
      const awayIndex = teamCount - 1 - match;
      
      if (homeIndex < teamList.length && awayIndex < teamList.length) {
        const homeTeam = teamList[homeIndex];
        const awayTeam = teamList[awayIndex];
        
        fixtures.push({
          season_id: seasonId,
          tournament_id: tournamentId,
          group_name: groupName,
          round: round + 1,
          home_team_id: homeTeam.id,
          home_team_name: homeTeam.name,
          away_team_id: awayTeam.id,
          away_team_name: awayTeam.name,
          status: 'scheduled',
          created_at: new Date(),
        });
      }
    }
    
    // Rotate teams (keep first team fixed, rotate others)
    if (teamList.length > 2) {
      const lastTeam = teamList.pop()!;
      teamList.splice(1, 0, lastTeam);
    }
  }
  
  return fixtures;
}

/**
 * Generate fixtures for all groups in a tournament
 */
export async function generateGroupStageFixtures(
  seasonId: string,
  tournamentId: string,
  numberOfGroups: number,
  teamsPerGroup: number,
  allTeams: Array<{ id: string; name: string }>
): Promise<{ success: boolean; fixtures?: GroupFixture[]; error?: string }> {
  try {
    const totalTeamsNeeded = numberOfGroups * teamsPerGroup;
    
    if (allTeams.length < totalTeamsNeeded) {
      return {
        success: false,
        error: `Not enough teams. Need ${totalTeamsNeeded} teams (${numberOfGroups} groups × ${teamsPerGroup} teams), but only ${allTeams.length} available.`
      };
    }
    
    // Shuffle teams for random distribution
    const shuffledTeams = [...allTeams].sort(() => Math.random() - 0.5);
    
    const allFixtures: GroupFixture[] = [];
    const groupNames = 'ABCDEFGH'.split('').slice(0, numberOfGroups);
    
    // Distribute teams into groups
    for (let groupIndex = 0; groupIndex < numberOfGroups; groupIndex++) {
      const groupName = groupNames[groupIndex];
      const startIndex = groupIndex * teamsPerGroup;
      const groupTeams = shuffledTeams.slice(startIndex, startIndex + teamsPerGroup);
      
      // Generate fixtures for this group
      const groupFixtures = generateRoundRobinFixtures(
        groupTeams,
        groupName,
        seasonId,
        tournamentId
      );
      
      allFixtures.push(...groupFixtures);
    }
    
    // Save fixtures to Firestore
    const fixturesCollection = collection(db, 'group_fixtures');
    
    for (const fixture of allFixtures) {
      await addDoc(fixturesCollection, fixture);
    }
    
    return { success: true, fixtures: allFixtures };
  } catch (error) {
    console.error('Error generating group stage fixtures:', error);
    return { success: false, error: 'Failed to generate fixtures' };
  }
}

/**
 * Get all fixtures for a tournament, organized by group
 */
export async function getGroupFixtures(
  seasonId: string,
  tournamentId: string
): Promise<Record<string, GroupFixture[]>> {
  try {
    const fixturesCollection = collection(db, 'group_fixtures');
    const q = query(
      fixturesCollection,
      where('season_id', '==', seasonId),
      where('tournament_id', '==', tournamentId),
      orderBy('group_name'),
      orderBy('round')
    );
    
    const snapshot = await getDocs(q);
    const fixtures: GroupFixture[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as GroupFixture));
    
    // Organize by group
    const groupedFixtures: Record<string, GroupFixture[]> = {};
    
    fixtures.forEach(fixture => {
      if (!groupedFixtures[fixture.group_name]) {
        groupedFixtures[fixture.group_name] = [];
      }
      groupedFixtures[fixture.group_name].push(fixture);
    });
    
    return groupedFixtures;
  } catch (error) {
    console.error('Error fetching group fixtures:', error);
    return {};
  }
}

/**
 * Calculate standings for all groups
 */
export async function calculateGroupStandings(
  seasonId: string,
  tournamentId: string
): Promise<Record<string, GroupStanding[]>> {
  try {
    const groupFixtures = await getGroupFixtures(seasonId, tournamentId);
    const standings: Record<string, GroupStanding[]> = {};
    
    // Calculate standings for each group
    Object.keys(groupFixtures).forEach(groupName => {
      const fixtures = groupFixtures[groupName];
      const teamStats: Record<string, GroupStanding> = {};
      
      // Initialize team stats
      fixtures.forEach(fixture => {
        if (!teamStats[fixture.home_team_id]) {
          teamStats[fixture.home_team_id] = {
            group_name: groupName,
            team_id: fixture.home_team_id,
            team_name: fixture.home_team_name,
            matches_played: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            goals_for: 0,
            goals_against: 0,
            goal_difference: 0,
            points: 0,
            position: 0,
          };
        }
        
        if (!teamStats[fixture.away_team_id]) {
          teamStats[fixture.away_team_id] = {
            group_name: groupName,
            team_id: fixture.away_team_id,
            team_name: fixture.away_team_name,
            matches_played: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            goals_for: 0,
            goals_against: 0,
            goal_difference: 0,
            points: 0,
            position: 0,
          };
        }
      });
      
      // Calculate stats from completed fixtures
      fixtures.forEach(fixture => {
        if (fixture.status === 'completed' && fixture.home_score !== undefined && fixture.away_score !== undefined) {
          const homeTeam = teamStats[fixture.home_team_id];
          const awayTeam = teamStats[fixture.away_team_id];
          
          homeTeam.matches_played++;
          awayTeam.matches_played++;
          
          homeTeam.goals_for += fixture.home_score;
          homeTeam.goals_against += fixture.away_score;
          awayTeam.goals_for += fixture.away_score;
          awayTeam.goals_against += fixture.home_score;
          
          if (fixture.result === 'home_win') {
            homeTeam.wins++;
            homeTeam.points += 3;
            awayTeam.losses++;
          } else if (fixture.result === 'away_win') {
            awayTeam.wins++;
            awayTeam.points += 3;
            homeTeam.losses++;
          } else if (fixture.result === 'draw') {
            homeTeam.draws++;
            homeTeam.points += 1;
            awayTeam.draws++;
            awayTeam.points += 1;
          }
          
          homeTeam.goal_difference = homeTeam.goals_for - homeTeam.goals_against;
          awayTeam.goal_difference = awayTeam.goals_for - awayTeam.goals_against;
        }
      });
      
      // Sort teams by: points > goal difference > goals for
      const sortedTeams = Object.values(teamStats).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.goal_difference !== a.goal_difference) return b.goal_difference - a.goal_difference;
        return b.goals_for - a.goals_for;
      });
      
      // Assign positions
      sortedTeams.forEach((team, index) => {
        team.position = index + 1;
      });
      
      standings[groupName] = sortedTeams;
    });
    
    return standings;
  } catch (error) {
    console.error('Error calculating group standings:', error);
    return {};
  }
}

/**
 * Get teams advancing from group stage to knockout
 */
export async function getAdvancingTeams(
  seasonId: string,
  tournamentId: string,
  teamsAdvancingPerGroup: number
): Promise<Array<{ team_id: string; team_name: string; group_name: string; position: number }>> {
  try {
    const standings = await calculateGroupStandings(seasonId, tournamentId);
    const advancingTeams: Array<{ team_id: string; team_name: string; group_name: string; position: number }> = [];
    
    Object.keys(standings).forEach(groupName => {
      const groupStandings = standings[groupName];
      const topTeams = groupStandings.slice(0, teamsAdvancingPerGroup);
      
      topTeams.forEach(team => {
        advancingTeams.push({
          team_id: team.team_id,
          team_name: team.team_name,
          group_name: groupName,
          position: team.position,
        });
      });
    });
    
    return advancingTeams;
  } catch (error) {
    console.error('Error getting advancing teams:', error);
    return [];
  }
}

/**
 * Delete all group fixtures for a tournament
 */
export async function deleteGroupFixtures(
  seasonId: string,
  tournamentId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const fixturesCollection = collection(db, 'group_fixtures');
    const q = query(
      fixturesCollection,
      where('season_id', '==', seasonId),
      where('tournament_id', '==', tournamentId)
    );
    
    const snapshot = await getDocs(q);
    
    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting group fixtures:', error);
    return { success: false, error: 'Failed to delete fixtures' };
  }
}
