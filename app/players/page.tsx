'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2 gradient-text">All Players</h1>
        <p className="text-gray-600">Browse and explore player profiles and statistics</p>
      </div>

      {/* Filters */}
      <div className="glass rounded-2xl p-6 mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

      {/* Players Grid */}
      {filteredPlayers.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <p className="text-gray-600 text-lg">No players found</p>
          <p className="text-gray-500 text-sm mt-2">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredPlayers.map((player) => (
            <Link
              key={player.id}
              href={`/players/${player.id}`}
              className="group"
            >
              <div className="glass rounded-2xl overflow-hidden hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
                {/* Player Photo with Overlay */}
                <div className="relative w-full aspect-[3/4] bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100">
                  {player.photo_url ? (
                    <Image
                      src={player.photo_url}
                      alt={player.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                      <svg className="w-24 h-24 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                      </svg>
                    </div>
                  )}
                  
                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                  
                  {/* Category Badge */}
                  {player.category && (
                    <div className={`absolute top-3 right-3 px-3 py-1.5 rounded-full text-xs font-bold shadow-lg backdrop-blur-sm ${
                      player.category === 'Legend' || player.category?.toLowerCase() === 'legend'
                        ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white' 
                        : 'bg-gradient-to-r from-blue-400 to-blue-600 text-white'
                    }`}>
                      {player.category?.toUpperCase()}
                    </div>
                  )}

                  {/* Player Name Overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h3 className="font-bold text-white text-lg mb-1 drop-shadow-lg">
                      {player.display_name || player.name}
                    </h3>
                    {player.team_name && (
                      <p className="text-white/90 text-sm font-medium drop-shadow-md truncate">{player.team_name}</p>
                    )}
                  </div>
                </div>

                {/* Stats Section */}
                <div className="p-4 bg-white/50">
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="text-center p-2 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200">
                      <div className="text-2xl font-bold text-blue-600">{player.stats.points}</div>
                      <div className="text-xs text-gray-600 font-medium">Points</div>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200">
                      <div className="text-2xl font-bold text-purple-600">⚽ {player.stats.goals_scored}</div>
                      <div className="text-xs text-gray-600 font-medium">Goals</div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-200">
                      <span className="text-xs text-gray-600">Matches</span>
                      <span className="font-bold text-gray-900">{player.stats.matches_played}</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-green-50 border border-green-200">
                      <span className="text-xs text-gray-600">CS</span>
                      <span className="font-bold text-green-600">🛡️ {player.stats.clean_sheets}</span>
                    </div>
                  </div>
                </div>

                {/* Hover Effect Border */}
                <div className="absolute inset-0 rounded-2xl border-2 border-transparent group-hover:border-blue-500 transition-colors duration-300 pointer-events-none"></div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
