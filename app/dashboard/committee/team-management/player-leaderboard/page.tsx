'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useTournamentContext } from '@/contexts/TournamentContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTournament } from '@/hooks/useTournaments';
import { usePlayerStats } from '@/hooks';
import { usePermissions } from '@/hooks/usePermissions';
import TournamentSelector from '@/components/TournamentSelector';

interface PlayerStats {
  id: string;
  player_id: string;
  name: string;
  team_id?: string;
  team_name?: string;
  category_id?: string;
  category_name?: string;
  category_color?: string;
  points: number;
  matches_played: number;
  wins: number;
  losses: number;
  draws: number;
  win_rate: number;
}

interface Team {
  id: string;
  team_name: string;
}

interface Category {
  id: string;
  name: string;
  color: string;
}

type SortField = 'points' | 'matches_played' | 'wins' | 'losses' | 'draws' | 'win_rate' | 'name';
type SortOrder = 'asc' | 'desc';

export default function PlayerLeaderboardPage() {
  const { user, loading } = useAuth();
  const { selectedTournamentId } = useTournamentContext();
  const { userSeasonId } = usePermissions();
  const router = useRouter();
  
  // Get tournament info for display (available for future use)
  const { data: tournament } = useTournament(selectedTournamentId);
  
  const [showOverall, setShowOverall] = useState(false);
  
  // Use React Query hook for player stats from Neon
  const { data: playerStatsData, isLoading: statsLoading } = usePlayerStats({
    tournamentId: showOverall ? undefined : selectedTournamentId,
    seasonId: userSeasonId || ''
  });
  
  const [players, setPlayers] = useState<PlayerStats[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<PlayerStats[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  
  const [sortField, setSortField] = useState<SortField>('points');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'committee_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user || user.role !== 'committee_admin') return;

      try {
        setIsLoading(true);
        
        // Fetch teams and categories for filters
        const [teamsRes, categoriesRes] = await Promise.all([
          fetch('/api/team/all'),
          fetch('/api/categories'),
        ]);

        const [teamsData, categoriesData] = await Promise.all([
          teamsRes.json(),
          categoriesRes.json(),
        ]);

        if (categoriesData.success) {
          setCategories(categoriesData.data);
        }

        if (teamsData.success) {
          setTeams(teamsData.data);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user]);

  // Process player stats data from Neon when it arrives
  useEffect(() => {
    if (!playerStatsData || playerStatsData.length === 0) return;
    
    const playersData: PlayerStats[] = playerStatsData.map((data: any) => {
      const winRate = data.matches_played > 0 ? (data.wins / data.matches_played) * 100 : 0;
      const categoryColor = categories.find(c => c.id === data.category_id)?.color;
      
      return {
        id: data.id,
        player_id: data.player_id,
        name: data.player_name,
        team_id: data.team_id,
        team_name: data.team || 'Unassigned',
        category_id: data.category_id,
        category_name: data.category || 'Unknown',
        category_color: categoryColor,
        matches_played: data.matches_played || 0,
        wins: data.wins || 0,
        draws: data.draws || 0,
        losses: data.losses || 0,
        points: data.points || 0,
        win_rate: winRate,
      };
    });

    setPlayers(playersData);
  }, [playerStatsData, categories]);

  useEffect(() => {
    let filtered = [...players];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.player_id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Team filter
    if (teamFilter === 'unassigned') {
      filtered = filtered.filter((p) => !p.team_id);
    } else if (teamFilter) {
      filtered = filtered.filter((p) => p.team_id === teamFilter);
    }

    // Category filter
    if (categoryFilter === 'unassigned') {
      filtered = filtered.filter((p) => !p.category_id);
    } else if (categoryFilter) {
      filtered = filtered.filter((p) => p.category_id === categoryFilter);
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      if (sortField === 'name') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    setFilteredPlayers(filtered);
  }, [players, searchTerm, teamFilter, categoryFilter, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const getColorClass = (color: string) => {
    const colorMap: { [key: string]: string } = {
      red: 'bg-red-600',
      blue: 'bg-blue-600',
      black: 'bg-black',
      white: 'bg-white border-2 border-gray-300',
      green: 'bg-green-600',
      yellow: 'bg-yellow-500',
      orange: 'bg-orange-600',
      purple: 'bg-purple-600',
    };
    return colorMap[color] || 'bg-gray-200';
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

  if (!user || user.role !== 'committee_admin') {
    return null;
  }

  const stats = {
    totalPlayers: players.length,
    activePlayers: players.filter(p => p.matches_played > 0).length,
    topScorer: players.length > 0 ? players.reduce((max, p) => p.points > max.points ? p : max, players[0]) : null,
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold gradient-text">Player Leaderboard</h1>
          <p className="text-gray-500 mt-1">View player statistics and rankings</p>
          <Link
            href="/dashboard/committee/team-management"
            className="inline-flex items-center mt-2 text-[#0066FF] hover:text-[#0052CC]"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Team Management
          </Link>
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
              <p className="text-sm text-gray-600 font-medium">Total Players</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalPlayers}</p>
            </div>
            <div className="p-3 bg-blue-500/20 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 backdrop-blur-md rounded-xl p-4 border border-green-200/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Active Players</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.activePlayers}</p>
            </div>
            <div className="p-3 bg-green-500/20 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 backdrop-blur-md rounded-xl p-4 border border-yellow-200/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Top Scorer</p>
              <p className="text-xl font-bold text-gray-900 mt-1 truncate">
                {stats.topScorer ? stats.topScorer.name : 'N/A'}
              </p>
              {stats.topScorer && (
                <p className="text-xs text-gray-500">{stats.topScorer.points} points</p>
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

      {/* Filters */}
      <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl p-6 mb-6 border border-gray-100/20">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or ID..."
              className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Team</label>
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
            >
              <option value="">All Teams</option>
              <option value="unassigned">Unassigned</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.team_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
            >
              <option value="">All Categories</option>
              <option value="unassigned">Unassigned</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl overflow-hidden border border-gray-100/20">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">
            Rankings ({filteredPlayers.length} players)
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
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-1">
                    Player
                    <SortIcon field="name" />
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Team
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th 
                  className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors"
                  onClick={() => handleSort('points')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Points
                    <SortIcon field="points" />
                  </div>
                </th>
                <th 
                  className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors"
                  onClick={() => handleSort('matches_played')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Played
                    <SortIcon field="matches_played" />
                  </div>
                </th>
                <th 
                  className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors"
                  onClick={() => handleSort('wins')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Wins
                    <SortIcon field="wins" />
                  </div>
                </th>
                <th 
                  className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors"
                  onClick={() => handleSort('draws')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Draws
                    <SortIcon field="draws" />
                  </div>
                </th>
                <th 
                  className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors"
                  onClick={() => handleSort('losses')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Losses
                    <SortIcon field="losses" />
                  </div>
                </th>
                <th 
                  className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors"
                  onClick={() => handleSort('win_rate')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Win %
                    <SortIcon field="win_rate" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white/60 divide-y divide-gray-200/50">
              {filteredPlayers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-8 text-center text-gray-500">
                    No players found
                  </td>
                </tr>
              ) : (
                filteredPlayers.map((player, index) => (
                  <tr key={player.id} className="hover:bg-gray-50/80 transition-colors">
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
                      <div>
                        <div className="text-sm font-medium text-gray-900">{player.name}</div>
                        <div className="text-sm text-gray-500">{player.player_id}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {player.team_name || (
                          <span className="text-gray-400 italic">Not assigned</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {player.category_name ? (
                        <div className="flex items-center">
                          <div
                            className={`h-4 w-4 rounded-full mr-2 ${getColorClass(
                              player.category_color || ''
                            )}`}
                          ></div>
                          <span className="text-sm text-gray-900">{player.category_name}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic text-sm">Not assigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="text-sm font-bold text-gray-900">{player.points}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="text-sm text-gray-600">{player.matches_played}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="text-sm font-semibold text-green-600">{player.wins}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="text-sm text-gray-600">{player.draws}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="text-sm font-semibold text-red-600">{player.losses}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="text-sm font-medium text-gray-900">
                        {player.matches_played > 0
                          ? `${player.win_rate.toFixed(1)}%`
                          : '-'}
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
