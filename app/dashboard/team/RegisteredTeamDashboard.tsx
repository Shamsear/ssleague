'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useModal } from '@/hooks/useModal';
import AlertModal from '@/components/modals/AlertModal';
import ConfirmModal from '@/components/modals/ConfirmModal';
import Image from 'next/image';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';
import ContractInfo from '@/components/ContractInfo';

// Position constants
const POSITIONS = ['GK', 'CB', 'LB', 'RB', 'DMF', 'CMF', 'AMF', 'LMF', 'RMF', 'LWF', 'RWF', 'SS', 'CF'];
const MAX_PLAYERS_PER_TEAM = 25;

interface TeamData {
  id: string;
  name: string;
  balance: number;
  logo_url?: string;
  currency_system?: string;
  dollarBalance?: number;
  euroBalance?: number;
  football_budget?: number;
  real_player_budget?: number;
  football_spent?: number;
  real_player_spent?: number;
  real_players?: Array<{
    name: string;
    auctionValue: number;
    starRating: number;
    category: 'legend' | 'classic';
    points: number;
    salaryPerMatch: number;
    startSeason: string;
    endSeason: string;
  }>;
  skipped_seasons?: number;
  penalty_amount?: number;
  last_played_season?: string;
  contract_id?: string;
  contract_start_season?: string;
  contract_end_season?: string;
  is_auto_registered?: boolean;
}

interface RoundTiebreaker {
  id: number;
  player_id: number;
  player_name: string;
  player_position: string;
  overall_rating: number;
  player_team: string;
  original_amount: number;
  status: string;
  winning_amount?: number;
  teams: Array<{
    team_id: string;
    team_name: string;
    original_bid: number;
    new_bid?: number;
    submitted: boolean;
  }>;
}

interface Round {
  id: string;
  season_id: string;
  round_number?: number;
  position?: string;
  status: string;
  end_time?: string;
  max_bids_per_team?: number;
  total_bids?: number;
  teams_bid?: number;
  player_count?: number;
  players?: Player[];
  tiebreakers?: RoundTiebreaker[];
}

interface Player {
  id: number;
  name: string;
  position: string;
  nfl_team: string;
  overall_rating: number;
  acquisition_value?: number;
}

interface Bid {
  id: number;
  player_id: number;
  player: Player;
  amount: number;
  round_id: number;
}

interface Tiebreaker {
  id: number;
  player_id: number;
  player: Player;
  round_id: number;
  original_amount: number;
  teams_involved: string[];
  status: string;
  new_amount?: number;
}

interface BulkTiebreaker {
  id: number;
  tiebreaker_id: number;
  player_id: number;
  player: Player;
  bulk_round_id: number;
  current_amount: number;
  last_bid?: number;
}

interface BulkRound {
  id: number;
  season_id: string;
  base_price: number;
  status: string;
  end_time?: string;
  available_players_count?: number;
}

interface RoundResult {
  id: number;
  player: Player;
  won: boolean;
  bid_amount: number;
  final_amount: number;
  round: Round;
}

interface SeasonParticipation {
  status: string;
  points_earned: number;
  joined_at?: Date;
}

interface DashboardData {
  team: TeamData;
  activeRounds: Round[];
  activeBids: Bid[];
  players: Player[];
  tiebreakers: Tiebreaker[];
  bulkTiebreakers: BulkTiebreaker[];
  activeBulkRounds: BulkRound[];
  roundResults: RoundResult[];
  seasonParticipation?: SeasonParticipation;
  stats: {
    playerCount: number;
    balance: number;
    totalSpent: number;
    avgRating: number;
    activeBidsCount: number;
    positionBreakdown: { [key: string]: number };
  };
}

interface Props {
  seasonStatus: {
    hasActiveSeason: boolean;
    isRegistered: boolean;
    seasonName?: string;
    seasonId?: string;
  };
  user: any;
}

