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
  max_bids_per_team: number;
  status: string;
  end_time: string;
  created_at: string;
  updated_at: string;
  total_bids: number;
  teams_bid: number;
  start_time?: string;
  player_count?: number;
  finalization_mode?: string;
  has_pending_allocations?: boolean;
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
  const [roundSubmissions, setRoundSubmissions] = useState<{[key: string]: any}>({});
  const [loadingSubmissions, setLoadingSubmissions] = useState<{[key: string]: boolean}>({});
  const [auctionSettings, setAuctionSettings] = useState<any[]>([]);
  const [selectedAuctionSettingsId, setSelectedAuctionSettingsId] = useState<string>('');
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
    finalization_mode: 'auto',
  });
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);

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

      // Fetch auction settings for this season
      try {
        const settingsResponse = await fetchWithTokenRefresh(
          `/api/auction-settings/all?season_id=${seasonId}`
        );
        const settingsData = await settingsResponse.json();
        if (settingsData.success && settingsData.data) {
          setAuctionSettings(settingsData.data);
          // Auto-select first setting if none selected
          if (!selectedAuctionSettingsId && settingsData.data.length > 0) {
            setSelectedAuctionSettingsId(String(settingsData.data[0].id));
          }
        }
      } catch (err) {
        console.error('Error fetching auction settings:', err);
      }

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
        const dataString = JSON.stringify(roundsData);
        if (dataString !== previousRoundsRef.current) {
          previousRoundsRef.current = dataString;
          setRounds(roundsData);
          
          // Initialize add time inputs for active rounds
          const activeRounds = roundsData.filter((r: Round) => r.status === 'active');
          activeRounds.forEach((r: Round) => {
            setAddTimeInputs(prev => ({ ...prev, [r.id]: prev[r.id] || '10' }));
          });

        // Fetch submission status for active rounds
        console.log('🔍 [fetchRounds] Found active rounds:', activeRounds.length);
        
        // Set loading state for each active round
        const loadingMap: {[key: string]: boolean} = {};
        activeRounds.forEach(r => { loadingMap[r.id] = true; });
        setLoadingSubmissions(prev => ({ ...prev, ...loadingMap }));
        
        // Use Promise.all to wait for all submissions to be fetched
        const submissionPromises = activeRounds.map(async (r: Round) => {
          try {
            console.log(`🔍 [fetchRounds] Fetching submissions for round ${r.id}`);
            const subResponse = await fetchWithTokenRefresh(`/api/admin/rounds/${r.id}/submissions`);
            const subData = await subResponse.json();
            console.log(`🔍 [fetchRounds] Submissions response for round ${r.id}:`, subData);
            if (subData.success) {
              console.log(`✅ [fetchRounds] Setting submissions for round ${r.id}:`, subData);
              return { roundId: r.id, data: subData };
            } else {
              console.error(`❌ [fetchRounds] Failed to fetch submissions for round ${r.id}:`, subData.error);
              return null;
            }
          } catch (err) {
            console.error(`❌ [fetchRounds] Error fetching submissions for round ${r.id}:`, err);
            return null;
          }
        });
        
        const submissionResults = await Promise.all(submissionPromises);
        const submissionsMap: {[key: string]: any} = {};
        submissionResults.forEach(result => {
          if (result) {
            submissionsMap[result.roundId] = {
              ...result.data.stats,
              teams: result.data.teams
            };
          }
        });
        console.log('📦 [fetchRounds] All submissions fetched:', submissionsMap);
        setRoundSubmissions(prev => ({ ...prev, ...submissionsMap }));
        
        // Clear loading state
        const clearedLoadingMap: {[key: string]: boolean} = {};
        activeRounds.forEach(r => { clearedLoadingMap[r.id] = false; });
        setLoadingSubmissions(prev => ({ ...prev, ...clearedLoadingMap }));
        }
      }

      // Process positions and position groups
      const { success: playersSuccess, data: playersData } = await playersResponse.json();
      if (playersSuccess && playersData.length > 0) {
        // Get all unique positions
        const allPositions = [...new Set(playersData.map((p: any) => p.position).filter(Boolean))] as string[];
        
        // Get positions that have been divided into groups
        const positionGroups = [...new Set(
          playersData
            .map((p: any) => p.position_group)
            .filter(Boolean)
        )] as string[];
        
        // Create map of which positions have groups
        const positionsWithGroups = new Set(
          positionGroups.map(pg => pg.split('-')[0]) // Extract position from "CB-1" -> "CB"
        );
        
        console.log('📊 [Positions] All positions:', allPositions);
        console.log('📊 [Positions] Position groups found:', positionGroups);
        console.log('📊 [Positions] Positions with groups:', Array.from(positionsWithGroups));
        
        // Build final list: use groups if they exist, otherwise use base position
        const finalPositions: string[] = [];
        
        allPositions.forEach(pos => {
          if (positionsWithGroups.has(pos)) {
            // Position has been divided - add all its groups
            const groups = positionGroups.filter(pg => pg.startsWith(`${pos}-`));
            finalPositions.push(...groups);
          } else {
            // Position not divided - add as-is
            finalPositions.push(pos);
          }
        });
        
        console.log('📊 [Positions] Final dropdown options:', finalPositions);
        setAvailablePositions(finalPositions.sort());
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
        const dataString = JSON.stringify(data);
        if (dataString !== previousRoundsRef.current) {
          previousRoundsRef.current = dataString;
          setRounds(data);
          
          // Initialize add time inputs for active rounds
          data.filter((r: Round) => r.status === 'active').forEach((r: Round) => {
            setAddTimeInputs(prev => ({ ...prev, [r.id]: prev[r.id] || '10' }));
          });
        }

        // Fetch submission status for active rounds
        const activeRounds = data.filter((r: Round) => r.status === 'active');
        console.log('🔍 [fetchAllData] Found active rounds:', activeRounds.length);
        
        // Set loading state for each active round
        const loadingMap: {[key: string]: boolean} = {};
        activeRounds.forEach(r => { loadingMap[r.id] = true; });
        setLoadingSubmissions(loadingMap);
        
        // Use Promise.all to wait for all submissions to be fetched
        const submissionPromises = activeRounds.map(async (r: Round) => {
          try {
            console.log(`🔍 [fetchAllData] Fetching submissions for round ${r.id}`);
            const subResponse = await fetchWithTokenRefresh(`/api/admin/rounds/${r.id}/submissions`);
            const subData = await subResponse.json();
            console.log(`🔍 [fetchAllData] Submissions response for round ${r.id}:`, subData);
            if (subData.success) {
              console.log(`✅ [fetchAllData] Setting submissions for round ${r.id}:`, subData);
              return { roundId: r.id, data: subData };
            } else {
              console.error(`❌ [fetchAllData] Failed to fetch submissions for round ${r.id}:`, subData.error);
              return null;
            }
          } catch (err) {
            console.error(`❌ [fetchAllData] Error fetching submissions for round ${r.id}:`, err);
            return null;
          }
        });
        
        const submissionResults = await Promise.all(submissionPromises);
        const submissionsMap: {[key: string]: any} = {};
        submissionResults.forEach(result => {
          if (result) {
            submissionsMap[result.roundId] = {
              ...result.data.stats,
              teams: result.data.teams
            };
          }
        });
        console.log('📦 [fetchAllData] All submissions fetched:', submissionsMap);
        setRoundSubmissions(submissionsMap);
        
        // Clear loading state
        const clearedLoadingMap: {[key: string]: boolean} = {};
        activeRounds.forEach(r => { clearedLoadingMap[r.id] = false; });
        setLoadingSubmissions(clearedLoadingMap);
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

  // Realtime listener for submission updates
  useEffect(() => {
    if (!currentSeasonId || rounds.length === 0) return;

    const activeRounds = rounds.filter(r => r.status === 'active');
    if (activeRounds.length === 0) {
      console.log('🔌 [Realtime] No active rounds found');
      return;
    }

    console.log('🔌 [Realtime] Setting up listeners for', activeRounds.length, 'active rounds:', activeRounds.map(r => r.id));
    console.log('🔌 [Realtime] Season ID:', currentSeasonId);

    // Import Firebase Realtime DB
    const { ref, onValue } = require('firebase/database');
    const { realtimeDb } = require('@/lib/firebase/config');

    if (!realtimeDb) {
      console.error('❌ [Realtime] Firebase Realtime Database not initialized!');
      return;
    }

    const unsubscribers: (() => void)[] = [];

    // Listen to each active round for submission updates
    activeRounds.forEach(round => {
      const path = `updates/${currentSeasonId}/rounds/${round.id}`;
      console.log('🔌 [Realtime] Listening to path:', path);
      
      const roundRef = ref(realtimeDb, path);
      
      const unsubscribe = onValue(
        roundRef,
        (snapshot) => {
          const data = snapshot.val();
          console.log('📡 [Realtime] Data received for round', round.id, ':', data);
          
          if (data && data.type === 'submission') {
            console.log('📊 [Realtime] ✅ Submission update detected!', {
              round: round.id,
              action: data.action,
              team: data.team_id,
              timestamp: data.timestamp
            });
            
            // Refetch submissions for this round
            console.log('🔄 [Realtime] Refetching submissions for round:', round.id);
            fetchWithTokenRefresh(`/api/admin/rounds/${round.id}/submissions`)
              .then(res => res.json())
              .then(subData => {
                if (subData.success) {
                  console.log('✅ [Realtime] Updated submissions for round:', round.id, subData.stats);
                  setRoundSubmissions(prev => {
                    const updated = {
                      ...prev,
                      [round.id]: {
                        ...subData.stats,
                        teams: subData.teams
                      }
                    };
                    console.log('📊 [Realtime] New submission state:', updated);
                    return updated;
                  });
                } else {
                  console.error('❌ [Realtime] API returned error:', subData.error);
                }
              })
              .catch(err => console.error('❌ [Realtime] Failed to fetch submissions:', err));
          } else if (data) {
            console.log('ℹ️ [Realtime] Received data but type is not "submission":', data.type);
          } else {
            console.log('ℹ️ [Realtime] Received null/empty data for round:', round.id);
          }
        },
        (error) => {
          console.error('❌ [Realtime] Error listening to round', round.id, ':', error);
        }
      );

      unsubscribers.push(unsubscribe);
    });

    return () => {
      console.log('🔌 [Realtime] Disconnecting', unsubscribers.length, 'submission listeners');
      unsubscribers.forEach(unsub => unsub());
    };
  }, [currentSeasonId, rounds]);

  // Debug: Monitor roundSubmissions state changes
  useEffect(() => {
    console.log('📦 [State] roundSubmissions updated:', roundSubmissions);
  }, [roundSubmissions]);

  // ⚡ Comprehensive Firebase Realtime Database listeners for instant updates
  useEffect(() => {
    if (!currentSeasonId) return;

    const { listenToSeasonRoundUpdates, listenToSquadUpdates, listenToWalletUpdates } = require('@/lib/realtime/listeners');
    
    console.log('🔴 [Committee Rounds] Setting up Firebase listeners for season:', currentSeasonId);
    
    // Listen to round updates (started, finalized, status changes, bids submitted)
    const unsubRounds = listenToSeasonRoundUpdates(currentSeasonId, (message: any) => {
      console.log('🔴 [Committee Rounds] Round update:', message.type, message);
      
      if (message.type === 'bid_submitted') {
        // When a team submits bids, refetch submissions for that specific round immediately
        console.log('🔍 [Firebase] Bid submitted for round:', message.data?.round_id);
        if (message.data?.round_id) {
          const roundId = message.data.round_id;
          setLoadingSubmissions(prev => ({ ...prev, [roundId]: true }));
          
          fetchWithTokenRefresh(`/api/admin/rounds/${roundId}/submissions`)
            .then(res => res.json())
            .then(subData => {
              if (subData.success) {
                console.log('✅ [Firebase] Updated submissions for round:', roundId);
                setRoundSubmissions(prev => ({
                  ...prev,
                  [roundId]: {
                    ...subData.stats,
                    teams: subData.teams
                  }
                }));
              }
              setLoadingSubmissions(prev => ({ ...prev, [roundId]: false }));
            })
            .catch(err => {
              console.error('❌ [Firebase] Error fetching submissions:', err);
              setLoadingSubmissions(prev => ({ ...prev, [roundId]: false }));
            });
        }
      } else if (
        message.type === 'round_finalized' ||
        message.type === 'round_started' ||
        message.type === 'round_updated' ||
        message.type === 'round_status_changed'
      ) {
        // For round status changes, refetch all rounds data immediately
        console.log('🔄 [Firebase] Refetching all rounds due to:', message.type);
        fetchRounds(false);
      }
    });

    // Listen to squad updates (player allocations during finalization)
    const unsubSquads = listenToSquadUpdates(currentSeasonId, (event: any) => {
      console.log('📦 [Committee Rounds] Squad update:', event);
      // Refetch rounds to update bid counts and team stats
      fetchRounds(false);
    });

    // Listen to wallet updates (balance changes during bidding/finalization)
    const unsubWallets = listenToWalletUpdates(currentSeasonId, (event: any) => {
      console.log('💰 [Committee Rounds] Wallet update:', event);
      // Wallet changes might affect submission status
      fetchRounds(false);
    });

    return () => {
      console.log('🔴 [Committee Rounds] Cleaning up Firebase listeners');
      unsubRounds();
      unsubSquads();
      unsubWallets();
    };
  }, [currentSeasonId, fetchRounds]);

  // Timer management for active rounds - optimized with requestAnimationFrame
  useEffect(() => {
    const activeRounds = rounds.filter(r => r.status === 'active');
    
    if (activeRounds.length === 0) return;

    let animationFrameId: number;
    let lastUpdate = Date.now();

    const updateTimers = () => {
      const now = Date.now();
      
      // Only update every second to reduce re-renders
      if (now - lastUpdate >= 1000) {
        lastUpdate = now;
        
        const newTimeRemaining: {[key: string]: number} = {};
        let hasActiveTimers = false;

        activeRounds.forEach(round => {
          if (round.end_time) {
            const end = new Date(round.end_time).getTime();
            const remaining = Math.max(0, Math.floor((end - now) / 1000));
            newTimeRemaining[round.id] = remaining;
            if (remaining > 0) hasActiveTimers = true;
          }
        });

        setTimeRemaining(newTimeRemaining);
        
        // Continue animation loop only if there are active timers
        if (hasActiveTimers) {
          animationFrameId = requestAnimationFrame(updateTimers);
        }
      } else {
        animationFrameId = requestAnimationFrame(updateTimers);
      }
    };

    // Start the animation loop
    animationFrameId = requestAnimationFrame(updateTimers);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
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

    if (selectedPositions.length === 0) {
      showAlert({
        type: 'warning',
        title: 'Missing Position',
        message: 'Please select at least one position'
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

    // Combine selected positions with comma separator
    const combinedPosition = selectedPositions.join(',');

    // Validate auction settings selected
    if (!selectedAuctionSettingsId) {
      showAlert({
        type: 'warning',
        title: 'Missing Settings',
        message: 'Please select auction settings'
      });
      return;
    }

    try {
      const response = await fetchWithTokenRefresh('/api/admin/rounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auction_settings_id: parseInt(selectedAuctionSettingsId),
          position: combinedPosition,
          max_bids_per_team: parseInt(formData.max_bids_per_team),
          duration_hours: (parseFloat(formData.duration_hours) + (parseFloat(formData.duration_minutes) / 60)).toString(),
          finalization_mode: formData.finalization_mode,
        }),
      });

      const { success, error } = await response.json();

      if (success) {
        showAlert({
          type: 'success',
          title: 'Round Started',
          message: `Round for ${selectedPositions.join(' + ')} started successfully!`
        });
        setFormData({
          position: '',
          duration_hours: '2',
          duration_minutes: '0',
          max_bids_per_team: '5',
          finalization_mode: 'auto',
        });
        setSelectedPositions([]);
        
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

  const handlePreviewFinalization = async (roundId: string) => {
    try {
      const response = await fetchWithTokenRefresh(`/api/admin/rounds/${roundId}/preview-finalization`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await response.json();

      if (result.success) {
        showAlert({
          type: 'success',
          title: 'Preview Created',
          message: `Preview finalization created successfully. ${result.data?.allocations?.length || 0} players allocated.`
        });
        
        // Refresh rounds to update status
        fetchRounds(false);
      } else if (result.tieDetected) {
        showAlert({
          type: 'warning',
          title: 'Tiebreaker Detected',
          message: 'A tiebreaker was detected and must be resolved before finalization can proceed.'
        });
        
        // Refresh to show tiebreaker
        fetchRounds(false);
      } else {
        showAlert({
          type: 'error',
          title: 'Preview Failed',
          message: result.error || 'Failed to create preview'
        });
      }
    } catch (err) {
      console.error('Error previewing finalization:', err);
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Failed to preview finalization'
      });
    }
  };

  const handleFinalizeImmediately = async (roundId: string) => {
    const confirmed = await showConfirm({
      type: 'warning',
      title: 'Finalize Immediately',
      message: 'This will skip the preview and finalize the round immediately. Results will be published to teams right away. Continue?',
      confirmText: 'Finalize Now',
      cancelText: 'Cancel'
    });
    
    if (!confirmed) {
      return;
    }

    // Use the existing finalization flow
    setFinalizingRoundId(roundId);
    setShowFinalizationProgress(true);
  };

  const handleViewPendingResults = async (roundId: string) => {
    try {
      const response = await fetchWithTokenRefresh(`/api/admin/rounds/${roundId}/pending-allocations`);
      const result = await response.json();

      if (result.success && result.data) {
        // TODO: Open PendingAllocationsModal with the data
        // For now, show an alert with summary
        showAlert({
          type: 'info',
          title: 'Pending Results',
          message: `${result.data.allocations?.length || 0} players allocated. Total spent: £${result.data.summary?.total_spent?.toLocaleString() || 0}. Modal component coming soon.`
        });
      } else {
        showAlert({
          type: 'error',
          title: 'Error',
          message: result.error || 'Failed to fetch pending results'
        });
      }
    } catch (err) {
      console.error('Error fetching pending results:', err);
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Failed to fetch pending results'
      });
    }
  };

  const handleApplyPendingAllocations = async (roundId: string) => {
    const confirmed = await showConfirm({
      type: 'warning',
      title: 'Finalize for Real',
      message: 'This will apply the pending allocations and publish results to all teams. This action cannot be undone. Continue?',
      confirmText: 'Finalize for Real',
      cancelText: 'Cancel'
    });
    
    if (!confirmed) {
      return;
    }

    try {
      const response = await fetchWithTokenRefresh(`/api/admin/rounds/${roundId}/apply-pending-allocations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await response.json();

      if (result.success) {
        showAlert({
          type: 'success',
          title: 'Round Finalized',
          message: 'Pending allocations applied successfully. Results are now visible to teams.'
        });
        
        // Refresh rounds to update status
        fetchRounds(false);
      } else {
        showAlert({
          type: 'error',
          title: 'Finalization Failed',
          message: result.error || 'Failed to apply pending allocations'
        });
      }
    } catch (err) {
      console.error('Error applying pending allocations:', err);
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Failed to apply pending allocations'
      });
    }
  };

  const handleCancelPending = async (roundId: string) => {
    const confirmed = await showConfirm({
      type: 'warning',
      title: 'Cancel Pending Results',
      message: 'This will delete the pending allocations. You can preview finalization again afterwards. Continue?',
      confirmText: 'Cancel Pending',
      cancelText: 'Keep Pending'
    });
    
    if (!confirmed) {
      return;
    }

    try {
      const response = await fetchWithTokenRefresh(`/api/admin/rounds/${roundId}/pending-allocations`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        showAlert({
          type: 'success',
          title: 'Pending Results Canceled',
          message: 'Pending allocations have been deleted. You can preview finalization again.'
        });
        
        // Refresh rounds to update status
        fetchRounds(false);
      } else {
        showAlert({
          type: 'error',
          title: 'Cancellation Failed',
          message: result.error || 'Failed to cancel pending allocations'
        });
      }
    } catch (err) {
      console.error('Error canceling pending allocations:', err);
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Failed to cancel pending allocations'
      });
    }
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
                  <label htmlFor="position" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Position(s)
                    <span className="ml-2 text-xs text-gray-500">(Select multiple for combined rounds)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute top-3 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                      </svg>
                    </span>
                    <div className="pl-10 min-h-[48px] w-full py-2 bg-white/60 border border-gray-200 rounded-xl focus-within:ring-2 focus-within:ring-[#0066FF]/30 focus-within:border-[#0066FF] transition-all duration-200 shadow-sm">
                      {/* Selected positions */}
                      {selectedPositions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 px-2 mb-2">
                          {selectedPositions.map(pos => (
                            <span key={pos} className="inline-flex items-center px-2 py-1 rounded-lg bg-blue-100 text-blue-800 text-sm font-medium">
                              {pos}
                              <button
                                type="button"
                                onClick={() => setSelectedPositions(prev => prev.filter(p => p !== pos))}
                                className="ml-1.5 text-blue-600 hover:text-blue-800"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      {/* Dropdown */}
                      <select
                        id="position"
                        value=""
                        onChange={(e) => {
                          if (e.target.value && !selectedPositions.includes(e.target.value)) {
                            setSelectedPositions(prev => [...prev, e.target.value]);
                          }
                        }}
                        className="w-full px-2 py-1 bg-transparent border-none focus:ring-0 outline-none text-base"
                      >
                        <option value="">+ Add position</option>
                        {availablePositions
                          .filter(pos => !selectedPositions.includes(pos))
                          .map(position => (
                            <option key={position} value={position}>{position}</option>
                          ))
                        }
                      </select>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Select one position for regular rounds, or multiple for combined rounds (e.g., LB + LWF)</p>
                </div>
              </div>

              {/* Auction Settings Selector */}
              <div className="mt-4">
                <label htmlFor="auction_settings" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Auction Settings
                  <span className="ml-2 text-xs text-gray-500">(Window Type)</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </span>
                  <select
                    id="auction_settings"
                    value={selectedAuctionSettingsId}
                    onChange={(e) => setSelectedAuctionSettingsId(e.target.value)}
                    required
                    className="pl-10 w-full py-3 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all duration-200 text-base shadow-sm"
                  >
                    <option value="">Select auction settings...</option>
                    {auctionSettings.map(setting => {
                      const windowLabel = setting.auction_window
                        .split('_')
                        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ');
                      return (
                        <option key={setting.id} value={setting.id}>
                          {windowLabel} (Max {setting.max_rounds} rounds, {setting.max_squad_size} players)
                        </option>
                      );
                    })}
                  </select>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Choose settings based on auction type. 
                  {auctionSettings.length === 0 && (
                    <Link href="/dashboard/committee/auction-settings" className="text-blue-600 hover:text-blue-800 ml-1">
                      Create settings first →
                    </Link>
                  )}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
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

              {/* Finalization Mode Selector */}
              <div className="mt-4">
                <label htmlFor="finalization_mode" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Finalization Mode
                  <span className="ml-2 text-xs text-gray-500">(How results are published)</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </span>
                  <select
                    id="finalization_mode"
                    value={formData.finalization_mode}
                    onChange={(e) => setFormData({ ...formData, finalization_mode: e.target.value })}
                    className="pl-10 w-full py-3 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all duration-200 text-base shadow-sm"
                  >
                    <option value="auto">Auto-Finalize (when timer ends)</option>
                    <option value="manual">Manual Finalization (preview first)</option>
                  </select>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {formData.finalization_mode === 'auto' 
                    ? 'Round will automatically finalize when timer expires' 
                    : 'Round will wait for committee approval before publishing results'}
                </p>
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
                          <div>
                            <h3 className="text-base sm:text-lg font-semibold">
                              {round.position} Round #{round.round_number || extractIdNumberAsInt(round.id)}
                            </h3>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {(() => {
                                // Determine phase based on round number and auction settings
                                const settings = auctionSettings.find(s => String(s.id) === String(selectedAuctionSettingsId));
                                if (!settings || !round.round_number) return null;
                                
                                let phase = 'Phase 3';
                                let phaseColor = 'bg-purple-100 text-purple-700';
                                
                                if (round.round_number <= settings.phase_1_end_round) {
                                  phase = 'Phase 1';
                                  phaseColor = 'bg-blue-100 text-blue-700';
                                } else if (round.round_number <= settings.phase_2_end_round) {
                                  phase = 'Phase 2';
                                  phaseColor = 'bg-orange-100 text-orange-700';
                                }
                                
                                return (
                                  <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold ${phaseColor}`}>
                                    {phase}
                                  </span>
                                );
                              })()}
                              {round.finalization_mode === 'manual' && (
                                <span className="inline-block px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-100 text-amber-700 flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                  Manual Finalization
                                </span>
                              )}
                            </div>
                          </div>
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
                      
                      {/* Submission Status */}
                      {console.log(`🔍 [Render] Round ${round.id} submission data:`, roundSubmissions[round.id])}
                      {loadingSubmissions[round.id] ? (
                        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-5 h-5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
                            <div>
                              <h4 className="font-semibold text-blue-800">Loading Team Submissions...</h4>
                              <p className="text-sm text-blue-600">Fetching submission status</p>
                            </div>
                          </div>
                          <div className="space-y-2">
                            {[1, 2, 3].map((i) => (
                              <div key={i} className="h-12 bg-white/60 rounded-lg animate-pulse" />
                            ))}
                          </div>
                        </div>
                      ) : roundSubmissions[round.id] && (
                        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                          <div className="flex items-center gap-3 mb-4">
                            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div>
                              <h4 className="font-semibold text-blue-800">Team Submissions</h4>
                              <p className="text-sm text-blue-600">
                                {roundSubmissions[round.id].submitted} of {roundSubmissions[round.id].total_teams} teams submitted ({roundSubmissions[round.id].submission_rate}%)
                              </p>
                            </div>
                          </div>

                          {/* Mobile-optimized: Card view for small screens */}
                          <div className="block lg:hidden space-y-2">
                            {roundSubmissions[round.id].teams?.map((team: any, idx: number) => (
                              <div
                                key={team.team_id || idx}
                                className={`flex items-center justify-between p-3 rounded-lg border ${
                                  team.has_submitted
                                    ? 'bg-green-50 border-green-200'
                                    : 'bg-orange-50 border-orange-200'
                                }`}
                              >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                    team.has_submitted ? 'bg-green-500' : 'bg-orange-500'
                                  }`} />
                                  <span className="font-medium text-gray-900 truncate">{team.team_name}</span>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${
                                  team.has_submitted
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-orange-100 text-orange-800'
                                }`}>
                                  {team.has_submitted ? '✓ Submitted' : 'Pending'}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Desktop-optimized: Table view for large screens */}
                          <div className="hidden lg:block overflow-hidden rounded-lg border border-blue-200">
                            <table className="min-w-full divide-y divide-blue-200">
                              <thead className="bg-blue-100">
                                <tr>
                                  <th className="px-4 py-3 text-left text-xs font-semibold text-blue-900 uppercase tracking-wider">
                                    Team Name
                                  </th>
                                  <th className="px-4 py-3 text-center text-xs font-semibold text-blue-900 uppercase tracking-wider">
                                    Status
                                  </th>
                                  <th className="px-4 py-3 text-center text-xs font-semibold text-blue-900 uppercase tracking-wider">
                                    Bids
                                  </th>
                                  <th className="px-4 py-3 text-center text-xs font-semibold text-blue-900 uppercase tracking-wider">
                                    Submitted At
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-blue-100">
                                {roundSubmissions[round.id].teams?.map((team: any, idx: number) => (
                                  <tr
                                    key={team.team_id || idx}
                                    className={`hover:bg-blue-50 transition-colors ${
                                      team.has_submitted ? 'bg-green-50/30' : 'bg-orange-50/30'
                                    }`}
                                  >
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${
                                          team.has_submitted ? 'bg-green-500' : 'bg-orange-500'
                                        }`} />
                                        <span className="font-medium text-gray-900">{team.team_name}</span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-center">
                                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${
                                        team.has_submitted
                                          ? 'bg-green-100 text-green-800'
                                          : 'bg-orange-100 text-orange-800'
                                      }`}>
                                        {team.has_submitted ? '✓ Submitted' : 'Pending'}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-center text-sm text-gray-700">
                                      {team.has_submitted ? team.bid_count : '-'}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-center text-sm text-gray-500">
                                      {team.has_submitted && team.submitted_at
                                        ? new Date(team.submitted_at).toLocaleString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                          })
                                        : '-'
                                      }
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

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
                          <div>
                            <h3 className="text-base sm:text-lg font-semibold">
                              {round.position} Round #{round.round_number || extractIdNumberAsInt(round.id)}
                            </h3>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {(() => {
                                const settings = auctionSettings.find(s => String(s.id) === String(selectedAuctionSettingsId));
                                if (!settings || !round.round_number) return null;
                                let phase = 'Phase 3';
                                let phaseColor = 'bg-purple-100 text-purple-700';
                                if (round.round_number <= settings.phase_1_end_round) {
                                  phase = 'Phase 1';
                                  phaseColor = 'bg-blue-100 text-blue-700';
                                } else if (round.round_number <= settings.phase_2_end_round) {
                                  phase = 'Phase 2';
                                  phaseColor = 'bg-orange-100 text-orange-700';
                                }
                                return <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold ${phaseColor}`}>{phase}</span>;
                              })()}
                              {round.finalization_mode === 'manual' && (
                                <span className="inline-block px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-100 text-amber-700 flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                  Manual Finalization
                                </span>
                              )}
                            </div>
                          </div>
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
                          <div>
                            <h3 className="text-base sm:text-lg font-semibold">
                              {round.position} Round #{round.round_number || extractIdNumberAsInt(round.id)}
                            </h3>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {(() => {
                                const settings = auctionSettings.find(s => String(s.id) === String(selectedAuctionSettingsId));
                                if (!settings || !round.round_number) return null;
                                let phase = 'Phase 3';
                                let phaseColor = 'bg-purple-100 text-purple-700';
                                if (round.round_number <= settings.phase_1_end_round) {
                                  phase = 'Phase 1';
                                  phaseColor = 'bg-blue-100 text-blue-700';
                                } else if (round.round_number <= settings.phase_2_end_round) {
                                  phase = 'Phase 2';
                                  phaseColor = 'bg-orange-100 text-orange-700';
                                }
                                return <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold ${phaseColor}`}>{phase}</span>;
                              })()}
                              {round.finalization_mode === 'manual' && (
                                <span className="inline-block px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-100 text-amber-700 flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                  Manual Finalization
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className="px-3 py-1 rounded-full bg-orange-100 text-orange-800 text-xs font-medium">
                            {round.status === 'expired_pending_finalization' ? 'Awaiting Preview' : 'Expired'}
                          </span>
                          {round.status === 'pending_finalization' && (
                            <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-medium">
                              Results Pending
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-2">
                        {/* For expired_pending_finalization status (manual mode, timer expired, not yet previewed) */}
                        {/* For expired rounds with manual finalization - show preview/finalize immediately options */}
                        {round.status === 'expired' && round.finalization_mode === 'manual' && !round.has_pending_allocations && (
                          <>
                            <button
                              onClick={() => handlePreviewFinalization(round.id)}
                              className="bg-blue-500 text-white px-4 py-2 rounded-xl hover:bg-blue-600 transition-all duration-200 text-sm flex items-center"
                            >
                              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              Preview Results
                            </button>
                            <button
                              onClick={() => handleFinalizeImmediately(round.id)}
                              className="bg-green-500 text-white px-4 py-2 rounded-xl hover:bg-green-600 transition-all duration-200 text-sm flex items-center"
                            >
                              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                              Finalize Immediately
                            </button>
                          </>
                        )}
                        
                        {/* For expired rounds with pending allocations (preview created, waiting for approval) */}
                        {round.status === 'expired' && round.finalization_mode === 'manual' && round.has_pending_allocations && (
                          <>
                            <button
                              onClick={() => handleViewPendingResults(round.id)}
                              className="bg-blue-500 text-white px-4 py-2 rounded-xl hover:bg-blue-600 transition-all duration-200 text-sm flex items-center"
                            >
                              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              View Pending Results
                            </button>
                            <button
                              onClick={() => handleApplyPendingAllocations(round.id)}
                              className="bg-green-500 text-white px-4 py-2 rounded-xl hover:bg-green-600 transition-all duration-200 text-sm flex items-center"
                            >
                              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                              </svg>
                              Finalize for Real
                            </button>
                            <button
                              onClick={() => handleCancelPending(round.id)}
                              className="bg-orange-500/10 text-orange-600 px-4 py-2 rounded-xl hover:bg-orange-500/20 transition-all duration-200 text-sm flex items-center"
                            >
                              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              Cancel Pending
                            </button>
                          </>
                        )}
                        
                        {/* For regular expired status (auto mode or old rounds without manual finalization) */}
                        {round.status === 'expired' && round.finalization_mode !== 'manual' && (
                          <button
                            onClick={() => handleFinalizeRound(round.id)}
                            className="bg-green-500 text-white px-4 py-2 rounded-xl hover:bg-green-600 transition-all duration-200 text-sm flex items-center"
                          >
                            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                            Finalize Round
                          </button>
                        )}
                        
                        {/* Delete button always available */}
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
