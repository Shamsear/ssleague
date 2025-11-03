'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useModal } from '@/hooks/useModal';
import AlertModal from '@/components/modals/AlertModal';
import ConfirmModal from '@/components/modals/ConfirmModal';
import { useAuctionWebSocket } from '@/hooks/useWebSocket';
import { fetchWithTokenRetry } from '@/lib/fetch-with-retry';

interface Player {
  id: string;
  name: string;
  position: string;
  team_name: string;
  overall_rating: number;
  playing_style?: string;
  is_starred?: boolean;
}

interface BulkRound {
  id: number;
  round_number: number;
  status: string;
  base_price: number;
  start_time?: string;
  end_time?: string;
  duration_seconds: number;
  player_count: number;
}

export default function TeamBulkRoundPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const roundId = params?.id as string;

  const [bulkRound, setBulkRound] = useState<BulkRound | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [biddedPlayers, setBiddedPlayers] = useState<Set<string>>(new Set());

  // Modal system
  const {
    alertState,
    showAlert,
    closeAlert,
    confirmState,
    showConfirm,
    closeConfirm,
    handleConfirm,
  } = useModal();
  const [isLoading, setIsLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [teamBalance, setTeamBalance] = useState(1000);
  const [filterPosition, setFilterPosition] = useState<string>('all');
  const [squadInfo, setSquadInfo] = useState({ current: 0, max: 25, available: 25 });
  const [bidsCount, setBidsCount] = useState(0);

  // ✅ Enable WebSocket for real-time bid updates and round updates
  const { isConnected, lastMessage } = useAuctionWebSocket(roundId, true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'team') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  // Fetch round and players
  useEffect(() => {
    const fetchData = async () => {
      // Wait for auth to be ready and user to be loaded
      if (!roundId || loading || !user) {
        console.log('⏳ Waiting for auth...', { roundId: !!roundId, loading, user: !!user });
        return;
      }

      setIsLoading(true);
      try {
        console.log(`🚀 Fetching bulk round ${roundId}...`);
        
        // Fetch round details and players
        const response = await fetchWithTokenRetry(`/api/team/bulk-rounds/${roundId}`);
        const { success, data, error } = await response.json();

        if (!success) {
          throw new Error(error || 'Failed to fetch round data');
        }

        console.log('✅ Round data fetched successfully');
        setBulkRound(data.round);
        setPlayers(data.players || []);
        setTeamBalance(data.balance || 1000);
        if (data.squad) {
          setSquadInfo(data.squad);
        }

        // Fetch team's existing bids
        const bidsResponse = await fetchWithTokenRetry(`/api/team/bulk-rounds/${roundId}/bids`);
        const bidsData = await bidsResponse.json();
        
        if (bidsData.success && bidsData.data.bids) {
          const bidPlayerIds = new Set(bidsData.data.bids.map((b: any) => b.player_id));
          setBiddedPlayers(bidPlayerIds);
          setBidsCount(bidsData.data.count || 0);
        }
      } catch (err: any) {
        console.error('Error fetching data:', err);
        showAlert({
          type: 'error',
          title: 'Error',
          message: err.message || 'Failed to load round data'
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [roundId, loading, user]);

  // Listen for WebSocket updates (round metadata changes)
  useEffect(() => {
    if (!lastMessage) return;

    try {
      const message = JSON.parse(lastMessage);
      console.log('📨 WebSocket message received:', message);

      // Handle round update (timer extension, etc.)
      if (message.type === 'round_updated' && message.data) {
        console.log('🔄 Round metadata updated via WebSocket');
        setBulkRound(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            end_time: message.data.end_time || prev.end_time,
            duration_seconds: message.data.duration_seconds || prev.duration_seconds,
            status: message.data.status || prev.status,
          };
        });
      }

      // Handle bid updates
      if (message.type === 'bid_added' || message.type === 'bid_removed') {
        console.log('💰 Bid update via WebSocket:', message.type);
        // Refetch bids to stay in sync
        fetchWithTokenRetry(`/api/team/bulk-rounds/${roundId}/bids`)
          .then(res => res.json())
          .then(data => {
            if (data.success && data.data.bids) {
              const bidPlayerIds = new Set(data.data.bids.map((b: any) => b.player_id));
              setBiddedPlayers(bidPlayerIds);
              setBidsCount(data.data.count || 0);
            }
          })
          .catch(err => console.error('Error refetching bids:', err));
      }
    } catch (err) {
      console.error('Error parsing WebSocket message:', err);
    }
  }, [lastMessage, roundId]);

  // Timer countdown
  useEffect(() => {
    if (bulkRound?.status === 'active' && bulkRound.end_time) {
      const timer = setInterval(() => {
        const now = new Date().getTime();
        const end = new Date(bulkRound.end_time!).getTime();
        const remaining = Math.max(0, Math.floor((end - now) / 1000));
        setTimeRemaining(remaining);
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [bulkRound]);

  const handleTogglePlayer = async (playerId: string) => {
    const isBidded = biddedPlayers.has(playerId);
    
    try {
      if (isBidded) {
        // ✨ OPTIMISTIC UPDATE: Remove immediately for instant feedback
        const newBidded = new Set(biddedPlayers);
        newBidded.delete(playerId);
        setBiddedPlayers(newBidded);
        setBidsCount(prev => prev - 1);
        
        // Then send to server
        const response = await fetchWithTokenRetry(`/api/team/bulk-rounds/${roundId}/bids`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ player_id: playerId }),
        });
        
        const result = await response.json();
        
        if (!result.success) {
          // Revert optimistic update on error
          const revertBidded = new Set(biddedPlayers);
          revertBidded.add(playerId);
          setBiddedPlayers(revertBidded);
          setBidsCount(prev => prev + 1);
          throw new Error(result.error || 'Failed to remove bid');
        }
        // Success - no alert needed, optimistic update already applied
      } else {
        // Check if slots available
        const availableSlots = squadInfo.max - squadInfo.current - bidsCount;
        if (availableSlots <= 0) {
          showAlert({
            type: 'error',
            title: 'No Slots Available',
            message: `No squad slots available. Current: ${squadInfo.current}/${squadInfo.max}, Bids: ${bidsCount}`
          });
          return;
        }
        
        // Check balance
        const totalReserved = (bidsCount + 1) * (bulkRound?.base_price || 10);
        if (teamBalance < totalReserved) {
          showAlert({
            type: 'error',
            title: 'Insufficient Balance',
            message: `Insufficient balance! Required: £${totalReserved}, Available: £${teamBalance}`
          });
          return;
        }
        
        // ✨ OPTIMISTIC UPDATE: Add immediately for instant feedback
        const newBidded = new Set(biddedPlayers);
        newBidded.add(playerId);
        setBiddedPlayers(newBidded);
        setBidsCount(prev => prev + 1);
        
        // Then send to server
        const response = await fetchWithTokenRetry(`/api/team/bulk-rounds/${roundId}/bids`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ player_id: playerId }),
        });
        
        const result = await response.json();
        
        if (!result.success) {
          // Revert optimistic update on error
          const revertBidded = new Set(biddedPlayers);
          revertBidded.delete(playerId);
          setBiddedPlayers(revertBidded);
          setBidsCount(prev => prev - 1);
          throw new Error(result.error || 'Failed to place bid');
        }
        // Success - no alert needed, optimistic update already applied
      }
    } catch (err: any) {
      console.error('Error toggling bid:', err);
      showAlert({
        type: 'error',
        title: 'Error',
        message: err.message || 'Failed to process bid'
      });
    }
  };


  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimerColor = () => {
    if (timeRemaining === 0) return 'text-red-600';
    if (timeRemaining < 300) return 'text-red-600 animate-pulse';
    if (timeRemaining < 600) return 'text-orange-500';
    return 'text-green-600';
  };

  const filteredPlayers = players.filter(player => {
    const matchesSearch = player.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPosition = filterPosition === 'all' || player.position === filterPosition;
    return matchesSearch && matchesPosition;
  });

  const sortedPlayers = [...filteredPlayers].sort((a, b) => {
    if (a.is_starred && !b.is_starred) return -1;
    if (!a.is_starred && b.is_starred) return 1;
    return b.overall_rating - a.overall_rating;
  });

  const totalCost = bidsCount * (bulkRound?.base_price || 10);
  const remainingBalance = teamBalance - totalCost;
  const availableSlotsNow = squadInfo.max - squadInfo.current - bidsCount;

  if (loading || !user || user.role !== 'team' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading bulk round...</p>
        </div>
      </div>
    );
  }

  if (!bulkRound) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Bulk round not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-4 sm:py-6 md:py-8 px-3 sm:px-4 bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-4 sm:mb-6 md:mb-8">
          <div className="flex items-start sm:items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <Link
              href="/dashboard/team"
              className="text-gray-500 hover:text-[#0066FF] transition-colors p-1 hover:bg-gray-100 rounded-lg mt-1 sm:mt-0"
              aria-label="Back to dashboard"
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold gradient-text truncate">
                  Bulk Round {bulkRound.round_number}
                </h1>
                {/* WebSocket Status */}
                <span className={`inline-flex items-center px-2 sm:px-2.5 py-1 rounded-full text-xs font-medium w-fit ${
                  isConnected 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full mr-1 sm:mr-1.5 ${
                    isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                  }`}></span>
                  {isConnected ? 'Live' : 'Offline'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-gray-600 mt-1 sm:mt-2">
                Click players to bid £{bulkRound.base_price} each
              </p>
            </div>
          </div>
        </div>

        {/* Timer and Info Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6">
          <div className="glass rounded-lg sm:rounded-xl p-3 sm:p-4 border border-white/20 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-xs sm:text-sm text-gray-600 mb-1">Time Left</div>
            <div className={`text-lg sm:text-xl md:text-2xl font-bold font-mono ${getTimerColor()}`}>
              {formatTime(timeRemaining)}
            </div>
          </div>

          <div className="glass rounded-lg sm:rounded-xl p-3 sm:p-4 border border-white/20 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-xs sm:text-sm text-gray-600 mb-1">Price</div>
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800">£{bulkRound.base_price}</div>
          </div>

          <div className="glass rounded-lg sm:rounded-xl p-3 sm:p-4 border border-white/20 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-xs sm:text-sm text-gray-600 mb-1">Balance</div>
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-green-600">£{teamBalance}</div>
          </div>

          <div className="glass rounded-lg sm:rounded-xl p-3 sm:p-4 border border-white/20 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-xs sm:text-sm text-gray-600 mb-1">Squad</div>
            <div className={`text-lg sm:text-xl md:text-2xl font-bold ${
              squadInfo.available > 0 ? 'text-blue-600' : 'text-red-600'
            }`}>
              {squadInfo.current}/{squadInfo.max}
            </div>
            <div className="text-[10px] sm:text-xs text-gray-500 mt-0.5">current</div>
          </div>

          <div className="glass rounded-lg sm:rounded-xl p-3 sm:p-4 border border-white/20 shadow-sm hover:shadow-md transition-shadow col-span-2 sm:col-span-1">
            <div className="text-xs sm:text-sm text-gray-600 mb-1">Your Bids</div>
            <div className={`text-lg sm:text-xl md:text-2xl font-bold ${
              bidsCount > 0 ? 'text-blue-600' : 'text-gray-400'
            }`}>
              {bidsCount}
            </div>
            <div className="text-[10px] sm:text-xs text-gray-500 mt-0.5">
              {availableSlotsNow} slots left
            </div>
          </div>
        </div>


        {/* Info Card - Collapsible on mobile */}
        <details className="glass rounded-xl sm:rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6 border border-white/20 shadow-sm group" open>
          <summary className="flex items-center gap-2 sm:gap-3 cursor-pointer list-none">
            <div className="p-1.5 sm:p-2 rounded-lg bg-blue-100">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-gray-900 flex-1">How It Works</h3>
            <svg className="w-5 h-5 text-gray-500 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <ul className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-gray-700 mt-3 sm:mt-4 ml-10 sm:ml-11">
            <li className="flex items-start">
              <span className="text-blue-600 mr-2">•</span>
              <span>Click any player to bid £{bulkRound.base_price}</span>
            </li>
            <li className="flex items-start">
              <span className="text-blue-600 mr-2">•</span>
              <span>Click again to remove your bid</span>
            </li>
            <li className="flex items-start">
              <span className="text-blue-600 mr-2">•</span>
              <span>Only bidder? Player is yours!</span>
            </li>
            <li className="flex items-start">
              <span className="text-blue-600 mr-2">•</span>
              <span>Multiple bids trigger tiebreaker</span>
            </li>
            <li className="flex items-start">
              <span className="text-blue-600 mr-2">•</span>
              <span>Bids auto-save, money reserved</span>
            </li>
          </ul>
        </details>

        {/* Filters and Controls */}
        <div className="glass rounded-xl sm:rounded-2xl p-3 sm:p-4 mb-4 sm:mb-6 border border-white/20 shadow-sm">
          <div className="flex flex-col gap-3">
            {/* Search with icon */}
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search players..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 sm:pl-10 pr-4 py-2 sm:py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0066FF] focus:border-[#0066FF] text-sm transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label="Clear search"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            
            {/* Position Tabs - Mobile Optimized with horizontal scroll */}
            <div className="-mx-3 sm:-mx-4 px-3 sm:px-4">
              <div className="overflow-x-auto scrollbar-hide">
                <div className="flex gap-1.5 sm:gap-2 min-w-max pb-1">
                  {['all', 'GK', 'CB', 'LB', 'RB', 'DMF', 'CMF', 'AMF', 'LMF', 'RMF', 'SS', 'CF'].map((pos) => (
                    <button
                      key={pos}
                      onClick={() => setFilterPosition(pos)}
                      className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap touch-manipulation ${
                        filterPosition === pos
                          ? 'bg-[#0066FF] text-white shadow-md scale-105'
                          : 'bg-white/70 text-gray-700 hover:bg-white active:scale-95'
                      }`}
                    >
                      {pos === 'all' ? 'All' : pos}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Your Bidded Players */}
        {bidsCount > 0 && (
          <div className="glass rounded-xl sm:rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6 border-2 border-green-200 shadow-lg">
            <h2 className="text-base sm:text-lg font-bold text-gray-800 mb-3 sm:mb-4 flex items-center">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Your Bids ({bidsCount})
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-3 sm:mb-4">
              {players
                .filter(player => biddedPlayers.has(player.id))
                .map((player) => (
                  <div
                    key={player.id}
                    className="glass rounded-lg sm:rounded-xl p-3 sm:p-4 border-2 border-green-300 bg-green-50 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
                          <h3 className="font-bold text-sm sm:text-base text-gray-800 truncate">{player.name}</h3>
                          {player.is_starred && (
                            <svg className="w-4 h-4 text-yellow-500 fill-current" viewBox="0 0 24 24">
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                            </svg>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-600 flex-wrap">
                          <span className="px-1.5 sm:px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] sm:text-xs font-medium">
                            {player.position}
                          </span>
                          <span className="hidden sm:inline">•</span>
                          <span className="truncate text-xs">{player.team_name}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleTogglePlayer(player.id)}
                        className="w-7 h-7 sm:w-8 sm:h-8 flex-shrink-0 rounded border-2 bg-red-600 border-red-600 flex items-center justify-center hover:bg-red-700 active:scale-95 transition-all touch-manipulation"
                        title="Remove bid"
                        aria-label="Remove bid"
                      >
                        <svg className="w-3 h-3 sm:w-4 sm:h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-xs sm:text-sm mt-2">
                      <span className="text-gray-600">Rating: {player.overall_rating}</span>
                      <span className="text-green-600 font-bold">£{bulkRound?.base_price}</span>
                    </div>
                  </div>
                ))
              }
            </div>

            <div className="bg-gradient-to-r from-blue-100 to-blue-50 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-blue-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex-1">
                  <p className="text-blue-900 font-bold text-sm sm:text-base">
                    {bidsCount} bid{bidsCount !== 1 ? 's' : ''} placed
                  </p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs sm:text-sm text-blue-700 mt-1">
                    <span className="whitespace-nowrap">Reserved: £{totalCost}</span>
                    <span className="hidden sm:inline">•</span>
                    <span className="whitespace-nowrap">Left: £{remainingBalance}</span>
                    <span className="hidden sm:inline">•</span>
                    <span className="whitespace-nowrap">{availableSlotsNow} slots</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Available Players */}
        <div className="glass rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-white/20 shadow-sm">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h2 className="text-base sm:text-lg md:text-xl font-bold text-gray-800">
              Available Players
            </h2>
            <span className="text-xs sm:text-sm text-gray-500 font-medium bg-gray-100 px-2 sm:px-3 py-1 rounded-full">
              {filteredPlayers.length}
            </span>
          </div>

          {sortedPlayers.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <p className="text-gray-600 font-medium">No players found</p>
              <p className="text-sm text-gray-500 mt-2">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {sortedPlayers.map((player) => {
                const isBidded = biddedPlayers.has(player.id);
                
                return (
                <button
                  key={player.id}
                  onClick={() => handleTogglePlayer(player.id)}
                  className={`glass rounded-lg sm:rounded-xl p-3 sm:p-4 border-2 transition-all text-left active:scale-98 touch-manipulation ${
                    isBidded
                      ? 'border-green-500 bg-green-50 shadow-md'
                      : 'border-white/20 hover:border-blue-300 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
                        <h3 className="font-bold text-sm sm:text-base text-gray-800 truncate">{player.name}</h3>
                        {player.is_starred && (
                          <svg className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-500 fill-current flex-shrink-0" viewBox="0 0 24 24">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                        )}
                        {isBidded && (
                          <span className="text-[10px] sm:text-xs font-semibold text-green-700 bg-green-100 px-1.5 sm:px-2 py-0.5 rounded whitespace-nowrap">
                            ✓ Bid
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-600 flex-wrap">
                        <span className="px-1.5 sm:px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] sm:text-xs font-medium">
                          {player.position}
                        </span>
                        <span className="hidden sm:inline">•</span>
                        <span className="truncate text-xs">{player.team_name}</span>
                      </div>
                    </div>
                    <div className={`w-7 h-7 sm:w-8 sm:h-8 flex-shrink-0 rounded border-2 flex items-center justify-center transition-all ${
                      isBidded
                        ? 'bg-green-600 border-green-600 shadow-md'
                        : 'border-gray-300 group-hover:border-blue-400'
                    }`}>
                      {isBidded && (
                        <svg className="w-3 h-3 sm:w-4 sm:h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs sm:text-sm mt-2">
                    <span className="text-gray-600">Rating: {player.overall_rating}</span>
                    <span className="text-[10px] sm:text-xs text-gray-500 truncate max-w-[100px] sm:max-w-none">{player.playing_style}</span>
                  </div>
                </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal Components */}
      <AlertModal
        isOpen={alertState.isOpen}
        onClose={closeAlert}
        title={alertState.title}
        message={alertState.message}
        type={alertState.type}
      />

      <ConfirmModal
        isOpen={confirmState.isOpen}
        onConfirm={handleConfirm}
        onCancel={closeConfirm}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        cancelText={confirmState.cancelText}
        type={confirmState.type}
      />
    </div>
  );
}
