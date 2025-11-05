'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { adminDb } from '@/lib/firebase/admin-client';
import { extractIdNumberAsInt } from '@/lib/id-utils';
import Link from 'next/link';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';
import FinalizationProgress from '@/components/FinalizationProgress';
import { useModal } from '@/hooks/useModal';
import { MultiRoundAutoFinalize } from '@/components/MultiRoundAutoFinalize';
import AlertModal from '@/components/modals/AlertModal';
import ConfirmModal from '@/components/modals/ConfirmModal';
import { useWebSocket } from '@/hooks/useWebSocket';

interface Round {
  id: string;
  season_id: string;
  position: string;
  round_number?: number;
  round_type?: string;
  max_bids_per_team: number;
  status: string;
  end_time: string;
  created_at: string;
  updated_at: string;
  total_bids: number;
  teams_bid: number;
  start_time?: string;
  player_count?: number;
}

interface Tiebreaker {
  id: string;
  round_id: string;
  player_id: string;
  player_name: string;
  position: string;
  original_amount: number;
  status: string;
  teams_count: number;
  submitted_count: number;
  teams: any[];
}

export default function RoundsManagementPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [currentSeasonId, setCurrentSeasonId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [availablePositions, setAvailablePositions] = useState<string[]>([]);
  const [timeRemaining, setTimeRemaining] = useState<{[key: string]: number}>({});
  const [addTimeInputs, setAddTimeInputs] = useState<{[key: string]: string}>({});
  const [roundTiebreakers, setRoundTiebreakers] = useState<{[key: string]: Tiebreaker[]}>({});
  const [showFinalizationProgress, setShowFinalizationProgress] = useState(false);
  const [finalizingRoundId, setFinalizingRoundId] = useState<string | null>(null);
  const [expandedRounds, setExpandedRounds] = useState<Set<string>>(new Set());
  const [expandedPlayers, setExpandedPlayers] = useState<Set<string>>(new Set());
  const [roundDetails, setRoundDetails] = useState<{[key: string]: any}>({});
  const timerRefs = useRef<{[key: string]: NodeJS.Timeout}>({});
  const previousRoundsRef = useRef<string>('');

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

  // Form state
  const [formData, setFormData] = useState({
    position: '',
    duration_hours: '2',
    duration_minutes: '0',
    max_bids_per_team: '5',
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'committee_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  // Fetch all data in parallel
  const fetchAllData = useCallback(async () => {
    if (!user || user.role !== 'committee_admin') return;

    setIsLoading(true);
    
    try {
      // Fetch active season first (needed for other requests)
      const seasonsQuery = query(
        collection(db, 'seasons'),
        where('isActive', '==', true),
        limit(1)
      );
      const seasonsSnapshot = await getDocs(seasonsQuery);

      if (seasonsSnapshot.empty) {
        setIsLoading(false);
        return;
      }

      const seasonId = seasonsSnapshot.docs[0].id;
      setCurrentSeasonId(seasonId);

      // Fetch rounds, positions, and tiebreakers in parallel
      const roundsParams = new URLSearchParams({ season_id: seasonId });
      const [roundsResponse, playersResponse, tbResponse] = await Promise.all([
        fetchWithTokenRefresh(`/api/admin/rounds?${roundsParams}`),
        fetchWithTokenRefresh('/api/players?is_auction_eligible=true'),
        fetchWithTokenRefresh(`/api/admin/tiebreakers?seasonId=${seasonId}&status=active,pending`).catch(err => {
          console.error('Error fetching tiebreakers:', err);
          return null;
        })
      ]);

      // Process rounds
      const { success: roundsSuccess, data: roundsData } = await roundsResponse.json();
      if (roundsSuccess) {
        // Filter out bulk rounds - only show normal auction rounds
        const normalRounds = roundsData.filter((r: Round) => r.round_type !== 'bulk');
        const dataString = JSON.stringify(normalRounds);
        if (dataString !== previousRoundsRef.current) {
          previousRoundsRef.current = dataString;
          setRounds(normalRounds);
          
          // Initialize add time inputs for active rounds
          normalRounds.filter((r: Round) => r.status === 'active').forEach((r: Round) => {
            setAddTimeInputs(prev => ({ ...prev, [r.id]: prev[r.id] || '10' }));
          });
        }
      }

      // Process positions
      const { success: playersSuccess, data: playersData } = await playersResponse.json();
      if (playersSuccess && playersData.length > 0) {
        const positions = [...new Set(playersData.map((p: any) => p.position).filter(Boolean))] as string[];
        setAvailablePositions(positions.sort());
      }

      // Process tiebreakers
      if (tbResponse) {
        const tbData = await tbResponse.json();
        console.log('🔍 Tiebreaker response:', tbData);
        if (tbData.success && tbData.data?.tiebreakers) {
          const tiebreakersByRound: {[key: string]: Tiebreaker[]} = {};
          tbData.data.tiebreakers.forEach((tb: Tiebreaker) => {
            if (!tiebreakersByRound[tb.round_id]) {
              tiebreakersByRound[tb.round_id] = [];
            }
            tiebreakersByRound[tb.round_id].push(tb);
          });
          console.log('🔍 Tiebreakers by round:', tiebreakersByRound);
          // Only update if tiebreakers actually changed
          const tbString = JSON.stringify(tiebreakersByRound);
          setRoundTiebreakers(prev => {
            if (JSON.stringify(prev) !== tbString) {
              return tiebreakersByRound;
            }
            return prev;
          });
        }
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Fetch rounds only (for updates)
  const fetchRounds = useCallback(async (showLoader = true) => {
    if (!currentSeasonId) return;

    if (showLoader) setIsLoading(true);
    
    try {
      const params = new URLSearchParams({ season_id: currentSeasonId });
      
      // Fetch rounds and tiebreakers in parallel
      const [roundsResponse, tbResponse] = await Promise.all([
        fetchWithTokenRefresh(`/api/admin/rounds?${params}`),
        fetchWithTokenRefresh(`/api/admin/tiebreakers?seasonId=${currentSeasonId}&status=active,pending`).catch(err => {
          console.error('Error fetching tiebreakers:', err);
          return null;
        })
      ]);

      const { success, data } = await roundsResponse.json();
      if (success) {
        // Filter out bulk rounds - only show normal auction rounds
        const normalRounds = data.filter((r: Round) => r.round_type !== 'bulk');
        const dataString = JSON.stringify(normalRounds);
        if (dataString !== previousRoundsRef.current) {
          previousRoundsRef.current = dataString;
          setRounds(normalRounds);
          
          // Initialize add time inputs for active rounds
          normalRounds.filter((r: Round) => r.status === 'active').forEach((r: Round) => {
            setAddTimeInputs(prev => ({ ...prev, [r.id]: prev[r.id] || '10' }));
          });
        }
      }
      
      // Process tiebreakers
      if (tbResponse) {
        const tbData = await tbResponse.json();
        console.log('🔍 Tiebreaker response (fetchRounds):', tbData);
        if (tbData.success && tbData.data?.tiebreakers) {
          const tiebreakersByRound: {[key: string]: Tiebreaker[]} = {};
          tbData.data.tiebreakers.forEach((tb: Tiebreaker) => {
            if (!tiebreakersByRound[tb.round_id]) {
              tiebreakersByRound[tb.round_id] = [];
            }
            tiebreakersByRound[tb.round_id].push(tb);
          });
          console.log('🔍 Tiebreakers by round (fetchRounds):', tiebreakersByRound);
          // Only update if tiebreakers actually changed
          const tbString = JSON.stringify(tiebreakersByRound);
          setRoundTiebreakers(prev => {
            if (JSON.stringify(prev) !== tbString) {
              return tiebreakersByRound;
            }
            return prev;
          });
        }
      }
    } catch (err) {
      console.error('Error fetching rounds:', err);
    } finally {
      if (showLoader) setIsLoading(false);
    }
  }, [currentSeasonId]);

  // Initial fetch
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // WebSocket for real-time updates (no polling needed)
  useWebSocket({
    channel: `season:${currentSeasonId}`,
    enabled: !!currentSeasonId,
    onMessage: useCallback((message: any) => {
      console.log('🔴 Rounds WebSocket message:', message);
      
      // Handle different WebSocket message types
      switch (message.type) {
        case 'bid_placed':
        case 'bid_cancelled':
        case 'round_finalized':
        case 'round_updated':
        case 'round_status_changed':
        case 'round_created':
        case 'round_time_extended':
        case 'tiebreaker_created':
        case 'tiebreaker_updated':
          // Refetch rounds when there's an update
          console.log('🔄 Fetching rounds due to WebSocket update:', message.type);
          fetchRounds(false);
          break;
        default:
          console.log('🔵 Unhandled WebSocket message type:', message.type);
      }
    }, [fetchRounds]),
  });

  // Timer management for active rounds
  useEffect(() => {
    const activeRounds = rounds.filter(r => r.status === 'active');
    
    activeRounds.forEach(round => {
      if (round.end_time && !timerRefs.current[round.id]) {
        // Calculate and set initial time immediately
        const now = new Date().getTime();
        const end = new Date(round.end_time!).getTime();
        const remaining = Math.max(0, Math.floor((end - now) / 1000));
        setTimeRemaining(prev => ({ ...prev, [round.id]: remaining }));
        
        // Then start the interval
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
      if (!activeRounds.find(r => r.id === id)) {
        clearInterval(timerRefs.current[id]);
        delete timerRefs.current[id];
      }
    });

    return () => {
      Object.values(timerRefs.current).forEach(timer => clearInterval(timer));
    };
  }, [rounds]);

  const handleStartRound = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentSeasonId) {
      showAlert({
        type: 'error',
        title: 'No Active Season',
        message: 'No active season found'
      });
      return;
    }

    if (!formData.position) {
      showAlert({
        type: 'warning',
        title: 'Missing Position',
        message: 'Please select a position'
      });
      return;
    }

    // Get next round number
    const nextRoundNumber = rounds.length > 0 
      ? Math.max(...rounds.map(r => r.round_number ?? 0)) + 1 
      : 1;

    // Convert hours and minutes to seconds
    const totalHours = parseFloat(formData.duration_hours) + (parseFloat(formData.duration_minutes) / 60);
    const durationSeconds = Math.round(totalHours * 3600);

    try {
      const response = await fetchWithTokenRefresh('/api/admin/rounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          season_id: currentSeasonId,
          position: formData.position,
          max_bids_per_team: parseInt(formData.max_bids_per_team),
          duration_hours: (parseFloat(formData.duration_hours) + (parseFloat(formData.duration_minutes) / 60)).toString(),
        }),
      });

      const { success, error } = await response.json();

      if (success) {
        showAlert({
          type: 'success',
          title: 'Round Started',
          message: `Round for ${formData.position} started successfully!`
        });
        setFormData({
          position: '',
          duration_hours: '2',
          duration_minutes: '0',
          max_bids_per_team: '5',
        });
        
        // Refresh rounds
        const params = new URLSearchParams({ season_id: currentSeasonId });
        const refreshResponse = await fetchWithTokenRefresh(`/api/admin/rounds?${params}`);
        const refreshData = await refreshResponse.json();
        if (refreshData.success) {
          setRounds(refreshData.data);
        }
      } else {
        showAlert({
          type: 'error',
          title: 'Error',
          message: error || 'Failed to start round'
        });
      }
    } catch (err) {
      console.error('Error starting round:', err);
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Failed to start round'
      });
    }
  };

  const handleAddTime = async (roundId: string) => {
    const minutes = parseInt(addTimeInputs[roundId] || '10');
    
    if (minutes < 5) {
      showAlert({
        type: 'warning',
        title: 'Invalid Duration',
        message: 'Duration must be at least 5 minutes'
      });
      return;
    }

    try {
      const round = rounds.find(r => r.id === roundId);
      if (!round || !round.end_time) return;

      const currentEnd = new Date(round.end_time);
      const newEnd = new Date(currentEnd.getTime() + (minutes * 60 * 1000));

      const response = await fetchWithTokenRefresh(`/api/rounds/${roundId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          end_time: newEnd.toISOString(),
        }),
      });

      const { success } = await response.json();

      if (success) {
        showAlert({
          type: 'success',
          title: 'Time Added',
          message: `Added ${minutes} minute${minutes !== 1 ? 's' : ''} to the timer`
        });
        
        // Refresh rounds
        const params = new URLSearchParams({ season_id: currentSeasonId! });
        const refreshResponse = await fetchWithTokenRefresh(`/api/rounds?${params}`);
        const refreshData = await refreshResponse.json();
        if (refreshData.success) {
          setRounds(refreshData.data);
        }
      }
    } catch (err) {
      console.error('Error adding time:', err);
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Failed to add time'
      });
    }
  };


  const handleFinalizeRound = async (roundId: string) => {
    const confirmed = await showConfirm({
      type: 'warning',
      title: 'Finalize Round',
      message: 'Are you sure you want to finalize this round? This will allocate players based on bids. This cannot be undone.',
      confirmText: 'Finalize',
      cancelText: 'Cancel'
    });
    
    if (!confirmed) {
      return;
    }

    // Show progress modal and start finalization
    setFinalizingRoundId(roundId);
    setShowFinalizationProgress(true);
  };

  const handleFinalizationComplete = () => {
    setShowFinalizationProgress(false);
    setFinalizingRoundId(null);
    
    // Refresh rounds list
    if (currentSeasonId) {
      const params = new URLSearchParams({ season_id: currentSeasonId });
      fetchWithTokenRefresh(`/api/admin/rounds?${params}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setRounds(data.data);
          }
        });
    }
  };

  const handleFinalizationError = (error: string) => {
    console.error('Finalization error:', error);
    // Modal will show error state, user can close it
  };

  const handleResolveTiebreaker = async (tiebreakerId: string, roundId: string) => {
    const confirmed = await showConfirm({
      type: 'warning',
      title: 'Resolve Tiebreaker',
      message: 'This will resolve the tiebreaker and finalize the round if all tiebreakers are resolved. Continue?',
      confirmText: 'Resolve',
      cancelText: 'Cancel'
    });
    
    if (!confirmed) {
      return;
    }

    try {
      // Call the tiebreaker resolution API
      const response = await fetchWithTokenRefresh(`/api/tiebreakers/${tiebreakerId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolutionType: 'auto' }),
      });

      const result = await response.json();

      if (result.success) {
        showAlert({
          type: 'success',
          title: 'Tiebreaker Resolved',
          message: result.message || 'Tiebreaker resolved successfully'
        });
        
        // Refresh rounds to update tiebreaker status
        fetchRounds(false);
      } else {
        showAlert({
          type: 'error',
          title: 'Resolution Failed',
          message: result.error || 'Failed to resolve tiebreaker'
        });
      }
    } catch (err) {
      console.error('Error resolving tiebreaker:', err);
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Failed to resolve tiebreaker'
      });
    }
  };

  const toggleRound = async (roundId: string) => {
    const newExpanded = new Set(expandedRounds);
    if (newExpanded.has(roundId)) {
      newExpanded.delete(roundId);
    } else {
      newExpanded.add(roundId);
      // Fetch round details if not already loaded
      if (!roundDetails[roundId]) {
        try {
          const response = await fetchWithTokenRefresh(`/api/rounds/${roundId}`);
          const { success, data } = await response.json();
          if (success) {
            setRoundDetails(prev => ({ ...prev, [roundId]: data }));
          }
        } catch (err) {
          console.error('Error fetching round details:', err);
        }
      }
    }
    setExpandedRounds(newExpanded);
  };

  const togglePlayer = (playerKey: string) => {
    const newExpanded = new Set(expandedPlayers);
    if (newExpanded.has(playerKey)) {
      newExpanded.delete(playerKey);
    } else {
      newExpanded.add(playerKey);
    }
    setExpandedPlayers(newExpanded);
  };

  const organizeBidsByPlayer = (bids: any[]) => {
    const byPlayer: {[key: string]: any[]} = {};
    
    bids.forEach(bid => {
      if (!byPlayer[bid.player_id]) {
        byPlayer[bid.player_id] = [];
      }
      byPlayer[bid.player_id].push(bid);
    });
    
    // Sort bids within each player by amount (highest first)
    Object.keys(byPlayer).forEach(playerId => {
      byPlayer[playerId].sort((a, b) => b.amount - a.amount);
    });
    
    return byPlayer;
  };

  const handleDeleteRound = async (roundId: string) => {
    const confirmed = await showConfirm({
      type: 'danger',
      title: 'Delete Round',
      message: 'Are you sure you want to delete this round? This will release all players allocated in this round. This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel'
    });
    
    if (!confirmed) {
      return;
    }

    try {
      const response = await fetchWithTokenRefresh(`/api/rounds/${roundId}`, {
        method: 'DELETE',
      });

      const { success } = await response.json();

      if (success) {
        showAlert({
          type: 'success',
          title: 'Round Deleted',
          message: 'Round deleted successfully'
        });
        const params = new URLSearchParams({ season_id: currentSeasonId! });
        const refreshResponse = await fetchWithTokenRefresh(`/api/rounds?${params}`);
        const refreshData = await refreshResponse.json();
        if (refreshData.success) {
          setRounds(refreshData.data);
        }
      }
    } catch (err) {
      console.error('Error deleting round:', err);
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Failed to delete round'
      });
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const activeRounds = rounds.filter(r => r.status === 'active');
  const finalizingRounds = rounds.filter(r => r.status === 'tiebreaker_pending');
  const expiredRounds = rounds.filter(r => r.status === 'expired');
  const completedRounds = rounds.filter(r => r.status === 'completed');

  if (loading || !user || user.role !== 'committee_admin' || isLoading) {
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
    <div className="min-h-screen py-4 sm:py-8 px-4">
      {/* ✅ Auto-finalize all active rounds */}
      <MultiRoundAutoFinalize 
        rounds={rounds} 
        onFinalizationComplete={() => fetchRounds(false)}
      />
      
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="glass rounded-3xl p-4 sm:p-6 mb-4 backdrop-blur-md border border-white/20 shadow-xl">
          <div className="flex flex-col gap-4 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center">
                <Link
                  href="/dashboard/committee"
                  className="inline-flex items-center justify-center p-2 mr-3 rounded-xl bg-white/60 text-gray-700 hover:bg-white/80 transition-all duration-200 backdrop-blur-sm border border-gray-200/50 shadow-sm"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </Link>
                <div>
                  <h2 className="text-2xl font-bold gradient-text">Round Management</h2>
                  <p className="text-sm text-gray-600 mt-1">Create and manage auction rounds</p>
                </div>
              </div>
              
              <div className="flex items-center">
                <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-blue-100 text-blue-800 text-sm font-medium">
                  <span className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500 mr-1.5"></span>
                  <span>{activeRounds.length} Active</span>
                </span>
              </div>
            </div>
          </div>

          {/* Start New Round Form */}
          <div className="glass rounded-2xl p-4 sm:p-6 mb-6 border border-white/20 transform transition-all duration-300 hover:shadow-lg backdrop-blur-sm">
            <h2 className="text-lg sm:text-xl font-bold mb-4 gradient-text flex items-center">
              <svg className="w-5 h-5 mr-2 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Start New Round
            </h2>
            <form onSubmit={handleStartRound} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="position" className="block text-sm font-medium text-gray-700 mb-1.5">Position</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                      </svg>
                    </span>
                    <select
                      id="position"
                      value={formData.position}
                      onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                      required
                      className="pl-10 w-full py-3 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all duration-200 text-base shadow-sm"
                    >
                      <option value="">Select a position</option>
                      {availablePositions.map(position => (
                        <option key={position} value={position}>{position}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Duration</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </span>
                        <input
                          type="number"
                          id="duration_hours"
                          value={formData.duration_hours}
                          onChange={(e) => setFormData({ ...formData, duration_hours: e.target.value })}
                          min="0"
                          max="24"
                          required
                          className="pl-10 pr-12 w-full py-3 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all duration-200 text-base shadow-sm"
                        />
                        <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-sm text-gray-500 font-medium">
                          hrs
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="relative">
                        <input
                          type="number"
                          id="duration_minutes"
                          value={formData.duration_minutes}
                          onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })}
                          min="0"
                          max="59"
                          className="pr-12 w-full py-3 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all duration-200 text-base shadow-sm"
                        />
                        <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-sm text-gray-500 font-medium">
                          min
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Recommended: 2-3 hours</p>
                </div>
                
                <div>
                  <label htmlFor="max_bids" className="block text-sm font-medium text-gray-700 mb-1.5">Required Bids Per Team</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </span>
                    <input
                      type="number"
                      id="max_bids"
                      value={formData.max_bids_per_team}
                      onChange={(e) => setFormData({ ...formData, max_bids_per_team: e.target.value })}
                      min="1"
                      required
                      className="pl-10 w-full py-3 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all duration-200 text-base shadow-sm"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Teams must bid exactly this many players</p>
                </div>
              </div>
              
              <div className="flex justify-end mt-2">
                <button
                  type="submit"
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#0066FF] to-[#0052CC] text-white font-medium hover:from-[#0052CC] hover:to-[#0066FF] transform hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 shadow-md flex items-center"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Start Round
                </button>
              </div>
            </form>
          </div>

          {/* Active Rounds Section */}
          <div className="glass rounded-2xl p-4 sm:p-6 mb-6 border border-white/20 backdrop-blur-sm">
            <h2 className="text-lg sm:text-xl font-bold mb-4 gradient-text flex items-center">
              <svg className="w-5 h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Active Rounds
              {activeRounds.length > 0 && (
                <span className="ml-2 px-2.5 py-0.5 rounded-full bg-green-100 text-green-800 text-xs font-medium">
                  {activeRounds.length}
                </span>
              )}
            </h2>
            
            <div className="space-y-4">
              {activeRounds.length === 0 ? (
                <div className="text-center py-8 glass rounded-xl border border-gray-100/20 bg-white/5">
                  <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <h3 className="mt-2 text-lg font-medium text-gray-500">No active rounds</h3>
                  <p className="mt-1 text-gray-500">Start a new round using the form above</p>
                </div>
              ) : (
                activeRounds.map(round => (
                  <div
                    key={round.id}
                    className="glass rounded-xl p-4 sm:p-5 border border-green-200/30 hover:shadow-lg transition-all duration-300 backdrop-blur-sm relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 bg-green-500 text-white px-3 py-1 text-xs font-medium rounded-bl-lg">
                      Active
                    </div>
                    
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div className="flex items-center">
                          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mr-3">
                            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                            </svg>
                          </div>
                          <h3 className="text-base sm:text-lg font-semibold">
                            {round.position} Round #{extractIdNumberAsInt(round.id)}
                          </h3>
                        </div>
                        <div className="text-sm font-medium px-4 py-2 rounded-xl bg-white/80 backdrop-blur-sm shadow-sm flex items-center">
                          <svg className="w-4 h-4 mr-2 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="font-mono">{formatTime(timeRemaining[round.id] || 0)}</span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="glass rounded-xl p-3 backdrop-blur-sm flex items-center gap-4">
                          <div className="relative flex-1 max-w-[120px]">
                            <input
                              type="number"
                              value={addTimeInputs[round.id] || '10'}
                              onChange={(e) => setAddTimeInputs({ ...addTimeInputs, [round.id]: e.target.value })}
                              min="5"
                              className="w-full py-2.5 px-3 rounded-xl bg-white border border-gray-200 focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none text-base shadow-sm"
                            />
                            <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-500">min</span>
                          </div>
                          <button
                            onClick={() => handleAddTime(round.id)}
                            className="bg-[#0066FF]/90 text-white px-4 py-2.5 rounded-xl hover:bg-[#0066FF] transition-all duration-200 text-sm whitespace-nowrap flex items-center justify-center"
                          >
                            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            Add Time
                          </button>
                        </div>
                        
                        <button
                          onClick={() => handleFinalizeRound(round.id)}
                          className="bg-green-500 text-white px-4 py-3 rounded-xl hover:bg-green-600 transition-all duration-200 font-medium flex items-center justify-center"
                        >
                          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                          </svg>
                          Finalize Round
                        </button>
                      </div>
                      
                      {/* Tiebreakers Section - Show when round has tiebreakers */}
                      {roundTiebreakers[round.id] && roundTiebreakers[round.id].length > 0 && (
                        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                          <div className="flex items-center mb-3">
                            <svg className="w-5 h-5 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <h4 className="font-semibold text-yellow-800">Active Tiebreakers ({roundTiebreakers[round.id].length})</h4>
                          </div>
                          
                          <div className="space-y-2">
                            {roundTiebreakers[round.id].map((tb: Tiebreaker) => (
                              <div key={tb.id} className="bg-white p-3 rounded-lg border border-yellow-300">
                                <div className="flex justify-between items-start gap-3">
                                  <div className="flex-1">
                                    <p className="font-medium text-gray-900">{tb.player_name}</p>
                                    <p className="text-sm text-gray-600">{tb.position} - £{tb.original_amount.toLocaleString()}</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                      {tb.submitted_count}/{tb.teams_count} teams submitted
                                    </p>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleResolveTiebreaker(tb.id, round.id)}
                                      disabled={tb.submitted_count < tb.teams_count}
                                      className={`px-3 py-1.5 text-white text-sm rounded-lg transition-colors flex items-center ${
                                        tb.submitted_count < tb.teams_count
                                          ? 'bg-gray-400 cursor-not-allowed'
                                          : 'bg-green-600 hover:bg-green-700'
                                      }`}
                                      title={tb.submitted_count < tb.teams_count ? 'Waiting for all teams to submit' : 'Resolve tiebreaker'}
                                    >
                                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                      </svg>
                                      Resolve
                                    </button>
                                    <Link 
                                      href="/dashboard/committee/tiebreakers"
                                      className="px-3 py-1.5 bg-yellow-600 text-white text-sm rounded-lg hover:bg-yellow-700 transition-colors flex items-center"
                                    >
                                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                      </svg>
                                      View
                                    </Link>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                          
                          <div className="mt-3 flex items-start gap-2 text-xs text-yellow-700 bg-yellow-100/50 p-2 rounded-lg">
                            <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>Tiebreakers have no time limit. Teams can submit bids when ready. Resolve tiebreakers before finalizing the round.</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Finalizing Rounds Section (rounds with tiebreakers) */}
          {finalizingRounds.length > 0 && (
            <div className="glass rounded-2xl p-4 sm:p-6 mb-6 border border-yellow-200/30 backdrop-blur-sm">
              <h2 className="text-lg sm:text-xl font-bold mb-4 gradient-text flex items-center">
                <svg className="w-5 h-5 mr-2 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Finalizing Rounds (Tiebreakers Pending)
                <span className="ml-2 px-2.5 py-0.5 rounded-full bg-yellow-100 text-yellow-800 text-xs font-medium">
                  {finalizingRounds.length}
                </span>
              </h2>
              
              <div className="space-y-4">
                {finalizingRounds.map(round => {
                  console.log(`🔍 Rendering finalizing round ${round.id}, tiebreakers:`, roundTiebreakers[round.id]);
                  return (
                  <div
                    key={round.id}
                    className="glass rounded-xl p-4 sm:p-5 border border-yellow-200/30 hover:shadow-lg transition-all duration-300 backdrop-blur-sm"
                  >
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div className="flex items-center">
                          <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0 mr-3">
                            <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                          </div>
                          <h3 className="text-base sm:text-lg font-semibold">
                            {round.position} Round #{extractIdNumberAsInt(round.id)}
                          </h3>
                        </div>
                        <span className="px-3 py-1 rounded-full bg-yellow-100 text-yellow-800 text-xs font-medium">
                          Resolving Tiebreakers
                        </span>
                      </div>
                      
                      {/* Tiebreakers */}
                      {roundTiebreakers[round.id] && roundTiebreakers[round.id].length > 0 && (
                        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                          <div className="flex items-center mb-3">
                            <h4 className="font-semibold text-yellow-800">Tiebreakers ({roundTiebreakers[round.id].length})</h4>
                          </div>
                          <div className="space-y-2">
                            {roundTiebreakers[round.id].map((tb: Tiebreaker) => (
                              <div key={tb.id} className="bg-white p-3 rounded-lg border border-yellow-300">
                                <div className="flex justify-between items-start gap-3">
                                  <div className="flex-1">
                                    <p className="font-medium text-gray-900">{tb.player_name}</p>
                                    <p className="text-sm text-gray-600">{tb.position} - £{tb.original_amount.toLocaleString()}</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                      {tb.submitted_count}/{tb.teams_count} teams submitted
                                    </p>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleResolveTiebreaker(tb.id, round.id)}
                                      disabled={tb.submitted_count < tb.teams_count}
                                      className={`px-3 py-1.5 text-white text-sm rounded-lg transition-colors flex items-center ${
                                        tb.submitted_count < tb.teams_count
                                          ? 'bg-gray-400 cursor-not-allowed'
                                          : 'bg-green-600 hover:bg-green-700'
                                      }`}
                                    >
                                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                      </svg>
                                      Resolve
                                    </button>
                                    <Link 
                                      href="/dashboard/committee/tiebreakers"
                                      className="px-3 py-1.5 bg-yellow-600 text-white text-sm rounded-lg hover:bg-yellow-700 transition-colors flex items-center"
                                    >
                                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                      </svg>
                                      View
                                    </Link>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Expired Rounds Section (rounds that failed finalization) */}
          {expiredRounds.length > 0 && (
            <div className="glass rounded-2xl p-4 sm:p-6 mb-6 border border-orange-200/30 backdrop-blur-sm">
              <h2 className="text-lg sm:text-xl font-bold mb-4 gradient-text flex items-center">
                <svg className="w-5 h-5 mr-2 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Expired Rounds (Needs Manual Finalization)
                <span className="ml-2 px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-800 text-xs font-medium">
                  {expiredRounds.length}
                </span>
              </h2>
              
              <div className="space-y-4">
                {expiredRounds.map(round => (
                  <div
                    key={round.id}
                    className="glass rounded-xl p-4 sm:p-5 border border-orange-200/30 hover:shadow-lg transition-all duration-300 backdrop-blur-sm"
                  >
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div className="flex items-center">
                          <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 mr-3">
                            <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <h3 className="text-base sm:text-lg font-semibold">
                            {round.position} Round #{extractIdNumberAsInt(round.id)}
                          </h3>
                        </div>
                        <span className="px-3 py-1 rounded-full bg-orange-100 text-orange-800 text-xs font-medium">
                          Expired
                        </span>
                      </div>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleFinalizeRound(round.id)}
                          className="bg-green-500 text-white px-4 py-2 rounded-xl hover:bg-green-600 transition-all duration-200 text-sm flex items-center"
                        >
                          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                          </svg>
                          Finalize Round
                        </button>
                        <button
                          onClick={() => handleDeleteRound(round.id)}
                          className="bg-red-500/10 text-red-500 px-4 py-2 rounded-xl hover:bg-red-500/20 transition-all duration-200 text-sm flex items-center"
                        >
                          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completed Rounds Section */}
          <div className="glass rounded-2xl p-4 sm:p-6 border border-white/20 backdrop-blur-sm">
            <h2 className="text-lg sm:text-xl font-bold mb-4 gradient-text flex items-center">
              <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              Completed Rounds
              {completedRounds.length > 0 && (
                <span className="ml-2 px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-medium">
                  {completedRounds.length}
                </span>
              )}
            </h2>
            
            <div className="space-y-4">
              {completedRounds.length === 0 ? (
                <div className="text-center py-8 glass rounded-xl bg-white/10 backdrop-blur-sm border border-gray-100/20">
                  <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  <h3 className="mt-2 text-lg font-medium text-gray-500">No completed rounds yet</h3>
                  <p className="mt-1 text-gray-500">Past rounds will appear here once they're finalized</p>
                </div>
              ) : (
                completedRounds.map(round => (
                  <div
                    key={round.id}
                    className="glass rounded-xl p-4 sm:p-5 border border-blue-100/30 transform transition-all duration-300 hover:shadow-lg backdrop-blur-sm"
                  >
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div className="flex items-center">
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mr-3">
                            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                            </svg>
                          </div>
                          <div>
                            <h3 className="text-base sm:text-lg font-semibold">
                              {round.position} Round #{extractIdNumberAsInt(round.id)}
                            </h3>
                            <p className="text-xs text-gray-500 mt-1">
                              {round.created_at && new Date(round.created_at).toLocaleString('en-US', { 
                                year: 'numeric', 
                                month: '2-digit', 
                                day: '2-digit', 
                                hour: '2-digit', 
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className="text-xs text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg flex items-center">
                            <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            {round.total_bids || 0} bids from {round.teams_bid || 0} teams
                          </span>
                          <span className="text-xs text-[#0066FF] bg-[#0066FF]/10 px-3 py-1.5 rounded-lg flex items-center">
                            <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {round.status.charAt(0).toUpperCase() + round.status.slice(1)}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap justify-end gap-2 mt-1">
                        <Link
                          href={`/dashboard/committee/rounds/${round.id}`}
                          className="inline-flex items-center px-4 py-2.5 rounded-xl bg-[#0066FF]/10 text-[#0066FF] hover:bg-[#0066FF]/20 transition-colors text-sm shadow-sm"
                        >
                          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          View Details
                        </Link>
                        <button
                          onClick={() => handleDeleteRound(round.id)}
                          className="inline-flex items-center px-4 py-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors text-sm shadow-sm"
                        >
                          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Round Finalization Details Section - NEW */}
          {completedRounds.length > 0 && (
            <div className="glass rounded-2xl p-4 sm:p-6 mt-6 border border-white/20 backdrop-blur-sm">
              <h2 className="text-lg sm:text-xl font-bold mb-4 gradient-text flex items-center">
                <svg className="w-5 h-5 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
                Round Finalization Details
              </h2>
              
              <div className="space-y-3">
                {completedRounds.map(round => {
                  const isRoundExpanded = expandedRounds.has(round.id);
                  const details = roundDetails[round.id];
                  const bidsByPlayer = details?.bids ? organizeBidsByPlayer(details.bids) : {};
                  
                  return (
                    <div key={round.id} className="glass rounded-xl border border-gray-200/30 overflow-hidden">
                      {/* Round Header */}
                      <button
                        onClick={() => toggleRound(round.id)}
                        className="w-full p-4 flex items-center justify-between hover:bg-white/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <svg 
                            className={`w-5 h-5 text-gray-600 transition-transform ${
                              isRoundExpanded ? 'rotate-90' : ''
                            }`}
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                          </svg>
                          <span className="font-semibold text-gray-900">
                            {round.position} Round #{extractIdNumberAsInt(round.id)}
                          </span>
                          {details && (
                            <span className="text-sm text-gray-500">
                              ({Object.keys(bidsByPlayer).length} players)
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(round.created_at).toLocaleDateString()}
                        </span>
                      </button>

                      {/* Round Content - Players List */}
                      {isRoundExpanded && details && (
                        <div className="border-t border-gray-200/30 bg-white/20">
                          {Object.keys(bidsByPlayer).length === 0 ? (
                            <div className="p-4 text-center text-gray-500">
                              <p>No bids found for this round</p>
                            </div>
                          ) : (
                            <div className="divide-y divide-gray-200/30">
                              {Object.entries(bidsByPlayer).map(([playerId, playerBids]: [string, any]) => {
                                const playerKey = `${round.id}_${playerId}`;
                                const isPlayerExpanded = expandedPlayers.has(playerKey);
                                const firstBid = playerBids[0];
                                const wonBid = playerBids.find((b: any) => b.status === 'won');
                                
                                return (
                                  <div key={playerKey}>
                                    {/* Player Header */}
                                    <button
                                      onClick={() => togglePlayer(playerKey)}
                                      className="w-full p-3 pl-8 flex items-center justify-between hover:bg-white/40 transition-colors"
                                    >
                                      <div className="flex items-center gap-3">
                                        <svg 
                                          className={`w-4 h-4 text-gray-500 transition-transform ${
                                            isPlayerExpanded ? 'rotate-90' : ''
                                          }`}
                                          fill="none" 
                                          stroke="currentColor" 
                                          viewBox="0 0 24 24"
                                        >
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                        </svg>
                                        <span className="font-medium text-gray-900">
                                          {firstBid.player_name}
                                        </span>
                                        <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                                          {firstBid.position}
                                        </span>
                                        {wonBid && (
                                          <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800">
                                            Won by {wonBid.team_name}
                                          </span>
                                        )}
                                      </div>
                                      <span className="text-sm text-gray-600">
                                        {playerBids.length} bid{playerBids.length > 1 ? 's' : ''}
                                      </span>
                                    </button>

                                    {/* Player Bids - Sorted List */}
                                    {isPlayerExpanded && (
                                      <div className="bg-gray-50/50 px-4 py-3">
                                        <div className="space-y-2">
                                          {playerBids.map((bid: any, index: number) => (
                                            <div 
                                              key={bid.id}
                                              className={`flex items-center justify-between p-3 rounded-lg border ${
                                                bid.status === 'won'
                                                  ? 'bg-green-50 border-green-300'
                                                  : 'bg-white border-gray-200'
                                              }`}
                                            >
                                              <div className="flex items-center gap-3">
                                                <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                                                  bid.status === 'won'
                                                    ? 'bg-green-500 text-white'
                                                    : 'bg-gray-200 text-gray-600'
                                                }`}>
                                                  {index + 1}
                                                </span>
                                                <div>
                                                  <div className="font-medium text-gray-900">
                                                    {bid.team_name}
                                                  </div>
                                                  <div className="text-xs text-gray-500">
                                                    {new Date(bid.created_at).toLocaleString()}
                                                  </div>
                                                </div>
                                              </div>
                                              <div className="flex items-center gap-3">
                                                <span className={`font-bold text-lg ${
                                                  bid.status === 'won'
                                                    ? 'text-green-600'
                                                    : 'text-gray-600'
                                                }`}>
                                                  £{bid.amount.toLocaleString()}
                                                </span>
                                                {bid.status === 'won' && (
                                                  <span className="flex items-center gap-1 text-xs font-semibold text-green-600">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                    WON
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                        
                                        {/* Summary */}
                                        <div className="mt-3 p-2 bg-blue-50 rounded-lg border border-blue-200">
                                          <div className="text-xs text-blue-800">
                                            <strong>Highest Bid:</strong> £{playerBids[0].amount.toLocaleString()} by {playerBids[0].team_name}
                                            {wonBid && wonBid.id === playerBids[0].id && ' ✓ Won'}
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Finalization Progress Modal */}
      {showFinalizationProgress && finalizingRoundId && (
        <FinalizationProgress
          roundId={finalizingRoundId}
          onComplete={handleFinalizationComplete}
          onError={handleFinalizationError}
        />
      )}

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