export default function RegisteredTeamDashboard({ seasonStatus, user }: Props) {
  // State Management
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<{ [key: string]: number }>({});
  const [bulkTimeRemaining, setBulkTimeRemaining] = useState<{ [key: number]: number }>({});
  const [activeTab, setActiveTab] = useState<'auctions' | 'squad' | 'results' | 'overview'>('auctions');
  const [selectedPosition, setSelectedPosition] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [bidSearchTerm, setBidSearchTerm] = useState('');
  const [resultFilter, setResultFilter] = useState<'all' | 'won' | 'lost'>('all');

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
  
  const timerRefs = useRef<{ [key: string]: NodeJS.Timeout }>({});
  const bulkTimerRefs = useRef<{ [key: number]: NodeJS.Timeout }>({});
  const previousDataRef = useRef<string>('');

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboard = async (showLoader = true) => {
      if (!seasonStatus?.seasonId) return;
      if (showLoader) setIsLoading(true);

      try {
        const params = new URLSearchParams({ season_id: seasonStatus.seasonId });
        const response = await fetchWithTokenRefresh(`/api/team/dashboard?${params}`, {
          headers: { 'Cache-Control': 'no-cache' },
        });
        
        if (!response.ok) {
          let errorMessage = `Server error (${response.status})`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch {
            errorMessage = response.status === 404 
              ? 'Team not registered for this season' 
              : `Unable to load dashboard (${response.status})`;
          }
          setError(errorMessage);
          return;
        }

        const { success, data } = await response.json();

        if (success) {
          const dataString = JSON.stringify(data);
          if (dataString !== previousDataRef.current) {
            previousDataRef.current = dataString;
            setDashboardData(data);
            setError(null);
          }
        } else {
          setError(data?.error || 'Failed to load dashboard data');
        }
      } catch (err) {
        console.error('Error fetching dashboard:', err);
        setError('Unable to connect to the server');
      } finally {
        if (showLoader) setIsLoading(false);
      }
    };

    // Small delay to allow AuthContext to refresh token on page load
    const initialTimeout = setTimeout(() => {
      fetchDashboard(true);
    }, 500);

    let interval: NodeJS.Timeout;
    const startPolling = () => {
      const hasActiveContent = 
        (dashboardData?.activeRounds?.length || 0) > 0 ||
        (dashboardData?.activeBulkRounds?.length || 0) > 0 ||
        (dashboardData?.tiebreakers?.length || 0) > 0;
      
      const pollInterval = hasActiveContent ? 3000 : 10000;
      clearInterval(interval);
      interval = setInterval(() => fetchDashboard(false), pollInterval);
    };

    startPolling();
    const restartTimer = setTimeout(startPolling, 100);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
      clearTimeout(restartTimer);
    };
  }, [seasonStatus?.seasonId, dashboardData?.activeRounds?.length, dashboardData?.activeBulkRounds?.length, dashboardData?.tiebreakers?.length, user]);

  // Timer effect for active rounds
  useEffect(() => {
    if (!dashboardData?.activeRounds) return;

    dashboardData.activeRounds.forEach(round => {
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

    Object.keys(timerRefs.current).forEach(id => {
      if (!dashboardData.activeRounds.find(r => r.id === id)) {
        clearInterval(timerRefs.current[id]);
        delete timerRefs.current[id];
      }
    });

    return () => {
      Object.values(timerRefs.current).forEach(timer => clearInterval(timer));
    };
  }, [dashboardData?.activeRounds]);

  // Timer effect for bulk rounds
  useEffect(() => {
    if (!dashboardData?.activeBulkRounds) return;

    dashboardData.activeBulkRounds.forEach(bulkRound => {
      if (bulkRound.end_time && !bulkTimerRefs.current[bulkRound.id]) {
        bulkTimerRefs.current[bulkRound.id] = setInterval(() => {
          const now = new Date().getTime();
          const end = new Date(bulkRound.end_time!).getTime();
          const remaining = Math.max(0, Math.floor((end - now) / 1000));
          setBulkTimeRemaining(prev => ({ ...prev, [bulkRound.id]: remaining }));

          if (remaining <= 0) {
            clearInterval(bulkTimerRefs.current[bulkRound.id]);
            delete bulkTimerRefs.current[bulkRound.id];
          }
        }, 1000);
      }
    });

    Object.keys(bulkTimerRefs.current).forEach(id => {
      const bulkId = parseInt(id);
      if (!dashboardData.activeBulkRounds.find(br => br.id === bulkId)) {
        clearInterval(bulkTimerRefs.current[bulkId]);
        delete bulkTimerRefs.current[bulkId];
      }
    });

    return () => {
      Object.values(bulkTimerRefs.current).forEach(timer => clearInterval(timer));
    };
  }, [dashboardData?.activeBulkRounds]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDeleteBid = async (bidId: number) => {
    const confirmed = await showConfirm({
      type: 'danger',
      title: 'Delete Bid',
      message: 'Are you sure you want to delete this bid?',
      confirmText: 'Delete',
      cancelText: 'Cancel'
    });
    
    if (!confirmed) return;
    
    const bidToDelete = dashboardData?.activeBids.find(b => b.id === bidId);
    if (!bidToDelete) return;

    setDashboardData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        activeBids: prev.activeBids.filter(bid => bid.id !== bidId),
        team: {
          ...prev.team,
          balance: prev.team.balance + bidToDelete.amount,
        },
        stats: {
          ...prev.stats,
          balance: prev.stats.balance + bidToDelete.amount,
          activeBidsCount: prev.stats.activeBidsCount - 1,
        },
      };
    });
    
    try {
      const response = await fetch(`/api/team/bids/${bidId}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (!data.success) {
        setDashboardData(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            activeBids: [...prev.activeBids, bidToDelete],
            team: {
              ...prev.team,
              balance: prev.team.balance - bidToDelete.amount,
            },
            stats: {
              ...prev.stats,
              balance: prev.stats.balance - bidToDelete.amount,
              activeBidsCount: prev.stats.activeBidsCount + 1,
            },
          };
        });
        showAlert({
          type: 'error',
          title: 'Delete Failed',
          message: data.error || 'Failed to delete bid'
        });
      }
    } catch (err) {
      setDashboardData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          activeBids: [...prev.activeBids, bidToDelete],
          team: {
            ...prev.team,
            balance: prev.team.balance - bidToDelete.amount,
          },
          stats: {
            ...prev.stats,
            balance: prev.stats.balance - bidToDelete.amount,
            activeBidsCount: prev.stats.activeBidsCount + 1,
          },
        };
      });
      console.error('Error deleting bid:', err);
      showAlert({
        type: 'error',
        title: 'Delete Failed',
        message: 'Failed to delete bid'
      });
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600 font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (!dashboardData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
        <div className="text-center max-w-md mx-auto">
          <div className="inline-flex items-center justify-center p-4 bg-red-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">Unable to load dashboard</h3>
          <p className="text-gray-600 text-sm mb-6">{error || 'There was an error loading your team data.'}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  const { team, activeRounds, players, tiebreakers, bulkTiebreakers, activeBulkRounds, stats, activeBids, roundResults, seasonParticipation } = dashboardData;

  // Filter players
  const filteredPlayers = players.filter(player => {
    const matchesPosition = selectedPosition === 'all' || player.position === selectedPosition;
    const matchesSearch = player.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesPosition && matchesSearch;
  });

  // Filter bids
  const filteredBids = activeBids.filter(bid =>
    bid.player.name.toLowerCase().includes(bidSearchTerm.toLowerCase())
  );

  // Filter results
  const filteredResults = roundResults.filter(result => {
    if (resultFilter === 'won') return result.won;
    if (resultFilter === 'lost') return !result.won;
    return true;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8 max-w-7xl">
      
        {/* Hero Section - Fully Responsive */}
        <div className="glass rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 mb-4 sm:mb-6 lg:mb-8 shadow-xl border border-white/20 bg-gradient-to-br from-blue-600/10 via-purple-600/5 to-pink-600/10">
          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4 sm:gap-6">
            
            {/* Team Logo & Name - Mobile Optimized */}
            <div className="flex items-center gap-3 sm:gap-4 flex-1 w-full lg:w-auto">
              <div className="relative flex-shrink-0">
                {team.logo_url ? (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 rounded-xl sm:rounded-2xl overflow-hidden ring-4 ring-white/50 shadow-lg">
                    <Image src={team.logo_url} alt={team.name} width={96} height={96} className="object-cover w-full h-full" />
                  </div>
                ) : (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center ring-4 ring-white/50 shadow-lg">
                    <span className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">{team.name.charAt(0)}</span>
                  </div>
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <h1 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold text-gray-900 mb-1 truncate">{team.name}</h1>
                {seasonStatus && (
                  <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                    <span className="px-2 sm:px-3 py-1 rounded-full bg-blue-100 text-blue-700 font-medium">{seasonStatus.seasonName}</span>
                    {seasonParticipation && (
                      <span className="px-2 sm:px-3 py-1 rounded-full bg-green-100 text-green-700 font-medium capitalize">{seasonParticipation.status}</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Key Stats Cards - Responsive Grid */}
            {team.currency_system === 'dual' ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 lg:gap-4 w-full lg:w-auto lg:min-w-[400px]">
                <div className="glass rounded-lg sm:rounded-xl p-2 sm:p-3 lg:p-4 text-center border border-white/20">
                  <div className="text-[10px] sm:text-xs lg:text-sm text-gray-600 mb-0.5 sm:mb-1">€ Football</div>
                  <div className="text-sm sm:text-lg lg:text-2xl font-bold text-blue-600">€{(team.football_budget || 0).toLocaleString()}</div>
                </div>
                <div className="glass rounded-lg sm:rounded-xl p-2 sm:p-3 lg:p-4 text-center border border-white/20">
                  <div className="text-[10px] sm:text-xs lg:text-sm text-gray-600 mb-0.5 sm:mb-1">$ Real</div>
                  <div className="text-sm sm:text-lg lg:text-2xl font-bold text-green-600">${(team.real_player_budget || 0).toLocaleString()}</div>
                </div>
                <div className="glass rounded-lg sm:rounded-xl p-2 sm:p-3 lg:p-4 text-center border border-white/20">
                  <div className="text-[10px] sm:text-xs lg:text-sm text-gray-600 mb-0.5 sm:mb-1">Squad</div>
                  <div className="text-sm sm:text-lg lg:text-2xl font-bold text-purple-600">{stats.playerCount}/{MAX_PLAYERS_PER_TEAM}</div>
                </div>
                <div className="glass rounded-lg sm:rounded-xl p-2 sm:p-3 lg:p-4 text-center border border-white/20">
                  <div className="text-[10px] sm:text-xs lg:text-sm text-gray-600 mb-0.5 sm:mb-1">Avg</div>
                  <div className="text-sm sm:text-lg lg:text-2xl font-bold text-orange-600">{stats.avgRating.toFixed(1)}</div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:gap-4 w-full lg:w-auto lg:min-w-[300px]">
                <div className="glass rounded-lg sm:rounded-xl p-2 sm:p-3 lg:p-4 text-center border border-white/20">
                  <div className="text-[10px] sm:text-xs lg:text-sm text-gray-600 mb-0.5 sm:mb-1">Balance</div>
                  <div className="text-sm sm:text-lg lg:text-2xl font-bold text-green-600">£{stats.balance.toLocaleString()}</div>
                </div>
                <div className="glass rounded-lg sm:rounded-xl p-2 sm:p-3 lg:p-4 text-center border border-white/20">
                  <div className="text-[10px] sm:text-xs lg:text-sm text-gray-600 mb-0.5 sm:mb-1">Squad</div>
                  <div className="text-sm sm:text-lg lg:text-2xl font-bold text-blue-600">{stats.playerCount}/{MAX_PLAYERS_PER_TEAM}</div>
                </div>
                <div className="glass rounded-lg sm:rounded-xl p-2 sm:p-3 lg:p-4 text-center border border-white/20">
                  <div className="text-[10px] sm:text-xs lg:text-sm text-gray-600 mb-0.5 sm:mb-1">Avg</div>
                  <div className="text-sm sm:text-lg lg:text-2xl font-bold text-purple-600">{stats.avgRating.toFixed(1)}</div>
                </div>
              </div>
            )}
          </div>

          {/* Contract Info Banner */}
          {team.contract_id && (
            <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-white/20">
              <ContractInfo
                skippedSeasons={team.skipped_seasons}
                penaltyAmount={team.penalty_amount}
                lastPlayedSeason={team.last_played_season}
                contractId={team.contract_id}
                contractStartSeason={team.contract_start_season}
                contractEndSeason={team.contract_end_season}
                isAutoRegistered={team.is_auto_registered}
              />
            </div>
          )}
        </div>

        {/* Quick Actions Grid - Fully Responsive */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-4 sm:mb-6 lg:mb-8">
          
          {/* Auction Card */}
          <div className="glass rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-white/20 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
              <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-bold text-gray-900 text-sm sm:text-base">Auction</h3>
            </div>
            <div className="space-y-2">
              {activeRounds.length > 0 ? (
                <button onClick={() => setActiveTab('auctions')} className="w-full px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600 transition-all text-xs sm:text-sm font-medium text-center">
                  🔥 {activeRounds.length} Active Round{activeRounds.length > 1 ? 's' : ''}
                </button>
              ) : (
                <div className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl bg-gray-100 text-gray-500 text-xs sm:text-sm text-center">No active rounds</div>
              )}
              {activeBids.length > 0 && (
                <button onClick={() => setActiveTab('auctions')} className="w-full px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl bg-blue-100 text-blue-700 hover:bg-blue-200 transition-all text-xs sm:text-sm font-medium text-center">
                  📋 {activeBids.length} Active Bid{activeBids.length > 1 ? 's' : ''}
                </button>
              )}
              {roundResults.length > 0 && (
                <button onClick={() => setActiveTab('results')} className="w-full px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all text-xs sm:text-sm font-medium text-center">
                  📊 View Results
                </button>
              )}
            </div>
          </div>

          {/* Team Management Card */}
          <div className="glass rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-white/20 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
              <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="font-bold text-gray-900 text-sm sm:text-base">Team</h3>
            </div>
            <div className="space-y-2">
              <button onClick={() => setActiveTab('squad')} className="w-full px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl bg-green-100 text-green-700 hover:bg-green-200 transition-all text-xs sm:text-sm font-medium text-center">
                ⚽ My Squad ({stats.playerCount})
              </button>
              <Link href="/dashboard/team/real-players" className="block w-full px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all text-xs sm:text-sm font-medium text-center">
                👥 Real Players
              </Link>
              <Link href="/dashboard/team/contracts" className="block w-full px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all text-xs sm:text-sm font-medium text-center">
                📄 Contracts
              </Link>
            </div>
          </div>

          {/* Competition Card */}
          <div className="glass rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-white/20 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
              <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="font-bold text-gray-900 text-sm sm:text-base">Competition</h3>
            </div>
            <div className="space-y-2">
              <Link href="/dashboard/team/matches" className="block w-full px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl bg-blue-100 text-blue-700 hover:bg-blue-200 transition-all text-xs sm:text-sm font-medium text-center">
                📅 Matches
              </Link>
              <Link href="/dashboard/team/all-teams" className="block w-full px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all text-xs sm:text-sm font-medium text-center">
                👥 All Teams
              </Link>
              <Link href="/dashboard/team/team-leaderboard" className="block w-full px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all text-xs sm:text-sm font-medium text-center">
                🏆 Team Standings
              </Link>
              <Link href="/dashboard/team/player-leaderboard" className="block w-full px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all text-xs sm:text-sm font-medium text-center">
                📋 Player Stats
              </Link>
              <Link href="/dashboard/team/statistics" className="block w-full px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all text-xs sm:text-sm font-medium text-center">
                📈 Statistics
              </Link>
              <Link href="/dashboard/team/fantasy/my-team" className="block w-full px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 transition-all text-xs sm:text-sm font-medium text-center">
                ⭐ Fantasy
              </Link>
            </div>
          </div>

          {/* Planning Card */}
          <div className="glass rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-white/20 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
              <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="font-bold text-gray-900 text-sm sm:text-base">Planning</h3>
            </div>
            <div className="space-y-2">
              <Link href="/dashboard/team/budget-planner" className="block w-full px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl bg-purple-100 text-purple-700 hover:bg-purple-200 transition-all text-xs sm:text-sm font-medium text-center">
                💰 Budget Planner
              </Link>
              <Link href="/dashboard/team/transactions" className="block w-full px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-all text-xs sm:text-sm font-medium text-center">
                💳 Transactions
              </Link>
              <Link href="/dashboard/team/profile/edit" className="block w-full px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all text-xs sm:text-sm font-medium text-center">
                ⚙️ Settings
              </Link>
              <button onClick={() => setActiveTab('overview')} className="w-full px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all text-xs sm:text-sm font-medium text-center">
                📊 Overview
              </button>
            </div>
          </div>
        </div>

        {/* URGENT: Tiebreaker Alerts - Fully Responsive */}
        {tiebreakers.length > 0 && (
          <div className="glass rounded-2xl sm:rounded-3xl p-4 sm:p-6 mb-4 sm:mb-6 lg:mb-8 border-2 border-yellow-400 shadow-xl animate-pulse">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
              <div className="flex items-center">
                <div className="bg-yellow-100 p-2 rounded-full mr-3">
                  <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-red-600">URGENT: Active Tiebreakers</h2>
                  <p className="text-xs sm:text-sm text-red-500">Action required immediately</p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-lg bg-red-100 text-red-800 text-xs sm:text-sm font-medium">
                {tiebreakers.length} pending
              </span>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
              {tiebreakers.map(tiebreaker => (
                <div key={tiebreaker.id} className={`glass-card p-3 sm:p-4 rounded-xl border-l-4 ${!tiebreaker.new_amount ? 'border-red-400' : 'border-green-400'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-8 h-8 rounded-lg bg-gray-100 text-gray-700 text-xs flex items-center justify-center font-medium">{tiebreaker.player.position}</span>
                        <div className="font-medium text-dark truncate">{tiebreaker.player.name}</div>
                      </div>
                      <div className="text-xs sm:text-sm text-gray-600 mt-1">Round #{tiebreaker.round_id}</div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <div className="text-xs px-2 py-1 bg-white/30 rounded-lg">
                          Original: <span className="font-medium">£{tiebreaker.original_amount.toLocaleString()}</span>
                        </div>
                        {tiebreaker.new_amount && (
                          <div className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-lg">
                            New: <span className="font-medium">£{tiebreaker.new_amount.toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <Link href={`/dashboard/team/tiebreaker/${tiebreaker.id}`} className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium ${!tiebreaker.new_amount ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'} transition-colors whitespace-nowrap`}>
                      {tiebreaker.new_amount ? 'View' : 'Resolve'}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab Navigation - Fully Responsive */}
        <div className="glass rounded-t-2xl sm:rounded-t-3xl border-b border-white/20 overflow-x-auto">
          <div className="flex min-w-max sm:min-w-0">
            <button
              onClick={() => setActiveTab('auctions')}
              className={`flex-1 sm:flex-none px-4 sm:px-6 lg:px-8 py-3 sm:py-4 text-xs sm:text-sm lg:text-base font-medium transition-all ${
                activeTab === 'auctions'
                  ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white'
                  : 'text-gray-600 hover:bg-white/50'
              } rounded-t-2xl sm:rounded-t-3xl`}
            >
              <span className="flex items-center gap-1.5 sm:gap-2 whitespace-nowrap">
                🔥 Auctions
                {(activeRounds.length > 0 || activeBids.length > 0) && (
                  <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-[10px] sm:text-xs font-bold">
                    {activeRounds.length + activeBids.length}
                  </span>
                )}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('squad')}
              className={`flex-1 sm:flex-none px-4 sm:px-6 lg:px-8 py-3 sm:py-4 text-xs sm:text-sm lg:text-base font-medium transition-all ${
                activeTab === 'squad'
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
                  : 'text-gray-600 hover:bg-white/50'
              } rounded-t-2xl sm:rounded-t-3xl`}
            >
              <span className="flex items-center gap-1.5 sm:gap-2 whitespace-nowrap">
                ⚽ Squad
                {players.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-[10px] sm:text-xs font-bold">
                    {players.length}
                  </span>
                )}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('results')}
              className={`flex-1 sm:flex-none px-4 sm:px-6 lg:px-8 py-3 sm:py-4 text-xs sm:text-sm lg:text-base font-medium transition-all ${
                activeTab === 'results'
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white'
                  : 'text-gray-600 hover:bg-white/50'
              } rounded-t-2xl sm:rounded-t-3xl`}
            >
              <span className="flex items-center gap-1.5 sm:gap-2 whitespace-nowrap">
                📊 Results
                {roundResults.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-[10px] sm:text-xs font-bold">
                    {roundResults.length}
                  </span>
                )}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex-1 sm:flex-none px-4 sm:px-6 lg:px-8 py-3 sm:py-4 text-xs sm:text-sm lg:text-base font-medium transition-all ${
                activeTab === 'overview'
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                  : 'text-gray-600 hover:bg-white/50'
              } rounded-t-2xl sm:rounded-t-3xl`}
            >
              <span className="whitespace-nowrap">📈 Overview</span>
            </button>
          </div>
        </div>

        {/* Tab Content - Fully Responsive */}
        <div className="glass rounded-b-2xl sm:rounded-b-3xl p-4 sm:p-6 lg:p-8 mb-4 sm:mb-6 lg:mb-8">
          
          {/* Auctions Tab */}
          {activeTab === 'auctions' && (
            <div className="space-y-4 sm:space-y-6">
              {activeRounds.length === 0 && activeBids.length === 0 ? (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center p-4 bg-gray-100 rounded-full mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-gray-700 mb-2">No Active Auctions</h3>
                  <p className="text-sm text-gray-500">Check back when new rounds start</p>
                </div>
              ) : (
                <>
                  {/* Active Rounds */}
                  {activeRounds.map(round => (
                    <div key={round.id} className="glass-card rounded-xl sm:rounded-2xl p-4 sm:p-6 border-l-4 border-orange-500">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                        <div>
                          <h3 className="text-lg sm:text-xl font-bold text-gray-900">
                            Round #{round.round_number} - {round.position}
                          </h3>
                          <p className="text-xs sm:text-sm text-gray-600 mt-1">
                            {round.player_count} players • Max {round.max_bids_per_team} bids per team
                          </p>
                        </div>
                        {round.end_time && (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-100">
                            <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-sm font-bold text-red-600">
                              {formatTime(timeRemaining[round.id] || 0)}
                            </span>
                          </div>
                        )}
                      </div>
                      <Link 
                        href={`/dashboard/team/round/${round.id}`}
                        className="block w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600 transition-all text-center font-medium"
                      >
                        Enter Round →
                      </Link>
                    </div>
                  ))}

                  {/* Active Bids */}
                  {activeBids.length > 0 && (
                    <div>
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                        <h3 className="text-lg font-bold text-gray-900">My Active Bids ({activeBids.length})</h3>
                        <input
                          type="text"
                          placeholder="Search bids..."
                          value={bidSearchTerm}
                          onChange={(e) => setBidSearchTerm(e.target.value)}
                          className="w-full sm:w-64 px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                        {filteredBids.map(bid => (
                          <div key={bid.id} className="glass-card p-3 sm:p-4 rounded-xl hover:shadow-lg transition-all">
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="px-2 py-1 rounded-lg bg-blue-100 text-blue-700 text-xs font-medium">
                                    {bid.player.position}
                                  </span>
                                  <span className="font-medium text-gray-900 truncate">{bid.player.name}</span>
                                </div>
                                <div className="flex items-center gap-3 text-xs sm:text-sm text-gray-600">
                                  <span>{bid.player.nfl_team}</span>
                                  <span>•</span>
                                  <span className="font-bold text-green-600">£{bid.amount.toLocaleString()}</span>
                                </div>
                              </div>
                              <button
                                onClick={() => handleDeleteBid(bid.id)}
                                className="ml-2 p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Squad Tab */}
          {activeTab === 'squad' && (
            <div className="space-y-4 sm:space-y-6">
              {players.length === 0 ? (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center p-4 bg-gray-100 rounded-full mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-gray-700 mb-2">No Players Yet</h3>
                  <p className="text-sm text-gray-500 mb-4">Start bidding in auctions to build your squad</p>
                  <button 
                    onClick={() => setActiveTab('auctions')}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600 transition-all font-medium"
                  >
                    Go to Auctions
                  </button>
                </div>
              ) : (
                <>
                  {/* Filters */}
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                    <input
                      type="text"
                      placeholder="Search players..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="flex-1 px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                    />
                    <select
                      value={selectedPosition}
                      onChange={(e) => setSelectedPosition(e.target.value)}
                      className="px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                    >
                      <option value="all">All Positions</option>
                      {POSITIONS.map(pos => (
                        <option key={pos} value={pos}>{pos}</option>
                      ))}
                    </select>
                  </div>

                  {/* Squad Stats Summary */}
                  {team.currency_system === 'dual' ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                      <div className="glass-card p-3 sm:p-4 rounded-xl text-center">
                        <div className="text-xs sm:text-sm text-gray-600 mb-1">Total Players</div>
                        <div className="text-xl sm:text-2xl font-bold text-gray-900">{players.length}/{MAX_PLAYERS_PER_TEAM}</div>
                      </div>
                      <div className="glass-card p-3 sm:p-4 rounded-xl text-center">
                        <div className="text-xs sm:text-sm text-gray-600 mb-1">Avg Rating</div>
                        <div className="text-xl sm:text-2xl font-bold text-purple-600">{stats.avgRating.toFixed(1)}</div>
                      </div>
                      <div className="glass-card p-3 sm:p-4 rounded-xl text-center">
                        <div className="text-xs sm:text-sm text-gray-600 mb-1">€ Spent</div>
                        <div className="text-xl sm:text-2xl font-bold text-blue-600">€{(team.football_spent || 0).toLocaleString()}</div>
                      </div>
                      <div className="glass-card p-3 sm:p-4 rounded-xl text-center">
                        <div className="text-xs sm:text-sm text-gray-600 mb-1">€ Left</div>
                        <div className="text-xl sm:text-2xl font-bold text-blue-600">€{(team.football_budget || 0).toLocaleString()}</div>
                      </div>
                      <div className="glass-card p-3 sm:p-4 rounded-xl text-center">
                        <div className="text-xs sm:text-sm text-gray-600 mb-1">$ Budget</div>
                        <div className="text-xl sm:text-2xl font-bold text-green-600">${(team.real_player_budget || 0).toLocaleString()}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="glass-card p-3 sm:p-4 rounded-xl text-center">
                        <div className="text-xs sm:text-sm text-gray-600 mb-1">Total Players</div>
                        <div className="text-xl sm:text-2xl font-bold text-gray-900">{players.length}/{MAX_PLAYERS_PER_TEAM}</div>
                      </div>
                      <div className="glass-card p-3 sm:p-4 rounded-xl text-center">
                        <div className="text-xs sm:text-sm text-gray-600 mb-1">Avg Rating</div>
                        <div className="text-xl sm:text-2xl font-bold text-purple-600">{stats.avgRating.toFixed(1)}</div>
                      </div>
                      <div className="glass-card p-3 sm:p-4 rounded-xl text-center">
                        <div className="text-xs sm:text-sm text-gray-600 mb-1">Total Spent</div>
                        <div className="text-xl sm:text-2xl font-bold text-red-600">£{stats.totalSpent.toLocaleString()}</div>
                      </div>
                      <div className="glass-card p-3 sm:p-4 rounded-xl text-center">
                        <div className="text-xs sm:text-sm text-gray-600 mb-1">Remaining</div>
                        <div className="text-xl sm:text-2xl font-bold text-green-600">£{stats.balance.toLocaleString()}</div>
                      </div>
                    </div>
                  )}

                  {/* Players Grid */}
                  {filteredPlayers.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500">No players match your filters</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                      {filteredPlayers.map(player => (
                        <div key={player.id} className="glass-card p-4 rounded-xl hover:shadow-lg transition-all">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold text-sm">
                                {player.position}
                              </div>
                              <div>
                                <div className="font-bold text-gray-900 text-sm truncate">{player.name}</div>
                                <div className="text-xs text-gray-600">{player.nfl_team}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-100">
                              <svg className="w-3 h-3 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                              <span className="text-xs font-bold text-purple-600">{player.overall_rating}</span>
                            </div>
                          </div>
                          {player.acquisition_value && (
                            <div className="pt-3 border-t border-gray-200">
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-gray-600">Acquisition</span>
                                <span className="font-bold text-green-600">£{player.acquisition_value.toLocaleString()}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Real Players Section (SS Members) */}
                  {team.real_players && team.real_players.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-gray-200">
                      <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <span className="px-3 py-1 rounded-lg bg-purple-100 text-purple-700 text-sm font-medium">
                          👥 Real Players (SS Members)
                        </span>
                        <span className="text-sm text-gray-600">({team.real_players.length})</span>
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                        {team.real_players.map((player, idx) => (
                          <div key={idx} className="glass-card p-4 rounded-xl hover:shadow-lg transition-all border-l-4 border-purple-500">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <div className="font-bold text-gray-900 mb-1">{player.name}</div>
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                                    player.category === 'legend' 
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : 'bg-gray-100 text-gray-700'
                                  }`}>
                                    {player.category === 'legend' ? '⭐ Legend' : 'Classic'}
                                  </span>
                                  <span className="text-xs text-gray-600">
                                    {'★'.repeat(player.starRating)}{'☆'.repeat(10 - player.starRating)}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-200 text-xs">
                              <div>
                                <div className="text-gray-600">Auction</div>
                                <div className="font-bold text-gray-900">${player.auctionValue.toLocaleString()}</div>
                              </div>
                              <div>
                                <div className="text-gray-600">Salary/Match</div>
                                <div className="font-bold text-gray-900">${player.salaryPerMatch.toLocaleString()}</div>
                              </div>
                              <div>
                                <div className="text-gray-600">Points</div>
                                <div className="font-bold text-purple-600">{player.points}</div>
                              </div>
                              <div>
                                <div className="text-gray-600">Contract</div>
                                <div className="font-bold text-gray-900">{player.startSeason}-{player.endSeason}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Results Tab */}
          {activeTab === 'results' && (
            <div className="space-y-4 sm:space-y-6">
              {roundResults.length === 0 ? (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center p-4 bg-gray-100 rounded-full mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-gray-700 mb-2">No Results Yet</h3>
                  <p className="text-sm text-gray-500">Results will appear here after rounds end</p>
                </div>
              ) : (
                <>
                  {/* Filter */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <h3 className="text-lg font-bold text-gray-900">Round Results ({filteredResults.length})</h3>
                    <select
                      value={resultFilter}
                      onChange={(e) => setResultFilter(e.target.value as 'all' | 'won' | 'lost')}
                      className="px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    >
                      <option value="all">All Results</option>
                      <option value="won">Wins Only</option>
                      <option value="lost">Losses Only</option>
                    </select>
                  </div>

                  {/* Results Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                    {filteredResults.map(result => (
                      <div 
                        key={result.id} 
                        className={`glass-card p-4 rounded-xl border-l-4 ${result.won ? 'border-green-500' : 'border-red-500'}`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm ${result.won ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'bg-gradient-to-br from-red-500 to-rose-600'}`}>
                              {result.player.position}
                            </div>
                            <div>
                              <div className="font-bold text-gray-900">{result.player.name}</div>
                              <div className="text-xs text-gray-600">{result.player.nfl_team}</div>
                            </div>
                          </div>
                          <div className={`px-3 py-1 rounded-full text-xs font-bold ${result.won ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {result.won ? '✓ WON' : '✗ LOST'}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-200">
                          <div>
                            <div className="text-xs text-gray-600">Your Bid</div>
                            <div className="text-sm font-bold text-gray-900">£{result.bid_amount.toLocaleString()}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-600">Final Amount</div>
                            <div className={`text-sm font-bold ${result.won ? 'text-green-600' : 'text-red-600'}`}>
                              £{result.final_amount.toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-4 sm:space-y-6">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900">Team Overview</h3>
              
              {/* Position Breakdown */}
              <div>
                <h4 className="text-base font-bold text-gray-800 mb-3">Position Breakdown</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {POSITIONS.map(position => {
                    const count = stats.positionBreakdown[position] || 0;
                    return (
                      <div key={position} className="glass-card p-3 rounded-lg">
                        <div className="text-xs text-gray-600 mb-1">{position}</div>
                        <div className="text-2xl font-bold text-gray-900">{count}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Team Stats */}
              <div>
                <h4 className="text-base font-bold text-gray-800 mb-3">Season Statistics</h4>
                {team.currency_system === 'dual' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="glass-card p-4 sm:p-6 rounded-xl text-center">
                      <div className="text-sm text-gray-600 mb-2">Total Bids</div>
                      <div className="text-3xl font-bold text-blue-600">{activeBids.length + roundResults.length}</div>
                    </div>
                    <div className="glass-card p-4 sm:p-6 rounded-xl text-center">
                      <div className="text-sm text-gray-600 mb-2">Success Rate</div>
                      <div className="text-3xl font-bold text-green-600">
                        {roundResults.length > 0 
                          ? `${Math.round((roundResults.filter(r => r.won).length / roundResults.length) * 100)}%`
                          : '0%'
                        }
                      </div>
                    </div>
                    <div className="glass-card p-4 sm:p-6 rounded-xl text-center">
                      <div className="text-sm text-gray-600 mb-2">€ Spent</div>
                      <div className="text-3xl font-bold text-blue-600">€{(team.football_spent || 0).toLocaleString()}</div>
                    </div>
                    <div className="glass-card p-4 sm:p-6 rounded-xl text-center">
                      <div className="text-sm text-gray-600 mb-2">€ Budget Left</div>
                      <div className="text-3xl font-bold text-blue-600">€{(team.football_budget || 0).toLocaleString()}</div>
                    </div>
                    <div className="glass-card p-4 sm:p-6 rounded-xl text-center">
                      <div className="text-sm text-gray-600 mb-2">$ Real Players</div>
                      <div className="text-3xl font-bold text-green-600">${(team.real_player_budget || 0).toLocaleString()}</div>
                    </div>
                    <div className="glass-card p-4 sm:p-6 rounded-xl text-center">
                      <div className="text-sm text-gray-600 mb-2">Avg Per Player</div>
                      <div className="text-3xl font-bold text-orange-600">
                        €{players.length > 0 ? Math.round((team.football_spent || 0) / players.length).toLocaleString() : '0'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="glass-card p-4 sm:p-6 rounded-xl text-center">
                      <div className="text-sm text-gray-600 mb-2">Total Bids</div>
                      <div className="text-3xl font-bold text-blue-600">{activeBids.length + roundResults.length}</div>
                    </div>
                    <div className="glass-card p-4 sm:p-6 rounded-xl text-center">
                      <div className="text-sm text-gray-600 mb-2">Success Rate</div>
                      <div className="text-3xl font-bold text-green-600">
                        {roundResults.length > 0 
                          ? `${Math.round((roundResults.filter(r => r.won).length / roundResults.length) * 100)}%`
                          : '0%'
                        }
                      </div>
                    </div>
                    <div className="glass-card p-4 sm:p-6 rounded-xl text-center">
                      <div className="text-sm text-gray-600 mb-2">Total Invested</div>
                      <div className="text-3xl font-bold text-purple-600">£{stats.totalSpent.toLocaleString()}</div>
                    </div>
                    <div className="glass-card p-4 sm:p-6 rounded-xl text-center">
                      <div className="text-sm text-gray-600 mb-2">Avg Per Player</div>
                      <div className="text-3xl font-bold text-orange-600">
                        £{players.length > 0 ? Math.round(stats.totalSpent / players.length).toLocaleString() : '0'}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div>
                <h4 className="text-base font-bold text-gray-800 mb-3">Quick Links</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <Link href="/dashboard/team/profile" className="glass-card p-4 rounded-xl hover:shadow-lg transition-all text-center">
                    <div className="text-2xl mb-2">👤</div>
                    <div className="font-medium text-gray-900">Team Profile</div>
                  </Link>
                  <Link href="/dashboard/team/budget-planner" className="glass-card p-4 rounded-xl hover:shadow-lg transition-all text-center">
                    <div className="text-2xl mb-2">💰</div>
                    <div className="font-medium text-gray-900">Budget Planner</div>
                  </Link>
                  <Link href="/dashboard/team/matches" className="glass-card p-4 rounded-xl hover:shadow-lg transition-all text-center">
                    <div className="text-2xl mb-2">📅</div>
                    <div className="font-medium text-gray-900">Match Schedule</div>
                  </Link>
                </div>
              </div>
            </div>
          )}
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
    </div>
  );
}
