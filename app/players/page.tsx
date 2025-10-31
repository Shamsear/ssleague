'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import OptimizedImage from '@/components/OptimizedImage';

interface Player {
  id: string;
  player_id: string;
  name: string;
  display_name?: string;
  category?: string;
  team?: string;
  team_name?: string;
  photo_url?: string;
  current_season_id?: string;
  stats: {
    points: number;
    matches_played: number;
    goals_scored: number;
    clean_sheets: number;
  };
}

export default function AllPlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('name');
  const [teams, setTeams] = useState<string[]>([]);

  useEffect(() => {
    fetchPlayers();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchTerm, categoryFilter, teamFilter, sortBy, players]);

  const fetchPlayers = async () => {
    try {
      setLoading(true);
      
      // Fetch all players from Firebase and aggregate their stats
      const response = await fetch('/api/players/with-stats');
      const data = await response.json();
      
      if (data.success && data.players) {
        const playersData = data.players.map((p: any) => ({
          id: p.id,
          player_id: p.player_id,
          name: p.name,
          display_name: p.display_name,
          category: p.category,
          team: p.team,
          team_name: p.team_name,
          photo_url: p.photo_url,
          current_season_id: p.current_season_id,
          stats: {
            points: p.total_points || 0,
            matches_played: p.matches_played || 0,
            goals_scored: p.goals_scored || 0,
            clean_sheets: p.clean_sheets || 0
          }
        })) as Player[];
        
        setPlayers(playersData);
        
        // Extract unique teams for filter
        const uniqueTeams = Array.from(new Set(playersData.map(p => p.team_name).filter(Boolean))) as string[];
        setTeams(uniqueTeams.sort());
      }
    } catch (error) {
      console.error('Error fetching players:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...players];
    
    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(player =>
        player.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        player.display_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(player => player.category === categoryFilter);
    }
    
    // Team filter
    if (teamFilter !== 'all') {
      filtered = filtered.filter(player => player.team_name === teamFilter);
    }
    
    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'points':
          return b.stats.points - a.stats.points;
        case 'goals':
          return b.stats.goals_scored - a.stats.goals_scored;
        case 'matches':
          return b.stats.matches_played - a.stats.matches_played;
        default:
          return 0;
      }
    });
    
    setFilteredPlayers(filtered);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading players...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Title */}
        <div className="glass rounded-3xl p-8 mb-8 shadow-xl backdrop-blur-md border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-[#0066FF] via-blue-500 to-[#0066FF] bg-clip-text text-transparent mb-2">
                All Players
              </h1>
              <p className="text-gray-600">
                {filteredPlayers.length} Player{filteredPlayers.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-[#0066FF]">{players.length}</div>
              <div className="text-sm text-gray-600">Total Players</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="glass rounded-3xl p-6 mb-8 shadow-xl backdrop-blur-md border border-white/20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <input
              type="text"
              placeholder="Search players..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Categories</option>
              <option value="Legend">Legend</option>
              <option value="Classic">Classic</option>
            </select>
          </div>

          {/* Team Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Team</label>
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Teams</option>
              {teams.map(team => (
                <option key={team} value={team}>{team}</option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="name">Name (A-Z)</option>
              <option value="points">Points</option>
              <option value="goals">Goals</option>
              <option value="matches">Matches Played</option>
            </select>
          </div>
        </div>

        {/* Results Count */}
        <div className="mt-4 text-sm text-gray-600">
          Showing {filteredPlayers.length} of {players.length} players
        </div>
      </div>

        {/* Mobile Cards */}
        <div className="block lg:hidden">
          {filteredPlayers.length === 0 ? (
            <div className="glass rounded-3xl p-12 text-center shadow-xl backdrop-blur-md border border-white/20">
              <div className="text-6xl mb-4">👥</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">No Players Found</h3>
              <p className="text-gray-600">
                {searchTerm || categoryFilter !== 'all' || teamFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'No players available'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPlayers.map((player) => (
              <Link
                key={player.id}
                href={`/players/${player.id}`}
                className="glass rounded-3xl p-5 shadow-lg backdrop-blur-md border border-white/30 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 flex items-center gap-4"
              >
                {/* Circular Photo with gradient border */}
                <div className="relative flex-shrink-0">
                  <div className="absolute -inset-0.5 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full opacity-75"></div>
                  <div className="relative w-20 h-20 rounded-full overflow-hidden shadow-lg bg-white p-0.5">
                    {player.photo_url ? (
                      <OptimizedImage
                        src={player.photo_url}
                        alt={player.name}
                        width={80}
                        height={80}
                        quality={85}
                        className="w-full h-full object-cover rounded-full"
                        fallback={
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-purple-100 rounded-full">
                            <span className="text-2xl font-bold text-blue-600">{player.name[0]}</span>
                          </div>
                        }
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-purple-100 rounded-full">
                        <span className="text-2xl font-bold text-blue-600">{player.name[0]}</span>
                      </div>
                    )}
                  </div>
                  {/* Category Badge */}
                  {player.category && (
                    <div className={`absolute -bottom-1 left-1/2 transform -translate-x-1/2 px-2 py-0.5 rounded-full text-xs font-bold shadow-md ${
                      player.category === 'Legend' || player.category?.toLowerCase() === 'legend'
                        ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white'
                        : 'bg-gradient-to-r from-blue-400 to-blue-600 text-white'
                    }`}>
                      {player.category.toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Player Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 text-lg mb-1 truncate">
                    {player.display_name || player.name}
                  </h3>
                  {player.team_name && (
                    <p className="text-sm text-gray-600 truncate mb-3">{player.team_name}</p>
                  )}
                  {/* Stats Pills */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-blue-50 to-blue-100 rounded-full border border-blue-200">
                      <span className="text-xs font-bold text-[#0066FF]">{player.stats.points}</span>
                      <span className="text-xs text-gray-600">pts</span>
                    </div>
                    <div className="flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-green-50 to-green-100 rounded-full border border-green-200">
                      <span className="text-xs">⚽</span>
                      <span className="text-xs font-semibold text-green-700">{player.stats.goals_scored}</span>
                    </div>
                    <div className="flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-purple-50 to-purple-100 rounded-full border border-purple-200">
                      <span className="text-xs font-semibold text-purple-700">{player.stats.matches_played}</span>
                      <span className="text-xs text-gray-600">games</span>
                    </div>
                  </div>
                </div>

                {/* Arrow */}
                <svg className="w-6 h-6 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
            </div>
          )}
        </div>

        {/* Desktop List */}
        <div className="hidden lg:block glass rounded-3xl overflow-hidden shadow-xl backdrop-blur-md border border-white/20">
          {filteredPlayers.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">👥</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">No Players Found</h3>
              <p className="text-gray-600">
                {searchTerm || categoryFilter !== 'all' || teamFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'No players available'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredPlayers.map((player) => (
                <Link
                  key={player.id}
                  href={`/players/${player.id}`}
                  className="flex items-center gap-6 p-4 hover:bg-white/50 transition-all duration-200"
                >
                  {/* Circular Photo */}
                  <div className="w-20 h-20 flex-shrink-0 rounded-full overflow-hidden shadow-md border-2 border-white/50">
                    {player.photo_url ? (
                      <OptimizedImage
                        src={player.photo_url}
                        alt={player.name}
                        width={80}
                        height={80}
                        quality={85}
                        className="w-full h-full object-cover"
                        fallback={
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-purple-100">
                            <span className="text-2xl font-bold text-blue-600">{player.name[0]}</span>
                          </div>
                        }
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-purple-100">
                        <span className="text-2xl font-bold text-blue-600">{player.name[0]}</span>
                      </div>
                    )}
                  </div>

                  {/* Player Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-bold text-gray-900 text-lg">
                        {player.display_name || player.name}
                      </h3>
                      {player.category && (
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                          player.category === 'Legend' || player.category?.toLowerCase() === 'legend'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {player.category}
                        </span>
                      )}
                    </div>
                    {player.team_name && (
                      <p className="text-sm text-gray-600">{player.team_name}</p>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4">
                    <div className="text-center px-4 py-2 rounded-lg bg-blue-50 border border-blue-200">
                      <div className="text-xl font-bold text-[#0066FF]">{player.stats.points}</div>
                      <div className="text-xs text-gray-600">Points</div>
                    </div>
                    <div className="text-center px-4 py-2 rounded-lg bg-green-50 border border-green-200">
                      <div className="text-xl font-bold text-green-600">{player.stats.goals_scored}</div>
                      <div className="text-xs text-gray-600">Goals</div>
                    </div>
                    <div className="text-center px-4 py-2 rounded-lg bg-gray-50 border border-gray-200">
                      <div className="text-xl font-bold text-gray-900">{player.stats.matches_played}</div>
                      <div className="text-xs text-gray-600">Matches</div>
                    </div>
                    <div className="text-center px-4 py-2 rounded-lg bg-blue-50 border border-blue-200">
                      <div className="text-xl font-bold text-blue-600">{player.stats.clean_sheets}</div>
                      <div className="text-xs text-gray-600">CS</div>
                    </div>
                  </div>

                  {/* Arrow */}
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
