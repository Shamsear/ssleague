'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import OptimizedImage from '@/components/OptimizedImage';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';
import { usePermissions } from '@/hooks/usePermissions';
import { useCachedSeasons } from '@/hooks/useCachedFirebase';

// Position constants
const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'DST'];
const POSITION_GROUPS = ['Offense', 'Defense', 'Special Teams'];

interface AuctionPlayer {
  id: number;
  name: string;
  position: string;
  position_group?: string;
  nfl_team: string;
  overall_rating: number;
  acquisition_value?: number;
  player_id?: string;
}

interface TournamentPlayer {
  id: string;
  player_id: string;
  name: string;
  team_id?: string;
  team_name?: string;
  category?: string;
  star_rating: number;
  points: number;
  auction_value: number;
  salary_per_match: number;
  status: string;
  season_id: string;
  updated_at: string;
  photo_url?: string;
}

type TabType = 'auction' | 'tournament';

export default function TeamPlayersPage() {
  const { user, loading } = useAuth();
  const { userSeasonId } = usePermissions();
  const router = useRouter();
  
  // Fetch current active season from Firebase (same as team dashboard)
  const { data: activeSeasons, isLoading: activeSeasonsLoading } = useCachedSeasons(
    user?.role === 'team' ? { isActive: 'true' } : undefined
  );
  
  // Get active season ID
  const activeSeasonId = activeSeasons && Array.isArray(activeSeasons) && activeSeasons.length > 0 
    ? activeSeasons[0].id 
    : null;
  
  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('tournament');
  
  // Player data state
  const [auctionPlayers, setAuctionPlayers] = useState<AuctionPlayer[]>([]);
  const [tournamentPlayers, setTournamentPlayers] = useState<TournamentPlayer[]>([]);
  const [isLoadingAuction, setIsLoadingAuction] = useState(true);
  const [isLoadingTournament, setIsLoadingTournament] = useState(true);
  
  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  // Auction player filters
  const [positionFilter, setPositionFilter] = useState('all');
  const [positionGroupFilter, setPositionGroupFilter] = useState('all');
  // Tournament player filters
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [starRatingFilter, setStarRatingFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'team') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const fetchAuctionPlayers = async () => {
      if (!user) {
        console.log('No user, skipping auction players fetch');
        return;
      }

      console.log('Fetching auction players...');
      setIsLoadingAuction(true);

      try {
        const response = await fetchWithTokenRefresh('/api/team/players', {
          headers: { 'Cache-Control': 'no-cache' },
        });
        
        if (!response.ok) {
          console.error('Failed to fetch auction players:', response.status, response.statusText);
          setIsLoadingAuction(false);
          return;
        }
        
        const { success, data, error } = await response.json();

        if (success) {
          console.log('Auction players fetched successfully:', data.players?.length || 0, 'players');
          setAuctionPlayers(data.players || []);
        } else {
          console.error('API returned error:', error);
        }
      } catch (err) {
        console.error('Error fetching auction players:', err);
      } finally {
        console.log('Auction players loading finished');
        setIsLoadingAuction(false);
      }
    };

    fetchAuctionPlayers();
  }, [user]);

  useEffect(() => {
    const fetchTournamentPlayers = async () => {
      // Use userSeasonId first, then activeSeasonId as fallback
      const effectiveSeasonId = userSeasonId || activeSeasonId;
      
      if (!user) {
        console.log('No user, skipping tournament players fetch');
        return;
      }

      if (activeSeasonsLoading) {
        console.log('Still loading active seasons, waiting...');
        return;
      }

      if (!effectiveSeasonId) {
        console.log('No season ID available', { userSeasonId, activeSeasonId });
        setIsLoadingTournament(false);
        return;
      }

      console.log('Fetching tournament players for season:', effectiveSeasonId);
      setIsLoadingTournament(true);

      try {
        const response = await fetchWithTokenRefresh(`/api/team/tournament-players?seasonId=${effectiveSeasonId}`, {
          headers: { 'Cache-Control': 'no-cache' },
        });
        
        if (!response.ok) {
          console.error('Failed to fetch tournament players:', response.status, response.statusText);
          setIsLoadingTournament(false);
          return;
        }
        
        const { success, data, error } = await response.json();

        if (success) {
          console.log('Tournament players fetched successfully:', data.players?.length || 0, 'players');
          setTournamentPlayers(data.players || []);
        } else {
          console.error('Tournament players API returned error:', error);
        }
      } catch (err) {
        console.error('Error fetching tournament players:', err);
      } finally {
        console.log('Tournament players loading finished');
        setIsLoadingTournament(false);
      }
    };

    fetchTournamentPlayers();
  }, [user, userSeasonId, activeSeasonId, activeSeasonsLoading]);

  // Get current data based on active tab
  const currentPlayers = activeTab === 'auction' ? auctionPlayers : tournamentPlayers;
  const isCurrentLoading = activeTab === 'auction' ? isLoadingAuction : isLoadingTournament;

  // Filter players based on current tab
  const filteredPlayers = currentPlayers.filter(player => {
    const matchesSearch = player.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeTab === 'auction') {
      const auctionPlayer = player as AuctionPlayer;
      const positionMatch = auctionPlayer.position?.toLowerCase().includes(searchTerm.toLowerCase());
      const searchMatch = matchesSearch || positionMatch;
      const matchesPosition = positionFilter === 'all' || auctionPlayer.position === positionFilter;
      const matchesGroup = positionGroupFilter === 'all' || auctionPlayer.position_group === positionGroupFilter;
      return searchMatch && matchesPosition && matchesGroup;
    } else {
      const tournamentPlayer = player as TournamentPlayer;
      const categoryMatch = tournamentPlayer.category?.toLowerCase().includes(searchTerm.toLowerCase());
      const searchMatch = matchesSearch || categoryMatch;
      
      // Tournament player filters
      const matchesCategory = categoryFilter === 'all' || tournamentPlayer.category === categoryFilter;
      const matchesStarRating = starRatingFilter === 'all' || tournamentPlayer.star_rating === parseInt(starRatingFilter);
      const matchesStatus = statusFilter === 'all' || tournamentPlayer.status === statusFilter;
      
      return searchMatch && matchesCategory && matchesStarRating && matchesStatus;
    }
  });

  // Get unique values for filters
  // Tournament filters
  const categories = Array.from(new Set(tournamentPlayers.filter(p => p.category).map(p => p.category!))).sort();
  const statuses = Array.from(new Set(tournamentPlayers.filter(p => p.status).map(p => p.status!))).sort();
  const starRatings = Array.from(new Set(tournamentPlayers.map(p => p.star_rating))).sort((a, b) => b - a);
  
  // Auction filters - get positions from actual auction players data (football positions)
  const positions = Array.from(new Set(auctionPlayers.filter(p => p.position).map(p => p.position!))).sort();
  const positionGroups = Array.from(new Set(auctionPlayers.filter(p => p.position_group).map(p => p.position_group!))).sort();

  const getPositionColor = (position: string) => {
    switch (position) {
      case 'QB': return 'bg-red-100 text-red-800';
      case 'RB': return 'bg-blue-100 text-blue-800';
      case 'WR': return 'bg-green-100 text-green-800';
      case 'TE': return 'bg-purple-100 text-purple-800';
      case 'K': return 'bg-yellow-100 text-yellow-800';
      case 'DST': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 85) return 'bg-green-100 text-green-800 border-green-200';
    if (rating >= 75) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (rating >= 65) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getStarRatingColor = (rating: number) => {
    if (rating >= 9) return 'bg-purple-100 text-purple-800 border-purple-200';
    if (rating >= 7) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (rating >= 5) return 'bg-green-100 text-green-800 border-green-200';
    return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  };

  const getCategoryColor = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'legend': return 'bg-yellow-100 text-yellow-800';
      case 'classic': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show loading only for the current tab
  if (isCurrentLoading) {
    return (
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
        <div className="glass rounded-3xl p-6 shadow-lg">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading {activeTab} players...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'team') {
    return null;
  }

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
      {/* Mobile Header Section */}
      <div className="block sm:hidden glass rounded-3xl p-4 shadow-lg mb-4">
        <div className="text-center mb-4">
          <h2 className="text-xl font-bold text-dark mb-1">Players Database</h2>
          <p className="text-sm text-gray-500">{filteredPlayers.length} of {currentPlayers.length} players</p>
        </div>

        {/* Mobile Tabs */}
        <div className="flex mb-4 bg-white/50 rounded-xl p-1">
          <button
            onClick={() => setActiveTab('tournament')}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'tournament'
                ? 'bg-[#0066FF] text-white shadow-sm'
                : 'text-gray-600 hover:text-[#0066FF]'
            }`}
          >
            Tournament ({tournamentPlayers.length})
          </button>
          <button
            onClick={() => setActiveTab('auction')}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'auction'
                ? 'bg-[#0066FF] text-white shadow-sm'
                : 'text-gray-600 hover:text-[#0066FF]'
            }`}
          >
            Auction ({auctionPlayers.length})
          </button>
        </div>
        
        {/* Mobile Search Bar */}
        <div className="relative mb-3">
          <input 
            type="text" 
            placeholder="Search players..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 py-3 pr-4 bg-white/70 backdrop-blur-sm border border-white/30 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all duration-200 shadow-sm text-base"
          />
          <svg className="w-5 h-5 text-gray-500 absolute left-3 top-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        
        {/* Mobile Filters */}
        <div className="flex gap-2">
          {activeTab === 'auction' ? (
            <div className="relative flex-1">
              <select 
                value={positionFilter}
                onChange={(e) => setPositionFilter(e.target.value)}
                className="w-full pl-8 py-2.5 pr-4 bg-white/70 backdrop-blur-sm border border-white/30 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all duration-200 shadow-sm text-sm"
              >
                <option value="all">All Positions</option>
                {positions.map(position => (
                  <option key={position} value={position}>{position}</option>
                ))}
              </select>
              <svg className="w-4 h-4 text-gray-500 absolute left-2.5 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          ) : (
            <div className="relative flex-1">
              <select 
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full pl-8 py-2.5 pr-4 bg-white/70 backdrop-blur-sm border border-white/30 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all duration-200 shadow-sm text-sm"
              >
                <option value="all">All Categories</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              <svg className="w-4 h-4 text-gray-500 absolute left-2.5 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          )}
          
          <Link href="/dashboard/team" className="px-4 py-2.5 rounded-xl bg-white/60 text-[#0066FF] hover:bg-white/80 transition-all duration-300 text-sm font-medium flex items-center shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
        </div>
      </div>
      
      {/* Desktop Header Section */}
      <div className="hidden sm:block glass rounded-3xl p-4 sm:p-6 shadow-lg mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="mb-2 sm:mb-0">
            <h2 className="text-2xl font-bold text-dark mb-1">Players Database</h2>
            <p className="text-sm text-gray-500">View players from both auction and tournament systems</p>
          </div>
          
          {/* Desktop Tabs */}
          <div className="flex bg-white/50 rounded-xl p-1 mb-4 sm:mb-0">
            <button
              onClick={() => setActiveTab('tournament')}
              className={`py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'tournament'
                  ? 'bg-[#0066FF] text-white shadow-sm'
                  : 'text-gray-600 hover:text-[#0066FF]'
              }`}
            >
              Tournament Players ({tournamentPlayers.length})
            </button>
            <button
              onClick={() => setActiveTab('auction')}
              className={`py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'auction'
                  ? 'bg-[#0066FF] text-white shadow-sm'
                  : 'text-gray-600 hover:text-[#0066FF]'
              }`}
            >
              Auction Players ({auctionPlayers.length})
            </button>
        </div>
        
        {/* Filter Controls */}
        <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-3 sm:items-center">
          {activeTab === 'auction' ? (
            <div className="flex flex-col sm:flex-row gap-2">
              {/* Position Filter */}
              <div className="relative">
                <select 
                  value={positionFilter}
                  onChange={(e) => setPositionFilter(e.target.value)}
                  className="pl-10 py-2.5 pr-4 bg-white/70 backdrop-blur-sm border border-white/30 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all duration-200 shadow-sm w-full"
                >
                  <option value="all">All Positions</option>
                  {POSITIONS.map(position => (
                    <option key={position} value={position}>{position}</option>
                  ))}
                </select>
                <svg className="w-5 h-5 text-gray-500 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              
              {/* Position Group Filter */}
              <div className="relative">
                <select 
                  value={positionGroupFilter}
                  onChange={(e) => setPositionGroupFilter(e.target.value)}
                  className="pl-10 py-2.5 pr-4 bg-white/70 backdrop-blur-sm border border-white/30 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all duration-200 shadow-sm w-full"
                >
                  <option value="all">All Position Groups</option>
                  {positionGroups.map(group => (
                    <option key={group} value={group}>{group}</option>
                  ))}
                </select>
                <svg className="w-5 h-5 text-gray-500 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2">
              {/* Category Filter */}
              <div className="relative">
                <select 
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="pl-10 py-2.5 pr-4 bg-white/70 backdrop-blur-sm border border-white/30 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all duration-200 shadow-sm w-full"
                >
                  <option value="all">All Categories</option>
                  {categories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
                <svg className="w-5 h-5 text-gray-500 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              
              {/* Star Rating Filter */}
              <div className="relative">
                <select 
                  value={starRatingFilter}
                  onChange={(e) => setStarRatingFilter(e.target.value)}
                  className="pl-10 py-2.5 pr-4 bg-white/70 backdrop-blur-sm border border-white/30 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all duration-200 shadow-sm w-full"
                >
                  <option value="all">All Star Ratings</option>
                  {starRatings.map(rating => (
                    <option key={rating} value={rating}>{rating} ⭐</option>
                  ))}
                </select>
                <svg className="w-5 h-5 text-gray-500 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </div>

              {/* Status Filter */}
              <div className="relative">
                <select 
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="pl-10 py-2.5 pr-4 bg-white/70 backdrop-blur-sm border border-white/30 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all duration-200 shadow-sm w-full"
                >
                  <option value="all">All Status</option>
                  {statuses.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
                <svg className="w-5 h-5 text-gray-500 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          )}
            
            {/* Search Bar */}
            <div className="relative w-full sm:w-64">
              <input 
                type="text" 
                placeholder="Search players..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 py-2.5 pr-4 bg-white/70 backdrop-blur-sm border border-white/30 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all duration-200 shadow-sm"
              />
              <svg className="w-5 h-5 text-gray-500 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            <Link href="/dashboard/team" className="px-4 py-2.5 rounded-xl bg-white/60 text-[#0066FF] hover:bg-white/80 transition-all duration-300 text-sm font-medium flex items-center shadow-sm">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Dashboard
            </Link>
          </div>
        </div>
      </div>
      
      {/* Mobile Card View */}
      <div className="block md:hidden space-y-4 glass rounded-3xl p-4 sm:p-6 shadow-lg">
        {filteredPlayers.length > 0 ? (
          filteredPlayers.map(player => (
            <div 
              key={player.id}
              className="glass-card p-4 rounded-2xl hover:shadow-lg transition-all duration-300 backdrop-blur-sm bg-white/50 border border-white/30"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="h-14 w-14 rounded-full overflow-hidden flex items-center justify-center shadow-md border border-white/40 bg-[#0066FF]/10">
                    {player.photo_url ? (
                      <OptimizedImage
                        src={player.photo_url}
                        alt={player.name}
                        width={56}
                        height={56}
                        quality={85}
                        className="w-14 h-14 rounded-full object-cover"
                        fallback={
                          <div className="w-14 h-14 flex items-center justify-center bg-gradient-to-br from-blue-400 to-blue-600 rounded-full">
                            <span className="text-xl font-bold text-white">{player.name[0]}</span>
                          </div>
                        }
                      />
                    ) : (
                      <div className="w-14 h-14 flex items-center justify-center bg-gradient-to-br from-blue-400 to-blue-600 rounded-full">
                        <span className="text-xl font-bold text-white">{player.name[0]}</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 text-base">{player.name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      {activeTab === 'auction' ? (
                        <>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPositionColor((player as AuctionPlayer).position)}`}>
                            {(player as AuctionPlayer).position}
                          </span>
                          {(player as AuctionPlayer).position_group && (
                            <span className="text-xs px-2 py-0.5 bg-[#0066FF]/10 text-[#0066FF] rounded-lg">{(player as AuctionPlayer).position_group}</span>
                          )}
                        </>
                      ) : (
                        <>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryColor((player as TournamentPlayer).category || '')}`}>
                            {(player as TournamentPlayer).category || 'N/A'}
                          </span>
                          <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-lg">
                            {(player as TournamentPlayer).star_rating}⭐
                          </span>
                          <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded-lg">
                            {(player as TournamentPlayer).points} pts
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                {activeTab === 'auction' ? (
                  <span className={`flex items-center justify-center h-10 w-10 rounded-full shadow-sm border ${getRatingColor((player as AuctionPlayer).overall_rating)}`}>
                    <span className="font-bold text-sm">{(player as AuctionPlayer).overall_rating}</span>
                  </span>
                ) : (
                  <div className="text-right">
                    <div className="text-xs text-gray-500">Status</div>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      (player as TournamentPlayer).status === 'assigned' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {(player as TournamentPlayer).status}
                    </span>
                  </div>
                )}
              </div>
              
              <div className="mt-4 pt-3 border-t border-gray-200/50 flex justify-between items-center">
                <div className="text-sm text-gray-700">
                  {activeTab === 'auction' ? (
                    <>
                      <span className="font-medium text-xs text-gray-500">Acquisition Value</span><br />
                      <span className={`text-base font-semibold ${(player as AuctionPlayer).acquisition_value ? 'text-[#0066FF]' : 'text-gray-500'}`}>
                        {(player as AuctionPlayer).acquisition_value ? `£${(player as AuctionPlayer).acquisition_value!.toLocaleString()}` : 'Free Transfer'}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="font-medium text-xs text-gray-500">Auction Value</span><br />
                      <span className="text-base font-semibold text-[#0066FF]">
                        ₹{((player as TournamentPlayer).auction_value || 0).toLocaleString()}
                      </span>
                      <div className="mt-1">
                        <span className="font-medium text-xs text-gray-500">Salary per Match</span><br />
                        <span className="text-sm font-semibold text-green-600">
                          ₹{(Number((player as TournamentPlayer).salary_per_match) || 0).toFixed(2)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
                <Link href={`/dashboard/players/${player.player_id || player.id}`} className="px-4 py-2 rounded-xl bg-[#0066FF] text-white hover:bg-[#0052CC] transition-colors duration-200 flex items-center text-sm shadow-sm">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Details
                </Link>
              </div>
            </div>
          ))
        ) : (
          <div className="glass-card p-8 rounded-2xl text-center backdrop-blur-sm bg-white/40 border border-white/20 shadow-lg">
            <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="text-gray-700 text-lg font-medium mb-2">
              {currentPlayers.length === 0 ? 'No players acquired yet' : 'No matches found'}
            </p>
            <p className="text-gray-500 text-sm mb-4">
              {currentPlayers.length === 0 ? 'Join an active round to bid on players' : 'Try adjusting your filters'}
            </p>
            {currentPlayers.length === 0 && (
              <Link href="/dashboard/team" className="inline-flex items-center px-4 py-2 rounded-xl bg-[#0066FF] text-white shadow-md hover:bg-[#0052CC] transition-all duration-300">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Browse Players
              </Link>
            )}
          </div>
        )}
      </div>
      
      {/* Desktop Table View */}
      <div className="hidden md:block glass rounded-3xl p-4 sm:p-6 shadow-lg overflow-hidden">
        <div className="overflow-x-auto rounded-xl">
          <table className="min-w-full divide-y divide-gray-200 bg-white/40 backdrop-blur-sm">
            <thead className="bg-gray-50/80">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                {activeTab === 'auction' ? (
                  <>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Group</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rating</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acquisition Value</th>
                  </>
                ) : (
                  <>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Star Rating</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Points</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Auction Value</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Salary/Match</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </>
                )}
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white/30">
              {filteredPlayers.length > 0 ? (
                filteredPlayers.map(player => (
                  <tr key={player.id} className="hover:bg-white/70 transition-all duration-200">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-12 w-12 rounded-full overflow-hidden flex items-center justify-center border border-white/40 shadow-sm bg-[#0066FF]/10">
                          {player.photo_url ? (
                            <OptimizedImage
                              src={player.photo_url}
                              alt={player.name}
                              width={48}
                              height={48}
                              quality={85}
                              className="w-12 h-12 rounded-full object-cover"
                              fallback={
                                <div className="w-12 h-12 flex items-center justify-center bg-gradient-to-br from-blue-400 to-blue-600 rounded-full">
                                  <span className="text-lg font-bold text-white">{player.name[0]}</span>
                                </div>
                              }
                            />
                          ) : (
                            <div className="w-12 h-12 flex items-center justify-center bg-gradient-to-br from-blue-400 to-blue-600 rounded-full">
                              <span className="text-lg font-bold text-white">{player.name[0]}</span>
                            </div>
                          )}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-800">{player.name}</div>
                          <div className="text-xs text-gray-500">ID: {player.player_id || player.id}</div>
                        </div>
                      </div>
                    </td>
                    {activeTab === 'auction' ? (
                      <>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${getPositionColor((player as AuctionPlayer).position)}`}>
                            {(player as AuctionPlayer).position}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {(player as AuctionPlayer).position_group ? (
                            <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-[#0066FF]/10 text-[#0066FF]">
                              {(player as AuctionPlayer).position_group}
                            </span>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`flex items-center justify-center h-8 w-8 rounded-full text-xs font-medium border ${getRatingColor((player as AuctionPlayer).overall_rating)}`}>
                            {(player as AuctionPlayer).overall_rating}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={(player as AuctionPlayer).acquisition_value ? 'text-[#0066FF] font-medium' : 'text-gray-500'}>
                            {(player as AuctionPlayer).acquisition_value ? `£${(player as AuctionPlayer).acquisition_value!.toLocaleString()}` : 'Free Transfer'}
                          </span>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${getCategoryColor((player as TournamentPlayer).category || '')}`}>
                            {(player as TournamentPlayer).category || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <span className={`flex items-center justify-center h-8 w-8 rounded-full text-xs font-medium border ${getStarRatingColor((player as TournamentPlayer).star_rating)}`}>
                              {(player as TournamentPlayer).star_rating}
                            </span>
                            <span className="ml-1 text-yellow-500">⭐</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-gray-800">{(player as TournamentPlayer).points}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-[#0066FF] font-medium">
                            ₹{((player as TournamentPlayer).auction_value || 0).toLocaleString()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-green-600 font-medium">
                            ₹{(Number((player as TournamentPlayer).salary_per_match) || 0).toFixed(2)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                            (player as TournamentPlayer).status === 'assigned' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {(player as TournamentPlayer).status}
                          </span>
                        </td>
                      </>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Link href={`/dashboard/players/${player.player_id || player.id}`} className="inline-flex items-center px-3 py-1.5 rounded-lg bg-[#0066FF] text-white hover:bg-[#0052CC] transition-all duration-200 shadow-sm">
                        <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-10 whitespace-nowrap text-sm text-gray-500 text-center">
                    <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <p className="text-gray-700 text-lg font-medium mb-2">
                      {currentPlayers.length === 0 ? 'No players acquired yet' : 'No matches found'}
                    </p>
                    <p className="text-gray-500 text-sm mb-4">
                      {currentPlayers.length === 0 ? 'Join an active round to bid on players' : 'Try adjusting your filters'}
                    </p>
                    {currentPlayers.length === 0 && (
                      <Link href="/dashboard/team" className="inline-flex items-center px-4 py-2 rounded-xl bg-[#0066FF] text-white shadow-md hover:bg-[#0052CC] transition-all duration-300">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        Browse Players
                      </Link>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
