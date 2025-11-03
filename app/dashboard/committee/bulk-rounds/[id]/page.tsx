'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, use, useCallback } from 'react';
import Link from 'next/link';
import { useWebSocket } from '@/hooks/useWebSocket';

interface BulkBid {
  player_id: string;
  player_name: string;
  team_id: string;
  team_name: string;
  position: string;
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
  const [availablePlayers, setAvailablePlayers] = useState<any[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());

  // Enable WebSocket for real-time updates with custom message handler
  const { isConnected } = useWebSocket({
    channel: `round:${resolvedParams.id}`,
    enabled: true,
    onMessage: useCallback((message: any) => {
      console.log('[Committee Page] WebSocket message:', message);
      
      // Handle different message types
      switch (message.type) {
        case 'round_updated':
          // Update round metadata (timer, status, etc.) without full refresh
          if (message.data) {
            setRound(prev => prev ? {
              ...prev,
              status: message.data.status || prev.status,
              start_time: message.data.start_time || prev.start_time,
              end_time: message.data.end_time || prev.end_time,
              duration_seconds: message.data.duration_seconds || prev.duration_seconds,
            } : null);
          }
          break;
          
        case 'bid_added':
        case 'bid_removed':
          // Update player bid counts in real-time
          if (message.data?.player_id) {
            setRound(prev => {
              if (!prev?.roundPlayers) return prev;
              return {
                ...prev,
                roundPlayers: prev.roundPlayers.map(player => 
                  player.player_id === message.data.player_id
                    ? { ...player, bid_count: message.data.bid_count || player.bid_count }
                    : player
                ),
              };
            });
          }
          break;
          
        case 'player_status_updated':
          // Update player status (sold, contested, etc.)
          if (message.data?.player_id) {
            setRound(prev => {
              if (!prev?.roundPlayers) return prev;
              return {
                ...prev,
                roundPlayers: prev.roundPlayers.map(player => 
                  player.player_id === message.data.player_id
                    ? {
                        ...player,
                        status: message.data.status || player.status,
                        winning_team_id: message.data.winning_team_id || player.winning_team_id,
                        winning_bid: message.data.winning_bid || player.winning_bid,
                        bid_count: message.data.bid_count ?? player.bid_count,
                      }
                    : player
                ),
              };
            });
          }
          break;
      }
      
      setLastUpdate(Date.now());
    }, []),
  });

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
      const response = await fetch(`/api/rounds/${resolvedParams.id}`);
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

