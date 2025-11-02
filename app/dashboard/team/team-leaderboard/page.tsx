'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useTournamentContext } from '@/contexts/TournamentContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { db } from '@/lib/firebase/config';
import { collection, query, getDocs } from 'firebase/firestore';
import { useTeamStats } from '@/hooks';
import { useTournament } from '@/hooks/useTournaments';
import TournamentSelector from '@/components/TournamentSelector';

interface TeamStats {
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
  win_rate: number;
}

type SortField = 'points' | 'wins' | 'goal_difference' | 'matches_played' | 'team_name';

export default function TeamLeaderboardPage() {
  const { user, loading } = useAuth();
  const { selectedTournamentId } = useTournamentContext();
  const router = useRouter();
  
  const [teams, setTeams] = useState<TeamStats[]>([]);
  const [sortField, setSortField] = useState<SortField>('points');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [seasonName, setSeasonName] = useState('');
  const [currentSeasonId, setCurrentSeasonId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  // Get tournament info for display
  const { data: tournament } = useTournament(selectedTournamentId);

  // Use React Query hook for team stats from Neon - now uses tournamentId
  const { data: teamStatsData, isLoading: statsLoading } = useTeamStats({
    tournamentId: selectedTournamentId,
    seasonId: currentSeasonId // Fallback for backward compatibility
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'team') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user || user.role !== 'team') return;

      try {
        setIsLoading(true);
        
        // Get all seasons from the seasons collection
        const seasonsQuery = query(collection(db, 'seasons'));
        const seasonsSnapshot = await getDocs(seasonsQuery);
        const seasonsMap = new Map();
        const nonCompletedSeasonIds: string[] = [];
        
        seasonsSnapshot.forEach((doc) => {
          const data = doc.data();
          seasonsMap.set(doc.id, data.name || `Season ${data.season_number || 'Unknown'}`);
          
          // Include seasons that are NOT completed (can be active, pending, draft, etc.)
          if (data.status !== 'completed') {
            nonCompletedSeasonIds.push(doc.id);
          }
        });

        // If there are no non-completed seasons, just use the first season we find
        let targetSeasonIds = nonCompletedSeasonIds;
        if (targetSeasonIds.length === 0 && seasonsSnapshot.size > 0) {
          // Fallback: use the first active season or any season
          const firstActiveSeason = seasonsSnapshot.docs.find(doc => doc.data().isActive === true);
          if (firstActiveSeason) {
            targetSeasonIds = [firstActiveSeason.id];
            setSeasonName(seasonsMap.get(firstActiveSeason.id) || 'Current Season');
          } else {
            const firstSeason = seasonsSnapshot.docs[0];
            targetSeasonIds = [firstSeason.id];
            setSeasonName(seasonsMap.get(firstSeason.id) || 'Season');
          }
        } else if (targetSeasonIds.length > 0) {
          // Set season name to the first non-completed season
          setSeasonName(seasonsMap.get(targetSeasonIds[0]) || 'Current Season');
        }

        if (targetSeasonIds.length === 0) {
          setIsLoading(false);
          return;
        }

        // Set the current season ID for the hook to fetch
        if (targetSeasonIds.length > 0) {
          setCurrentSeasonId(targetSeasonIds[0]);
        }
        
        // Fetch all teams to get team names
        const teamsQuery = query(collection(db, 'teams'));
        const teamsSnapshot = await getDocs(teamsQuery);
        const teamsMap = new Map();
        teamsSnapshot.forEach((doc) => {
          const data = doc.data();
          teamsMap.set(doc.id, data.name || data.team_name || 'Unknown Team');
        });
        
        // Store teams map for later use
        (window as any).teamsMap = teamsMap;
        
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, [user]);

  // Process team stats data from Neon when it arrives
  useEffect(() => {
    if (!teamStatsData || teamStatsData.length === 0) return;
    
    const teamsMap = (window as any).teamsMap || new Map();
    
    const teamStatsArray: TeamStats[] = teamStatsData.map((data: any) => {
      const wins = data.wins || 0;
      const draws = data.draws || 0;
      const points = data.points || ((wins * 3) + (draws * 1));
      const matches_played = data.matches_played || 0;
      const win_rate = matches_played > 0 ? (wins / matches_played) * 100 : 0;
      
      return {
        team_id: data.team_id,
        team_name: data.team_name || teamsMap.get(data.team_id) || 'Unknown Team',
        matches_played,
        wins,
        draws,
        losses: data.losses || 0,
        goals_for: data.goals_for || 0,
        goals_against: data.goals_against || 0,
        goal_difference: data.goal_difference || 0,
        points,
        win_rate,
      };
    });

    setTeams(teamStatsArray);
  }, [teamStatsData]);

  const sortedTeams = [...teams].sort((a, b) => {
    let aVal: any = a[sortField];
    let bVal: any = b[sortField];
    
    if (sortField === 'team_name') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }
    
    if (sortOrder === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    
    if (sortOrder === 'asc') {
      return (
        <svg className="w-4 h-4 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
        </svg>
      );
    } else {
      return (
        <svg className="w-4 h-4 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      );
    }
  };

  if (loading || statsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading leaderboard...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'team') {
    return null;
  }

  const topTeam = teams.length > 0 ? teams.reduce((max, t) => t.points > max.points ? t : max, teams[0]) : null;
  const totalMatches = teams.reduce((sum, t) => sum + t.matches_played, 0);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold gradient-text">🏆 Team Leaderboard</h1>
          <p className="text-gray-500 mt-1">
            {tournament?.tournament_name || seasonName} - Team Rankings
          </p>
          <div className="flex gap-4 mt-2">
            <Link
              href="/dashboard/team"
              className="inline-flex items-center text-[#0066FF] hover:text-[#0052CC] text-sm"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Dashboard
            </Link>
            <Link
              href="/dashboard/team/player-leaderboard"
              className="inline-flex items-center text-purple-600 hover:text-purple-700 text-sm font-medium"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Player Rankings →
            </Link>
          </div>
        </div>
        <div>
          <TournamentSelector />
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 backdrop-blur-md rounded-xl p-4 border border-blue-200/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Total Teams</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{teams.length}</p>
            </div>
            <div className="p-3 bg-blue-500/20 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 backdrop-blur-md rounded-xl p-4 border border-green-200/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Matches Played</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{totalMatches}</p>
            </div>
            <div className="p-3 bg-green-500/20 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 backdrop-blur-md rounded-xl p-4 border border-yellow-200/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Leader</p>
              <p className="text-lg font-bold text-gray-900 mt-1 truncate">
                {topTeam ? topTeam.team_name : 'N/A'}
              </p>
              {topTeam && (
                <p className="text-xs text-gray-500">{topTeam.points} points</p>
              )}
            </div>
            <div className="p-3 bg-yellow-500/20 rounded-lg">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl overflow-hidden border border-gray-100/20">
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <span className="text-3xl">⚽</span>
            <div>
              <h3 className="text-xl font-bold text-gray-900">League Table</h3>
              <p className="text-sm text-gray-600">{teams.length} teams competing for the title</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rank
                </th>
                <th 
                  className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors"
                  onClick={() => handleSort('team_name')}
                >
                  <div className="flex items-center gap-1">
                    Team
                    <SortIcon field="team_name" />
                  </div>
                </th>
                <th 
                  className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors"
                  onClick={() => handleSort('matches_played')}
                >
                  <div className="flex items-center justify-center gap-1">
                    MP
                    <SortIcon field="matches_played" />
                  </div>
                </th>
                <th 
                  className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors"
                  onClick={() => handleSort('wins')}
                >
                  <div className="flex items-center justify-center gap-1">
                    W
                    <SortIcon field="wins" />
                  </div>
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  D
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  L
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  GF
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  GA
                </th>
                <th 
                  className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors"
                  onClick={() => handleSort('goal_difference')}
                >
                  <div className="flex items-center justify-center gap-1">
                    GD
                    <SortIcon field="goal_difference" />
                  </div>
                </th>
                <th 
                  className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors"
                  onClick={() => handleSort('points')}
                >
                  <div className="flex items-center justify-center gap-1">
                    PTS
                    <SortIcon field="points" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white/60 divide-y divide-gray-200/50">
              {sortedTeams.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-gray-500">
                    <span className="text-6xl mb-4 block">⚽</span>
                    <h3 className="text-lg font-medium text-gray-600 mb-2">No Team Statistics Available</h3>
                    <p className="text-sm">Team standings will appear once matches are completed</p>
                  </td>
                </tr>
              ) : (
                sortedTeams.map((team, index) => (
                  <tr 
                    key={team.team_id} 
                    className={`hover:bg-blue-50/50 transition-colors ${
                      index < 3 ? 'bg-green-50/30' : ''
                    } ${
                      team.team_id === user.uid ? 'ring-2 ring-blue-400' : ''
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                      {index === 0 && <span className="text-2xl">🥇</span>}
                      {index === 1 && <span className="text-2xl">🥈</span>}
                      {index === 2 && <span className="text-2xl">🥉</span>}
                      {index > 2 && `#${index + 1}`}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-bold text-gray-900">
                          {team.team_name}
                        </div>
                        {team.team_id === user.uid && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                            Your Team
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600">
                      {team.matches_played}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-semibold text-green-600">
                      {team.wins}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600">
                      {team.draws}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-semibold text-red-600">
                      {team.losses}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600">
                      {team.goals_for}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600">
                      {team.goals_against}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`text-sm font-medium ${
                        team.goal_difference > 0 ? 'text-green-600' :
                        team.goal_difference < 0 ? 'text-red-600' :
                        'text-gray-600'
                      }`}>
                        {team.goal_difference > 0 ? '+' : ''}{team.goal_difference}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-blue-100 text-blue-800">
                        {team.points}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">📊</span>
          <div>
            <h3 className="text-sm font-semibold text-blue-800 mb-2">League Table Legend</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs text-blue-700">
              <div><strong>MP:</strong> Matches Played</div>
              <div><strong>W:</strong> Wins</div>
              <div><strong>D:</strong> Draws</div>
              <div><strong>L:</strong> Losses</div>
              <div><strong>GF:</strong> Goals For</div>
              <div><strong>GA:</strong> Goals Against</div>
              <div><strong>GD:</strong> Goal Difference</div>
              <div><strong>PTS:</strong> Points (3 for win, 1 for draw)</div>
            </div>
          </div>
        </div>
      </div>

      {/* Championship Info */}
      {topTeam && topTeam.matches_played > 0 && (
        <div className="mt-6 bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-xl p-6">
          <div className="flex items-center gap-3">
            <span className="text-4xl">🏆</span>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Current Leader</h3>
              <p className="text-2xl font-extrabold text-yellow-600 mt-1">{topTeam.team_name}</p>
              <p className="text-sm text-gray-600 mt-1">
                {topTeam.points} points • {topTeam.wins} wins • GD: {topTeam.goal_difference > 0 ? '+' : ''}{topTeam.goal_difference}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
