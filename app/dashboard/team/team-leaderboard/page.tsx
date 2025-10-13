'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getActiveSeason } from '@/lib/firebase/seasons';
import { getFixturesByRounds } from '@/lib/firebase/fixtures';

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
  const router = useRouter();
  
  const [teams, setTeams] = useState<TeamStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>('points');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [seasonName, setSeasonName] = useState('');

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
        
        const activeSeason = await getActiveSeason();
        if (!activeSeason) {
          setIsLoading(false);
          return;
        }

        setSeasonName(activeSeason.name);

        // Fetch all fixtures to calculate team stats
        const fixtureRounds = await getFixturesByRounds(activeSeason.id);
        
        // Calculate team statistics from fixtures
        const teamStatsMap = new Map<string, TeamStats>();
        
        fixtureRounds.forEach(round => {
          round.matches.forEach(match => {
            if (match.status === 'completed' && match.home_score !== undefined && match.away_score !== undefined) {
              // Initialize home team stats if not exists
              if (!teamStatsMap.has(match.home_team_id)) {
                teamStatsMap.set(match.home_team_id, {
                  team_id: match.home_team_id,
                  team_name: match.home_team_name,
                  matches_played: 0,
                  wins: 0,
                  draws: 0,
                  losses: 0,
                  goals_for: 0,
                  goals_against: 0,
                  goal_difference: 0,
                  points: 0,
                  win_rate: 0,
                });
              }
              
              // Initialize away team stats if not exists
              if (!teamStatsMap.has(match.away_team_id)) {
                teamStatsMap.set(match.away_team_id, {
                  team_id: match.away_team_id,
                  team_name: match.away_team_name,
                  matches_played: 0,
                  wins: 0,
                  draws: 0,
                  losses: 0,
                  goals_for: 0,
                  goals_against: 0,
                  goal_difference: 0,
                  points: 0,
                  win_rate: 0,
                });
              }
              
              const homeTeam = teamStatsMap.get(match.home_team_id)!;
              const awayTeam = teamStatsMap.get(match.away_team_id)!;
              
              // Update matches played
              homeTeam.matches_played++;
              awayTeam.matches_played++;
              
              // Update goals
              homeTeam.goals_for += match.home_score;
              homeTeam.goals_against += match.away_score;
              awayTeam.goals_for += match.away_score;
              awayTeam.goals_against += match.home_score;
              
              // Determine result
              if (match.home_score > match.away_score) {
                homeTeam.wins++;
                homeTeam.points += 3;
                awayTeam.losses++;
              } else if (match.home_score < match.away_score) {
                awayTeam.wins++;
                awayTeam.points += 3;
                homeTeam.losses++;
              } else {
                homeTeam.draws++;
                awayTeam.draws++;
                homeTeam.points += 1;
                awayTeam.points += 1;
              }
              
              // Update goal difference and win rate
              homeTeam.goal_difference = homeTeam.goals_for - homeTeam.goals_against;
              awayTeam.goal_difference = awayTeam.goals_for - awayTeam.goals_against;
              homeTeam.win_rate = (homeTeam.wins / homeTeam.matches_played) * 100;
              awayTeam.win_rate = (awayTeam.wins / awayTeam.matches_played) * 100;
            }
          });
        });
        
        const teamStatsArray = Array.from(teamStatsMap.values());
        setTeams(teamStatsArray);
        
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user]);

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

  if (loading || isLoading) {
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
          <h1 className="text-3xl md:text-4xl font-bold gradient-text">Team Leaderboard</h1>
          <p className="text-gray-500 mt-1">{seasonName} - Team Rankings</p>
          <Link
            href="/dashboard/team"
            className="inline-flex items-center mt-2 text-[#0066FF] hover:text-[#0052CC]"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </Link>
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
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">
            Rankings ({teams.length} teams)
          </h3>
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
                  <td colSpan={10} className="px-6 py-8 text-center text-gray-500">
                    No team statistics available yet
                  </td>
                </tr>
              ) : (
                sortedTeams.map((team, index) => (
                  <tr 
                    key={team.team_id} 
                    className={`hover:bg-gray-50/80 transition-colors ${
                      team.team_id === user.uid ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center justify-center">
                        <span className={`
                          text-sm font-bold
                          ${index === 0 ? 'text-yellow-600' : ''}
                          ${index === 1 ? 'text-gray-400' : ''}
                          ${index === 2 ? 'text-orange-600' : ''}
                          ${index > 2 ? 'text-gray-600' : ''}
                        `}>
                          {index === 0 && '🥇'}
                          {index === 1 && '🥈'}
                          {index === 2 && '🥉'}
                          {index > 2 && `#${index + 1}`}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="text-sm font-medium text-gray-900">
                          {team.team_name}
                          {team.team_id === user.uid && (
                            <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                              Your Team
                            </span>
                          )}
                        </div>
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
                      <span className="text-sm font-bold text-gray-900">
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
    </div>
  );
}
