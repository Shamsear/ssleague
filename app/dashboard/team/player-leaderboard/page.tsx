'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useTournamentContext } from '@/contexts/TournamentContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePermissions } from '@/hooks/usePermissions';
import { usePlayerStats } from '@/hooks';
import { useTournament } from '@/hooks/useTournaments';
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
  base_points?: number;
  matches_played: number;
  wins: number;
  losses: number;
  draws: number;
  win_rate: number;
  goals: number;
  assists: number;
  goals_conceded: number;
  clean_sheets: number;
  potm: number;
  points_change?: number; // For most improved tab
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
type TabType = 'all' | 'golden-boot' | 'golden-glove' | 'rankings' | 'most-improved';

export default function PlayerLeaderboardPage() {
  const { user, loading } = useAuth();
  const { selectedTournamentId, seasonId, setSeasonId } = useTournamentContext();
  const { userSeasonId } = usePermissions();
  const router = useRouter();
  
  // Get tournament info for display
  const { data: tournament } = useTournament(selectedTournamentId);
  
  const [players, setPlayers] = useState<PlayerStats[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<PlayerStats[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showOverall, setShowOverall] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  
  // Use React Query hook for player stats from Neon
  // If showOverall is true, use seasonId (all tournaments), otherwise use tournamentId (specific tournament)
  // Use seasonId from context for team users, userSeasonId for committee admins
  const effectiveSeasonId = user?.role === 'team' ? seasonId : userSeasonId;
  
  const { data: playerStatsData, isLoading: statsLoading } = usePlayerStats({
    tournamentId: showOverall ? undefined : selectedTournamentId,
    seasonId: effectiveSeasonId || '',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  
  const [sortField, setSortField] = useState<SortField>('points');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'team') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  // Fetch and set the team's season if not already set
  useEffect(() => {
    const fetchTeamSeason = async () => {
      if (!user || user.role !== 'team' || seasonId) return;

      try {
        // Get active season from Firebase
        const { db } = await import('@/lib/firebase/config');
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        
        const seasonsRef = collection(db, 'seasons');
        const activeSeasonQuery = query(seasonsRef, where('isActive', '==', true));
        const snapshot = await getDocs(activeSeasonQuery);
        
        if (!snapshot.empty) {
          const activeSeason = snapshot.docs[0];
          const activeSeasonId = activeSeason.id;
          
          // Check if team is registered for this season
          const teamSeasonsRef = collection(db, 'team_seasons');
          const teamSeasonQuery = query(
            teamSeasonsRef,
            where('user_id', '==', user.uid),
            where('season_id', '==', activeSeasonId),
            where('status', '==', 'registered')
          );
          const teamSeasonSnapshot = await getDocs(teamSeasonQuery);
          
          if (!teamSeasonSnapshot.empty) {
            console.log('📝 [Player Leaderboard] Setting team season ID:', activeSeasonId);
            setSeasonId(activeSeasonId);
          } else {
            console.log('⚠️ [Player Leaderboard] Team not registered for active season');
          }
        } else {
          console.log('⚠️ [Player Leaderboard] No active season found');
        }
      } catch (error) {
        console.error('❌ [Player Leaderboard] Error fetching team season:', error);
      }
    };

    fetchTeamSeason();
  }, [user, seasonId, setSeasonId]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user || user.role !== 'team' || !effectiveSeasonId) return;

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
  }, [user, effectiveSeasonId]);

  // Process player stats data from Neon when it arrives
  useEffect(() => {
    if (!playerStatsData || playerStatsData.length === 0) return;
    
    const playersData: PlayerStats[] = playerStatsData.map((data: any) => {
      const winRate = data.matches_played > 0 ? (data.wins / data.matches_played) * 100 : 0;
      
      return {
        id: data.id || data.player_id,
        player_id: data.player_id,
        name: data.player_name,
        team_id: data.team_id,
        team_name: data.team || 'Unassigned',
        category_id: data.category_id,
        category_name: data.category || 'Unknown',
        category_color: undefined,
        matches_played: data.matches_played || 0,
        wins: data.wins || 0,
        draws: data.draws || 0,
        losses: data.losses || 0,
        points: data.points || 0,
        base_points: data.base_points || 0,
        win_rate: winRate,
        goals: data.goals_scored || 0,
        assists: data.assists || 0,
        goals_conceded: data.goals_conceded || 0,
        clean_sheets: data.clean_sheets || 0,
        potm: data.motm_awards || 0,
      };
    });

    setPlayers(playersData);
  }, [playerStatsData]);

  useEffect(() => {
    let filtered = [...players];

    // Tab filter
    if (activeTab === 'golden-boot') {
      // Top 10 goal scorers
      filtered = filtered
        .filter(p => p.goals > 0)
        .sort((a, b) => b.goals - a.goals)
        .slice(0, 10);
    } else if (activeTab === 'golden-glove') {
      // Top 10 clean sheet keepers
      filtered = filtered
        .filter(p => p.matches_played > 0)
        .sort((a, b) => {
          if (b.clean_sheets !== a.clean_sheets) {
            return b.clean_sheets - a.clean_sheets;
          }
          return a.goals_conceded - b.goals_conceded;
        })
        .slice(0, 10);
    } else if (activeTab === 'rankings') {
      // Top 20 by points
      filtered = filtered
        .sort((a, b) => b.points - a.points)
        .slice(0, 20);
    } else if (activeTab === 'most-improved') {
      // Top 10 most improved (highest positive points change)
      filtered = filtered
        .filter(p => p.base_points && p.base_points > 0)
        .map(p => ({
          ...p,
          id: p.id || p.player_id, // Ensure id is always present
          points_change: p.points - (p.base_points || 0)
        }))
        .sort((a: any, b: any) => b.points_change - a.points_change)
        .slice(0, 10);
    }

    // Search filter (only for 'all' tab)
    if (activeTab === 'all' && searchTerm) {
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.player_id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Team filter (only for 'all' tab)
    if (activeTab === 'all') {
      if (teamFilter === 'unassigned') {
        filtered = filtered.filter((p) => !p.team_id);
      } else if (teamFilter) {
        filtered = filtered.filter((p) => p.team_id === teamFilter);
      }
    }

    // Sort (only for 'all' tab)
    if (activeTab === 'all') {
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
    }

    setFilteredPlayers(filtered);
  }, [players, searchTerm, teamFilter, sortField, sortOrder, activeTab]);

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

  const stats = {
    totalPlayers: players.length,
    activePlayers: players.filter(p => p.matches_played > 0).length,
    topScorer: players.length > 0 ? players.reduce((max, p) => p.points > max.points ? p : max, players[0]) : null,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50 to-pink-50">
      <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          {/* Back Link */}
          <Link
            href="/dashboard/team"
            className="group inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm text-gray-700 hover:text-purple-600 mb-4 font-medium transition-all rounded-xl shadow-sm hover:shadow-md border border-gray-200 hover:border-purple-300"
          >
            <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-sm sm:text-base">Back to Dashboard</span>
          </Link>

          {/* Title Card */}
          <div className="relative bg-white/90 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-xl border border-white/20 p-5 sm:p-8 overflow-hidden">
            {/* Decorative background */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full blur-3xl opacity-30 -z-10"></div>
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div>
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-gray-900 via-purple-900 to-pink-900 bg-clip-text text-transparent">
                      Player Leaderboard
                    </h1>
                    <p className="text-sm sm:text-base text-gray-600 mt-1">
                      {tournament?.tournament_name ? `${tournament.tournament_name} - ` : ''}Player Rankings
                    </p>
                  </div>
                </div>
                
                {/* Quick Link */}
                <Link
                  href="/dashboard/team/team-leaderboard"
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-sm font-medium transition-all mt-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  View Team Standings
                </Link>
              </div>
              
              {/* Tournament Selector */}
              <div className="w-full sm:w-auto">
                <TournamentSelector />
              </div>
            </div>
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

        {/* Overall Stats Toggle */}
        <div className="mb-4 flex justify-end">
        <button
          onClick={() => setShowOverall(!showOverall)}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            showOverall
              ? 'bg-purple-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300'
          }`}
        >
          {showOverall ? '🌍 Overall Stats (All Tournaments)' : '🏆 Tournament Stats'}
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-xl p-2 border border-gray-100/20 mb-6">
        <div className="flex gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-6 py-3 rounded-lg font-medium transition-all whitespace-nowrap ${
              activeTab === 'all'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            📊 All Players
          </button>
          <button
            onClick={() => setActiveTab('golden-boot')}
            className={`px-6 py-3 rounded-lg font-medium transition-all whitespace-nowrap ${
              activeTab === 'golden-boot'
                ? 'bg-gradient-to-r from-yellow-500 to-amber-600 text-white shadow-lg'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            ⚽ Golden Boot
          </button>
          <button
            onClick={() => setActiveTab('golden-glove')}
            className={`px-6 py-3 rounded-lg font-medium transition-all whitespace-nowrap ${
              activeTab === 'golden-glove'
                ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            🧤 Golden Glove
          </button>
          <button
            onClick={() => setActiveTab('rankings')}
            className={`px-6 py-3 rounded-lg font-medium transition-all whitespace-nowrap ${
              activeTab === 'rankings'
                ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            🏆 Top Rankings
          </button>
          <button
            onClick={() => setActiveTab('most-improved')}
            className={`px-6 py-3 rounded-lg font-medium transition-all whitespace-nowrap ${
              activeTab === 'most-improved'
                ? 'bg-gradient-to-r from-pink-500 to-rose-600 text-white shadow-lg'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            📈 Most Improved
          </button>
        </div>
      </div>

        {/* Filters - Only show for 'all' tab */}
        {activeTab === 'all' && (
          <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl p-6 mb-6 border border-gray-100/20">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Filters</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            </div>
          </div>
        )}

        {/* Leaderboard Table */}
        <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl overflow-hidden border border-gray-100/20">
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-indigo-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">
                {activeTab === 'golden-boot' && '⚽'}
                {activeTab === 'golden-glove' && '🧤'}
                {activeTab === 'rankings' && '🏆'}
                {activeTab === 'most-improved' && '📈'}
                {activeTab === 'all' && '👥'}
              </span>
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {activeTab === 'golden-boot' && 'Golden Boot - Top Scorers'}
                  {activeTab === 'golden-glove' && 'Golden Glove - Clean Sheet Leaders'}
                  {activeTab === 'rankings' && 'Top 20 Rankings'}
                  {activeTab === 'most-improved' && 'Most Improved Players'}
                  {activeTab === 'all' && 'Player Rankings'}
                </h3>
                <p className="text-sm text-gray-600">
                  {activeTab === 'golden-boot' && 'Top 10 players by goals scored'}
                  {activeTab === 'golden-glove' && 'Top 10 players by clean sheets'}
                  {activeTab === 'rankings' && 'Top 20 players by points'}
                  {activeTab === 'most-improved' && 'Top 10 players with highest points gain'}
                  {activeTab === 'all' && `${filteredPlayers.length} players competing`}
                </p>
              </div>
            </div>
            <div className="text-sm text-gray-600">
              <span className="font-semibold">{filteredPlayers.length}</span> / {players.length} Players
            </div>
          </div>
        </div>

        {/* Desktop Table - Hidden on mobile */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50/50">
              <tr>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rank
                </th>
                <th 
                  className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-1">
                    Player
                    <SortIcon field="name" />
                  </div>
                </th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Team
                </th>
                <th 
                  className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors"
                  onClick={() => handleSort('points')}
                >
                  <div className="flex items-center justify-center gap-1">
                    {activeTab === 'most-improved' ? 'Points Change' : 'Points'}
                    <SortIcon field="points" />
                  </div>
                </th>
                <th 
                  className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors"
                  onClick={() => handleSort('matches_played')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Played
                    <SortIcon field="matches_played" />
                  </div>
                </th>
                <th 
                  className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors"
                  onClick={() => handleSort('wins')}
                >
                  <div className="flex items-center justify-center gap-1">
                    W
                    <SortIcon field="wins" />
                  </div>
                </th>
                <th 
                  className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors"
                  onClick={() => handleSort('draws')}
                >
                  <div className="flex items-center justify-center gap-1">
                    D
                    <SortIcon field="draws" />
                  </div>
                </th>
                <th 
                  className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors"
                  onClick={() => handleSort('losses')}
                >
                  <div className="flex items-center justify-center gap-1">
                    L
                    <SortIcon field="losses" />
                  </div>
                </th>
                <th 
                  className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors"
                  onClick={() => handleSort('win_rate')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Win %
                    <SortIcon field="win_rate" />
                  </div>
                </th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ⚽ GS
                </th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  🥅 GC
                </th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  🧤 CS
                </th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ⭐ POTM
                </th>
              </tr>
            </thead>
            <tbody className="bg-white/60 divide-y divide-gray-200/50">
              {filteredPlayers.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-6 py-12 text-center text-gray-500">
                    <span className="text-6xl mb-4 block">👤</span>
                    <h3 className="text-lg font-medium text-gray-600 mb-2">No Players Found</h3>
                    <p className="text-sm">Try adjusting your filters</p>
                  </td>
                </tr>
              ) : (
                filteredPlayers.map((player, index) => (
                  <tr key={player.id || player.player_id || `player-${index}`} className={`hover:bg-purple-50/50 transition-colors ${index < 3 ? 'bg-yellow-50/30' : ''}`}>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                      {index === 0 && <span className="text-2xl">🥇</span>}
                      {index === 1 && <span className="text-2xl">🥈</span>}
                      {index === 2 && <span className="text-2xl">🥉</span>}
                      {index > 2 && <span className="text-sm">{`#${index + 1}`}</span>}
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <div>
                        <div className="text-sm font-bold text-gray-900">{player.name}</div>
                        <div className="text-xs text-gray-500">{player.player_id}</div>
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {player.team_name || <span className="text-gray-400 italic">Not assigned</span>}
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-center">
                      {activeTab === 'most-improved' && player.points_change !== undefined ? (
                        <div className="flex flex-col items-center gap-1">
                          <span 
                            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${
                              player.points_change > 0 
                                ? 'bg-green-100 text-green-800' 
                                : player.points_change < 0
                                ? 'bg-red-100 text-red-800'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {player.points_change > 0 ? '+' : ''}{player.points_change}
                          </span>
                          <span className="text-[10px] text-gray-500">
                            {player.base_points} → {player.points}
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-purple-100 text-purple-800">
                          {player.points}
                        </span>
                      )}
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-center">
                      <span className="text-sm text-gray-600">{player.matches_played}</span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-center">
                      <span className="text-sm font-semibold text-green-600">{player.wins}</span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-center">
                      <span className="text-sm text-gray-600">{player.draws}</span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-center">
                      <span className="text-sm font-semibold text-red-600">{player.losses}</span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-center">
                      <span className="text-sm font-medium text-gray-900">
                        {player.matches_played > 0 ? `${player.win_rate.toFixed(1)}%` : '-'}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-center">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                        ⚽ {player.goals || 0}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-center">
                      <span className="text-sm font-semibold text-red-600">{player.goals_conceded || 0}</span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-center">
                      <span className="text-sm font-semibold text-blue-600">{player.clean_sheets || 0}</span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-center">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-700">
                        ⭐ {player.potm || 0}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards - Shown only on mobile */}
        <div className="md:hidden space-y-4">
          {filteredPlayers.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <span className="text-6xl mb-4 block">👤</span>
              <h3 className="text-lg font-medium text-gray-600 mb-2">No Players Found</h3>
              <p className="text-sm">Try adjusting your filters</p>
            </div>
          ) : (
            filteredPlayers.map((player, index) => (
              <div 
                key={player.id || player.player_id || `player-${index}`}
                className={`bg-white/80 backdrop-blur-sm rounded-xl p-4 shadow-md border-2 transition-all ${
                  index < 3 ? 'border-yellow-400 bg-yellow-50/50' : 'border-gray-200'
                }`}
              >
                {/* Header with Rank and Name */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl font-bold">
                      {index === 0 && '🥇'}
                      {index === 1 && '🥈'}
                      {index === 2 && '🥉'}
                      {index > 2 && <span className="text-gray-600">#{index + 1}</span>}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{player.name}</h3>
                      <p className="text-xs text-gray-500">{player.player_id}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{player.team_name || 'Not assigned'}</p>
                    </div>
                  </div>
                  {activeTab === 'most-improved' && player.points_change !== undefined ? (
                    <div className="text-right">
                      <span 
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold ${
                          player.points_change > 0 
                            ? 'bg-green-100 text-green-800' 
                            : player.points_change < 0
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {player.points_change > 0 ? '+' : ''}{player.points_change}
                      </span>
                      <p className="text-[10px] text-gray-500 mt-1">
                        {player.base_points} → {player.points}
                      </p>
                    </div>
                  ) : (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-purple-100 text-purple-800">
                      {player.points}
                    </span>
                  )}
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-gray-200">
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1">Played</p>
                    <p className="text-sm font-bold text-gray-900">{player.matches_played}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1">Wins</p>
                    <p className="text-sm font-bold text-green-600">{player.wins}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1">Draws</p>
                    <p className="text-sm font-bold text-gray-600">{player.draws}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1">Losses</p>
                    <p className="text-sm font-bold text-red-600">{player.losses}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1">Win %</p>
                    <p className="text-sm font-bold text-gray-900">
                      {player.matches_played > 0 ? `${player.win_rate.toFixed(1)}%` : '-'}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1">⚽ Goals</p>
                    <p className="text-sm font-bold text-green-700">{player.goals || 0}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1">🥅 Conceded</p>
                    <p className="text-sm font-bold text-red-600">{player.goals_conceded || 0}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1">🧤 Clean</p>
                    <p className="text-sm font-bold text-blue-600">{player.clean_sheets || 0}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1">⭐ POTM</p>
                    <p className="text-sm font-bold text-purple-600">{player.potm || 0}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

        {/* Legend Info */}
        <div className="mt-6 bg-purple-50 border border-purple-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">📊</span>
          <div>
            <h3 className="text-sm font-semibold text-purple-800 mb-2">Leaderboard Legend</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs text-purple-700">
              <div><strong>Points:</strong> Overall score accumulated</div>
              <div><strong>Played:</strong> Total matches played</div>
              <div><strong>Win %:</strong> Percentage of matches won</div>
              <div><strong>W/D/L:</strong> Wins, Draws, Losses</div>
              <div><strong>GS:</strong> Goals Scored</div>
              <div><strong>GC:</strong> Goals Conceded</div>
              <div><strong>CS:</strong> Clean Sheets</div>
              <div><strong>POTM:</strong> Player of the Match awards</div>
              <div><strong>🥇🥈🥉:</strong> Top 3 players highlighted</div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
