'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import Link from 'next/link';
import Image from 'next/image';

interface Player {
  id: string;
  player_id: string;
  name: string;
  display_name?: string;
  category?: string;
  team?: string;
  photo_url?: string;
  stats?: {
    points?: number;
    matches_played?: number;
    goals_scored?: number;
    average_rating?: number;
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
      
      // Fetch all players from realplayers collection
      const playersRef = collection(db, 'realplayers');
      const playersQuery = query(playersRef, orderBy('name'));
      const playersSnapshot = await getDocs(playersQuery);
      
      const playersData = playersSnapshot.docs.map(doc => ({
        id: doc.id,
        player_id: doc.data().player_id,
        name: doc.data().name,
        display_name: doc.data().display_name,
        category: doc.data().category,
        team: doc.data().team,
        photo_url: doc.data().photo_url,
        stats: doc.data().stats || {}
      })) as Player[];
      
      setPlayers(playersData);
      
      // Extract unique teams for filter
      const uniqueTeams = Array.from(new Set(playersData.map(p => p.team).filter(Boolean))) as string[];
      setTeams(uniqueTeams.sort());
      
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
      filtered = filtered.filter(player => player.team === teamFilter);
    }
    
    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'points':
          return (b.stats?.points || 0) - (a.stats?.points || 0);
        case 'goals':
          return (b.stats?.goals_scored || 0) - (a.stats?.goals_scored || 0);
        case 'rating':
          return (b.stats?.average_rating || 0) - (a.stats?.average_rating || 0);
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
              <option value="points">Points (High to Low)</option>
              <option value="goals">Goals (High to Low)</option>
              <option value="rating">Rating (High to Low)</option>
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
              className="glass rounded-xl p-4 hover:shadow-lg transition-all duration-200 hover:scale-105 group"
            >
              {/* Player Photo */}
              <div className="relative w-full aspect-square mb-4 rounded-lg overflow-hidden bg-gradient-to-br from-blue-50 to-purple-50">
                {player.photo_url ? (
                  <Image
                    src={player.photo_url}
                    alt={player.name}
                    fill
                    className="object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-20 h-20 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                    </svg>
                  </div>
                )}
                
                {/* Category Badge */}
                {player.category && (
                  <div className={`absolute top-2 right-2 px-2 py-1 rounded-lg text-xs font-semibold ${
                    player.category === 'Legend' 
                      ? 'bg-amber-500 text-white' 
                      : 'bg-blue-500 text-white'
                  }`}>
                    {player.category}
                  </div>
                )}
              </div>

              {/* Player Info */}
              <div>
                <h3 className="font-bold text-gray-900 mb-1 truncate">
                  {player.display_name || player.name}
                </h3>
                {player.team && (
                  <p className="text-sm text-gray-600 mb-3 truncate">{player.team}</p>
                )}

                {/* Stats */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-blue-50 rounded-lg p-2">
                    <div className="text-gray-600">Points</div>
                    <div className="font-bold text-blue-600">{player.stats?.points || 0}</div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-2">
                    <div className="text-gray-600">Goals</div>
                    <div className="font-bold text-purple-600">{player.stats?.goals_scored || 0}</div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
