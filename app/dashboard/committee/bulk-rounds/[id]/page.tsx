'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, use, useCallback } from 'react';
import Link from 'next/link';
import { useWebSocket } from '@/hooks/useWebSocket';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface BulkBid {
  player_id: string;
  player_name: string;
  team_id: string;
  team_name: string;
  position: string;
}

interface TiebreakerInfo {
  id: string;
  status: string;
  created_at: string;
  team_count: number;
  highest_bid?: number;
  highest_bidder?: string;
  submissions: Array<{
    team_id: string;
    team_name: string;
    new_bid_amount: number;
    submitted: string;
  }>;
}

interface RoundPlayer {
  id: number;
  player_id: string;
  player_name: string;
  position: string;
  position_group: string;
  base_price: number;
  status: string;
  winning_team_id?: string;
  winning_bid?: number;
  bid_count?: number;
  tiebreaker_id?: string;
  tiebreaker?: TiebreakerInfo;
}

interface TeamSummary {
  team_id: string;
  team_name: string;
  slots_needed: number;
  players_selected: number;
  bids_submitted: number;
}

interface Round {
  id: number;
  season_id: string;
  round_number: number;
  status: string;
  round_type: string;
  base_price: number;
  start_time?: string;
  end_time?: string;
  duration_seconds: number;
  created_at: string;
  roundPlayers?: RoundPlayer[];
}

