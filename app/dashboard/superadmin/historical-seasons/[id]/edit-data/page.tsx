'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getIdToken } from 'firebase/auth';
import { getSmartCache, setSmartCache, CACHE_DURATIONS } from '@/utils/smartCache';
import { clearCache } from '@/utils/cache';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface Team {
  id: string;
  season_id: string;
  team_name: string;
  team_code: string;
  owner_name?: string;
  owner_email?: string;
  initial_balance?: number;
  current_balance?: number;
  is_historical: boolean;
  season_stats?: {
    rank?: number;
    p?: number;
    mp?: number;
    w?: number;
    d?: number;
    l?: number;
    f?: number;
    a?: number;
    gd?: number;
    percentage?: number;
    cup?: string;
    players_count?: number;
  };
}

interface Player {
  id: string;
  player_id?: string;
  name: string;
  category?: string;
  team?: string;
  season_id?: string;
  display_name?: string;
  email?: string;
  phone?: string;
  role?: string;
  psn_id?: string;
  xbox_id?: string;
  steam_id?: string;
  is_registered?: boolean;
  is_active?: boolean;
  is_available?: boolean;
  notes?: string;
  category_wise_trophy_1?: string;
  category_wise_trophy_2?: string;
  individual_wise_trophy_1?: string;
  individual_wise_trophy_2?: string;
  stats?: {
    matches_played: number;
    matches_won: number;
    matches_lost: number;
    matches_drawn: number;
    goals_scored: number;
    goals_per_game: number;
    goals_conceded: number;
    conceded_per_game: number;
    net_goals: number;
    assists: number;
    clean_sheets: number;
    cleansheets: number;
    potm: number;
    points: number;
    total_points: number;
    win: number;
    draw: number;
    loss: number;
    total_matches: number;
    win_rate: number;
    average_rating: number;
  };
}

