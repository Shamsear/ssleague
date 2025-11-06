'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRoundData, usePlaceBid, useCancelBid, useRoundStatus } from '@/hooks/useTeamDashboard';
import { useModal } from '@/hooks/useModal';
import { useAuctionWebSocket } from '@/hooks/useWebSocket';
import AlertModal from '@/components/modals/AlertModal';
import ConfirmModal from '@/components/modals/ConfirmModal';

interface Player {
  id: string;
  name: string;
  position: string;
  team_name: string;
  overall_rating: number;
  playing_style?: string;
  is_starred?: boolean;
}

interface Bid {
  id: string;
  player_id: string;
  player: Player;
  amount: number;
  round_id: string;
}

interface Round {
  id: string;
  position: string;
  max_bids_per_team: number;
  end_time: string;
  status: string;
  season_id: string;
}

export default function TeamRoundPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const roundId = params?.id as string;

  // Use React Query for data fetching with auto-refresh
  const { 
    data: roundData, 
    isLoading, 
    isError, 
    error,
    refetch: refetchRoundData
  } = useRoundData(roundId, !loading && !!user && user.role === 'team');

  // Use React Query for round status checking
  const { data: statusData } = useRoundStatus(roundId, !!roundId);
  
  // WebSocket for live updates
  const { isConnected } = useAuctionWebSocket(roundId, !!roundId);

  // Mutations with optimistic updates
  const placeBidMutation = usePlaceBid(roundId || '');
  const cancelBidMutation = useCancelBid(roundId || '');

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

  // UI State
  const [searchTerm, setSearchTerm] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);

  // Extract data from React Query result
  const round = roundData?.round;
  const players = roundData?.players || [];
  const rawMyBids = roundData?.myBids || [];
  // Sort bids by amount (highest first)
  const myBids = [...rawMyBids].sort((a: Bid, b: Bid) => (b.amount || 0) - (a.amount || 0));
  const teamBalance = roundData?.teamBalance || 0;
  const completedRounds = roundData?.completedRounds || 0;
  const totalRounds = roundData?.totalRounds || 0;
  const submission = roundData?.submission || null;
  const hasSubmitted = !!submission;
  const isLocked = submission?.is_locked || false;

  // Auth guard
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'team') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  // Handle redirects from round data and errors
  useEffect(() => {
    if (roundData && 'redirect' in roundData) {
      console.log('👉 Redirect from round data:', roundData.redirect);
      router.push(roundData.redirect as string);
    }
  }, [roundData, router]);
  
  // Handle round fetch errors (deleted round, not found, etc.)
  useEffect(() => {
    if (isError) {
      console.error('❌ Round fetch error:', error);
      console.log('👉 Redirecting to dashboard due to error');
      router.push('/dashboard/team');
    }
  }, [isError, error, router]);

  // Note: Auto-finalization disabled on team pages (requires admin access)
  // Only committee admins can trigger finalization

  // Calculate time remaining from round data
  useEffect(() => {
    if (!round?.end_time) return;

    // Check if round is no longer active (manually finalized or completed)
    if (round.status !== 'active') {
      console.log(`⏰ Round status is '${round.status}', redirecting to dashboard...`);
      router.push('/dashboard/team');
      return;
    }

    const updateTimeRemaining = () => {
      const endTime = new Date(round.end_time).getTime();
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
      setTimeRemaining(remaining);
      
      // Auto-redirect when timer reaches 0
      if (remaining === 0) {
        console.log('⏰ Round time expired, redirecting to dashboard...');
        setTimeout(() => {
          router.push('/dashboard/team');
        }, 2000); // Wait 2 seconds to show "Time's Up!" message
      }
    };

    // Check immediately - if round already ended, redirect right away
    const endTime = new Date(round.end_time).getTime();
    const now = Date.now();
    if (now >= endTime) {
      console.log('⏰ Round already ended, redirecting immediately...');
      router.push('/dashboard/team');
      return;
    }

    updateTimeRemaining();
    const interval = setInterval(updateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [round, router]);

  // WebSocket connection status (refetching is handled by useAuctionWebSocket automatically)
  useEffect(() => {
    if (isConnected) {
      console.log('🔌 WebSocket connected for round:', roundId);
    }
  }, [isConnected, roundId]);

  // Handle round status changes (auto-checked by React Query)
  useEffect(() => {
    if (statusData) {
      console.log('🔍 Round status data:', statusData);
      
      // Only redirect if we have a valid response AND the round is explicitly not active
      // Don't redirect on API errors (success: false)
      if (statusData.success === false) {
        console.log('⚠️ Status check failed (likely auth issue), ignoring...');
        return;
      }
      
      if (statusData.active === false) {
        console.log('⚠️ Round is not active, redirecting...');
        if (statusData.redirect) {
          router.push(statusData.redirect);
        } else {
          router.push('/dashboard/team');
        }
      } else if (statusData.active === true) {
        console.log('✅ Round is active');
      }
    }
  }, [statusData, router]);

  // Place bid using React Query mutation
  const handlePlaceBid = async (playerId: string, amount: number) => {
    if (!roundId) return;

    try {
      await placeBidMutation.mutateAsync({ playerId, amount });
    } catch (error: any) {
      showAlert({
        type: 'error',
        title: 'Bid Failed',
        message: error.message || 'Failed to place bid'
      });
    }
  };

  // Cancel bid using React Query mutation
  const handleCancelBid = async (bidId: string) => {
    const confirmed = await showConfirm({
      type: 'warning',
      title: 'Cancel Bid',
      message: 'Are you sure you want to cancel this bid?',
      confirmText: 'Yes, Cancel',
      cancelText: 'No'
    });
    
    if (!confirmed) return;

    try {
      await cancelBidMutation.mutateAsync(bidId);
    } catch (error: any) {
      showAlert({
        type: 'error',
        title: 'Cancel Failed',
        message: error.message || 'Failed to cancel bid'
      });
    }
  };

  // Submit bids
  const handleSubmitBids = async () => {
    const confirmed = await showConfirm({
      type: 'warning',
      title: 'Submit Bids',
      message: `Are you sure you want to submit your ${myBids.length} bid(s)? After submission, you won't be able to modify them unless you unlock.`,
      confirmText: 'Yes, Submit',
      cancelText: 'Cancel'
    });
    
    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/team/round/${roundId}/submit`, {
        method: 'POST',
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to submit bids');
      }

      showAlert({
        type: 'success',
        title: 'Bids Submitted',
        message: 'Your bids have been submitted successfully!'
      });

      // Refetch round data to update submission status
      refetchRoundData();
    } catch (error: any) {
      showAlert({
        type: 'error',
        title: 'Submission Failed',
        message: error.message || 'Failed to submit bids'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Unlock bids for modification
  const handleUnlockBids = async () => {
    const confirmed = await showConfirm({
      type: 'warning',
      title: 'Unlock Bids',
      message: 'Are you sure you want to unlock your bids? You will need to submit them again.',
      confirmText: 'Yes, Unlock',
      cancelText: 'Cancel'
    });
    
    if (!confirmed) return;

    setIsUnlocking(true);
    try {
      const response = await fetch(`/api/team/round/${roundId}/submit`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to unlock bids');
      }

      showAlert({
        type: 'success',
        title: 'Bids Unlocked',
        message: 'You can now modify your bids. Remember to submit again!'
      });

      // Refetch round data to update submission status
      refetchRoundData();
    } catch (error: any) {
      showAlert({
        type: 'error',
        title: 'Unlock Failed',
        message: error.message || 'Failed to unlock bids'
      });
    } finally {
      setIsUnlocking(false);
    }
  };

  // Format time
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Filter players
  const filteredPlayers = players.filter((player: Player) =>
    player.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Sort players (starred first)
  const sortedPlayers = [...filteredPlayers].sort((a, b) => {
    if (a.is_starred && !b.is_starred) return -1;
    if (!a.is_starred && b.is_starred) return 1;
    return 0;
  });

  // Check if player has bid
  const hasBid = (playerId: string) => {
    return myBids.some((bid: Bid) => bid.player_id === playerId);
  };

  // Get player bid
  const getPlayerBid = (playerId: string) => {
    return myBids.find((bid: Bid) => bid.player_id === playerId);
  };

  // Get timer color
  const getTimerColor = () => {
    if (timeRemaining === 0) return 'text-red-600 animate-pulse';
    if (timeRemaining < 300) return 'text-red-600 animate-pulse';
    if (timeRemaining < 600) return 'text-orange-500';
    return 'text-primary';
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading round...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'team' || !round) {
    return null;
  }

  const bidCount = myBids.length;
  const bidProgress = (bidCount / round.max_bids_per_team) * 100;

  return (
    <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
      <div className="glass rounded-3xl backdrop-blur-md p-4 sm:p-6 shadow-lg border border-white/10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 sm:mb-6 gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-dark bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary-dark">
              Active Rounds
            </h2>
            <p className="text-sm text-gray-500 mt-1">Place bids on players in active rounds</p>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3 w-full sm:w-auto">
            <Link
              href="/dashboard/team"
              className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-white/60 hover:bg-white/80 shadow-sm transition-all duration-300 text-sm font-medium flex items-center justify-center"
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Dashboard
            </Link>
            <Link
              href="/dashboard/team/bids"
              className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-white/60 hover:bg-white/80 shadow-sm transition-all duration-300 text-sm font-medium flex items-center justify-center"
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              My Bids
            </Link>
          </div>
        </div>

        {/* Timer Card */}
        <div className="glass-card mb-6 p-5 sm:p-6 rounded-2xl backdrop-blur-md shadow-lg border border-white/10 hover:shadow-xl transition-all">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center">
            <div className="mb-4 md:mb-0">
              <div className="flex items-center">
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 mr-2 animate-pulse backdrop-blur-sm">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-1.5"></span>
                  Live
                </span>
                <h3 className="text-lg font-bold text-dark">{round.position} Round</h3>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                You must place exactly {round.max_bids_per_team} bids in this round for your bids to be considered
              </p>
            </div>
            <div className="flex flex-col items-center bg-gradient-to-r from-primary/5 to-primary/10 p-3 rounded-xl backdrop-blur-md">
              <div className="text-sm text-gray-600 mb-1">Time Remaining</div>
              <div className={`text-2xl font-bold ${getTimerColor()}`}>
                {formatTime(timeRemaining)}
              </div>
            </div>
          </div>

          {/* Auction Status Info */}
          <div className="mt-5 mb-4 glass p-4 rounded-xl bg-blue-50/30 backdrop-blur-sm border border-blue-100/20">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 bg-blue-100 p-2 rounded-full">
                <svg className="h-5 w-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-medium text-blue-700">Auction Status</h4>
                <div className="mt-1.5 text-xs text-blue-600 grid grid-cols-2 sm:grid-cols-4 gap-y-1.5 gap-x-4">
                  <div>
                    <span className="text-xs text-blue-500">Rounds completed:</span>
                    <p className="font-medium">{completedRounds} of {totalRounds}</p>
                  </div>
                  <div>
                    <span className="text-xs text-blue-500">Rounds remaining:</span>
                    <p className="font-medium">{totalRounds - completedRounds}</p>
                  </div>
                  <div>
                    <span className="text-xs text-blue-500">Min balance per round:</span>
                    <p className="font-medium">£1,000</p>
                  </div>
                  <div>
                    <span className="text-xs text-blue-500">Your balance:</span>
                    <p className={`font-medium ${teamBalance >= 1000 ? 'text-green-600' : 'text-red-600'}`}>
                      £{teamBalance.toLocaleString()}
                      <span className={`text-xs ml-1 block sm:inline ${teamBalance >= 1000 ? 'text-green-500' : 'text-red-500'}`}>
                        ({teamBalance >= 1000 ? 'sufficient' : 'insufficient'})
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bids Progress */}
          <div className="mt-4 mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Bids Placed</span>
              <span className="text-sm font-medium text-primary">
                {bidCount} / {round.max_bids_per_team}
              </span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden backdrop-blur-sm">
              <div
                className="h-3 rounded-full bg-gradient-to-r from-primary to-primary-dark transition-all duration-300"
                style={{ width: `${Math.min(bidProgress, 100)}%` }}
              ></div>
            </div>
          </div>

          {/* Submission Status Banner */}
          {hasSubmitted && isLocked && (
            <div className="mb-4 p-4 bg-green-50 border-2 border-green-200 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-green-100 p-2 rounded-full">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-green-800">Bids Submitted</p>
                    <p className="text-sm text-green-600">Your bids are locked and submitted</p>
                  </div>
                </div>
                <button
                  onClick={handleUnlockBids}
                  disabled={isUnlocking}
                  className="px-4 py-2 bg-white border border-green-300 text-green-700 rounded-lg hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  {isUnlocking ? 'Unlocking...' : 'Unlock to Modify'}
                </button>
              </div>
            </div>
          )}

          {/* Your Selected Players */}
          <div className="mb-6">
            <h4 className="font-medium text-dark mb-3 flex items-center">
              <svg className="w-4 h-4 mr-1.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Your Selected Players
              {hasSubmitted && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full font-medium">
                  Submitted
                </span>
              )}
            </h4>

            {myBids.length > 0 ? (
              <div className="glass-card rounded-xl overflow-hidden backdrop-blur-sm shadow-sm border border-white/10">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50/70">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Player
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                          Position
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Bid Amount
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white/50 divide-y divide-gray-200">
                      {myBids.map((bid: Bid) => (
                        <tr key={bid.id} className="hover:bg-white/80">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                                {bid.player.position[0]}
                              </div>
                              <div className="ml-3">
                                <div className="text-sm font-medium text-gray-800 flex items-center">
                                  {bid.player.name}
                                  {bid.player.is_starred && (
                                    <svg className="w-4 h-4 ml-1 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                    </svg>
                                  )}
                                </div>
                                <div className="text-xs text-gray-500 sm:hidden">{bid.player.position}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap hidden sm:table-cell">
                            <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800">
                              {bid.player.position}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium text-primary">
                            £{bid.amount.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-center">
                            <button
                              onClick={() => handleCancelBid(bid.id)}
                              className="text-xs text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded-full transition-colors"
                              title="Cancel Bid"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="glass-card p-4 rounded-xl backdrop-blur-sm bg-white/30 border border-white/10 text-center">
                <span className="text-sm text-gray-500">You haven't placed any bids in this round yet</span>
              </div>
            )}

            {/* Submit Bids Button */}
            {!hasSubmitted && bidCount === round.max_bids_per_team && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-100 p-2 rounded-full">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-blue-800">Ready to Submit</p>
                      <p className="text-sm text-blue-600">You've placed all {round.max_bids_per_team} required bids</p>
                    </div>
                  </div>
                  <button
                    onClick={handleSubmitBids}
                    disabled={isSubmitting}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-lg"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Submitting...
                      </span>
                    ) : (
                      'Submit Bids'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Available Players */}
          <div className="mb-6">
            <h4 className="font-medium text-dark mb-3 flex items-center">
              <svg className="w-4 h-4 mr-1.5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Available Players
            </h4>

            {/* Player Search */}
            <div className="mb-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                  </svg>
                </div>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 text-sm rounded-lg border-gray-200 focus:ring-primary focus:border-primary shadow-sm"
                  placeholder="Search players by name..."
                />
              </div>
            </div>

            <div className="flex items-center mb-3 bg-gray-100/50 p-2 rounded-lg text-xs text-gray-600">
              <svg className="w-4 h-4 mr-2 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span>Starred players are shown first with yellow highlight.</span>
            </div>

            {/* Players Grid */}
            {sortedPlayers.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sortedPlayers.map((player) => {
                  const playerHasBid = hasBid(player.id);
                  const playerBid = getPlayerBid(player.id);

                  return (
                    <PlayerCard
                      key={player.id}
                      player={player}
                      hasBid={playerHasBid}
                      bid={playerBid}
                      bidCount={bidCount}
                      maxBids={round.max_bids_per_team}
                      teamBalance={teamBalance}
                      existingBidAmounts={myBids.map((b: Bid) => b.amount)}
                      onPlaceBid={handlePlaceBid}
                      onCancelBid={handleCancelBid}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="glass-card p-4 rounded-xl backdrop-blur-sm bg-white/30 border border-white/10 text-center">
                <span className="text-sm text-gray-500">No players found</span>
              </div>
            )}
          </div>
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

// Player Card Component
interface PlayerCardProps {
  player: Player;
  hasBid: boolean;
  bid?: Bid;
  bidCount: number;
  maxBids: number;
  teamBalance: number;
  existingBidAmounts: number[]; // Add this to check for duplicates
  onPlaceBid: (playerId: string, amount: number) => void;
  onCancelBid: (bidId: string) => void;
}

function PlayerCard({
  player,
  hasBid,
  bid,
  bidCount,
  maxBids,
  teamBalance,
  existingBidAmounts,
  onPlaceBid,
  onCancelBid,
}: PlayerCardProps) {
  const [bidAmount, setBidAmount] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editAmount, setEditAmount] = useState('');

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);

  // Initialize edit amount when entering edit mode
  const handleEdit = () => {
    if (bid) {
      setEditAmount(bid.amount.toString());
      setIsEditing(true);
    }
  };

  // Handle edit submission
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseInt(editAmount);

    if (!amount || isNaN(amount) || amount < 10) {
      showAlert({
        type: 'warning',
        title: 'Invalid Amount',
        message: 'Bid amount must be at least £10'
      });
      return;
    }

    if (bid && amount === bid.amount) {
      setIsEditing(false);
      return; // No change
    }

    // Calculate balance if editing (add back old bid amount)
    const availableBalance = bid ? teamBalance + bid.amount : teamBalance;
    
    if (amount > availableBalance) {
      showAlert({
        type: 'error',
        title: 'Insufficient Balance',
        message: 'Bid amount exceeds your available balance'
      });
      return;
    }

    // Check for duplicate bid amounts (excluding current bid)
    const otherBidAmounts = existingBidAmounts.filter(a => bid ? a !== bid.amount : true);
    if (otherBidAmounts.includes(amount)) {
      showAlert({
        type: 'error',
        title: 'Duplicate Bid Amount',
        message: 'You already have a bid with this amount. Each bid must have a unique amount.'
      });
      return;
    }

    setIsSubmitting(true);
    // Delete old bid and place new one
    if (bid) {
      await onCancelBid(bid.id);
    }
    await onPlaceBid(player.id, amount);
    setIsEditing(false);
    setEditAmount('');
    setIsSubmitting(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseInt(bidAmount);

    if (!amount || isNaN(amount) || amount < 10) {
      showAlert({
        type: 'warning',
        title: 'Invalid Amount',
        message: 'Bid amount must be at least £10'
      });
      return;
    }

    if (amount > teamBalance) {
      showAlert({
        type: 'error',
        title: 'Insufficient Balance',
        message: 'Bid amount exceeds your team balance'
      });
      return;
    }

    // Check for duplicate bid amounts
    if (existingBidAmounts.includes(amount)) {
      showAlert({
        type: 'error',
        title: 'Duplicate Bid Amount',
        message: 'You already have a bid with this amount in this round. Each bid must have a unique amount.'
      });
      return;
    }

    setIsSubmitting(true);
    await onPlaceBid(player.id, amount);
    setBidAmount('');
    setIsSubmitting(false);
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 90) return 'bg-gradient-to-r from-green-500 to-emerald-600';
    if (rating >= 80) return 'bg-gradient-to-r from-blue-500 to-blue-600';
    if (rating >= 70) return 'bg-gradient-to-r from-yellow-500 to-amber-600';
    return 'bg-gradient-to-r from-gray-500 to-gray-600';
  };

  return (
    <div
      className={`glass-card p-4 rounded-xl backdrop-blur-sm shadow-sm border transition-all ${
        player.is_starred
          ? 'border-yellow-300 hover:border-yellow-400'
          : 'border-white/10 hover:border-primary/20'
      } hover:shadow-md ${hasBid ? 'ring-2 ring-primary' : ''}`}
    >
      <div className="flex justify-between items-start">
        <div className="flex items-start gap-3">
          <div className="bg-primary/10 flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center">
            <span className="text-lg font-bold text-primary">{player.position[0]}</span>
          </div>
          <div>
            <div className="font-medium text-dark flex items-center">
              {player.name}
              {player.is_starred && (
                <>
                  <svg className="w-4 h-4 ml-1.5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="ml-2 px-1.5 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-md">
                    Starred
                  </span>
                </>
              )}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {player.position} • {player.team_name}
            </div>

            {player.overall_rating && (
              <div className="flex items-center mt-1.5">
                <div
                  className={`w-5 h-5 flex items-center justify-center rounded-full ${getRatingColor(
                    player.overall_rating
                  )} text-white text-xs font-bold shadow-sm`}
                >
                  {player.overall_rating}
                </div>
                {player.playing_style && <span className="text-xs ml-1.5">{player.playing_style}</span>}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          {hasBid && bid && (
            <>
              <div className="inline-flex items-center px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                £{bid.amount.toLocaleString()}
              </div>
              <div className="flex gap-1">
                <button
                  onClick={handleEdit}
                  disabled={isSubmitting || isCanceling}
                  className="text-xs text-blue-500 hover:text-blue-700 flex items-center disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                >
                  <svg className="w-3 h-3 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </button>
                <button
                  onClick={async () => {
                    setIsCanceling(true);
                    await onCancelBid(bid.id);
                    setIsCanceling(false);
                  }}
                  disabled={isCanceling || isSubmitting}
                  className="text-xs text-red-500 hover:text-red-700 flex items-center disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                >
                  {isCanceling ? (
                    <>
                      <svg className="animate-spin w-3 h-3 mr-0.5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      ...
                    </>
                  ) : (
                    <>
                      <svg className="w-3 h-3 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Edit Mode Form */}
      {hasBid && bid && isEditing && (
        <div className="mt-4 pt-3 border-t border-gray-200 bg-blue-50/30 p-3 rounded-lg">
          <form onSubmit={handleEditSubmit}>
            <div className="flex items-center gap-2">
              <div className="relative rounded-lg flex-grow">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                  £
                </span>
                <input
                  type="number"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className="block w-full pl-7 pr-12 py-2.5 text-sm rounded-lg border-blue-200 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                  placeholder="New bid amount"
                  required
                  min="10"
                  max={teamBalance + bid.amount}
                  disabled={isSubmitting}
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 shadow-sm disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-lg bg-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-300 shadow-sm disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {!hasBid && bidCount < maxBids && (
        <div className="mt-4 pt-3 border-t border-gray-200">
          <form onSubmit={handleSubmit}>
            <div className="flex items-center gap-2">
              <div className="relative rounded-lg flex-grow">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                  £
                </span>
                <input
                  type="number"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  className="block w-full pl-7 pr-12 py-2.5 text-sm rounded-lg border-gray-200 focus:ring-primary focus:border-primary shadow-sm"
                  placeholder="Bid amount"
                  required
                  min="10"
                  max={teamBalance}
                  disabled={isSubmitting}
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-lg bg-gradient-to-r from-primary to-primary-dark text-white text-sm font-medium hover:from-primary-dark hover:to-primary shadow-sm disabled:opacity-50"
              >
                {isSubmitting ? 'Bidding...' : 'Bid'}
              </button>
            </div>
          </form>
        </div>
      )}

      {bidCount >= maxBids && !hasBid && (
        <div className="mt-3 py-2 text-xs text-center text-gray-500 bg-gray-50 rounded-lg">
          Required number of bids reached for this round
        </div>
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