  useEffect(() => {
    if (resolvedParams.id) {
      fetchRound();
    }
  }, [resolvedParams.id]);


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
        const response = await fetch('/api/players?is_auction_eligible=true');
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
        // Refresh Firebase token before making the request
        if (firebaseUser) {
          const idToken = await firebaseUser.getIdToken(true);
          await fetch('/api/auth/set-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: idToken }),
          });
          console.log('✅ Token refreshed before starting round');
        }
        
        const response = await fetch(`/api/admin/bulk-rounds/${round.id}/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        const { success, data, error } = await response.json();

        if (success) {
          alert(data.message || 'Round started successfully!');
          // Refresh round data
          const refreshResponse = await fetch(`/api/rounds/${round.id}`);
          const refreshData = await refreshResponse.json();
          if (refreshData.success) {
            setRound(refreshData.data);
          }
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
        const response = await fetch(`/api/admin/bulk-rounds/${round.id}/finalize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        const { success, data, error } = await response.json();

        if (success) {
          alert(data.message || 'Round completed successfully!');
          // Refresh round data
          const refreshResponse = await fetch(`/api/rounds/${round.id}`);
          const refreshData = await refreshResponse.json();
          if (refreshData.success) {
            setRound(refreshData.data);
          }
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
      const response = await fetch(`/api/rounds/${round.id}`, {
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
      const response = await fetch(`/api/admin/bulk-rounds/${round.id}/create-tiebreaker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: playerId }),
      });

      const { success, data, error } = await response.json();

      if (success) {
        alert(data.message || 'Tiebreaker created successfully!');
        // Refresh round data
        await fetchRound();
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
      const response = await fetch(`/api/rounds/${round.id}`, {
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
      contested: round.roundPlayers.filter(p => p.bid_count && p.bid_count > 1),
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

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Link
              href="/dashboard/committee/bulk-rounds"
              className="text-gray-500 hover:text-[#0066FF] transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <h1 className="text-3xl md:text-4xl font-bold gradient-text flex items-center">
              <svg className="w-8 h-8 mr-3 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Bulk Round {round.round_number}
            </h1>
            <span className={`px-3 py-1.5 rounded-full text-sm font-medium border ${getStatusColor(round.status)}`}>
              {round.status}
            </span>
          </div>
          <p className="text-gray-600">Manage bulk bidding round where teams bid on multiple players</p>
        </div>

        {/* Active Round Timer */}
        {round.status === 'active' && timeRemaining !== null && (
          <div className="glass rounded-2xl p-6 mb-6 border-2 border-green-300 bg-green-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-green-500 text-white">
                  <svg className="w-6 h-6 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-green-900">Round Active</h3>
                  <p className="text-green-700">Teams are currently placing bids</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-green-900 font-mono">
                  {formatTime(timeRemaining)}
                </div>
                <div className="text-sm text-green-700">Time Remaining</div>
              </div>
            </div>
          </div>
        )}

        {/* Round Info */}
        <div className="glass rounded-2xl p-6 mb-6 border border-white/20">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Round Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Base Price</label>
              <p className="text-lg font-semibold text-gray-800">£{round.base_price}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Duration</label>
              <p className="text-lg font-semibold text-gray-800">{round.duration_seconds}s</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Total Players</label>
              <p className="text-lg font-semibold text-gray-800">{round.roundPlayers?.length || 0}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Sold</label>
              <p className="text-lg font-semibold text-green-600">{sold.length}</p>
            </div>
          </div>

          {/* Status Controls */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <label className="block text-sm font-medium text-gray-600 mb-3">Round Controls</label>
            <div className="flex flex-wrap gap-2">
              {round.status === 'draft' && (
                <>
                  <button
                    onClick={() => handleUpdateStatus('active')}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium"
                  >
                    Start Round Now
                  </button>
                  <button
                    onClick={handleDeleteRound}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium ml-auto"
                  >
                    Delete Round
                  </button>
                </>
              )}
              {round.status === 'active' && (
                <button
                  onClick={() => handleUpdateStatus('completed')}
                  className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors font-medium"
                >
                  Complete Round
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="glass rounded-2xl p-6 border border-white/20">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-gray-800">Pending</h3>
              <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                {pending.length}
              </span>
            </div>
            <p className="text-sm text-gray-600">Players awaiting bids</p>
          </div>

          <div className="glass rounded-2xl p-6 border border-green-200 bg-green-50">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-green-800">Sold</h3>
              <span className="px-3 py-1 bg-green-200 text-green-800 rounded-full text-sm font-medium">
                {sold.length}
              </span>
            </div>
            <p className="text-sm text-green-700">Successfully assigned</p>
          </div>

          <div className="glass rounded-2xl p-6 border border-orange-200 bg-orange-50">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-orange-800">Contested</h3>
              <span className="px-3 py-1 bg-orange-200 text-orange-800 rounded-full text-sm font-medium">
                {contested.length}
              </span>
            </div>
            <p className="text-sm text-orange-700">Need tiebreaker auction</p>
          </div>
        </div>

        {/* Players Section */}
        <div className="glass rounded-2xl p-6 border border-white/20 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-800">Round Players</h2>
            {round.status === 'draft' && (
              <button
                onClick={() => setShowAddPlayers(!showAddPlayers)}
                className="inline-flex items-center px-4 py-2 bg-[#0066FF] text-white rounded-lg hover:bg-[#0052CC] transition-colors font-medium"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <h3 className="text-xl font-medium text-gray-600 mb-2">No players assigned</h3>
              <p className="text-gray-500">Add players to this bulk round to begin bidding</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Player Name</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Position</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Base Price</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Bids</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {round.roundPlayers?.map((player) => (
                    <tr key={player.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium text-gray-800">{player.player_name}</td>
                      <td className="py-3 px-4 text-gray-600">{player.position}</td>
                      <td className="py-3 px-4 text-gray-600">£{player.base_price}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          (player.bid_count || 0) > 1 ? 'bg-orange-100 text-orange-700' :
                          (player.bid_count || 0) === 1 ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {player.bid_count || 0} {(player.bid_count || 0) === 1 ? 'bid' : 'bids'}
                        </span>
                      </td>
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
                        <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                          View Bids
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Tiebreakers Section */}
        {contested.length > 0 && (
          <div className="glass rounded-2xl p-6 border-2 border-orange-300 bg-orange-50">
            <h2 className="text-xl font-bold text-orange-900 mb-4 flex items-center">
              <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Tiebreakers Required
            </h2>
            <p className="text-orange-800 mb-4">The following players have multiple bids and require a tiebreaker auction:</p>
            <div className="space-y-2">
              {contested.map((player) => (
                <div key={player.id} className="flex items-center justify-between p-3 bg-white rounded-lg">
                  <div>
                    <p className="font-semibold text-gray-800">{player.player_name}</p>
                    <p className="text-sm text-gray-600">{player.position} • {player.bid_count} teams bidding</p>
                  </div>
                  <button 
                    onClick={() => handleCreateTiebreaker(player.player_id, player.player_name)}
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
                  >
                    Create Tiebreaker
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