export default function EditSeasonDataPage() {
  const { user, firebaseUser, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const seasonId = params?.id as string;

  const [activeTab, setActiveTab] = useState<'teams' | 'players'>('teams');
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [selectedColumn, setSelectedColumn] = useState<{ field: string; startIndex: number } | null>(null);

  // Auth check
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'super_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  // Extract data processing logic
  const processData = (data: any) => {
    // Process teams data - ensure season_stats exists and map database fields to interface fields
    const processedTeams = (data.teams || []).map((team: any) => {
      const seasonStats = team.season_stats;
      return {
        ...team,
        season_stats: {
          rank: seasonStats?.rank || 0,
          p: seasonStats?.points || 0,
          mp: seasonStats?.matches_played || 0,
          w: seasonStats?.wins || 0,
          d: seasonStats?.draws || 0,
          l: seasonStats?.losses || 0,
          f: seasonStats?.goals_for || 0,
          a: seasonStats?.goals_against || 0,
          gd: seasonStats?.goal_difference || 0,
          percentage: seasonStats?.win_percentage || 0,
          cup: seasonStats?.cup_achievement || '',
          players_count: seasonStats?.players_count || 0
        }
      };
    });
    setTeams(processedTeams);
    
    // Process players data - convert trophy arrays to individual fields and ensure stats exist
    const processedPlayers = (data.players || []).map((player: any) => {
      const processed = { ...player };
      
      // Convert category_trophies array to individual fields
      if (player.category_trophies && Array.isArray(player.category_trophies)) {
        processed.category_wise_trophy_1 = player.category_trophies[0] || '';
        processed.category_wise_trophy_2 = player.category_trophies[1] || '';
      }
      
      // Convert individual_trophies array to individual fields
      if (player.individual_trophies && Array.isArray(player.individual_trophies)) {
        processed.individual_wise_trophy_1 = player.individual_trophies[0] || '';
        processed.individual_wise_trophy_2 = player.individual_trophies[1] || '';
      }
      
      // Ensure stats object exists with default values
      if (!processed.stats) {
        processed.stats = {
          matches_played: 0,
          matches_won: 0,
          matches_lost: 0,
          matches_drawn: 0,
          goals_scored: 0,
          goals_per_game: 0,
          goals_conceded: 0,
          conceded_per_game: 0,
          net_goals: 0,
          assists: 0,
          clean_sheets: 0,
          cleansheets: 0,
          potm: 0,
          points: 0,
          total_points: 0,
          win: 0,
          draw: 0,
          loss: 0,
          total_matches: 0,
          win_rate: 0,
          average_rating: 0
        };
      }
      
      return processed;
    });
    
    setPlayers(processedPlayers);
  };

  // Fetch data
  useEffect(() => {
    if (!seasonId || loading || !user) return;
    
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Try cache first (1 hour cache for historical data)
        const cacheKey = `historical_season_${seasonId}_full`;
        const cachedData = getSmartCache<any>(cacheKey, CACHE_DURATIONS.LONG);
        
        if (cachedData) {
          console.log('📋 Using cached historical season data');
          processData(cachedData);
          setIsLoading(false);
          return;
        }
        
        console.log('🔥 Fetching fresh historical season data');
        const response = await fetchWithTokenRefresh(`/api/seasons/historical/${seasonId}?loadAll=true`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch season data');
        }
        
        const { success, data } = await response.json();
        
        if (!success) {
          throw new Error('Failed to load season');
        }
        
        // Cache the data for 1 hour
        setSmartCache(cacheKey, data, CACHE_DURATIONS.LONG);
        processData(data);
        setIsLoading(false);
      } catch (error: any) {
        console.error('Error fetching data:', error);
        setError(error.message);
        setIsLoading(false);
      }
    };

    fetchData();
  }, [seasonId, loading, user]);

  // Update team field
  const updateTeamField = (teamId: string, field: string, value: any) => {
    setTeams(prevTeams => 
      prevTeams.map(team => {
        if (team.id === teamId) {
          if (field.startsWith('season_stats.')) {
            const statsField = field.replace('season_stats.', '');
            return {
              ...team,
              season_stats: {
                ...team.season_stats,
                [statsField]: statsField === 'cup' ? value : (parseFloat(value) || 0)
              } as any
            };
          }
          return { ...team, [field]: value };
        }
        return team;
      })
    );
  };

  // Update player field
  const updatePlayerField = (playerId: string, field: string, value: any) => {
    setPlayers(prevPlayers => 
      prevPlayers.map(player => {
        if (player.id === playerId) {
          if (field.startsWith('stats.')) {
            const statsField = field.replace('stats.', '');
            return {
              ...player,
              stats: {
                ...player.stats,
                [statsField]: parseFloat(value) || 0
              } as any
            };
          }
          return { ...player, [field]: value };
        }
        return player;
      })
    );
  };

  // Save all changes
  const handleSaveAll = async () => {
    if (!firebaseUser) {
      setError('Not authenticated');
      return;
    }

    try {
      setIsSaving(true);
      setError('');
      setSuccessMessage('');

      const token = await getIdToken(firebaseUser);
      
      const response = await fetchWithTokenRefresh(`/api/seasons/historical/${seasonId}/bulk-update`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          teams,
          players
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save changes');
      }

      setSuccessMessage('✅ All changes saved successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      
      // Clear cache to ensure fresh data on next load
      const cacheKey = `historical_season_${seasonId}_full`;
      clearCache(cacheKey);
      
    } catch (err: any) {
      console.error('❌ Error saving changes:', err);
      setError(err.message || 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  // Sort function
  const sortData = (data: any[], key: string) => {
    if (!sortConfig || sortConfig.key !== key) {
      return [...data].sort((a, b) => {
        const aVal = key.includes('.') ? key.split('.').reduce((o, i) => o?.[i], a) : a[key];
        const bVal = key.includes('.') ? key.split('.').reduce((o, i) => o?.[i], b) : b[key];
        
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        
        if (typeof aVal === 'string') {
          return aVal.localeCompare(bVal);
        }
        return aVal > bVal ? 1 : -1;
      });
    }
    
    return [...data].sort((a, b) => {
      const aVal = key.includes('.') ? key.split('.').reduce((o, i) => o?.[i], a) : a[key];
      const bVal = key.includes('.') ? key.split('.').reduce((o, i) => o?.[i], b) : b[key];
      
      if (aVal === null || aVal === undefined) return sortConfig.direction === 'asc' ? 1 : -1;
      if (bVal === null || bVal === undefined) return sortConfig.direction === 'asc' ? -1 : 1;
      
      if (typeof aVal === 'string') {
        return sortConfig.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      
      if (sortConfig.direction === 'asc') {
        return aVal > bVal ? 1 : -1;
      }
      return aVal < bVal ? 1 : -1;
    });
  };

  // Handle column sort
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Handle paste from Excel (for teams)
  const handleTeamPaste = (e: React.ClipboardEvent, teamId: string, field: string, rowIndex: number) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    
    // Split by newlines (Excel column copy)
    const values = pastedData.split(/\r?\n/).filter(v => v.trim() !== '');
    
    if (values.length > 1) {
      // Multiple values - paste across rows
      const teamsArray = sortedTeams;
      values.forEach((value, index) => {
        const targetIndex = rowIndex + index;
        if (targetIndex < teamsArray.length) {
          const targetTeam = teamsArray[targetIndex];
          updateTeamField(targetTeam.id, field, value.trim());
        }
      });
    } else {
      // Single value - paste in current cell
      updateTeamField(teamId, field, pastedData.trim());
    }
  };

  // Handle paste from Excel (for players)
  const handlePlayerPaste = (e: React.ClipboardEvent, playerId: string, field: string, rowIndex: number) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    
    // Split by newlines (Excel column copy)
    const values = pastedData.split(/\r?\n/).filter(v => v.trim() !== '');
    
    if (values.length > 1) {
      // Multiple values - paste across rows
      const playersArray = sortedPlayers;
      values.forEach((value, index) => {
        const targetIndex = rowIndex + index;
        if (targetIndex < playersArray.length) {
          const targetPlayer = playersArray[targetIndex];
          updatePlayerField(targetPlayer.id, field, value.trim());
        }
      });
    } else {
      // Single value - paste in current cell
      updatePlayerField(playerId, field, pastedData.trim());
    }
  };

  // Filter players based on search
  const filteredPlayers = players.filter(player => 
    player.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    player.team?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    player.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Apply sorting to players
  const sortedPlayers = sortConfig && activeTab === 'players' ? sortData(filteredPlayers, sortConfig.key) : filteredPlayers;

  // Filter teams based on search
  const filteredTeams = teams.filter(team => 
    team.team_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    team.owner_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    team.team_code?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Apply sorting to teams
  const sortedTeams = sortConfig && activeTab === 'teams' ? sortData(filteredTeams, sortConfig.key) : filteredTeams;

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading season data...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'super_admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 py-4 px-4">
      <div className="container mx-auto max-w-screen-2xl">
        {/* Header */}
        <div className="mb-6">
          <div className="glass rounded-2xl p-6 shadow-xl backdrop-blur-md border border-white/30">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => router.push(`/dashboard/superadmin/historical-seasons/${seasonId}`)}
                  className="group p-3 rounded-xl bg-white/60 hover:bg-white/80 transition-all duration-300 hover:shadow-md"
                >
                  <svg className="w-5 h-5 text-gray-600 group-hover:text-[#0066FF] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-gradient-to-r from-[#0066FF] to-purple-600 rounded-xl">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                    </svg>
                  </div>
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-[#0066FF] to-purple-600 bg-clip-text text-transparent">
                      📊 Excel-Style Data Editor
                    </h1>
                    <p className="text-sm text-gray-600 mt-1">Edit teams and players with all columns visible</p>
                  </div>
                </div>
              </div>
              
              <button
                onClick={handleSaveAll}
                disabled={isSaving}
                className={`px-6 py-3 rounded-xl font-medium text-white transition-all transform hover:scale-105 ${
                  isSaving
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 shadow-lg hover:shadow-xl'
                }`}
              >
                {isSaving ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Saving...</span>
                  </div>
                ) : (
                  <span>💾 Save All Changes</span>
                )}
              </button>
            </div>

            {/* Messages */}
            {successMessage && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-800">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-medium">{successMessage}</span>
                </div>
              </div>
            )}

            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 text-red-800">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium">{error}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="glass rounded-t-2xl p-3 shadow-xl backdrop-blur-md border border-white/30 border-b-0">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('teams')}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
                activeTab === 'teams'
                  ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg'
                  : 'bg-white/60 text-gray-700 hover:bg-white/80'
              }`}
            >
              <span>🏆</span>
              <span>Teams ({teams.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('players')}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
                activeTab === 'players'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg'
                  : 'bg-white/60 text-gray-700 hover:bg-white/80'
              }`}
            >
              <span>👤</span>
              <span>Players ({players.length})</span>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="glass rounded-b-none border-t-0 p-4 shadow-xl backdrop-blur-md border border-white/30">
          <div className="relative">
            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0066FF] focus:border-transparent"
            />
            <svg className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Content */}
        <div className="glass rounded-b-2xl shadow-xl backdrop-blur-md border border-white/30 border-t-0 overflow-hidden">
          {activeTab === 'teams' ? (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gradient-to-r from-orange-50 to-orange-100/80 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-orange-200">#</th>
                    <th onClick={() => handleSort('season_stats.rank')} className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-orange-200 min-w-[80px] cursor-pointer hover:bg-orange-200/50">
                      <div className="flex items-center gap-1">
                        Rank
                        {sortConfig?.key === 'season_stats.rank' && <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}
                      </div>
                    </th>
                    <th onClick={() => handleSort('team_name')} className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-orange-200 min-w-[200px] cursor-pointer hover:bg-orange-200/50">
                      <div className="flex items-center gap-1">
                        Team
                        {sortConfig?.key === 'team_name' && <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}
                      </div>
                    </th>
                    <th onClick={() => handleSort('owner_name')} className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-orange-200 min-w-[150px] cursor-pointer hover:bg-orange-200/50">
                      <div className="flex items-center gap-1">
                        Owner Name
                        {sortConfig?.key === 'owner_name' && <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}
                      </div>
                    </th>
                    <th onClick={() => handleSort('season_stats.p')} className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-orange-200 min-w-[80px] cursor-pointer hover:bg-orange-200/50">
                      <div className="flex items-center gap-1">
                        P
                        {sortConfig?.key === 'season_stats.p' && <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}
                      </div>
                    </th>
                    <th onClick={() => handleSort('season_stats.mp')} className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-orange-200 min-w-[80px] cursor-pointer hover:bg-orange-200/50">
                      <div className="flex items-center gap-1">
                        MP
                        {sortConfig?.key === 'season_stats.mp' && <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}
                      </div>
                    </th>
                    <th onClick={() => handleSort('season_stats.w')} className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-orange-200 min-w-[80px] cursor-pointer hover:bg-orange-200/50">
                      <div className="flex items-center gap-1">
                        W
                        {sortConfig?.key === 'season_stats.w' && <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}
                      </div>
                    </th>
                    <th onClick={() => handleSort('season_stats.d')} className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-orange-200 min-w-[80px] cursor-pointer hover:bg-orange-200/50">
                      <div className="flex items-center gap-1">
                        D
                        {sortConfig?.key === 'season_stats.d' && <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}
                      </div>
                    </th>
                    <th onClick={() => handleSort('season_stats.l')} className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-orange-200 min-w-[80px] cursor-pointer hover:bg-orange-200/50">
                      <div className="flex items-center gap-1">
                        L
                        {sortConfig?.key === 'season_stats.l' && <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}
                      </div>
                    </th>
                    <th onClick={() => handleSort('season_stats.f')} className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-orange-200 min-w-[80px] cursor-pointer hover:bg-orange-200/50">
                      <div className="flex items-center gap-1">
                        F
                        {sortConfig?.key === 'season_stats.f' && <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}
                      </div>
                    </th>
                    <th onClick={() => handleSort('season_stats.a')} className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-orange-200 min-w-[80px] cursor-pointer hover:bg-orange-200/50">
                      <div className="flex items-center gap-1">
                        A
                        {sortConfig?.key === 'season_stats.a' && <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}
                      </div>
                    </th>
                    <th onClick={() => handleSort('season_stats.gd')} className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-orange-200 min-w-[80px] cursor-pointer hover:bg-orange-200/50">
                      <div className="flex items-center gap-1">
                        GD
                        {sortConfig?.key === 'season_stats.gd' && <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}
                      </div>
                    </th>
                    <th onClick={() => handleSort('season_stats.percentage')} className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-orange-200 min-w-[100px] cursor-pointer hover:bg-orange-200/50">
                      <div className="flex items-center gap-1">
                        Percentage
                        {sortConfig?.key === 'season_stats.percentage' && <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}
                      </div>
                    </th>
                    <th onClick={() => handleSort('season_stats.cup')} className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-orange-200 min-w-[120px] cursor-pointer hover:bg-orange-200/50">
                      <div className="flex items-center gap-1">
                        Cup
                        {sortConfig?.key === 'season_stats.cup' && <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}
                      </div>
                    </th>
                    <th onClick={() => handleSort('season_stats.players_count')} className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider min-w-[120px] cursor-pointer hover:bg-orange-200/50">
                      <div className="flex items-center gap-1">
                        Players Count
                        {sortConfig?.key === 'season_stats.players_count' && <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white/50 divide-y divide-gray-200">
                  {sortedTeams.map((team, index) => (
                    <tr key={team.id} className="hover:bg-orange-50/30 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-600 border-r border-gray-200">{index + 1}</td>
                      <td className="px-4 py-3 border-r border-gray-200">
                        <input
                          type="number"
                          value={team.season_stats?.rank || 0}
                          onChange={(e) => updateTeamField(team.id, 'season_stats.rank', e.target.value)}
                          onPaste={(e) => handleTeamPaste(e, team.id, 'season_stats.rank', index)}
                          onFocus={(e) => e.target.select()}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                        />
                      </td>
                      <td className="px-4 py-3 border-r border-gray-200">
                        <input
                          type="text"
                          value={team.team_name}
                          onChange={(e) => updateTeamField(team.id, 'team_name', e.target.value)}
                          onPaste={(e) => handleTeamPaste(e, team.id, 'team_name', index)}
                          onFocus={(e) => e.target.select()}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm font-medium"
                        />
                      </td>
                      <td className="px-4 py-3 border-r border-gray-200">
                        <input
                          type="text"
                          value={team.owner_name || ''}
                          onChange={(e) => updateTeamField(team.id, 'owner_name', e.target.value)}
                          onPaste={(e) => handleTeamPaste(e, team.id, 'owner_name', index)}
                          onFocus={(e) => e.target.select()}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                        />
                      </td>
                      <td className="px-4 py-3 border-r border-gray-200">
                        <input
                          type="number"
                          value={team.season_stats?.p || 0}
                          onChange={(e) => updateTeamField(team.id, 'season_stats.p', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                        />
                      </td>
                      <td className="px-4 py-3 border-r border-gray-200">
                        <input
                          type="number"
                          value={team.season_stats?.mp || 0}
                          onChange={(e) => updateTeamField(team.id, 'season_stats.mp', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                        />
                      </td>
                      <td className="px-4 py-3 border-r border-gray-200">
                        <input
                          type="number"
                          value={team.season_stats?.w || 0}
                          onChange={(e) => updateTeamField(team.id, 'season_stats.w', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                        />
                      </td>
                      <td className="px-4 py-3 border-r border-gray-200">
                        <input
                          type="number"
                          value={team.season_stats?.d || 0}
                          onChange={(e) => updateTeamField(team.id, 'season_stats.d', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                        />
                      </td>
                      <td className="px-4 py-3 border-r border-gray-200">
                        <input
                          type="number"
                          value={team.season_stats?.l || 0}
                          onChange={(e) => updateTeamField(team.id, 'season_stats.l', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                        />
                      </td>
                      <td className="px-4 py-3 border-r border-gray-200">
                        <input
                          type="number"
                          value={team.season_stats?.f || 0}
                          onChange={(e) => updateTeamField(team.id, 'season_stats.f', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                        />
                      </td>
                      <td className="px-4 py-3 border-r border-gray-200">
                        <input
                          type="number"
                          value={team.season_stats?.a || 0}
                          onChange={(e) => updateTeamField(team.id, 'season_stats.a', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                        />
                      </td>
                      <td className="px-4 py-3 border-r border-gray-200">
                        <input
                          type="number"
                          value={team.season_stats?.gd || 0}
                          onChange={(e) => updateTeamField(team.id, 'season_stats.gd', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                        />
                      </td>
                      <td className="px-4 py-3 border-r border-gray-200">
                        <input
                          type="number"
                          step="0.01"
                          value={team.season_stats?.percentage || 0}
                          onChange={(e) => updateTeamField(team.id, 'season_stats.percentage', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                        />
                      </td>
                      <td className="px-4 py-3 border-r border-gray-200">
                        <input
                          type="text"
                          value={team.season_stats?.cup || ''}
                          onChange={(e) => updateTeamField(team.id, 'season_stats.cup', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={team.season_stats?.players_count || 0}
                          onChange={(e) => updateTeamField(team.id, 'season_stats.players_count', e.target.value)}
                          onPaste={(e) => handleTeamPaste(e, team.id, 'season_stats.players_count', index)}
                          onFocus={(e) => e.target.select()}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {sortedTeams.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-500">No teams found matching "{searchTerm}"</p>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gradient-to-r from-blue-50 to-blue-100/80 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-blue-200">#</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-blue-200 min-w-[180px]">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-blue-200 min-w-[150px]">Team</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-blue-200 min-w-[100px]">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-blue-200 min-w-[100px]">Goals Scored</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-blue-200 min-w-[120px]">Goals Per Game</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-blue-200 min-w-[120px]">Goals Conceded</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-blue-200 min-w-[130px]">Conceded Per Game</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-blue-200 min-w-[100px]">Net Goals</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-blue-200 min-w-[110px]">Clean Sheets</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-blue-200 min-w-[80px]">POTM</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-blue-200 min-w-[80px]">Points</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-blue-200 min-w-[80px]">Win</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-blue-200 min-w-[80px]">Draw</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-blue-200 min-w-[80px]">Loss</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-blue-200 min-w-[120px]">Total Matches</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-blue-200 min-w-[110px]">Total Points</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-blue-200 min-w-[150px]">Category Trophy 1</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-blue-200 min-w-[150px]">Category Trophy 2</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-blue-200 min-w-[160px]">Individual Trophy 1</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider min-w-[160px]">Individual Trophy 2</th>
                  </tr>
                </thead>
                <tbody className="bg-white/50 divide-y divide-gray-200">
                  {sortedPlayers.map((player, index) => (
                    <tr key={player.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-600 border-r border-gray-200">{index + 1}</td>
                      <td className="px-4 py-3 border-r border-gray-200">
                        <input
                          type="text"
                          value={player.name}
                          onChange={(e) => updatePlayerField(player.id, 'name', e.target.value)}
                          onPaste={(e) => handlePlayerPaste(e, player.id, 'name', index)}
                          onFocus={(e) => e.target.select()}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-medium"
                        />
                      </td>
                      <td className="px-4 py-3 border-r border-gray-200">
                        <input
                          type="text"
                          value={player.team || ''}
                          onChange={(e) => updatePlayerField(player.id, 'team', e.target.value)}
                          onPaste={(e) => handlePlayerPaste(e, player.id, 'team', index)}
                          onFocus={(e) => e.target.select()}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </td>
                      <td className="px-4 py-3 border-r border-gray-200">
                        <input
                          type="text"
                          value={player.category || ''}
                          onChange={(e) => updatePlayerField(player.id, 'category', e.target.value)}
                          onPaste={(e) => handlePlayerPaste(e, player.id, 'category', index)}
                          onFocus={(e) => e.target.select()}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </td>
                      <td className="px-4 py-3 border-r border-gray-200">
                        <input
                          type="number"
                          step="0.01"
                          value={player.stats?.goals_scored || 0}
                          onChange={(e) => updatePlayerField(player.id, 'stats.goals_scored', e.target.value)}
                          onPaste={(e) => handlePlayerPaste(e, player.id, 'stats.goals_scored', index)}
                          onFocus={(e) => e.target.select()}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </td>
                      <td className="px-4 py-3 border-r border-gray-200">
                        <input
                          type="number"
                          step="0.01"
                          value={player.stats?.goals_per_game || 0}
                          onChange={(e) => updatePlayerField(player.id, 'stats.goals_per_game', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </td>
                      <td className="px-4 py-3 border-r border-gray-200">
                        <input
                          type="number"
                          step="0.01"
                          value={player.stats?.goals_conceded || 0}
                          onChange={(e) => updatePlayerField(player.id, 'stats.goals_conceded', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </td>
                      <td className="px-4 py-3 border-r border-gray-200">
                        <input
                          type="number"
                          step="0.01"
                          value={player.stats?.conceded_per_game || 0}
                          onChange={(e) => updatePlayerField(player.id, 'stats.conceded_per_game', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </td>
                      <td className="px-4 py-3 border-r border-gray-200">
                        <input
                          type="number"
                          step="0.01"
                          value={player.stats?.net_goals || 0}
                          onChange={(e) => updatePlayerField(player.id, 'stats.net_goals', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </td>
                      <td className="px-4 py-3 border-r border-gray-200">
                        <input
                          type="number"
                          value={player.stats?.cleansheets || player.stats?.clean_sheets || 0}
                          onChange={(e) => updatePlayerField(player.id, 'stats.cleansheets', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </td>
                      <td className="px-4 py-3 border-r border-gray-200">
                        <input
                          type="number"
                          value={player.stats?.potm || 0}
                          onChange={(e) => updatePlayerField(player.id, 'stats.potm', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </td>
                      <td className="px-4 py-3 border-r border-gray-200">
                        <input
                          type="number"
                          step="0.01"
                          value={player.stats?.points || 0}
                          onChange={(e) => updatePlayerField(player.id, 'stats.points', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </td>
                      <td className="px-4 py-3 border-r border-gray-200">
                        <input
                          type="number"
                          value={player.stats?.win || 0}
                          onChange={(e) => updatePlayerField(player.id, 'stats.win', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </td>
                      <td className="px-4 py-3 border-r border-gray-200">
                        <input
                          type="number"
                          value={player.stats?.draw || 0}
                          onChange={(e) => updatePlayerField(player.id, 'stats.draw', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </td>
                      <td className="px-4 py-3 border-r border-gray-200">
                        <input
                          type="number"
                          value={player.stats?.loss || 0}
                          onChange={(e) => updatePlayerField(player.id, 'stats.loss', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </td>
                      <td className="px-4 py-3 border-r border-gray-200">
                        <input
                          type="number"
                          value={player.stats?.total_matches || 0}
                          onChange={(e) => updatePlayerField(player.id, 'stats.total_matches', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </td>
                      <td className="px-4 py-3 border-r border-gray-200">
                        <input
                          type="number"
                          step="0.01"
                          value={player.stats?.total_points || 0}
                          onChange={(e) => updatePlayerField(player.id, 'stats.total_points', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </td>
                      <td className="px-4 py-3 border-r border-gray-200">
                        <input
                          type="text"
                          value={player.category_wise_trophy_1 || ''}
                          onChange={(e) => updatePlayerField(player.id, 'category_wise_trophy_1', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </td>
                      <td className="px-4 py-3 border-r border-gray-200">
                        <input
                          type="text"
                          value={player.category_wise_trophy_2 || ''}
                          onChange={(e) => updatePlayerField(player.id, 'category_wise_trophy_2', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </td>
                      <td className="px-4 py-3 border-r border-gray-200">
                        <input
                          type="text"
                          value={player.individual_wise_trophy_1 || ''}
                          onChange={(e) => updatePlayerField(player.id, 'individual_wise_trophy_1', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={player.individual_wise_trophy_2 || ''}
                          onChange={(e) => updatePlayerField(player.id, 'individual_wise_trophy_2', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {sortedPlayers.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-500">No players found matching "{searchTerm}"</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Info Banner */}
        <div className="mt-6 glass rounded-xl p-4 border border-blue-200/50 bg-gradient-to-r from-blue-50/50 to-indigo-50/30">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-sm text-gray-700">
              <p className="font-semibold mb-1">💡 Excel-Style Editing Tips:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>All fields are directly editable - click any cell to modify</li>
                <li><strong>Copy/Paste from Excel:</strong> Copy a column from Excel (multiple cells), click any cell here, and paste (Ctrl+V) - data fills down automatically!</li>
                <li><strong>Sorting:</strong> Click column headers to sort data (click again to reverse)</li>
                <li><strong>Auto-select:</strong> Click any cell to auto-select all text for easy copying</li>
                <li>Use the search bar to quickly find specific teams or players</li>
                <li>Changes are saved in memory until you click "Save All Changes"</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
