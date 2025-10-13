'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

interface Round {
  id: number;
  season_id: string;
  round_number: number;
  position?: string;
  position_group?: string;
  status: string;
  round_type: string;
  base_price: number;
  start_time?: string;
  end_time?: string;
  duration_seconds: number;
  player_count: number;
  sold_count: number;
  created_at: string;
}

export default function RoundsManagementPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [currentSeasonId, setCurrentSeasonId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [availablePositions, setAvailablePositions] = useState<string[]>([]);
  const [timeRemaining, setTimeRemaining] = useState<{[key: number]: number}>({});
  const timerRefs = useRef<{[key: number]: NodeJS.Timeout}>({});

  // Form state
  const [formData, setFormData] = useState({
    position: '',
    duration_hours: '2',
    max_bids_per_team: '5',
  });
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'committee_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  // Fetch current season and available positions
  useEffect(() => {
    const fetchCurrentSeason = async () => {
      if (!user || user.role !== 'committee_admin') return;

      try {
        const seasonsQuery = query(
          collection(db, 'seasons'),
          where('is_active', '==', true),
          limit(1)
        );
        const seasonsSnapshot = await getDocs(seasonsQuery);

        if (!seasonsSnapshot.empty) {
          const seasonId = seasonsSnapshot.docs[0].id;
          setCurrentSeasonId(seasonId);
        }

        // Fetch available positions from auction eligible players
        const playersResponse = await fetch('/api/players?is_auction_eligible=true');
        const { success, data } = await playersResponse.json();
        if (success && data.length > 0) {
          const positions = [...new Set(data.map((p: any) => p.position).filter(Boolean))];
          setAvailablePositions(positions.sort());
        }
      } catch (err) {
        console.error('Error fetching season:', err);
      }
    };

    fetchCurrentSeason();
  }, [user]);

  // Fetch rounds
  useEffect(() => {
    const fetchRounds = async () => {
      if (!currentSeasonId) return;

      setIsLoading(true);
      try {
        const params = new URLSearchParams({ season_id: currentSeasonId });
        const response = await fetch(`/api/rounds?${params}`);
        const { success, data } = await response.json();

        if (success) {
          setRounds(data);
        }
      } catch (err) {
        console.error('Error fetching rounds:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRounds();

    // Set up auto-refresh every 10 seconds
    const interval = setInterval(fetchRounds, 10000);
    return () => clearInterval(interval);
  }, [currentSeasonId]);
  }, [currentSeasonId, filterStatus, filterRoundType]);

  // Timer management for active rounds
  useEffect(() => {
    const activeRounds = rounds.filter(r => r.status === 'active');
    
    activeRounds.forEach(round => {
      if (round.end_time && !timerRefs.current[round.id]) {
        timerRefs.current[round.id] = setInterval(() => {
          const now = new Date().getTime();
          const end = new Date(round.end_time!).getTime();
          const remaining = Math.max(0, Math.floor((end - now) / 1000));
          
          setTimeRemaining(prev => ({ ...prev, [round.id]: remaining }));
          
          if (remaining <= 0) {
            clearInterval(timerRefs.current[round.id]);
            delete timerRefs.current[round.id];
          }
        }, 1000);
      }
    });

    // Cleanup timers for inactive rounds
    Object.keys(timerRefs.current).forEach(id => {
      const roundId = parseInt(id);
      if (!activeRounds.find(r => r.id === roundId)) {
        clearInterval(timerRefs.current[roundId]);
        delete timerRefs.current[roundId];
      }
    });

    return () => {
      Object.values(timerRefs.current).forEach(timer => clearInterval(timer));
    };
  }, [rounds]);

  const handleStartRound = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentSeasonId) {
      alert('No active season found');
      return;
    }

    if (!formData.position) {
      alert('Please select a position');
      return;
    }

    // Get next round number
    const nextRoundNumber = rounds.length > 0 
      ? Math.max(...rounds.map(r => r.round_number)) + 1 
      : 1;

    // Convert hours to seconds
    const durationSeconds = Math.round(parseFloat(formData.duration_hours) * 3600);

    try {
      const response = await fetch('/api/rounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          season_id: currentSeasonId,
          round_number: nextRoundNumber,
          position: formData.position,
          round_type: 'normal',
          base_price: 10,
          duration_seconds: durationSeconds,
        }),
      });

      const { success, data, error } = await response.json();

      if (success) {
        alert(`Round for ${formData.position} started successfully!`);
        setFormData({
          position: '',
          duration_hours: '2',
          max_bids_per_team: '5',
        });
        // Refresh rounds
        const params = new URLSearchParams({ season_id: currentSeasonId });
        const refreshResponse = await fetch(`/api/rounds?${params}`);
        const refreshData = await refreshResponse.json();
        if (refreshData.success) {
          setRounds(refreshData.data);
        }
      } else {
        alert(`Error: ${error}`);
      }
    } catch (err) {
      console.error('Error creating round:', err);
      alert('Failed to start round');
    }
  };

  const handleAddTime = async (roundId: number, minutes: number) => {
    if (minutes < 5) {
      alert('Duration must be at least 5 minutes');
      return;
    }

    try {
      const response = await fetch(`/api/rounds/${roundId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          add_time_seconds: minutes * 60,
        }),
      });

      const { success } = await response.json();

      if (success) {
        alert(`Added ${minutes} minute${minutes !== 1 ? 's' : ''} to the timer`);
        // Refresh rounds
        const params = new URLSearchParams({ season_id: currentSeasonId! });
        const refreshResponse = await fetch(`/api/rounds?${params}`);
        const refreshData = await refreshResponse.json();
        if (refreshData.success) {
          setRounds(refreshData.data);
        }
      }
    } catch (err) {
      console.error('Error adding time:', err);
      alert('Failed to add time');
    }
  };

  const handleFinalizeRound = async (roundId: number) => {
    if (!confirm('Are you sure you want to finalize this round? This cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/rounds/${roundId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      });

      const { success } = await response.json();

      if (success) {
        alert('Round finalized successfully');
        const params = new URLSearchParams({ season_id: currentSeasonId! });
        const refreshResponse = await fetch(`/api/rounds?${params}`);
        const refreshData = await refreshResponse.json();
        if (refreshData.success) {
          setRounds(refreshData.data);
        }
      }
    } catch (err) {
      console.error('Error finalizing round:', err);
      alert('Failed to finalize round');
    }
  };

  const handleDeleteRound = async (roundId: number) => {
    if (!confirm('Are you sure you want to delete this round? This will release all players allocated in this round. This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/rounds/${roundId}`, {
        method: 'DELETE',
      });

      const { success } = await response.json();

      if (success) {
        alert('Round deleted successfully');
        const params = new URLSearchParams({ season_id: currentSeasonId! });
        const refreshResponse = await fetch(`/api/rounds?${params}`);
        const refreshData = await refreshResponse.json();
        if (refreshData.success) {
          setRounds(refreshData.data);
        }
      }
    } catch (err) {
      console.error('Error deleting round:', err);
      alert('Failed to delete round');
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-700';
      case 'scheduled': return 'bg-blue-100 text-blue-700';
      case 'active': return 'bg-green-100 text-green-700';
      case 'completed': return 'bg-purple-100 text-purple-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'normal': return 'bg-blue-50 text-blue-600';
      case 'bulk': return 'bg-orange-50 text-orange-600';
      case 'tiebreaker': return 'bg-red-50 text-red-600';
      default: return 'bg-gray-50 text-gray-600';
    }
  };

  const activeRounds = rounds.filter(r => r.status === 'active');
  const completedRounds = rounds.filter(r => r.status === 'completed');

  if (loading || !user || user.role !== 'committee_admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Link
              href="/dashboard/committee"
              className="text-gray-500 hover:text-[#0066FF] transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <h1 className="text-3xl md:text-4xl font-bold gradient-text">Auction Rounds</h1>
          </div>
          <p className="text-gray-600">Manage auction rounds and bidding sessions</p>
        </div>

        {/* Round Type Tabs */}
        <div className="glass rounded-2xl p-4 mb-6 border border-white/20">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-gray-700 mr-2">Round Type:</span>
              {[
                { value: 'all', label: 'All Rounds', icon: '📋' },
                { value: 'normal', label: 'Normal', icon: '🎯' },
                { value: 'bulk', label: 'Bulk Bidding', icon: '⚡' },
                { value: 'tiebreaker', label: 'Tiebreaker', icon: '🔀' }
              ].map((type) => (
                <button
                  key={type.value}
                  onClick={() => setFilterRoundType(type.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    filterRoundType === type.value
                      ? 'bg-[#0066FF] text-white shadow-md'
                      : 'bg-white/50 text-gray-700 hover:bg-white/80'
                  }`}
                >
                  <span className="mr-1.5">{type.icon}</span>
                  {type.label}
                </button>
              ))}
            </div>
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-4 border-t border-gray-200">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-gray-700">Status:</span>
                {['all', 'draft', 'scheduled', 'active', 'completed'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      filterStatus === status
                        ? 'bg-[#0066FF] text-white'
                        : 'bg-white/50 text-gray-700 hover:bg-white/80'
                    }`}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="inline-flex items-center px-4 py-2 bg-[#0066FF] text-white rounded-lg hover:bg-[#0052CC] transition-colors font-medium"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Create Round
              </button>
            </div>
          </div>
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <div className="glass rounded-2xl p-6 mb-6 border border-white/20">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Create New Round</h2>
            <form onSubmit={handleCreateRound} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Round Number *</label>
                <input
                  type="number"
                  required
                  value={formData.round_number}
                  onChange={(e) => setFormData({ ...formData, round_number: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0066FF] focus:border-[#0066FF]"
                  placeholder="e.g., 1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Round Type *</label>
                <select
                  value={formData.round_type}
                  onChange={(e) => setFormData({ ...formData, round_type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0066FF] focus:border-[#0066FF]"
                >
                  <option value="normal">🎯 Normal Round</option>
                  <option value="bulk">⚡ Bulk Bidding Round</option>
                  <option value="tiebreaker">🔀 Tiebreaker Round</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {formData.round_type === 'normal' && 'Standard auction round with sequential player bidding'}
                  {formData.round_type === 'bulk' && 'Teams bid on multiple players simultaneously at fixed price'}
                  {formData.round_type === 'tiebreaker' && 'Resolves conflicts when multiple teams bid for same player'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Position (Optional)</label>
                <input
                  type="text"
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0066FF] focus:border-[#0066FF]"
                  placeholder="e.g., CB, DMF"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Position Group (Optional)</label>
                <select
                  value={formData.position_group}
                  onChange={(e) => setFormData({ ...formData, position_group: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0066FF] focus:border-[#0066FF]"
                >
                  <option value="">None</option>
                  <option value="GK">GK - Goalkeeper</option>
                  <option value="DEF">DEF - Defender</option>
                  <option value="MID">MID - Midfielder</option>
                  <option value="FWD">FWD - Forward</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Base Price (£)</label>
                <input
                  type="number"
                  required
                  value={formData.base_price}
                  onChange={(e) => setFormData({ ...formData, base_price: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0066FF] focus:border-[#0066FF]"
                  min="1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration (seconds)</label>
                <input
                  type="number"
                  required
                  value={formData.duration_seconds}
                  onChange={(e) => setFormData({ ...formData, duration_seconds: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0066FF] focus:border-[#0066FF]"
                  min="60"
                />
              </div>

              <div className="md:col-span-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-[#0066FF] text-white rounded-lg hover:bg-[#0052CC] transition-colors font-medium"
                >
                  Create Round
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Rounds List */}
        <div className="glass rounded-2xl p-6 border border-white/20">
          <h2 className="text-xl font-bold text-gray-800 mb-4">All Rounds</h2>

          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading rounds...</p>
            </div>
          ) : rounds.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-xl font-medium text-gray-600 mb-2">No rounds found</h3>
              <p className="text-gray-500">Create your first auction round to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rounds.map((round) => (
                <Link
                  key={round.id}
                  href={`/dashboard/committee/rounds/${round.id}`}
                  className="block glass p-4 rounded-xl border border-white/10 hover:border-[#0066FF]/30 transition-all hover:shadow-lg"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-gray-800">Round {round.round_number}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(round.status)}`}>
                          {round.status}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(round.round_type)}`}>
                          {round.round_type}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                        {round.position && (
                          <span className="flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {round.position}
                          </span>
                        )}
                        <span className="flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          £{round.base_price}
                        </span>
                        <span className="flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                          {round.player_count} players
                        </span>
                        {round.sold_count > 0 && (
                          <span className="flex items-center text-green-600">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {round.sold_count} sold
                          </span>
                        )}
                      </div>
                    </div>
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
