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
  player_id: string;
  name: string;
  team_name: string;
  matches_played: number;
  wins: number;
  draws: number;
  losses: number;
  goals: number;
  goals_conceded: number;
  clean_sheets: number;
  potm: number;
  win_rate: number;
  average_rating: number;
  points: number;
  star_rating: number;
  base_points?: number;
}

type SortField = 'matches_played' | 'wins' | 'goals' | 'goals_conceded' | 'potm' | 'win_rate' | 'points' | 'star_rating';
type TabType = 'all' | 'golden-boot' | 'golden-glove' | 'rankings' | 'most-improved';

export default function PlayerStatsPage() {
  const { user, loading } = useAuth();
  const { selectedTournamentId } = useTournamentContext();
  const { userSeasonId } = usePermissions();
  const router = useRouter();
  
  // Get tournament info for display
  const { data: tournament } = useTournament(selectedTournamentId);
  
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<PlayerStats[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('all');

  // Use React Query hook for player stats from Neon - fetches from player_seasons table
  const { data: playerStatsData, isLoading: statsLoading, isFetching } = usePlayerStats({
    tournamentId: selectedTournamentId,
    seasonId: userSeasonId || '',
  });
  
  console.log('[Player Stats Page] Stats loading:', statsLoading, 'Fetching:', isFetching, 'Data count:', playerStatsData?.length || 0);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('matches_played');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'committee_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  // Process player stats data from Neon when it arrives
  useEffect(() => {
    if (!playerStatsData || playerStatsData.length === 0) return;
    
    const players: PlayerStats[] = playerStatsData.map((data: any) => {
      const winRate = data.matches_played > 0 ? (data.wins / data.matches_played) * 100 : 0;
      
      return {
        player_id: data.player_id,
        name: data.player_name,
        team_name: data.team || 'Unassigned',
        matches_played: data.matches_played || 0,
        wins: data.wins || 0,
        draws: data.draws || 0,
        losses: data.losses || 0,
        goals: data.goals_scored || 0,
        goals_conceded: data.goals_conceded || 0,
        clean_sheets: data.clean_sheets || 0,
        potm: data.motm_awards || 0,
        win_rate: winRate,
        average_rating: 0,
        points: data.points || 0,
        base_points: data.base_points || 0,
        star_rating: data.star_rating || 3,
      };
    });

    setPlayerStats(players);
    setFilteredPlayers(players);
  }, [playerStatsData]);

  useEffect(() => {
    let filtered = [...playerStats];

    // Tab filter
    if (activeTab === 'golden-boot') {
      // Top 10 goal scorers
      filtered = filtered
        .filter(p => p.goals > 0)
        .sort((a, b) => b.goals - a.goals)
        .slice(0, 10);
    } else if (activeTab === 'golden-glove') {
      // Top 10 clean sheet keepers
      // Sort by: 1) Most clean sheets, 2) Fewest goals conceded (as tiebreaker)
      filtered = filtered
        .filter(p => p.matches_played > 0)
        .sort((a, b) => {
          // Primary: Clean sheets (descending)
          if (b.clean_sheets !== a.clean_sheets) {
            return b.clean_sheets - a.clean_sheets;
          }
          // Secondary: Goals conceded (ascending - fewer is better)
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
          points_change: p.points - (p.base_points || 0)
        }))
        .sort((a, b) => b.points_change - a.points_change)
        .slice(0, 10);
    }

    // Search filter (only for 'all' tab)
    if (activeTab === 'all' && searchTerm) {
      filtered = filtered.filter((p) =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.player_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.team_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort (only for 'all' tab)
    if (activeTab === 'all') {
      filtered.sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        
        if (sortOrder === 'asc') {
          return aVal > bVal ? 1 : -1;
        } else {
          return aVal < bVal ? 1 : -1;
        }
      });
    }

    setFilteredPlayers(filtered);
  }, [playerStats, searchTerm, sortField, sortOrder, activeTab]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const exportToExcel = async () => {
    try {
      // Dynamically import xlsx
      const XLSX = await import('xlsx');
      
      // Prepare data for export
      const exportData = filteredPlayers.map((player, index) => ({
        'Rank': index + 1,
        'Player Name': player.name,
        'Player ID': player.player_id,
        'Team': player.team_name,
        'Matches Played': player.matches_played,
        'Wins': player.wins,
        'Draws': player.draws,
        'Losses': player.losses,
        'Goals Scored': player.goals,
        'Goals Conceded': player.goals_conceded,
        'Clean Sheets': player.clean_sheets,
        'POTM Awards': player.potm,
        'Win Rate (%)': player.win_rate.toFixed(2),
        'Current Points': player.points,
        'Base Points': player.base_points || 0,
        'Points Change': player.base_points ? player.points - player.base_points : 0,
        'Star Rating': player.star_rating
      }));

      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      
      // Set column widths
      const columnWidths = [
        { wch: 6 },  // Rank
        { wch: 25 }, // Player Name
        { wch: 15 }, // Player ID
        { wch: 20 }, // Team
        { wch: 15 }, // Matches Played
        { wch: 8 },  // Wins
        { wch: 8 },  // Draws
        { wch: 8 },  // Losses
        { wch: 12 }, // Goals Scored
        { wch: 14 }, // Goals Conceded
        { wch: 12 }, // Clean Sheets
        { wch: 12 }, // POTM Awards
        { wch: 12 }, // Win Rate
        { wch: 14 }, // Current Points
        { wch: 12 }, // Base Points
        { wch: 14 }, // Points Change
        { wch: 12 }  // Star Rating
      ];
      worksheet['!cols'] = columnWidths;

      // Create workbook
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Player Stats');

      // Generate filename with tournament and date
      const tournamentName = tournament?.name || 'Tournament';
      const date = new Date().toISOString().split('T')[0];
      const filename = `${tournamentName}_Player_Stats_${date}.xlsx`;

      // Save file
      XLSX.writeFile(workbook, filename);
      
      console.log(`✅ Exported ${exportData.length} players to ${filename}`);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Failed to export to Excel. Please try again.');
    }
  };

  if (loading || statsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading player stats...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'committee_admin') {
    return null;
  }

  // Top performers
  const topScorer = [...playerStats].sort((a, b) => b.goals - a.goals)[0];
  const mostPOTM = [...playerStats].sort((a, b) => b.potm - a.potm)[0];
  const highestPoints = [...playerStats].sort((a, b) => b.points - a.points)[0];
  const highestStars = [...playerStats].sort((a, b) => b.star_rating - a.star_rating)[0];

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold gradient-text">Player Statistics</h1>
          <p className="text-gray-500 mt-1">Individual player performance metrics</p>
          <div className="flex gap-4 mt-2">
            <Link
              href="/dashboard/committee/team-management"
              className="inline-flex items-center text-[#0066FF] hover:text-[#0052CC] text-sm"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Team Management
            </Link>
            <Link
              href="/dashboard/committee/team-management/team-standings"
              className="inline-flex items-center text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              View Team Standings →
            </Link>
          </div>
        </div>
        <div>
          <TournamentSelector />
        </div>
      </div>

      {/* Top Performers */}
      {playerStats.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {topScorer && topScorer.goals > 0 && (
            <div className="bg-gradient-to-br from-yellow-50 to-amber-50 border border-yellow-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">⚽</span>
                <h3 className="text-sm font-semibold text-gray-700">Top Scorer</h3>
              </div>
              <p className="text-lg font-bold text-gray-900">{topScorer.name}</p>
              <p className="text-2xl font-extrabold text-yellow-600">{topScorer.goals} Goals</p>
              <p className="text-xs text-gray-600 mt-1">{topScorer.team_name}</p>
            </div>
          )}
          
          {mostPOTM && mostPOTM.potm > 0 && (
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">⭐</span>
                <h3 className="text-sm font-semibold text-gray-700">Most POTM</h3>
              </div>
              <p className="text-lg font-bold text-gray-900">{mostPOTM.name}</p>
              <p className="text-2xl font-extrabold text-purple-600">{mostPOTM.potm} POTM</p>
              <p className="text-xs text-gray-600 mt-1">{mostPOTM.team_name}</p>
            </div>
          )}
          
          {highestPoints && highestPoints.points > 0 && (
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">💎</span>
                <h3 className="text-sm font-semibold text-gray-700">Highest Points</h3>
              </div>
              <p className="text-lg font-bold text-gray-900">{highestPoints.name}</p>
              <p className="text-2xl font-extrabold text-green-600">{highestPoints.points}p</p>
              <p className="text-xs text-gray-600 mt-1">{highestPoints.team_name} • {highestPoints.star_rating}⭐</p>
            </div>
          )}
          
          {highestStars && highestStars.star_rating > 0 && (
            <div className="bg-gradient-to-br from-orange-50 to-red-50 border border-orange-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">🌟</span>
                <h3 className="text-sm font-semibold text-gray-700">Top Rated</h3>
              </div>
              <p className="text-lg font-bold text-gray-900">{highestStars.name}</p>
              <p className="text-2xl font-extrabold text-orange-600">{highestStars.star_rating}⭐</p>
              <p className="text-xs text-gray-600 mt-1">{highestStars.team_name} • {highestStars.points}p</p>
            </div>
          )}
        </div>
      )}

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

      {/* Search and Filters */}
      {activeTab === 'all' && (
        <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-xl p-4 border border-gray-100/20 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search players by name, ID, or team..."
                value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => handleSort('matches_played')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                sortField === 'matches_played' ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Sort by MP {sortField === 'matches_played' && (sortOrder === 'desc' ? '↓' : '↑')}
            </button>
            <button
              onClick={() => handleSort('goals')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                sortField === 'goals' ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Sort by Goals {sortField === 'goals' && (sortOrder === 'desc' ? '↓' : '↑')}
            </button>
            <button
              onClick={() => handleSort('win_rate')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                sortField === 'win_rate' ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Sort by Win% {sortField === 'win_rate' && (sortOrder === 'desc' ? '↓' : '↑')}
            </button>
            <button
              onClick={() => handleSort('points')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                sortField === 'points' ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Sort by Points {sortField === 'points' && (sortOrder === 'desc' ? '↓' : '↑')}
            </button>
            <button
              onClick={() => handleSort('star_rating')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                sortField === 'star_rating' ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Sort by Stars {sortField === 'star_rating' && (sortOrder === 'desc' ? '↓' : '↑')}
            </button>
            <button
              onClick={exportToExcel}
              className="px-4 py-2 text-sm font-medium rounded-lg transition-colors bg-green-600 text-white hover:bg-green-700 flex items-center gap-2"
              title="Export to Excel"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export Excel
            </button>
          </div>
        </div>
      </div>
      )}

      {/* Player Stats Table */}
      <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl overflow-hidden border border-gray-100/20">
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {activeTab === 'golden-boot' && '⚽ Golden Boot - Top Scorers'}
                {activeTab === 'golden-glove' && '🧤 Golden Glove - Clean Sheet Leaders'}
                {activeTab === 'rankings' && '🏆 Top 20 Rankings'}
                {activeTab === 'most-improved' && '📈 Most Improved Players'}
                {activeTab === 'all' && 'Player Performance'}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {activeTab === 'golden-boot' && 'Top 10 players by goals scored'}
                {activeTab === 'golden-glove' && 'Top 10 players by clean sheets'}
                {activeTab === 'rankings' && 'Top 20 players by points'}
                {activeTab === 'most-improved' && 'Top 10 players with highest points gain'}
                {activeTab === 'all' && 'Detailed statistics for all players'}
                {roundRange !== 'all' && ` (Rounds ${roundRange})`}
              </p>
            </div>
            <div className="text-sm text-gray-600">
              <span className="font-semibold">{filteredPlayers.length}</span> / {playerStats.length} Players
            </div>
          </div>
        </div>

        {filteredPlayers.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-600 mb-2">No Player Stats Found</h3>
            <p className="text-sm">{searchTerm ? 'Try a different search term' : 'Player statistics will appear once matches are completed'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50">Player</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('matches_played')}>
                    MP {sortField === 'matches_played' && (sortOrder === 'desc' ? '↓' : '↑')}
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('wins')}>
                    W {sortField === 'wins' && (sortOrder === 'desc' ? '↓' : '↑')}
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">D</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">L</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('goals')}>
                    Goals {sortField === 'goals' && (sortOrder === 'desc' ? '↓' : '↑')}
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('goals_conceded')}>
                    GC {sortField === 'goals_conceded' && (sortOrder === 'desc' ? '↓' : '↑')}
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">CS</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('potm')}>
                    POTM {sortField === 'potm' && (sortOrder === 'desc' ? '↓' : '↑')}
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('win_rate')}>
                    Win % {sortField === 'win_rate' && (sortOrder === 'desc' ? '↓' : '↑')}
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('points')}>
                    Points {sortField === 'points' && (sortOrder === 'desc' ? '↓' : '↑')}
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Base Pts
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Change
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('star_rating')}>
                    Stars {sortField === 'star_rating' && (sortOrder === 'desc' ? '↓' : '↑')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white/60 divide-y divide-gray-200/50">
                {filteredPlayers.map((player, index) => (
                  <tr key={player.player_id} className="hover:bg-purple-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap sticky left-0 bg-white">
                      <div className="flex items-center gap-2">
                        {index === 0 && <span className="text-lg">🥇</span>}
                        {index === 1 && <span className="text-lg">🥈</span>}
                        {index === 2 && <span className="text-lg">🥉</span>}
                        <div>
                          <div className="text-sm font-bold text-gray-900">{player.name}</div>
                          <div className="text-xs text-gray-500">{player.player_id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{player.team_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium text-gray-900">{player.matches_played}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-semibold text-green-600">{player.wins}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600">{player.draws}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-semibold text-red-600">{player.losses}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        ⚽ {player.goals}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        🥅 {player.goals_conceded || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        🛡️ {player.clean_sheets}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        ⭐ {player.potm}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`text-sm font-semibold ${player.win_rate >= 50 ? 'text-green-600' : 'text-gray-600'}`}>
                        {player.win_rate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-green-100 to-emerald-100 text-green-800">
                        💎 {player.points}p
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="text-sm font-medium text-gray-600">
                        {player.base_points || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {player.base_points !== undefined && player.base_points > 0 ? (
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold ${
                          player.points - player.base_points > 0 
                            ? 'bg-green-100 text-green-700' 
                            : player.points - player.base_points < 0
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {player.points - player.base_points > 0 ? '↑' : player.points - player.base_points < 0 ? '↓' : '='} 
                          {player.points - player.base_points > 0 ? '+' : ''}{player.points - player.base_points}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-sm font-bold bg-gradient-to-r from-yellow-100 to-orange-100 text-orange-800">
                        {'⭐'.repeat(Math.min(player.star_rating, 10))}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-6 bg-purple-50 border border-purple-200 rounded-xl p-4">
        <p className="text-xs text-purple-800 font-medium mb-2">📊 Legend</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs text-purple-700">
          <div><strong>MP</strong> = Matches Played</div>
          <div><strong>W</strong> = Wins</div>
          <div><strong>D</strong> = Draws</div>
          <div><strong>L</strong> = Losses</div>
          <div><strong>GC</strong> = Goals Conceded</div>
          <div><strong>CS</strong> = Clean Sheets</div>
          <div><strong>POTM</strong> = Player of the Match</div>
          <div><strong>Win %</strong> = Win Percentage</div>
          <div><strong>Points</strong> = Current Season Points (Max ±5/match)</div>
          <div><strong>Base Pts</strong> = Starting Points (from previous season)</div>
          <div><strong>Change</strong> = Points gained/lost this season (Current - Base)</div>
          <div><strong>Stars</strong> = Star Rating (3☆-10☆)</div>
        </div>
      </div>
    </div>
  );
}
