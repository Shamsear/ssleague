'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useModal } from '@/hooks/useModal';
import AlertModal from '@/components/modals/AlertModal';
import ConfirmModal from '@/components/modals/ConfirmModal';
import { useWebSocket } from '@/hooks/useWebSocket';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';
import TiebreakerWinnerPage from '@/components/TiebreakerWinnerModal';

interface Player {
  id: string;
  name: string;
  position: string;
  team_name: string;
  overall_rating: number;
}

interface Bid {
  team_id: string;
  team_name: string;
  amount: number;
  timestamp: string;
}

interface Tiebreaker {
  id: string;
  round_id: string;
  player_id: string;
  player_name: string;
  position: string;
  original_amount: number;
  current_highest_bid: number;
  highest_bidder_team_id?: string;
  highest_bidder_team_name?: string;
  status: string;
  my_last_bid?: number;
  bid_history: Bid[];
}

export default function TeamBulkTiebreakerPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const tiebreakerId = params?.id as string;

  const [tiebreaker, setTiebreaker] = useState<Tiebreaker | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [bidAmount, setBidAmount] = useState('');
  const [activeTeams, setActiveTeams] = useState(2); // Track active teams count
  const [seasonId, setSeasonId] = useState<string | null>(null); // Track season ID for WebSocket

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
  const [teamBalance, setTeamBalance] = useState(1000); // Mock balance
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  
  // Winner modal state
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [winnerData, setWinnerData] = useState<{
    playerName: string;
    position: string;
    winnerTeamName: string;
    winnerTeamId: string;
    finalBid: number;
  } | null>(null);
  
  // Use ref to store fetchData to avoid dependency issues
  const fetchDataRef = useRef<() => Promise<void>>();

  // Fetch data function (to be called on mount and WebSocket updates)
  const fetchData = useCallback(async () => {
    // Wait for auth to complete and user to be loaded
    if (loading || !user || !tiebreakerId) return;

    setIsLoading(true);
    try {
      console.log('🔍 Fetching bulk tiebreaker:', tiebreakerId);
      const response = await fetchWithTokenRefresh(`/api/team/bulk-tiebreakers/${tiebreakerId}`);
      const result = await response.json();
      console.log('📦 API Response:', result);
      const { success, data } = result;

      if (success && data) {
        console.log('✅ Bulk tiebreaker data loaded:', data);
        
        // For bulk tiebreakers, data structure is different
        const tiebreakerData = data;
        const teams = data.teams || [];
        
        // Current highest bid is already in the data - ensure it's a valid number
        const highestBid = tiebreakerData.current_highest_bid || tiebreakerData.tie_amount || tiebreakerData.original_amount || 10;
        
        // Find current user's team
        const myTeam = teams.find((t: any) => t.is_current_user);
        const myLastBid = myTeam?.current_bid || null;
        
        // Store season ID for WebSocket
        if (tiebreakerData.season_id) {
          setSeasonId(tiebreakerData.season_id);
        }
        
        setTiebreaker({
          id: tiebreakerData.id,
          round_id: tiebreakerData.round_id,
          player_id: tiebreakerData.player_id,
          player_name: tiebreakerData.player_name,
          position: tiebreakerData.position,
          original_amount: tiebreakerData.tie_amount || tiebreakerData.original_amount,
          current_highest_bid: highestBid,
          highest_bidder_team_id: tiebreakerData.current_highest_team_id,
          highest_bidder_team_name: teams.find((t: any) => t.team_id === tiebreakerData.current_highest_team_id)?.team_name,
          status: tiebreakerData.status,
          my_last_bid: myLastBid,
          bid_history: tiebreakerData.bid_history || [],
        });

        setPlayer({
          id: tiebreakerData.player_id,
          name: tiebreakerData.player_name,
          position: tiebreakerData.position,
          team_name: tiebreakerData.player_team || '',
          overall_rating: 0,
        });
        
        // Set team balance from current user's team data
        if (myTeam && myTeam.team_balance) {
          setTeamBalance(myTeam.team_balance);
        }

        // Set default bid amount (current highest + 1)
        setBidAmount((highestBid + 1).toString());
        setFetchError(null); // Clear any previous errors
        
        // Store active teams count
        if (tiebreakerData.statistics?.active_teams !== undefined) {
          setActiveTeams(tiebreakerData.statistics.active_teams);
        }
        
        // Check if tiebreaker is already resolved
        if (tiebreakerData.status === 'resolved' && tiebreakerData.current_highest_team_id) {
          const winnerTeam = teams.find((t: any) => t.team_id === tiebreakerData.current_highest_team_id);
          setWinnerData({
            playerName: tiebreakerData.player_name,
            position: tiebreakerData.position,
            winnerTeamName: winnerTeam?.team_name || 'Winner',
            winnerTeamId: tiebreakerData.current_highest_team_id,
            finalBid: tiebreakerData.current_highest_bid,
          });
          setShowWinnerModal(true);
        }
      } else {
        console.error('❌ API returned error:', result);
        setFetchError(result.error || 'Failed to load tiebreaker data');
      }
    } catch (err) {
      console.error('❌ Error fetching data:', err);
      setFetchError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [tiebreakerId, loading, user]);
  
  // Update ref whenever fetchData changes
  useEffect(() => {
    fetchDataRef.current = fetchData;
  }, [fetchData]);

  // ✅ Enable WebSocket for real-time tiebreaker bid updates
  const { isConnected } = useWebSocket({
    channel: seasonId ? `updates/${seasonId}/tiebreakers/${tiebreakerId}` : `tiebreaker:${tiebreakerId}`,
    enabled: !!tiebreakerId && !!seasonId,
    onMessage: useCallback((message: any) => {
      console.log('[Tiebreaker WS] Received:', message);
      
      // ⚡ INSTANT UPDATE - Firebase pushes have timestamp and bid data directly
      // Message format from broadcastTiebreakerBid: { team_id, team_name, bid_amount, timestamp }
      if (message.team_id && message.bid_amount) {
        const bidData = message;
        
        // Always update the highest bid info (even if it's our own bid)
        // This ensures the UI always shows the correct current highest bidder
        setTiebreaker(prev => {
          if (!prev) return prev;
          
          const newBid = {
            team_id: bidData.team_id,
            team_name: bidData.team_name,
            amount: bidData.bid_amount,
            timestamp: new Date().toISOString(),
          };
          
          return {
            ...prev,
            current_highest_bid: bidData.bid_amount,
            highest_bidder_team_id: bidData.team_id,
            highest_bidder_team_name: bidData.team_name,
            // Add to history (WebSocket broadcasts to all including sender)
            bid_history: [newBid, ...prev.bid_history.filter(b => 
              !(b.team_id === newBid.team_id && b.amount === newBid.amount)
            )],
          };
        });
        
        console.log(`⚡ Instant UI update from WebSocket: ${bidData.team_name} bid £${bidData.bid_amount}`);
        
        // Update default bid amount (current highest + 1)
        setBidAmount((bidData.bid_amount + 1).toString());
      } else if (message.type === 'tiebreaker_withdraw' && message.data) {
        // Someone withdrew - check if we're now the winner
        const withdrawData = message.data;
        console.log('🚺 Team withdrew:', withdrawData);
        
        if (withdrawData.is_winner_determined && withdrawData.winner_team_id) {
          // Winner determined - show winner page
          setWinnerData({
            playerName: withdrawData.player_name,
            position: withdrawData.position || '',
            winnerTeamName: withdrawData.winner_team_name,
            winnerTeamId: withdrawData.winner_team_id,
            finalBid: withdrawData.final_bid || 0,
          });
          setShowWinnerModal(true);
        }
      } else if (message.type === 'tiebreaker_finalized' && message.data) {
        // Tiebreaker completed - show winner modal
        const finalData = message.data;
        console.log('🏆 Tiebreaker finalized:', finalData);
        
        setWinnerData({
          playerName: finalData.player_name,
          position: finalData.position,
          winnerTeamName: finalData.winner_team_name,
          winnerTeamId: finalData.winner_team_id,
          finalBid: finalData.final_bid,
        });
        setShowWinnerModal(true);
      } else if (message.type && message.type !== 'subscribed' && message.type !== 'connected') {
        // Only refetch for unhandled message types that have explicit type field
        console.log('[Tiebreaker WS] Unhandled message type, refetching:', message.type);
        if (fetchDataRef.current) {
          fetchDataRef.current();
        }
      } else {
        // No type field and no bid data - likely just connection message, ignore
        console.log('[Tiebreaker WS] Ignoring message without type or bid data');
      }
    }, []), // Empty deps - uses ref instead
  });


  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'team') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  // Fetch tiebreaker data on mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Removed auto-refresh polling - relying on WebSocket for live updates
  // Data will refresh when:
  // 1. Page loads (initial fetch)
  // 2. WebSocket receives updates from server
  // 3. User places a bid (manual refresh after action)

  const handlePlaceBid = async () => {
    if (!tiebreaker) return;

    const amount = parseInt(bidAmount);

    if (isNaN(amount) || amount <= 0) {
      showAlert({
        type: 'warning',
        title: 'Invalid Amount',
        message: 'Please enter a valid bid amount'
      });
      return;
    }

    if (amount <= tiebreaker.current_highest_bid) {
      showAlert({
        type: 'warning',
        title: 'Bid Too Low',
        message: `Bid must be higher than the current highest bid (£${tiebreaker.current_highest_bid})`
      });
      return;
    }

    if (amount > teamBalance) {
      showAlert({
        type: 'error',
        title: 'Insufficient Balance',
        message: 'Insufficient balance!'
      });
      return;
    }

    // No confirmation needed - place bid immediately for faster bidding
    setIsSubmitting(true);
    
    // ⚡ OPTIMISTIC UPDATE - Update UI immediately for instant feedback
    const previousTiebreaker = tiebreaker;
    setTiebreaker({
      ...tiebreaker,
      current_highest_bid: amount,
      highest_bidder_team_id: user?.uid,
      highest_bidder_team_name: (user as any)?.teamName || 'Your Team',
      my_last_bid: amount,
      bid_history: [
        ...tiebreaker.bid_history,
        {
          team_id: user?.uid || '',
          team_name: (user as any)?.teamName || 'Your Team',
          amount,
          timestamp: new Date().toISOString(),
        },
      ],
    });
    setBidAmount((amount + 1).toString());
    
    let result: any = null;
    try {
      const response = await fetchWithTokenRefresh(`/api/team/bulk-tiebreakers/${tiebreakerId}/bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bid_amount: amount }),
      });
      result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to place bid');
      }

      // ⚡ NO MODAL - Silent success for faster bidding
      // WebSocket will handle real-time updates from other bidders
      // No need to refetch - optimistic update is already done
    } catch (err) {
      console.error('Error placing bid:', err);
      
      // Always rollback optimistic update first
      setTiebreaker(previousTiebreaker);
      
      // Check if error response includes updated bid data (race condition)
      const errorMessage = err instanceof Error ? err.message : 'Failed to place bid';
      
      // If the error mentions the current bid, extract it and update
      if (result && result.current_highest_bid) {
        // Someone else bid in the meantime - update only the bid amount
        // Don't update bidder name to avoid showing wrong info
        console.log('⚠️ Race condition detected - updating to latest bid:', result.current_highest_bid);
        
        // Update ONLY the bid amount, keep old bidder info to avoid confusion
        // WebSocket will provide the correct bidder info shortly
        setTiebreaker(prev => ({
          ...prev!,
          current_highest_bid: result.current_highest_bid,
          // Keep old highest_bidder info - WebSocket will update with correct info
        }));
        
        setBidAmount((result.current_highest_bid + 1).toString());
      } else {
        // Other error - just reset bid amount
        setBidAmount((previousTiebreaker.current_highest_bid + 1).toString());
      }
      
      // Don't fetch - WebSocket will provide updates
      showAlert({
        type: 'error',
        title: 'Bid Failed',
        message: errorMessage
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    const confirmed = await showConfirm({
      type: 'danger',
      title: 'Withdraw from Tiebreaker',
      message: 'Are you sure you want to withdraw from this tiebreaker? You will lose the player.',
      confirmText: 'Yes, Withdraw',
      cancelText: 'No'
    });
    
    if (!confirmed) {
      return;
    }

    try {
      // Check teams remaining BEFORE withdrawing
      // If only 2 teams, show processing page immediately
      const teamsRemainingBeforeWithdraw = activeTeams;
      
      if (teamsRemainingBeforeWithdraw <= 2) {
        // Show processing page immediately
        setWinnerData({
          playerName: tiebreaker?.player_name || '',
          position: tiebreaker?.position || '',
          winnerTeamName: '', // Will be updated when finalized
          winnerTeamId: '',
          finalBid: tiebreaker?.current_highest_bid || 0,
        });
        setShowWinnerModal(true);
      }
      
      const response = await fetchWithTokenRefresh(`/api/team/bulk-tiebreakers/${tiebreakerId}/withdraw`, {
        method: 'POST',
      });
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to withdraw');
      }

      // Update winner data with actual results
      if (result.data?.is_winner_determined && result.data?.winner) {
        // Winner determined - update with final data
        setWinnerData({
          playerName: result.data.player_name,
          position: result.data.position,
          winnerTeamName: result.data.winner.winner_team_name,
          winnerTeamId: result.data.winner.winner_team_id,
          finalBid: result.data.winner.final_bid,
        });
        setShowWinnerModal(true);
      } else if (teamsRemainingBeforeWithdraw > 2) {
        // Still teams left - show status page
        const teamsLeft = result.data?.teams_remaining || 2;
        setWinnerData({
          playerName: result.data.player_name,
          position: result.data.position,
          winnerTeamName: '', // No winner yet
          winnerTeamId: '',
          finalBid: result.data.current_highest_bid || 0,
        });
        // Show status page with teams left info
        showAlert({
          type: 'info',
          title: 'Withdrawn Successfully',
          message: `You have withdrawn. ${teamsLeft} team(s) still bidding.`
        });
        
        // Redirect after showing message
        setTimeout(() => router.push('/dashboard/team'), 2000);
      }
    } catch (err) {
      console.error('Error withdrawing:', err);
      showAlert({
        type: 'error',
        title: 'Withdrawal Failed',
        message: err instanceof Error ? err.message : 'Failed to withdraw'
      });
    }
  };

  const isMyBid = (teamId: string) => {
    return teamId === user?.uid;
  };

  const isWinning = tiebreaker?.highest_bidder_team_id === user?.uid;

  if (loading || !user || user.role !== 'team' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading tiebreaker...</p>
        </div>
      </div>
    );
  }

  if (!tiebreaker || !player) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Tiebreaker not found</p>
        </div>
      </div>
    );
  }

  // Show winner page if tiebreaker is resolved
  if (showWinnerModal && winnerData) {
    return (
      <TiebreakerWinnerPage
        playerName={winnerData.playerName}
        position={winnerData.position}
        winnerTeamName={winnerData.winnerTeamName}
        finalBid={winnerData.finalBid}
        isCurrentTeamWinner={winnerData.winnerTeamId === user?.uid}
      />
    );
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="container mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Link
              href="/dashboard/team"
              className="text-gray-500 hover:text-[#0066FF] transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl md:text-4xl font-bold gradient-text">
                  Tiebreaker
                </h1>
                {/* WebSocket Status */}
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                  isConnected 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  <span className={`w-2 h-2 rounded-full mr-1.5 ${
                    isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                  }`}></span>
                  {isConnected ? 'Live' : 'Offline'}
                </span>
              </div>
              <p className="text-gray-600 mt-1">Place your highest bid to win the player</p>
            </div>
          </div>
        </div>

        {/* Error Banner */}
        {fetchError && (
          <div className="glass rounded-2xl p-6 mb-6 border-2 border-red-300 bg-red-50">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-red-500 text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-red-900">Error Loading Data</h3>
                <p className="text-red-700">{fetchError}</p>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Status Banner */}
        {isWinning ? (
          <div className="glass rounded-2xl p-6 mb-6 border-2 border-green-300 bg-green-50">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-500 text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-green-900">You're Winning!</h3>
                <p className="text-green-700">Your bid of £{tiebreaker.current_highest_bid} is currently the highest</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="glass rounded-2xl p-6 mb-6 border-2 border-orange-300 bg-orange-50">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-orange-500 text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-orange-900">You're Being Outbid!</h3>
                <p className="text-orange-700">
                  Another team has the highest bid at £{tiebreaker.current_highest_bid}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Player Card */}
        <div className="glass rounded-2xl p-6 mb-6 border border-white/20">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Player Information</h2>
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
              <svg className="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zm-4 7a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-gray-800 mb-2">{player.name}</h3>
              <div className="flex items-center gap-4 text-sm">
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">
                  {player.position}
                </span>
                <span className="text-gray-600">{player.team_name}</span>
                <span className="text-gray-600">Rating: {player.overall_rating}</span>
              </div>
              <div className="mt-3 text-sm text-gray-600">
                <p>Original bid: £{tiebreaker.original_amount}</p>
                {tiebreaker.my_last_bid && (
                  <p>Your last bid: £{tiebreaker.my_last_bid}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bidding Section */}
        <div className="glass rounded-2xl p-6 mb-6 border border-white/20">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Place Your Bid</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="glass rounded-xl p-4 border border-white/10">
              <div className="text-sm text-gray-600 mb-1">Current Highest Bid</div>
              <div className="text-3xl font-bold text-red-600">£{tiebreaker.current_highest_bid}</div>
              {!isWinning && (
                <div className="text-sm text-gray-600 mt-1">by another team</div>
              )}
            </div>

            <div className="glass rounded-xl p-4 border border-white/10">
              <div className="text-sm text-gray-600 mb-1">Your Balance</div>
              <div className="text-3xl font-bold text-green-600">£{teamBalance}</div>
              <div className="text-sm text-gray-600 mt-1">
                Available after bid: £{teamBalance - parseInt(bidAmount || '0')}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Your Bid Amount</label>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <span className="text-gray-500 text-lg">£</span>
                  </div>
                  <input
                    type="number"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    min={(tiebreaker.current_highest_bid || 0) + 1}
                    className="w-full pl-10 pr-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0066FF] focus:border-[#0066FF]"
                    placeholder="Enter amount"
                  />
                </div>
                <button
                  onClick={() => setBidAmount((tiebreaker.current_highest_bid + 1).toString())}
                  className="px-4 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors text-sm font-medium"
                >
                  Min Bid
                </button>
                <button
                  onClick={() => setBidAmount((tiebreaker.current_highest_bid + 5).toString())}
                  className="px-4 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors text-sm font-medium"
                >
                  +£5
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Minimum bid: £{tiebreaker.current_highest_bid + 1}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handlePlaceBid}
                disabled={isSubmitting || parseInt(bidAmount) <= tiebreaker.current_highest_bid}
                className="flex-1 px-6 py-4 bg-[#0066FF] text-white rounded-xl hover:bg-[#0052CC] transition-colors font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Placing Bid...' : 'Place Bid'}
              </button>
              <button
                onClick={handleWithdraw}
                className="px-6 py-4 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors font-medium"
              >
                Withdraw
              </button>
            </div>
          </div>
        </div>

        {/* Info Card */}
        <div className="glass rounded-2xl p-6 mb-6 border border-white/20 bg-yellow-50">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-yellow-100">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-yellow-900 mb-2">How Tiebreaker Auctions Work</h3>
              <ul className="space-y-1 text-sm text-yellow-800">
                <li>• This is an open auction - the highest bidder wins the player</li>
                <li>• You can continue bidding until the committee closes the auction</li>
                <li>• Each bid must be higher than the current highest bid</li>
                <li>• The last team to bid when the auction closes wins the player</li>
                <li>• You can withdraw at any time if you don't want to continue</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bid History */}
        <div className="glass rounded-2xl p-6 border border-white/20">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Bid History</h2>
          
          {tiebreaker.bid_history.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No bids yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tiebreaker.bid_history.map((bid, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-4 rounded-xl border ${
                    isMyBid(bid.team_id)
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      isMyBid(bid.team_id)
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-300 text-gray-700'
                    }`}>
                      {isMyBid(bid.team_id) ? 'You' : bid.team_name[0]}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">
                        {isMyBid(bid.team_id) ? 'Your Team' : bid.team_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(bid.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900">£{bid.amount}</div>
                    {bid.amount === tiebreaker.current_highest_bid && (
                      <div className="text-xs text-green-600 font-semibold">Highest Bid</div>
                    )}
                  </div>
                </div>
              ))}
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
