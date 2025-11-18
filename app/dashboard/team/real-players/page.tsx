'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import OptimizedImage from '@/components/OptimizedImage';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface RealPlayer {
  player_id: string;
  player_name: string;
  display_name?: string;
  photo_url?: string;
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
  const [starFilter, setStarFilter] = useState('all');
  const [teamFilter, setTeamFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'points' | 'rating' | 'matches' | 'goals'>('points');
  const [activeSeason, setActiveSeason] = useState<any>(null);
  const [teams, setTeams] = useState<string[]>([]);

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
        const seasonResponse = await fetchWithTokenRefresh('/api/cached/firebase/seasons?isActive=true');
        
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
          const playersResponse = await fetchWithTokenRefresh(`/api/stats/players?seasonId=${season.id}&limit=1000`);
          
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
            
            // Fetch photo URLs from Firebase for each player
            const playerIds = realPlayers.map((p: any) => p.player_id).filter(Boolean);
            if (playerIds.length > 0) {
              try {
                const photosResponse = await fetchWithTokenRefresh('/api/real-players?' + new URLSearchParams({
                  playerIds: playerIds.join(',')
                }));
                
                if (photosResponse.ok) {
                  const photosData = await photosResponse.json();
                  if (photosData.success && photosData.players) {
                    // Create a map of player_id to photo_url
                    const photoMap = new Map(
                      photosData.players.map((p: any) => [p.player_id, p.photo_url])
                    );
                    
                    // Merge photo URLs into player data
                    realPlayers.forEach((player: any) => {
                      player.photo_url = photoMap.get(player.player_id) || null;
                    });
                  }
                }
              } catch (photoError) {
                console.warn('Could not fetch player photos:', photoError);
              }
            }
            
            setPlayers(realPlayers);
            
            // Extract unique teams for filter
            const uniqueTeams = Array.from(new Set(realPlayers.map((p: any) => p.team).filter(Boolean))) as string[];
            setTeams(uniqueTeams.sort());
            
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

  // Extract unique star ratings from players for filter options
  const uniqueStarRatings = Array.from(new Set(players.map(p => p.star_rating).filter(Boolean)))
    .sort((a, b) => b - a); // Sort in descending order

  const filteredPlayers = players
    .filter(player => {
      const matchesSearch = player.player_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (player.display_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
                           (player.team?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
      const matchesStar = starFilter === 'all' || (player.star_rating === parseInt(starFilter));
      const matchesTeam = teamFilter === 'all' || player.team === teamFilter;
      return matchesSearch && matchesStar && matchesTeam;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.player_name.localeCompare(b.player_name);
        case 'points':
          return (b.points || 0) - (a.points || 0);
        case 'rating':
          return (b.star_rating || 0) - (a.star_rating || 0);
        case 'matches':
          return (b.matches_played || 0) - (a.matches_played || 0);
        case 'goals':
          return (b.goals_scored || 0) - (a.goals_scored || 0);
        default:
          return (b.points || 0) - (a.points || 0);
      }
    });


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

            {/* Star Rating Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Star Rating</label>
              <select
                value={starFilter}
                onChange={(e) => setStarFilter(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Stars</option>
                {uniqueStarRatings.map(rating => (
                  <option key={rating} value={rating}>{rating} ⭐</option>
                ))}
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
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="name">Name (A-Z)</option>
                <option value="points">Points</option>
                <option value="goals">Goals</option>
                <option value="matches">Matches Played</option>
                <option value="rating">Star Rating</option>
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
                {searchTerm || starFilter !== 'all' || teamFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'No players available'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPlayers.map((player) => (
                <Link
                  key={player.player_id}
                  href={`/dashboard/players/${player.player_id}`}
                  className="glass rounded-3xl p-5 shadow-lg backdrop-blur-md border border-white/30 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 flex items-center gap-4"
                >
                  {/* Circular Photo with gradient border */}
                  <div className="relative flex-shrink-0">
                    <div className="absolute -inset-0.5 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full opacity-75"></div>
                    <div className="relative w-20 h-20 rounded-full overflow-hidden shadow-lg bg-white p-0.5">
                      {player.photo_url ? (
                        <OptimizedImage
                          src={player.photo_url}
                          alt={player.player_name}
                          width={80}
                          height={80}
                          quality={85}
                          className="w-full h-full object-cover rounded-full"
                          fallback={
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-purple-100 rounded-full">
                              <span className="text-2xl font-bold text-blue-600">{player.player_name[0]}</span>
                            </div>
                          }
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-purple-100 rounded-full">
                          <span className="text-2xl font-bold text-blue-600">{player.player_name[0]}</span>
                        </div>
                      )}
                    </div>
                    {/* Category Badge */}
                    {player.category && (
                      <div className={`absolute -bottom-1 left-1/2 transform -translate-x-1/2 px-2 py-0.5 rounded-full text-xs font-bold shadow-md ${
                        player.category.toLowerCase() === 'legend'
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
                      {player.display_name || player.player_name}
                    </h3>
                    <p className="text-sm text-gray-600 truncate mb-3">{player.team}</p>
                    {/* Stats Pills */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-blue-50 to-blue-100 rounded-full border border-blue-200">
                        <span className="text-xs font-bold text-[#0066FF]">{player.points || 0}</span>
                        <span className="text-xs text-gray-600">pts</span>
                      </div>
                      <div className="flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-green-50 to-green-100 rounded-full border border-green-200">
                        <span className="text-xs">⚽</span>
                        <span className="text-xs font-semibold text-green-700">{player.goals_scored || 0}</span>
                      </div>
                      <div className="flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-purple-50 to-purple-100 rounded-full border border-purple-200">
                        <span className="text-xs font-semibold text-purple-700">{player.matches_played || 0}</span>
                        <span className="text-xs text-gray-600">games</span>
                      </div>
                      <div className="flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-full border border-yellow-200">
                        <span className="text-xs font-semibold text-yellow-700">{player.star_rating || 3}</span>
                        <span className="text-xs">⭐</span>
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
                {searchTerm || starFilter !== 'all' || teamFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'No players available'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredPlayers.map((player) => (
                <Link
                  key={player.player_id}
                  href={`/dashboard/players/${player.player_id}`}
                  className="flex items-center gap-6 p-4 hover:bg-white/50 transition-all duration-200"
                >
                  {/* Circular Photo */}
                  <div className="w-20 h-20 flex-shrink-0 rounded-full overflow-hidden shadow-md border-2 border-white/50">
                    {player.photo_url ? (
                      <OptimizedImage
                        src={player.photo_url}
                        alt={player.player_name}
                        width={80}
                        height={80}
                        quality={85}
                        className="w-full h-full object-cover"
                        fallback={
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-purple-100">
                            <span className="text-2xl font-bold text-blue-600">{player.player_name[0]}</span>
                          </div>
                        }
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-purple-100">
                        <span className="text-2xl font-bold text-blue-600">{player.player_name[0]}</span>
                      </div>
                    )}
                  </div>

                  {/* Player Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-bold text-gray-900 text-lg">
                        {player.display_name || player.player_name}
                      </h3>
                      {player.category && (
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                          player.category.toLowerCase() === 'legend'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {player.category}
                        </span>
                      )}
                      <span className="px-3 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                        {player.star_rating || 3} ⭐
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{player.team}</p>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4">
                    <div className="text-center px-4 py-2 rounded-lg bg-blue-50 border border-blue-200">
                      <div className="text-xl font-bold text-[#0066FF]">{player.points || 0}</div>
                      <div className="text-xs text-gray-600">Points</div>
                    </div>
                    <div className="text-center px-4 py-2 rounded-lg bg-green-50 border border-green-200">
                      <div className="text-xl font-bold text-green-600">{player.goals_scored || 0}</div>
                      <div className="text-xs text-gray-600">Goals</div>
                    </div>
                    <div className="text-center px-4 py-2 rounded-lg bg-gray-50 border border-gray-200">
                      <div className="text-xl font-bold text-gray-900">{player.matches_played || 0}</div>
                      <div className="text-xs text-gray-600">Matches</div>
                    </div>
                    <div className="text-center px-4 py-2 rounded-lg bg-blue-50 border border-blue-200">
                      <div className="text-xl font-bold text-blue-600">{player.clean_sheets || 0}</div>
                      <div className="text-xs text-gray-600">CS</div>
                    </div>
                    <div className="text-center px-4 py-2 rounded-lg bg-purple-50 border border-purple-200">
                      <div className="text-xl font-bold text-purple-600">{player.assists || 0}</div>
                      <div className="text-xs text-gray-600">Assists</div>
                    </div>
                    <div className="text-center px-4 py-2 rounded-lg bg-yellow-50 border border-yellow-200">
                      <div className="text-xl font-bold text-yellow-600">{player.motm_awards || 0}</div>
                      <div className="text-xs text-gray-600">MOTM</div>
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
