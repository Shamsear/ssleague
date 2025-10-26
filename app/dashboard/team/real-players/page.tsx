'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface RealPlayer {
  player_id: string;
  player_name: string;
  team: string;
  team_id: string;
  category: string;
  star_rating: number;
  points: number;
  matches_played: number;
  goals_scored: number;
  assists: number;
  wins: number;
  draws: number;
  losses: number;
  clean_sheets: number;
  motm_awards: number;
}

export default function RealPlayersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [players, setPlayers] = useState<RealPlayer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [activeSeason, setActiveSeason] = useState<any>(null);

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
      if (!user) return;

      try {
        setIsLoading(true);

        // Get active season
        const seasonResponse = await fetch('/api/cached/firebase/seasons?isActive=true');
        
        if (!seasonResponse.ok) {
          console.error('Failed to fetch seasons:', seasonResponse.statusText);
          return;
        }
        
        const contentType = seasonResponse.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.error('Season API did not return JSON');
          return;
        }
        
        const seasonData = await seasonResponse.json();
        
        if (seasonData.success && seasonData.data.length > 0) {
          const season = seasonData.data[0];
          setActiveSeason(season);

          // Fetch real players for this season
          // The API automatically queries the correct table based on season number
          const playersResponse = await fetch(`/api/stats/players?seasonId=${season.id}&limit=1000`);
          
          if (!playersResponse.ok) {
            console.error('Failed to fetch players:', playersResponse.statusText);
            return;
          }
          
          const playersContentType = playersResponse.headers.get('content-type');
          if (!playersContentType || !playersContentType.includes('application/json')) {
            console.error('Players API did not return JSON');
            return;
          }
          
          const playersData = await playersResponse.json();

          if (playersData.success) {
            // Filter to show only players with star ratings (real players)
            const realPlayers = playersData.data?.filter((p: any) => p.star_rating && p.star_rating > 0) || [];
            setPlayers(realPlayers);
            console.log(`✅ Loaded ${realPlayers.length} real players for ${season.name}`);
          } else {
            console.error('Players API error:', playersData.error);
          }
        }
      } catch (error) {
        console.error('Error fetching players:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const filteredPlayers = players.filter(player => {
    const matchesSearch = player.player_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         player.team.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || player.category?.toLowerCase() === categoryFilter.toLowerCase();
    return matchesSearch && matchesCategory;
  });

  const getStarRatingDisplay = (rating: number) => {
    return '⭐'.repeat(Math.min(rating, 10));
  };

  const getCategoryBadge = (category: string) => {
    if (!category) return null;
    
    const isLegend = category.toLowerCase() === 'legend';
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
        isLegend 
          ? 'bg-yellow-100 text-yellow-800' 
          : 'bg-blue-100 text-blue-800'
      }`}>
        {category}
      </span>
    );
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading players...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'team') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/dashboard/team"
            className="inline-flex items-center px-4 py-2 rounded-2xl text-gray-700 glass backdrop-blur-md border border-white/20 hover:shadow-lg transition-all duration-300"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
        </div>

        {/* Title */}
        <div className="glass rounded-3xl p-8 mb-8 shadow-xl backdrop-blur-md border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-[#0066FF] via-blue-500 to-[#0066FF] bg-clip-text text-transparent mb-2">
                SS Members (Real Players)
              </h1>
              <p className="text-gray-600">
                {activeSeason ? `${activeSeason.name} - ` : ''}
                {filteredPlayers.length} SS Member{filteredPlayers.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-[#0066FF]">{players.length}</div>
              <div className="text-sm text-gray-600">Total SS Members</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="glass rounded-3xl p-6 mb-8 shadow-xl backdrop-blur-md border border-white/20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Players
              </label>
              <input
                type="text"
                placeholder="Search by name or team..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#0066FF] focus:border-transparent"
              />
            </div>

            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#0066FF] focus:border-transparent"
              >
                <option value="all">All Categories</option>
                <option value="legend">Legend</option>
                <option value="classic">Classic</option>
              </select>
            </div>
          </div>
        </div>

        {/* Players Grid */}
        {filteredPlayers.length === 0 ? (
          <div className="glass rounded-3xl p-12 text-center shadow-xl backdrop-blur-md border border-white/20">
            <div className="text-6xl mb-4">🎮</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No Players Found</h3>
            <p className="text-gray-600">
              {searchTerm || categoryFilter !== 'all' 
                ? 'Try adjusting your filters' 
                : 'No players registered for this season yet'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPlayers.map((player) => (
              <Link
                key={player.player_id}
                href={`/dashboard/players/${player.player_id}`}
                className="glass rounded-3xl p-6 shadow-xl backdrop-blur-md border border-white/20 hover:shadow-2xl hover:scale-105 transition-all duration-300"
              >
                {/* Player Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900 mb-1">
                      {player.player_name}
                    </h3>
                    <p className="text-sm text-gray-600">{player.team}</p>
                  </div>
                  {getCategoryBadge(player.category)}
                </div>

                {/* Star Rating */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">Rating</span>
                    <span className="text-sm font-bold text-[#0066FF]">
                      {player.star_rating || 3} ⭐
                    </span>
                  </div>
                  <div className="text-2xl">
                    {getStarRatingDisplay(player.star_rating || 3)}
                  </div>
                </div>

                {/* Points */}
                <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Points</span>
                    <span className="text-2xl font-bold text-[#0066FF]">
                      {player.points || 0}
                    </span>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="text-center p-2 bg-white/50 rounded-lg">
                    <div className="text-xs text-gray-600">Matches</div>
                    <div className="text-lg font-bold text-gray-900">{player.matches_played || 0}</div>
                  </div>
                  <div className="text-center p-2 bg-white/50 rounded-lg">
                    <div className="text-xs text-gray-600">Goals</div>
                    <div className="text-lg font-bold text-green-600">{player.goals_scored || 0}</div>
                  </div>
                  <div className="text-center p-2 bg-white/50 rounded-lg">
                    <div className="text-xs text-gray-600">Assists</div>
                    <div className="text-lg font-bold text-blue-600">{player.assists || 0}</div>
                  </div>
                  <div className="text-center p-2 bg-white/50 rounded-lg">
                    <div className="text-xs text-gray-600">MOTM</div>
                    <div className="text-lg font-bold text-yellow-600">{player.motm_awards || 0}</div>
                  </div>
                </div>

                {/* Win/Draw/Loss */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-green-600 font-medium">W: {player.wins || 0}</span>
                  <span className="text-gray-600 font-medium">D: {player.draws || 0}</span>
                  <span className="text-red-600 font-medium">L: {player.losses || 0}</span>
                </div>

                {/* View Details Button */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-center text-[#0066FF] font-medium text-sm">
                    View Details
                    <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