export default function BulkRoundManagementPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, firebaseUser, loading } = useAuth();
  const router = useRouter();
  const resolvedParams = use(params);
  const [round, setRound] = useState<Round | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddPlayers, setShowAddPlayers] = useState(false);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [availablePlayers, setAvailablePlayers] = useState<any[]>([]);
  const [showAddTime, setShowAddTime] = useState(false);
  const [minutesToAdd, setMinutesToAdd] = useState('5');
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());
  const [expandedTiebreakers, setExpandedTiebreakers] = useState<Set<string>>(new Set());
  const [expandedBids, setExpandedBids] = useState<Set<string>>(new Set());
  const [playerBids, setPlayerBids] = useState<Map<string, any[]>>(new Map());
  const [loadingBids, setLoadingBids] = useState<Set<string>>(new Set());
  const [teamSummary, setTeamSummary] = useState<TeamSummary[]>([]);
  const [loadingTeamSummary, setLoadingTeamSummary] = useState(false);
  const [teamSummaryRefreshTrigger, setTeamSummaryRefreshTrigger] = useState(0);

  // ⚡ Enable WebSocket for real-time round updates - NO PAGE REFRESH NEEDED!
  const { isConnected: isRoundConnected } = useWebSocket({
    channel: round?.season_id ? `updates/${round.season_id}/rounds/${resolvedParams.id}` : `round:${resolvedParams.id}`,
    enabled: true,
    onMessage: useCallback((message: any) => {
      console.log('⚡ [Committee WS] Real-time update:', message);
      
      // Handle both string messages and object messages
      const messageType = typeof message === 'string' ? message : message.type;
      
      // Handle different message types for instant UI updates
      switch (messageType) {
        case 'round_updated':
          // ⚡ INSTANT: Update round metadata (timer, status, etc.)
          console.log('🔄 Updating round metadata...', message);
          setRound(prev => prev ? {
            ...prev,
            status: message.status || prev.status,
            start_time: message.start_time || prev.start_time,
            end_time: message.end_time || prev.end_time,
            duration_seconds: message.duration_seconds || prev.duration_seconds,
          } : null);
          break;
          
        case 'bid_added':
          // ⚡ INSTANT: Team placed a bid - update bid count
          const playerId = message.data?.player_id || message.player_id;
          const bidCount = message.data?.bid_count || message.bid_count;
          const teamId = message.data?.team_id || message.team_id;
          
          if (playerId) {
            console.log(`💰 Bid added for player ${playerId}: ${bidCount} total bids, team: ${teamId}`);
            setRound(prev => {
              if (!prev?.roundPlayers) return prev;
              return {
                ...prev,
                roundPlayers: prev.roundPlayers.map(player => 
                  player.player_id === playerId
                    ? { ...player, bid_count: bidCount }
                    : player
                ),
              };
            });
            // Always refresh team summary when any bid is added
            console.log('🔄 Refreshing team summary due to bid_added');
            setTeamSummaryRefreshTrigger(prev => prev + 1);
          }
          break;
          
        case 'bid_removed':
          // ⚡ INSTANT: Team removed a bid - update bid count
          const removedPlayerId = message.data?.player_id || message.player_id;
          const removedBidCount = message.data?.bid_count || message.bid_count;
          const removedTeamId = message.data?.team_id || message.team_id;
          
          if (removedPlayerId) {
            console.log(`❌ Bid removed for player ${removedPlayerId}: ${removedBidCount} total bids, team: ${removedTeamId}`);
            setRound(prev => {
              if (!prev?.roundPlayers) return prev;
              return {
                ...prev,
                roundPlayers: prev.roundPlayers.map(player => 
                  player.player_id === removedPlayerId
                    ? { ...player, bid_count: removedBidCount }
                    : player
                ),
              };
            });
            // Always refresh team summary when any bid is removed
            console.log('🔄 Refreshing team summary due to bid_removed');
            setTeamSummaryRefreshTrigger(prev => prev + 1);
          }
          break;
          
        case 'player_status_updated':
          // ⚡ INSTANT: Player status changed (sold, contested, etc.)
          if (message.data?.player_id) {
            console.log(`📊 Player ${message.data.player_id} status: ${message.data.status}`);
            setRound(prev => {
              if (!prev?.roundPlayers) return prev;
              return {
                ...prev,
                roundPlayers: prev.roundPlayers.map(player => 
                  player.player_id === message.data.player_id
                    ? {
                        ...player,
                        status: message.data.status || player.status,
                        winning_team_id: message.data.winning_team_id,
                        winning_bid: message.data.winning_bid,
                        bid_count: message.data.bid_count ?? player.bid_count,
                        tiebreaker_id: message.data.tiebreaker_id || player.tiebreaker_id,
                      }
                    : player
                ),
              };
            });
          }
          break;
          
        case 'tiebreaker_created':
          // ⚡ INSTANT: Tiebreaker created for a player
          if (message.data?.player_id && message.data?.tiebreaker_id) {
            console.log(`🎯 Tiebreaker created: ${message.data.tiebreaker_id} for player ${message.data.player_id}`);
            setRound(prev => {
              if (!prev?.roundPlayers) return prev;
              return {
                ...prev,
                roundPlayers: prev.roundPlayers.map(player => 
                  player.player_id === message.data.player_id
                    ? {
                        ...player,
                        tiebreaker_id: message.data.tiebreaker_id,
                        status: 'contested',
                      }
                    : player
                ),
              };
            });
          }
          break;
          
        case 'round_started':
          // ⚡ INSTANT: Round started
          console.log('🚀 Round started!');
          setRound(prev => prev ? { ...prev, status: 'active', start_time: message.data?.start_time } : null);
          break;
          
        case 'round_completed':
          // ⚡ INSTANT: Round completed
          console.log('✅ Round completed!');
          setRound(prev => prev ? { ...prev, status: 'completed' } : null);
          break;
          
        case 'tiebreaker_bid':
          // ⚡ INSTANT: Tiebreaker bid placed - update tiebreaker data
          if (message.data?.tiebreaker_id) {
            console.log(`🎯 Tiebreaker bid: £${message.data.bid_amount} by ${message.data.team_name}`);
            // Find the player with this tiebreaker and update it
            setRound(prev => {
              if (!prev?.roundPlayers) return prev;
              return {
                ...prev,
                roundPlayers: prev.roundPlayers.map(player => {
                  if (player.tiebreaker_id === message.data.tiebreaker_id && player.tiebreaker) {
                    // Update tiebreaker data
                    const newSubmissions = player.tiebreaker.submissions?.map(sub =>
                      sub.team_id === message.data.team_id
                        ? { ...sub, new_bid_amount: message.data.bid_amount, submitted: new Date().toISOString() }
                        : sub
                    ) || [];
                    
                    // If team not in submissions yet, add them
                    const teamExists = newSubmissions.some(s => s.team_id === message.data.team_id);
                    if (!teamExists) {
                      newSubmissions.push({
                        team_id: message.data.team_id,
                        team_name: message.data.team_name,
                        new_bid_amount: message.data.bid_amount,
                        submitted: new Date().toISOString(),
                      });
                    }
                    
                    // Update highest bid
                    const highestBid = Math.max(...newSubmissions.map(s => s.new_bid_amount));
                    const highestBidder = newSubmissions.find(s => s.new_bid_amount === highestBid)?.team_name;
                    
                    return {
                      ...player,
                      tiebreaker: {
                        ...player.tiebreaker,
                        highest_bid: highestBid,
                        highest_bidder: highestBidder,
                        submissions: newSubmissions,
                      },
                    };
                  }
                  return player;
                }),
              };
            });
          }
          break;
      }
      
      setLastUpdate(Date.now());
    }, []),
  });
  
  // ⚡ ALSO listen to tiebreaker channels for ANY tiebreaker in this round
  // This catches tiebreaker bids even if round channel broadcast fails
  const activeTiebreakers = round?.roundPlayers?.filter(p => p.tiebreaker_id).map(p => p.tiebreaker_id) || [];
  
  useEffect(() => {
    // Subscribe to all active tiebreaker channels
    activeTiebreakers.forEach(tiebreakerId => {
      if (tiebreakerId) {
        console.log(`🎯 Subscribing to tiebreaker:${tiebreakerId}`);
      }
    });
  }, [JSON.stringify(activeTiebreakers)]);

  const isConnected = isRoundConnected;

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'committee_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  // Fetch round details
  const fetchRound = async () => {
    setIsLoading(true);
    try {
      // Add show_all=true to see all players, not just ones with bids
      const response = await fetchWithTokenRefresh(`/api/bulk-rounds/${resolvedParams.id}?show_all=true&limit=100`);
      const { success, data } = await response.json();

      if (success) {
        setRound(data);
      }
    } catch (err) {
      console.error('Error fetching round:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch team summary
  const fetchTeamSummary = async () => {
    setLoadingTeamSummary(true);
    try {
      const response = await fetchWithTokenRefresh(`/api/bulk-rounds/${resolvedParams.id}/team-summary`);
      const { success, data, error } = await response.json();

      console.log('[Team Summary] Response:', { success, data, error });

      if (success && data?.teams) {
        setTeamSummary(data.teams);
        console.log('[Team Summary] Loaded teams:', data.teams.length);
      } else {
        console.error('[Team Summary] Error:', error);
      }
    } catch (err) {
      console.error('[Team Summary] Fetch error:', err);
    } finally {
      setLoadingTeamSummary(false);
    }
  };

  useEffect(() => {
    if (resolvedParams.id) {
      fetchRound();
      fetchTeamSummary();
    }
  }, [resolvedParams.id]);

  // Refresh team summary when trigger changes
  useEffect(() => {
    if (teamSummaryRefreshTrigger > 0) {
      fetchTeamSummary();
    }
  }, [teamSummaryRefreshTrigger]);


  // Timer for active rounds
  useEffect(() => {
    if (round?.status === 'active' && round.end_time) {
      const interval = setInterval(() => {
        const now = new Date().getTime();
        const end = new Date(round.end_time!).getTime();
        const remaining = Math.floor((end - now) / 1000);
        
        if (remaining <= 0) {
          setTimeRemaining(0);
          clearInterval(interval);
        } else {
          setTimeRemaining(remaining);
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [round]);

  // Fetch available players
  useEffect(() => {
    const fetchAvailablePlayers = async () => {
      if (!showAddPlayers) return;

      try {
        const response = await fetchWithTokenRefresh('/api/players?is_auction_eligible=true');
        const { success, data } = await response.json();

        if (success) {
          const currentPlayerIds = round?.roundPlayers?.map(p => p.player_id) || [];
          const available = data.filter((p: any) => !currentPlayerIds.includes(p.id));
          setAvailablePlayers(available);
        }
      } catch (err) {
        console.error('Error fetching players:', err);
      }
    };

    fetchAvailablePlayers();
  }, [showAddPlayers, round]);

  const handleUpdateStatus = async (newStatus: string) => {
    if (!round) return;

    let confirmMessage = `Are you sure you want to ${newStatus} this round?`;
    
    if (newStatus === 'active') {
      if (!confirm('Are you sure you want to start this bulk bidding round? Teams will be able to place bids immediately.')) {
        return;
      }
      
      try {
        const response = await fetchWithTokenRefresh(`/api/admin/bulk-rounds/${round.id}/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        const { success, data, error } = await response.json();

        if (success) {
          alert(data.message || 'Round started successfully!');
          // ⚡ NO REFRESH NEEDED - WebSocket will update automatically!
        } else {
          alert(`Error: ${error}`);
        }
      } catch (err) {
        console.error('Error starting round:', err);
        alert('Failed to start round');
      }
      return;
    }

    if (!confirm(confirmMessage)) return;

    // Handle finalize/complete
    if (newStatus === 'completed') {
      try {
        const response = await fetchWithTokenRefresh(`/api/admin/bulk-rounds/${round.id}/finalize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        const { success, data, error } = await response.json();

        if (success) {
          alert(data.message || 'Round completed successfully!');
          // ⚡ NO REFRESH NEEDED - WebSocket will update automatically!
        } else {
          alert(`Error: ${error}`);
        }
      } catch (err) {
        console.error('Error completing round:', err);
        alert('Failed to complete round');
      }
      return;
    }

    // Handle other status changes
    try {
      const response = await fetchWithTokenRefresh(`/api/rounds/${round.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      const { success, data } = await response.json();

      if (success) {
        setRound({ ...round, ...data });
        alert(`Round ${newStatus} successfully!`);
      }
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Failed to update status');
    }
  };

  const handleCreateTiebreaker = async (playerId: string, playerName: string) => {
    if (!round) return;

    if (!confirm(`Create tiebreaker for ${playerName}? This will allow the tied teams to submit new bids.`)) {
      return;
    }

    try {
      const response = await fetchWithTokenRefresh(`/api/admin/bulk-rounds/${round.id}/create-tiebreaker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: playerId }),
      });

      const { success, data, error } = await response.json();

      if (success) {
        alert(data.message || 'Tiebreaker created successfully!');
        // ⚡ NO REFRESH NEEDED - WebSocket will update automatically!
      } else {
        alert(`Error: ${error}`);
      }
    } catch (err) {
      console.error('Error creating tiebreaker:', err);
      alert('Failed to create tiebreaker');
    }
  };

  const handleDeleteRound = async () => {
    if (!round) return;

    if (round.status === 'active' || round.status === 'completed') {
      alert('Cannot delete active or completed rounds');
      return;
    }

    const confirmMessage = 'Are you sure you want to delete this round? This action cannot be undone.';
    if (!confirm(confirmMessage)) return;

    try {
      const response = await fetchWithTokenRefresh(`/api/rounds/${round.id}`, {
        method: 'DELETE',
      });

      const { success } = await response.json();

      if (success) {
        alert('Round deleted successfully');
        router.push('/dashboard/committee/bulk-rounds');
      }
    } catch (err) {
      console.error('Error deleting round:', err);
      alert('Failed to delete round');
    }
  };

  const handleAddTime = async () => {
    if (!round) return;

    const minutes = parseInt(minutesToAdd);
    if (!minutes || minutes <= 0) {
      alert('Please enter a valid number of minutes');
      return;
    }

    if (!confirm(`Add ${minutes} minute(s) to the round?`)) {
      return;
    }

    try {
      const response = await fetchWithTokenRefresh(`/api/rounds/${round.id}/add-time`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes }),
      });

      const { success, data, error } = await response.json();

      if (success) {
        alert(`Successfully added ${minutes} minute(s) to the round!`);
        setShowAddTime(false);
        setMinutesToAdd('5');
        // WebSocket will update automatically
      } else {
        alert(`Error: ${error}`);
      }
    } catch (err) {
      console.error('Error adding time to round:', err);
      alert('Failed to add time to round');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-700 border-gray-300';
      case 'scheduled': return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'active': return 'bg-green-100 text-green-700 border-green-300';
      case 'completed': return 'bg-purple-100 text-purple-700 border-purple-300';
      case 'cancelled': return 'bg-red-100 text-red-700 border-red-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const filteredPlayers = availablePlayers.filter(p =>
    p.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.position?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const playersByStatus = () => {
    if (!round || !round.roundPlayers) return { pending: [], sold: [], contested: [] };
    
    return {
      pending: round.roundPlayers.filter(p => p.status === 'pending'),
      sold: round.roundPlayers.filter(p => p.status === 'sold'),
      // Only show contested players that don't have a tiebreaker yet
      contested: round.roundPlayers.filter(p => p.bid_count && p.bid_count > 1 && !p.tiebreaker_id),
    };
  };

  if (loading || isLoading || !round) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const { pending, sold, contested } = playersByStatus();

  // Determine if bids should be shown
  const shouldShowBids = round.status === 'completed' || timeRemaining === 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-gray-50">
      <div className="container mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        {/* Header */}
        <div className="mb-4 sm:mb-6 lg:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-3">
            <Link
              href="/dashboard/committee/bulk-rounds"
              className="text-gray-500 hover:text-[#0066FF] transition-colors self-start"
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
                <svg className="w-6 h-6 sm:w-8 sm:h-8 text-[#0066FF] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Bulk Round {round.round_number}</span>
              </h1>
              <span className={`px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-semibold border-2 ${getStatusColor(round.status)} capitalize`}>
                {round.status}
              </span>
              {/* ⚡ Real-time Connection Status */}
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                isConnected 
                  ? 'bg-green-100 text-green-800 border border-green-300' 
                  : 'bg-gray-100 text-gray-600 border border-gray-300'
              }`}>
                <span className={`w-2 h-2 rounded-full mr-1.5 ${
                  isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                }`}></span>
                {isConnected ? '⚡ Live' : 'Offline'}
              </span>
            </div>
          </div>
          <p className="text-sm sm:text-base text-gray-600 pl-8 sm:pl-10">Manage bulk bidding round where teams bid on multiple players</p>
        </div>

        {/* Active Round Timer */}
        {round.status === 'active' && timeRemaining !== null && (
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6 mb-4 sm:mb-6 border-2 border-green-400 animate-pulse-slow">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="p-2 sm:p-3 rounded-full bg-white/20 backdrop-blur-sm">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white">🔴 Round Active</h3>
                  <p className="text-xs sm:text-sm text-green-50">Teams are currently placing bids</p>
                </div>
              </div>
              <div className="text-center sm:text-right">
                <div className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white font-mono tracking-wider drop-shadow-lg">
                  {formatTime(timeRemaining)}
                </div>
                <div className="text-xs sm:text-sm text-green-50 mt-1">Time Remaining</div>
              </div>
            </div>
          </div>
        )}

        {/* Round Info */}
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-md hover:shadow-lg transition-shadow p-4 sm:p-6 mb-4 sm:mb-6 border border-gray-100">
          <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4 sm:mb-6 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Round Information
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-blue-200">
              <label className="block text-xs sm:text-sm font-medium text-blue-700 mb-1">Base Price</label>
              <p className="text-xl sm:text-2xl font-bold text-blue-900">£{round.base_price}</p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-purple-200">
              <label className="block text-xs sm:text-sm font-medium text-purple-700 mb-1">Duration</label>
              <p className="text-xl sm:text-2xl font-bold text-purple-900">{round.duration_seconds}s</p>
            </div>
            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-indigo-200">
              <label className="block text-xs sm:text-sm font-medium text-indigo-700 mb-1">Total Players</label>
              <p className="text-xl sm:text-2xl font-bold text-indigo-900">{round.stats?.total_players || round.roundPlayers?.length || 0}</p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-green-200">
              <label className="block text-xs sm:text-sm font-medium text-green-700 mb-1">Sold</label>
              <p className="text-xl sm:text-2xl font-bold text-green-900">{round.stats?.sold_count || sold.length}</p>
            </div>
          </div>

          {/* Status Controls */}
          <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-gray-200">
            <label className="block text-xs sm:text-sm font-medium text-gray-600 mb-3">Round Controls</label>
            <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3">
              {round.status === 'draft' && (
                <>
                  <button
                    onClick={() => handleUpdateStatus('active')}
                    className="px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all font-semibold shadow-md hover:shadow-lg transform hover:-translate-y-0.5 text-sm sm:text-base"
                  >
                    🚀 Start Round Now
                  </button>
                  <button
                    onClick={handleDeleteRound}
                    className="px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-lg hover:from-red-600 hover:to-rose-700 transition-all font-semibold shadow-md hover:shadow-lg text-sm sm:text-base sm:ml-auto"
                  >
                    🗑️ Delete Round
                  </button>
                </>
              )}
              {round.status === 'active' && (
                <>
                  <button
                    onClick={() => setShowAddTime(!showAddTime)}
                    className="px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-lg hover:from-blue-600 hover:to-cyan-700 transition-all font-semibold shadow-md hover:shadow-lg transform hover:-translate-y-0.5 text-sm sm:text-base"
                  >
                    ⏱️ Add Time
                  </button>
                  <button
                    onClick={() => handleUpdateStatus('completed')}
                    className="px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-purple-500 to-violet-600 text-white rounded-lg hover:from-purple-600 hover:to-violet-700 transition-all font-semibold shadow-md hover:shadow-lg transform hover:-translate-y-0.5 text-sm sm:text-base"
                  >
                    ✅ Complete Round
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Add Time Interface */}
          {showAddTime && round.status === 'active' && (
            <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Add Time to Round
              </h3>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Minutes to Add</label>
                  <input
                    type="number"
                    value={minutesToAdd}
                    onChange={(e) => setMinutesToAdd(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min="1"
                    max="120"
                    placeholder="Enter minutes"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <button
                    onClick={handleAddTime}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                  >
                    Add Time
                  </button>
                  <button
                    onClick={() => setShowAddTime(false)}
                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-600">
                This will extend the round deadline by {minutesToAdd} minute(s)
              </p>
            </div>
          )}
        </div>

        {/* Team Progress Summary */}
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-md hover:shadow-lg transition-shadow p-4 sm:p-6 mb-4 sm:mb-6 border border-gray-100">
          <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4 sm:mb-6 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Team Progress
          </h2>
          {loadingTeamSummary ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-500">Loading team progress...</p>
            </div>
          ) : teamSummary.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No teams found for this season</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {teamSummary
                .sort((a, b) => b.players_selected - a.players_selected)
                .map((team) => {
                  const progress = (team.players_selected / team.slots_needed) * 100;
                  const isComplete = team.players_selected >= team.slots_needed;
                  const hasStarted = team.players_selected > 0;
                  
                  return (
                    <div 
                      key={team.team_id} 
                      className={`border-2 rounded-lg sm:rounded-xl p-3 sm:p-4 transition-all hover:shadow-md ${
                        isComplete 
                          ? 'bg-green-50 border-green-300' 
                          : hasStarted 
                          ? 'bg-blue-50 border-blue-300' 
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-bold text-gray-900 text-sm sm:text-base flex-1 pr-2">{team.team_name}</h4>
                        {isComplete && (
                          <span className="text-green-600 flex-shrink-0">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          </span>
                        )}
                      </div>
                      <div className="mt-2">
                        <div className="flex justify-between text-xs sm:text-sm mb-1.5">
                          <span className="text-gray-600">Players Selected:</span>
                          <span className={`font-bold ${
                            isComplete ? 'text-green-700' : hasStarted ? 'text-blue-700' : 'text-gray-700'
                          }`}>
                            {team.players_selected} / {team.slots_needed}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                          <div 
                            className={`h-2 rounded-full transition-all duration-500 ${
                              isComplete 
                                ? 'bg-green-600' 
                                : hasStarted 
                                ? 'bg-blue-600' 
                                : 'bg-gray-400'
                            }`}
                            style={{ width: `${Math.min(progress, 100)}%` }}
                          />
                        </div>
                        {isComplete && (
                          <p className="text-xs text-green-700 font-medium mt-1.5">✓ Complete</p>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Bids Hidden Message */}
        {!shouldShowBids && round.status === 'active' && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl sm:rounded-2xl shadow-md p-4 sm:p-6 mb-4 sm:mb-6 border-2 border-amber-200">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 text-center sm:text-left">
              <div className="p-3 rounded-full bg-amber-100">
                <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg sm:text-xl font-bold text-amber-900 mb-1">🔒 Team Bids Hidden</h3>
                <p className="text-sm sm:text-base text-amber-800">
                  Individual team bids will be revealed when the timer reaches zero
                </p>
                {timeRemaining !== null && timeRemaining > 0 && (
                  <p className="text-xs sm:text-sm text-amber-700 mt-1 font-medium">
                    Time remaining: <span className="font-mono font-bold">{formatTime(timeRemaining)}</span>
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Statistics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 lg:gap-6 mb-4 sm:mb-6">
          <div className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all p-4 sm:p-6 border-l-4 border-gray-400 transform hover:-translate-y-1">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-sm sm:text-lg font-bold text-gray-800">Pending</h3>
              </div>
              <span className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-lg sm:text-xl font-bold">
                {round.stats?.pending_count || pending.length}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">Players awaiting bids</p>
          </div>

          <div className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all p-4 sm:p-6 border-l-4 border-green-500 transform hover:-translate-y-1">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-green-100 rounded-lg">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-sm sm:text-lg font-bold text-green-800">Sold</h3>
              </div>
              <span className="px-3 py-1.5 bg-green-100 text-green-800 rounded-full text-lg sm:text-xl font-bold">
                {round.stats?.sold_count || sold.length}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-green-700 mt-1">Successfully assigned</p>
          </div>

          {shouldShowBids && (
            <div className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all p-4 sm:p-6 border-l-4 border-orange-500 transform hover:-translate-y-1">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <h3 className="text-sm sm:text-lg font-bold text-orange-800">Contested</h3>
                </div>
                <span className="px-3 py-1.5 bg-orange-100 text-orange-800 rounded-full text-lg sm:text-xl font-bold">
                  {contested.length}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-orange-700 mt-1">Need tiebreaker auction</p>
            </div>
          )}
        </div>

        {/* Players Section */}
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-md p-4 sm:p-6 border border-gray-100 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 flex items-center gap-2">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Round Players
            </h2>
            {round.status === 'draft' && (
              <button
                onClick={() => setShowAddPlayers(!showAddPlayers)}
                className="inline-flex items-center px-3 sm:px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all font-semibold shadow-md hover:shadow-lg text-sm sm:text-base transform hover:-translate-y-0.5"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add Players
              </button>
            )}
          </div>

          {/* Add Players Interface */}
          {showAddPlayers && (
            <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
              <h3 className="font-semibold text-gray-800 mb-3">Select Players to Add</h3>
              <input
                type="text"
                placeholder="Search players..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-3 focus:ring-2 focus:ring-[#0066FF] focus:border-[#0066FF]"
              />
              <div className="max-h-64 overflow-y-auto space-y-2 mb-3">
                {filteredPlayers.map((player) => (
                  <label key={player.id} className="flex items-center p-2 hover:bg-white rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedPlayers.includes(player.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedPlayers([...selectedPlayers, player.id]);
                        } else {
                          setSelectedPlayers(selectedPlayers.filter(id => id !== player.id));
                        }
                      }}
                      className="mr-3"
                    />
                    <span className="flex-1 font-medium">{player.full_name}</span>
                    <span className="text-sm text-gray-600">{player.position}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowAddPlayers(false);
                    setSelectedPlayers([]);
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    alert('Add players functionality coming soon!');
                  }}
                  disabled={selectedPlayers.length === 0}
                  className="px-4 py-2 bg-[#0066FF] text-white rounded-lg hover:bg-[#0052CC] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add {selectedPlayers.length} Player{selectedPlayers.length !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          )}

          {/* Players List */}
          {!round.roundPlayers || round.roundPlayers.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto text-blue-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-xl font-medium text-gray-700 mb-2">Waiting for bids...</h3>
              <p className="text-gray-600 mb-1">This round has <span className="font-bold text-blue-600">{round.stats?.total_players || 0} players</span></p>
              <p className="text-gray-500 text-sm">Players with bids will appear here automatically</p>
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="block lg:hidden space-y-3">
                {round.roundPlayers?.sort((a, b) => (b.bid_count || 0) - (a.bid_count || 0)).map((player) => (
                  <div key={player.id} className="bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="p-4">
                      {/* Player Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-900 text-base mb-1">{player.player_name}</h3>
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md font-medium">{player.position}</span>
                            <span className="text-gray-600">•</span>
                            <span className="font-semibold text-gray-700">£{player.base_price}</span>
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                          player.status === 'sold' ? 'bg-green-100 text-green-700' :
                          player.status === 'unsold' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {player.status}
                        </span>
                      </div>
                      
                      {/* Bids Info */}
                      <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                        {shouldShowBids ? (
                          <span className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
                            (player.bid_count || 0) > 1 ? 'bg-orange-100 text-orange-700' :
                            (player.bid_count || 0) === 1 ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {player.bid_count || 0} {(player.bid_count || 0) === 1 ? 'bid' : 'bids'}
                          </span>
                        ) : (
                          <span className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-semibold flex items-center gap-1.5">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            Bids Hidden
                          </span>
                        )}
                        
                        {player.tiebreaker_id ? (
                          <button 
                            onClick={() => {
                              const newExpanded = new Set(expandedTiebreakers);
                              if (newExpanded.has(player.player_id)) {
                                newExpanded.delete(player.player_id);
                              } else {
                                newExpanded.add(player.player_id);
                              }
                              setExpandedTiebreakers(newExpanded);
                            }}
                            className="px-3 py-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-semibold shadow-sm"
                          >
                            {expandedTiebreakers.has(player.player_id) ? '▲ Hide' : '▼ View'} Tiebreaker
                          </button>
                        ) : shouldShowBids ? (
                          <button 
                            onClick={async () => {
                              const newExpanded = new Set(expandedBids);
                              if (newExpanded.has(player.player_id)) {
                                newExpanded.delete(player.player_id);
                                setExpandedBids(newExpanded);
                              } else {
                                newExpanded.add(player.player_id);
                                setExpandedBids(newExpanded);
                                if (!playerBids.has(player.player_id) && !loadingBids.has(player.player_id)) {
                                  setLoadingBids(prev => new Set(prev).add(player.player_id));
                                  try {
                                    const response = await fetchWithTokenRefresh(`/api/rounds/${round.id}/players/${player.player_id}/bids`);
                                    const { success, data } = await response.json();
                                    if (success) {
                                      setPlayerBids(prev => {
                                        const newMap = new Map(prev);
                                        newMap.set(player.player_id, data);
                                        return newMap;
                                      });
                                    }
                                  } catch (err) {
                                    console.error('[Bids] Fetch error:', err);
                                  } finally {
                                    setLoadingBids(prev => {
                                      const newLoading = new Set(prev);
                                      newLoading.delete(player.player_id);
                                      return newLoading;
                                    });
                                  }
                                }
                              }
                            }}
                            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold shadow-sm"
                          >
                            {expandedBids.has(player.player_id) ? '▲ Hide' : '▼ View'} Bids
                          </button>
                        ) : (
                          <div className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-semibold flex items-center gap-1.5">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            Hidden
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Expandable Bid Details - Mobile */}
                    {!player.tiebreaker_id && expandedBids.has(player.player_id) && shouldShowBids && (
                      <div className="border-t border-gray-200 bg-blue-50 p-4">
                        <h4 className="font-semibold text-gray-800 mb-3 flex items-center text-sm">
                          <svg className="w-4 h-4 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          Bids for {player.player_name}
                        </h4>
                        {loadingBids.has(player.player_id) ? (
                          <div className="text-center py-4">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                            <p className="mt-2 text-xs text-gray-500">Loading bids...</p>
                          </div>
                        ) : playerBids.has(player.player_id) ? (
                          <div className="space-y-2">
                            {playerBids.get(player.player_id)!.length > 0 ? (
                              playerBids.get(player.player_id)!
                                .sort((a: any, b: any) => b.amount - a.amount)
                                .map((bid: any, idx: number) => (
                                  <div 
                                    key={bid.team_id}
                                    className={`flex items-center justify-between p-3 rounded-lg ${
                                      idx === 0 ? 'bg-green-100 border-2 border-green-300' : 'bg-white border border-gray-200'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      {idx === 0 && <span className="text-lg">🏆</span>}
                                      <div>
                                        <p className={`font-semibold text-sm ${
                                          idx === 0 ? 'text-green-900' : 'text-gray-800'
                                        }`}>
                                          {bid.team_name}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                          {new Date(bid.created_at).toLocaleString()}
                                        </p>
                                      </div>
                                    </div>
                                    <div className={`text-lg font-bold ${
                                      idx === 0 ? 'text-green-700' : 'text-gray-700'
                                    }`}>
                                      £{bid.amount}
                                    </div>
                                  </div>
                                ))
                            ) : (
                              <div className="text-center py-4 text-gray-500 text-sm">
                                No bids placed yet
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-center py-4 text-gray-500 text-sm">
                            Failed to load bids
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Expandable Tiebreaker Details - Mobile */}
                    {player.tiebreaker_id && expandedTiebreakers.has(player.player_id) && player.tiebreaker && (
                      <div className="border-t border-gray-200 bg-orange-50 p-4">
                        <div className="mb-3 flex flex-col gap-2">
                          <h4 className="font-semibold text-gray-800 flex items-center text-sm">
                            <svg className="w-4 h-4 mr-2 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            Live Tiebreaker - {player.player_name}
                          </h4>
                          <div className="flex items-center justify-between">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              player.tiebreaker.status === 'active' ? 'bg-green-100 text-green-700' :
                              player.tiebreaker.status === 'resolved' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {player.tiebreaker.status}
                            </span>
                            <Link
                              href={`/dashboard/committee/bulk-rounds/${round.id}/tiebreakers`}
                              className="px-3 py-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-xs font-semibold"
                            >
                              Manage
                            </Link>
                          </div>
                        </div>
                        {player.tiebreaker.highest_bid && (
                          <div className="mb-3 p-3 bg-white rounded-lg border border-green-200">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-xs text-gray-600">Current Highest Bid</p>
                                <p className="text-xl font-bold text-green-600">£{player.tiebreaker.highest_bid}</p>
                              </div>
                              {player.tiebreaker.highest_bidder && (
                                <div className="text-right">
                                  <p className="text-xs text-gray-600">Leading Team</p>
                                  <p className="font-semibold text-sm text-gray-800">{player.tiebreaker.highest_bidder}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        <div>
                          <h5 className="text-xs font-semibold text-gray-700 mb-2">Team Bids ({player.tiebreaker.team_count} teams)</h5>
                          <div className="space-y-2">
                            {player.tiebreaker.submissions && player.tiebreaker.submissions.length > 0 ? (
                              player.tiebreaker.submissions
                                .sort((a, b) => b.new_bid_amount - a.new_bid_amount)
                                .map((sub, idx) => (
                                  <div 
                                    key={sub.team_id}
                                    className={`flex items-center justify-between p-3 rounded-lg ${
                                      idx === 0 ? 'bg-green-100 border-2 border-green-300' : 'bg-white border border-gray-200'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      {idx === 0 && <span className="text-lg">🏆</span>}
                                      <div>
                                        <p className={`font-semibold text-sm ${
                                          idx === 0 ? 'text-green-900' : 'text-gray-800'
                                        }`}>
                                          {sub.team_name}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                          {new Date(sub.submitted).toLocaleTimeString()}
                                        </p>
                                      </div>
                                    </div>
                                    <div className={`text-lg font-bold ${
                                      idx === 0 ? 'text-green-700' : 'text-gray-700'
                                    }`}>
                                      £{sub.new_bid_amount}
                                    </div>
                                  </div>
                                ))
                            ) : (
                              <div className="text-center py-4 text-gray-500 text-xs">
                                No bids submitted yet
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-200 bg-gray-50">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Player Name</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Position</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Base Price</th>
                      {shouldShowBids && (
                        <th className="text-left py-3 px-4 font-semibold text-gray-700 cursor-pointer hover:text-blue-600" title="Sorted by bid count (highest first)">Bids ↓</th>
                      )}
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {round.roundPlayers?.sort((a, b) => (b.bid_count || 0) - (a.bid_count || 0)).map((player) => (
                      <React.Fragment key={player.id}>
                        <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4 font-medium text-gray-800">{player.player_name}</td>
                        <td className="py-3 px-4 text-gray-600">{player.position}</td>
                        <td className="py-3 px-4 text-gray-600">£{player.base_price}</td>
                        {shouldShowBids && (
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              (player.bid_count || 0) > 1 ? 'bg-orange-100 text-orange-700' :
                              (player.bid_count || 0) === 1 ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {player.bid_count || 0} {(player.bid_count || 0) === 1 ? 'bid' : 'bids'}
                            </span>
                          </td>
                        )}
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            player.status === 'sold' ? 'bg-green-100 text-green-700' :
                            player.status === 'unsold' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {player.status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {player.tiebreaker_id ? (
                            <button 
                              onClick={() => {
                                const newExpanded = new Set(expandedTiebreakers);
                                if (newExpanded.has(player.player_id)) {
                                  newExpanded.delete(player.player_id);
                                } else {
                                  newExpanded.add(player.player_id);
                                }
                                setExpandedTiebreakers(newExpanded);
                              }}
                              className="px-3 py-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium transition-colors"
                            >
                              {expandedTiebreakers.has(player.player_id) ? 'Hide' : 'View'} Tiebreaker
                            </button>
                          ) : shouldShowBids ? (
                            <button 
                              onClick={async () => {
                                const newExpanded = new Set(expandedBids);
                                if (newExpanded.has(player.player_id)) {
                                  newExpanded.delete(player.player_id);
                                  setExpandedBids(newExpanded);
                                } else {
                                  // Expand immediately for instant feedback
                                  newExpanded.add(player.player_id);
                                  setExpandedBids(newExpanded);
                                  
                                  // Fetch bids in background if not already loaded
                                  if (!playerBids.has(player.player_id) && !loadingBids.has(player.player_id)) {
                                    setLoadingBids(prev => new Set(prev).add(player.player_id));
                                    try {
                                      console.log(`[Bids] Fetching bids for player ${player.player_id}`);
                                      const response = await fetchWithTokenRefresh(`/api/rounds/${round.id}/players/${player.player_id}/bids`);
                                      const { success, data, error } = await response.json();
                                      console.log(`[Bids] Response:`, { success, data, error });
                                      if (success) {
                                        setPlayerBids(prev => {
                                          const newMap = new Map(prev);
                                          newMap.set(player.player_id, data);
                                          return newMap;
                                        });
                                      } else {
                                        console.error(`[Bids] Error:`, error);
                                      }
                                    } catch (err) {
                                      console.error('[Bids] Fetch error:', err);
                                    } finally {
                                      setLoadingBids(prev => {
                                        const newLoading = new Set(prev);
                                        newLoading.delete(player.player_id);
                                        return newLoading;
                                      });
                                    }
                                  }
                                }
                              }}
                              className="text-blue-600 hover:text-blue-700 text-sm font-medium hover:underline transition-colors"
                            >
                              {expandedBids.has(player.player_id) ? 'Hide' : 'View'} Bids
                            </button>
                          ) : (
                            <span className="text-gray-500 text-sm flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                              Hidden
                            </span>
                          )}
                        </td>
                        </tr>
                      {/* Expandable Bid Details */}
                      {!player.tiebreaker_id && expandedBids.has(player.player_id) && shouldShowBids && (
                        <tr>
                        <td colSpan={6} className="p-0">
                          <div className="bg-blue-50 border-t border-b border-blue-200 p-4">
                            <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                              <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                              </svg>
                              Bids for {player.player_name}
                            </h4>
                            
                            {loadingBids.has(player.player_id) ? (
                              <div className="text-center py-4">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                                <p className="mt-2 text-sm text-gray-500">Loading bids...</p>
                              </div>
                            ) : playerBids.has(player.player_id) ? (
                              <div className="space-y-2">
                                {playerBids.get(player.player_id)!.length > 0 ? (
                                  playerBids.get(player.player_id)!
                                    .sort((a: any, b: any) => b.amount - a.amount)
                                    .map((bid: any, idx: number) => (
                                      <div 
                                        key={bid.team_id}
                                        className={`flex items-center justify-between p-3 rounded-lg ${
                                          idx === 0 ? 'bg-green-100 border border-green-200' : 'bg-white border border-gray-200'
                                        }`}
                                      >
                                        <div className="flex items-center gap-3">
                                          {idx === 0 && (
                                            <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                            </svg>
                                          )}
                                          <div>
                                            <p className={`font-semibold ${
                                              idx === 0 ? 'text-green-900' : 'text-gray-800'
                                            }`}>
                                              {bid.team_name}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                              {new Date(bid.created_at).toLocaleString()}
                                            </p>
                                          </div>
                                        </div>
                                        <div className={`text-xl font-bold ${
                                          idx === 0 ? 'text-green-700' : 'text-gray-700'
                                        }`}>
                                          £{bid.amount}
                                        </div>
                                      </div>
                                    ))
                                ) : (
                                  <div className="text-center py-4 text-gray-500 text-sm">
                                    No bids placed yet
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-center py-4 text-gray-500 text-sm">
                                Failed to load bids
                              </div>
                            )}
                          </div>
                        </td>
                        </tr>
                      )}
                      {/* Expandable Tiebreaker Details */}
                      {player.tiebreaker_id && expandedTiebreakers.has(player.player_id) && player.tiebreaker && (
                        <tr>
                        <td colSpan={6} className="p-0">
                          <div className="bg-orange-50 border-t border-b border-orange-200 p-4">
                            <div className="mb-3 flex items-center justify-between">
                              <h4 className="font-semibold text-gray-800 flex items-center">
                                <svg className="w-5 h-5 mr-2 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                Live Tiebreaker Auction - {player.player_name}
                              </h4>
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  player.tiebreaker.status === 'active' ? 'bg-green-100 text-green-700' :
                                  player.tiebreaker.status === 'resolved' ? 'bg-blue-100 text-blue-700' :
                                  'bg-gray-100 text-gray-700'
                                }`}>
                                  {player.tiebreaker.status}
                                </span>
                                <Link
                                  href={`/dashboard/committee/bulk-rounds/${round.id}/tiebreakers`}
                                  className="px-3 py-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-xs font-medium"
                                >
                                  Manage
                                </Link>
                              </div>
                            </div>
                            
                            {/* Current Highest Bid */}
                            {player.tiebreaker.highest_bid && (
                              <div className="mb-3 p-3 bg-white rounded-lg border border-green-200">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm text-gray-600">Current Highest Bid</p>
                                    <p className="text-2xl font-bold text-green-600">£{player.tiebreaker.highest_bid}</p>
                                  </div>
                                  {player.tiebreaker.highest_bidder && (
                                    <div className="text-right">
                                      <p className="text-sm text-gray-600">Leading Team</p>
                                      <p className="font-semibold text-gray-800">{player.tiebreaker.highest_bidder}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            {/* Team Submissions */}
                            <div>
                              <h5 className="text-sm font-medium text-gray-700 mb-2">Team Bids ({player.tiebreaker.team_count} teams)</h5>
                              <div className="space-y-2">
                                {player.tiebreaker.submissions && player.tiebreaker.submissions.length > 0 ? (
                                  player.tiebreaker.submissions
                                    .sort((a, b) => b.new_bid_amount - a.new_bid_amount)
                                    .map((sub, idx) => (
                                      <div 
                                        key={sub.team_id}
                                        className={`flex items-center justify-between p-3 rounded-lg ${
                                          idx === 0 ? 'bg-green-100 border border-green-200' : 'bg-white border border-gray-200'
                                        }`}
                                      >
                                        <div className="flex items-center gap-3">
                                          {idx === 0 && (
                                            <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                            </svg>
                                          )}
                                          <div>
                                            <p className={`font-semibold ${
                                              idx === 0 ? 'text-green-900' : 'text-gray-800'
                                            }`}>
                                              {sub.team_name}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                              {new Date(sub.submitted).toLocaleTimeString()}
                                            </p>
                                          </div>
                                        </div>
                                        <div className={`text-xl font-bold ${
                                          idx === 0 ? 'text-green-700' : 'text-gray-700'
                                        }`}>
                                          £{sub.new_bid_amount}
                                        </div>
                                      </div>
                                    ))
                                ) : (
                                  <div className="text-center py-4 text-gray-500 text-sm">
                                    No bids submitted yet
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        </tr>
                      )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Tiebreakers Section - Show contested players that need tiebreakers (only after timer ends) */}
        {shouldShowBids && contested.length > 0 && (
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl sm:rounded-2xl p-4 sm:p-6 border-2 border-orange-300 shadow-md">
            <h2 className="text-lg sm:text-xl font-bold text-orange-900 mb-3 sm:mb-4 flex items-center">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>⚠️ {round.status === 'completed' ? 'Tiebreakers Required' : 'Pending Tiebreakers'}</span>
            </h2>
            <p className="text-sm sm:text-base text-orange-800 mb-3 sm:mb-4">
              {round.status === 'completed' 
                ? 'The following players have multiple bids and require a tiebreaker auction:'
                : 'These players currently have multiple bids at the base price. Tiebreakers will be created when the round ends:'}
            </p>
            <div className="space-y-2 sm:space-y-3">
              {contested.map((player) => (
                <div key={player.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 sm:p-4 bg-white rounded-lg shadow-sm border border-orange-200">
                  <div className="flex-1">
                    <p className="font-bold text-gray-900 text-base">{player.player_name}</p>
                    <p className="text-sm text-gray-600 mt-1">{player.position} • {player.bid_count} teams bidding</p>
                  </div>
                  <button 
                    onClick={() => handleCreateTiebreaker(player.player_id, player.player_name)}
                    className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-lg hover:from-orange-700 hover:to-orange-800 transition-all text-sm font-semibold shadow-md hover:shadow-lg"
                  >
                    🔥 Create Tiebreaker
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
