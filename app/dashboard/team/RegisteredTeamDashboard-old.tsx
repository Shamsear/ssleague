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
  currency_system?: string; // 'single' | 'dual'
  // Multi-season fields
  dollarBalance?: number;
  euroBalance?: number;
  // Dual currency fields (Season 16+)
  football_budget?: number;  // Euro for football players
  real_player_budget?: number; // Dollar for real players
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
  // Contract fields
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
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<{ [key: string]: number }>({});
  const [bulkTimeRemaining, setBulkTimeRemaining] = useState<{ [key: number]: number }>({});
  const [showYourTeam, setShowYourTeam] = useState(true);
  const [selectedPosition, setSelectedPosition] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [bidSearchTerm, setBidSearchTerm] = useState('');
  const [playerSearchTerm, setPlayerSearchTerm] = useState('');
  const [positionFilter, setPositionFilter] = useState('');
  const [resultFilter, setResultFilter] = useState<'all' | 'won' | 'lost'>('all');
  const [activeTab, setActiveTab] = useState<'auctions' | 'squad' | 'results' | 'overview'>('auctions');

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
          // Handle non-200 responses
          let errorMessage = `Server error (${response.status})`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch {
            // Response is not JSON
            errorMessage = response.status === 404 
              ? 'Team not registered for this season' 
              : `Unable to load dashboard (${response.status})`;
          }
          setError(errorMessage);
          console.error('Dashboard API error:', errorMessage);
          return;
        }

        const { success, data } = await response.json();

        if (success) {
          console.log('📊 Dashboard API Response:', {
            activeRounds: data.activeRounds?.length || 0,
            activeBids: data.activeBids?.length || 0,
            players: data.players?.length || 0
          });
          if (data.activeRounds && data.activeRounds.length > 0) {
            console.log('✅ Active Rounds Data:', data.activeRounds);
          } else {
            console.warn('⚠️ No active rounds in API response');
          }
          const dataString = JSON.stringify(data);
          if (dataString !== previousDataRef.current) {
            previousDataRef.current = dataString;
            setDashboardData(data);
            setError(null);
            console.log('🔄 Dashboard data updated');
          }
        } else {
          console.error('Dashboard API returned error:', data);
          setError(data?.error || 'Failed to load dashboard data');
        }
      } catch (err) {
        console.error('Error fetching dashboard:', err);
        setError('Unable to connect to the server. Please check your internet connection.');
      } finally {
        if (showLoader) setIsLoading(false);
      }
    };

    fetchDashboard(true);

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
      clearInterval(interval);
      clearTimeout(restartTimer);
    };
  }, [seasonStatus?.seasonId, dashboardData?.activeRounds?.length, dashboardData?.activeBulkRounds?.length, dashboardData?.tiebreakers?.length, user]);

  // Timer effect for active rounds
  useEffect(() => {
    if (!dashboardData?.activeRounds) return;

    dashboardData.activeRounds.forEach(round => {
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
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
    
    // Find the bid to delete
    const bidToDelete = dashboardData?.activeBids.find(b => b.id === bidId);
    if (!bidToDelete) return;

    // Optimistic update: immediately remove bid and update balance
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
      const response = await fetchWithTokenRefresh(`/api/team/bids/${bidId}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (!data.success) {
        // Rollback on error: add the bid back and restore balance
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
      // Rollback on error
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

  const handleClearAllBids = async () => {
    const confirmed = await showConfirm({
      type: 'danger',
      title: 'Clear All Bids',
      message: 'Are you sure you want to clear all bids?',
      confirmText: 'Clear All',
      cancelText: 'Cancel'
    });
    
    if (!confirmed) return;
    
    try {
      const response = await fetchWithTokenRefresh('/api/team/bids/clear-all', {
        method: 'POST',
      });
      
      if (response.ok) {
        window.location.reload();
      }
    } catch (err) {
      console.error('Error clearing bids:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="inline-flex items-center justify-center p-3 bg-red-100 rounded-full mb-4">
            <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-700 mb-2">Unable to load dashboard</h3>
          <p className="text-gray-500 text-sm mb-4">{error || 'There was an error loading your team data.'}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-[#0066FF] text-white rounded-lg hover:bg-[#0052CC] transition-colors text-sm"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  const { team, activeRounds, players, tiebreakers, bulkTiebreakers, activeBulkRounds, stats, activeBids, roundResults, seasonParticipation } = dashboardData;

  // Filter players based on search and position
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
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 max-w-7xl">
      
      {/* Hero Section - Team Header */}
      <div className="glass rounded-3xl p-6 sm:p-8 mb-6 sm:mb-8 shadow-xl border border-white/20 bg-gradient-to-br from-blue-600/10 via-purple-600/5 to-pink-600/10">
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6">
          {/* Team Logo & Name */}
          <div className="flex items-center gap-4 flex-1">
            <div className="relative">
              {team.logo_url ? (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden ring-4 ring-white/50 shadow-lg">
                  <Image src={team.logo_url} alt={team.name} width={96} height={96} className="object-cover" />
                </div>
              ) : (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center ring-4 ring-white/50 shadow-lg">
                  <span className="text-3xl sm:text-4xl font-bold text-white">{team.name.charAt(0)}</span>
                </div>
              )}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-1">{team.name}</h1>
              {seasonStatus && (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 font-medium">{seasonStatus.seasonName}</span>
                  {seasonParticipation && (
                    <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 font-medium capitalize">{seasonParticipation.status}</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Key Stats Cards */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4 w-full lg:w-auto">
            <div className="glass rounded-xl p-3 sm:p-4 text-center border border-white/20">
              <div className="text-xs sm:text-sm text-gray-600 mb-1">Balance</div>
              <div className="text-lg sm:text-2xl font-bold text-green-600">£{stats.balance.toLocaleString()}</div>
            </div>
            <div className="glass rounded-xl p-3 sm:p-4 text-center border border-white/20">
              <div className="text-xs sm:text-sm text-gray-600 mb-1">Squad</div>
              <div className="text-lg sm:text-2xl font-bold text-blue-600">{stats.playerCount}/{MAX_PLAYERS_PER_TEAM}</div>
            </div>
            <div className="glass rounded-xl p-3 sm:p-4 text-center border border-white/20">
              <div className="text-xs sm:text-sm text-gray-600 mb-1">Avg Rating</div>
              <div className="text-lg sm:text-2xl font-bold text-purple-600">{stats.avgRating.toFixed(1)}</div>
            </div>
          </div>
        </div>

        {/* Contract Info Banner */}
        {team.contract_id && (
          <div className="mt-6 pt-6 border-t border-white/20">
            <ContractInfo team={team} />
          </div>
        )}
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
        {/* Auction Section */}
        <div className="glass rounded-2xl p-5 border border-white/20 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="font-bold text-gray-900">Auction</h3>
          </div>
          <div className="space-y-2">
            {activeRounds.length > 0 && (
              <Link href="#active-rounds" className="block px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600 transition-all text-sm font-medium text-center">
                🔥 {activeRounds.length} Active Round{activeRounds.length > 1 ? 's' : ''}
              </Link>
            )}
            {activeBids.length > 0 && (
              <Link href="#my-bids" className="block px-4 py-2.5 rounded-xl bg-blue-100 text-blue-700 hover:bg-blue-200 transition-all text-sm font-medium text-center">
                📋 {activeBids.length} Active Bid{activeBids.length > 1 ? 's' : ''}
              </Link>
            )}
            {roundResults.length > 0 && (
              <Link href="#results" className="block px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all text-sm font-medium text-center">
                📊 View Results
              </Link>
            )}
          </div>
        </div>

        {/* Team Management */}
        <div className="glass rounded-2xl p-5 border border-white/20 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="font-bold text-gray-900">Team</h3>
          </div>
          <div className="space-y-2">
            <Link href="#squad" className="block px-4 py-2.5 rounded-xl bg-green-100 text-green-700 hover:bg-green-200 transition-all text-sm font-medium text-center">
              ⚽ My Squad ({stats.playerCount})
            </Link>
            <Link href="/dashboard/team/real-players" className="block px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all text-sm font-medium text-center">
              👥 Real Players
            </Link>
            <Link href="/dashboard/team/contracts" className="block px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all text-sm font-medium text-center">
              📄 Contracts
            </Link>
          </div>
        </div>

        {/* Competition */}
        <div className="glass rounded-2xl p-5 border border-white/20 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="font-bold text-gray-900">Competition</h3>
          </div>
          <div className="space-y-2">
            <Link href="/dashboard/team/matches" className="block px-4 py-2.5 rounded-xl bg-blue-100 text-blue-700 hover:bg-blue-200 transition-all text-sm font-medium text-center">
              📅 Matches
            </Link>
            <Link href="/dashboard/team/team-leaderboard" className="block px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all text-sm font-medium text-center">
              🏆 Leaderboard
            </Link>
            <Link href="/dashboard/team/fantasy/my-team" className="block px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 transition-all text-sm font-medium text-center">
              ⭐ Fantasy
            </Link>
          </div>
        </div>

        {/* Planning */}
        <div className="glass rounded-2xl p-5 border border-white/20 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="font-bold text-gray-900">Planning</h3>
          </div>
          <div className="space-y-2">
            <Link href="/dashboard/team/budget-planner" className="block px-4 py-2.5 rounded-xl bg-purple-100 text-purple-700 hover:bg-purple-200 transition-all text-sm font-medium text-center">
              💰 Budget Planner
            </Link>
            <Link href="/dashboard/team/profile/edit" className="block px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all text-sm font-medium text-center">
              ⚙️ Team Settings
            </Link>
          </div>
        </div>
      </div>

      {/* URGENT: Tiebreaker Section */}
      {tiebreakers.length > 0 && (
        <div className="glass rounded-3xl p-4 sm:p-6 mb-6 sm:mb-8 border-2 border-yellow-400 shadow-lg hover:shadow-xl transition-all duration-300 animate-pulse">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-3">
            <div className="flex items-center">
              <div className="bg-yellow-100 p-2 rounded-full mr-3">
                <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-red-600">URGENT: Active Tiebreakers</h2>
                <p className="text-sm text-red-500">Action required: Resolve tie bids immediately</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-red-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="px-3 py-1 rounded-lg bg-red-100 text-red-800 text-sm font-medium">
                {tiebreakers.length} pending - High Priority
              </span>
            </div>
          </div>
          
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 rounded-r-xl">
            <div className="flex items-start">
              <div className="flex-shrink-0 mt-0.5">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700 leading-relaxed">
                  <strong className="text-yellow-800">Important:</strong> You must resolve tiebreakers as soon as possible to continue the auction process.
                </p>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {tiebreakers.map(tiebreaker => (
              <div key={tiebreaker.id} className={`glass-card p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:shadow-md transition-all duration-300 ${!tiebreaker.new_amount ? 'border-l-4 border-red-400' : 'border-l-4 border-green-400'}`}>
                <div>
                  <div className="flex items-center">
                    <span className="inline-block w-8 h-8 rounded-lg bg-gray-100 text-gray-700 text-xs flex items-center justify-center font-medium mr-2">{tiebreaker.player.position}</span>
                    <div className="font-medium text-dark">{tiebreaker.player.name}</div>
                  </div>
                  <div className="text-sm text-gray-600 mt-1 mb-2">Round #{tiebreaker.round_id}</div>
                  <div className="flex flex-wrap gap-2">
                    <div className="text-xs inline-block px-2 py-1 bg-white/30 rounded-lg">
                      Original bid: <span className="font-medium">£{tiebreaker.original_amount.toLocaleString()}</span>
                    </div>
                    {tiebreaker.new_amount ? (
                      <div className="text-xs inline-block px-2 py-1 bg-green-100 text-green-800 rounded-lg">
                        New bid: <span className="font-medium">£{tiebreaker.new_amount.toLocaleString()}</span>
                      </div>
                    ) : (
                      <div className="text-xs text-red-600 font-medium mt-1 flex items-center animate-pulse">
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Action required now
                      </div>
                    )}
                  </div>
                </div>
                <Link href={`/dashboard/team/tiebreaker/${tiebreaker.id}`} className={`px-4 py-2 rounded-xl ${!tiebreaker.new_amount ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-[#0066FF]/10 text-[#0066FF] hover:bg-[#0066FF]/20'} transition-colors duration-300 text-sm font-medium flex items-center`}>
                  {tiebreaker.new_amount ? (
                    <>
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      View Details
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Resolve Now
                    </>
                  )}
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* URGENT: Bulk Tiebreaker Section */}
      {bulkTiebreakers.length > 0 && (
        <div className="glass rounded-3xl p-4 sm:p-6 mb-6 sm:mb-8 border-2 border-purple-400 shadow-lg hover:shadow-xl transition-all duration-300 animate-pulse">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-3">
            <div className="flex items-center">
              <div className="bg-purple-100 p-2 rounded-full mr-3">
                <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-purple-600">URGENT: Bulk Bidding Tiebreakers</h2>
                <p className="text-sm text-purple-500">Action required: Resolve tie bids for bulk auction</p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-lg bg-purple-100 text-purple-800 text-sm font-medium">
              {bulkTiebreakers.length} pending - High Priority
            </span>
          </div>
          
          <div className="bg-purple-50 border-l-4 border-purple-400 p-4 mb-6 rounded-r-xl">
            <div className="flex items-start">
              <div className="flex-shrink-0 mt-0.5">
                <svg className="h-5 w-5 text-purple-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-purple-700 leading-relaxed">
                  <strong className="text-purple-800">Important:</strong> Multiple teams have bid for the same player in the bulk bidding round.
                </p>
              </div>
            </div>
          </div>
          
          {bulkTiebreakers.length > 0 && bulkTiebreakers.slice(0, 1).map(bulkTiebreaker => (
            <div key={bulkTiebreaker.id} className="glass-card p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:shadow-md transition-all duration-300 border-l-4 border-purple-400">
              <div>
                <div className="flex items-center">
                  <span className="inline-block w-8 h-8 rounded-lg bg-gray-100 text-gray-700 text-xs flex items-center justify-center font-medium mr-2">{bulkTiebreaker.player.position}</span>
                  <div className="font-medium text-dark">{bulkTiebreaker.player.name}</div>
                </div>
                <div className="text-sm text-gray-600 mt-1 mb-2">Bulk Round #{bulkTiebreaker.bulk_round_id}</div>
                <div className="flex flex-wrap gap-2">
                  <div className="text-xs inline-block px-2 py-1 bg-white/30 rounded-lg">
                    Base Price: <span className="font-medium">£{bulkTiebreaker.current_amount.toLocaleString()}</span>
                  </div>
                  {bulkTiebreaker.last_bid ? (
                    <div className="text-xs inline-block px-2 py-1 bg-green-100 text-green-800 rounded-lg">
                      Your bid: <span className="font-medium">£{bulkTiebreaker.last_bid.toLocaleString()}</span>
                    </div>
                  ) : (
                    <div className="text-xs text-purple-600 font-medium mt-1 flex items-center animate-pulse">
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Action required now
                    </div>
                  )}
                </div>
                {bulkTiebreakers.length > 1 && (
                  <div className="text-xs text-purple-600 font-medium mt-2 flex items-center">
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    {bulkTiebreakers.length - 1} more player(s) requiring action
                  </div>
                )}
              </div>
              <Link href={`/dashboard/team/bulk-tiebreaker/${bulkTiebreaker.tiebreaker_id}`} className="px-4 py-2 rounded-xl bg-purple-500 text-white hover:bg-purple-600 transition-colors duration-300 text-sm font-medium flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Enter Tiebreaker
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Live Bulk Bidding Round Section */}
      {activeBulkRounds.map(bulkRound => (
        <div key={bulkRound.id} className="relative overflow-hidden bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 rounded-3xl p-6 sm:p-8 mb-6 sm:mb-8 shadow-2xl hover:shadow-purple-500/25 transition-all duration-500 transform hover:scale-[1.02]">
          {/* Animated Background Elements */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-4 left-4 w-16 h-16 bg-white/20 rounded-full animate-pulse"></div>
            <div className="absolute top-12 right-8 w-8 h-8 bg-pink-300/30 rounded-full animate-bounce"></div>
            <div className="absolute bottom-6 left-12 w-12 h-12 bg-indigo-300/30 rounded-full animate-bounce"></div>
            <div className="absolute bottom-4 right-4 w-6 h-6 bg-purple-300/40 rounded-full animate-pulse"></div>
          </div>
          
          {/* Live Status Indicator */}
          <div className="relative z-10 flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div className="flex items-center bg-red-500 text-white px-3 py-1.5 rounded-full text-xs font-bold animate-pulse">
                <div className="w-2 h-2 bg-white rounded-full mr-2 animate-ping"></div>
                LIVE NOW
              </div>
              
              <div className="flex items-center bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-xl">
                <svg className="w-5 h-5 mr-2 text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-mono font-bold">{formatTime(bulkTimeRemaining[bulkRound.id] || 0)}</span>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-white/80 text-xs font-medium mb-1">Participation Status</div>
              <div className="flex items-center text-green-300">
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-medium">Active</span>
              </div>
            </div>
          </div>
          
          {/* Main Content */}
          <div className="relative z-10">
            <div className="text-center mb-8">
              <div className="inline-flex items-center bg-white/10 backdrop-blur-sm rounded-full px-6 py-3 mb-4">
                <svg className="w-8 h-8 text-yellow-300 mr-3 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="text-white text-lg font-bold">BULK BIDDING ROUND</span>
              </div>
              
              <h2 className="text-3xl sm:text-4xl font-black text-white mb-2 tracking-tight">
                Build Your Squad Fast!
              </h2>
              <p className="text-purple-100 text-lg font-medium">
                Fixed Price: <span className="text-yellow-300 text-xl font-bold">£{bulkRound.base_price.toLocaleString()}</span> per player
              </p>
            </div>
            
            {/* Key Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 text-center hover:bg-white/20 transition-all duration-300">
                <div className="w-12 h-12 bg-green-400 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-white font-bold text-sm mb-1">Fixed Pricing</h3>
                <p className="text-purple-200 text-xs">No bidding wars, just select and pay</p>
              </div>
              
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 text-center hover:bg-white/20 transition-all duration-300">
                <div className="w-12 h-12 bg-blue-400 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-white font-bold text-sm mb-1">Multiple Players</h3>
                <p className="text-purple-200 text-xs">Select as many as you can afford</p>
              </div>
              
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 text-center hover:bg-white/20 transition-all duration-300">
                <div className="w-12 h-12 bg-orange-400 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-white font-bold text-sm mb-1">Limited Time</h3>
                <p className="text-purple-200 text-xs">Act fast before time runs out</p>
              </div>
            </div>
            
            {/* Action Button */}
            <div className="text-center">
              <Link href={`/dashboard/team/bulk-round/${bulkRound.id}`} className="group inline-flex items-center bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-black font-bold px-8 py-4 rounded-2xl shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300">
                <svg className="w-6 h-6 mr-3 group-hover:animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="text-lg">Enter Bulk Round</span>
                <svg className="w-6 h-6 ml-3 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              
              {/* Quick Stats */}
              <div className="mt-6 flex justify-center items-center space-x-8 text-sm">
                <div className="text-center">
                  <div className="text-white/80 font-medium">Your Balance</div>
                  <div className="text-green-300 font-bold text-lg">£{team.balance.toLocaleString()}</div>
                </div>
                <div className="w-px h-8 bg-white/30"></div>
                <div className="text-center">
                  <div className="text-white/80 font-medium">Available Players</div>
                  <div className="text-blue-300 font-bold text-lg">{bulkRound.available_players_count || 'Many'}</div>
                </div>
                <div className="w-px h-8 bg-white/30"></div>
                <div className="text-center">
                  <div className="text-white/80 font-medium">Max Players</div>
                  <div className="text-purple-300 font-bold text-lg">{Math.floor(team.balance / bulkRound.base_price)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Team Overview */}
      <div className="glass rounded-3xl p-4 sm:p-6 mb-6 sm:mb-8 hover:shadow-lg transition-all duration-300">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-3">
          <div className="flex items-center">
            <div className="mr-3 relative group">
              {team.logo_url ? (
                <Image src={team.logo_url} alt={`${team.name} logo`} width={48} height={48} className="w-12 h-12 rounded-lg object-contain border-2 border-[#0066FF]/20 shadow-md group-hover:shadow-lg transition-all duration-300 group-hover:scale-105" />
              ) : (
                <div className="w-12 h-12 bg-gradient-to-br from-[#0066FF]/20 to-[#0066FF]/30 rounded-lg flex items-center justify-center border-2 border-[#0066FF]/20 shadow-md group-hover:shadow-lg transition-all duration-300 group-hover:scale-105">
                  <svg className="w-6 h-6 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              )}
            </div>
            <div>
              <Link href="/dashboard/team/profile" className="group">
                <h2 className="text-xl font-bold text-dark group-hover:text-[#0066FF] transition-colors">{team.name}</h2>
                <span className="text-sm font-normal text-gray-500 group-hover:text-[#0066FF]/70 transition-colors">Team Overview • Click to view profile</span>
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {team.currency_system === 'dual' ? (
              <>
                <span className="px-4 py-2 rounded-xl bg-white/60 text-[#0066FF] font-medium shadow-sm flex items-center">
                  <span className="mr-2">⚽ €</span>
                  {(team.football_budget || 0).toLocaleString()}
                </span>
                <span className="px-4 py-2 rounded-xl bg-white/60 text-[#0066FF] font-medium shadow-sm flex items-center">
                  <span className="mr-2">🎮 $</span>
                  {(team.real_player_budget || 0).toLocaleString()}
                </span>
              </>
            ) : (
              <span className="px-4 py-2 rounded-xl bg-white/60 text-[#0066FF] font-medium shadow-sm flex items-center">
                <svg className="w-5 h-5 mr-2 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Balance: £{stats.balance.toLocaleString()}
              </span>
            )}
          </div>
        </div>
        
        {/* Multi-Season Balance Display */}
        {(team.dollarBalance !== undefined || team.euroBalance !== undefined) && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
              <svg className="w-4 h-4 mr-2 text-[#9580FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Multi-Season Budgets
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="glass-card p-4 rounded-2xl border-2 border-[#9580FF]/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-600">Dollar Balance</span>
                  <span className="text-xs px-2 py-1 rounded-lg bg-green-100 text-green-700">Real Players</span>
                </div>
                <p className="text-2xl font-bold text-[#9580FF]">${team.dollarBalance?.toLocaleString() || 0}</p>
                <p className="text-xs text-gray-500 mt-1">For SS Members</p>
              </div>
              <div className="glass-card p-4 rounded-2xl border-2 border-[#0066FF]/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-600">Euro Balance</span>
                  <span className="text-xs px-2 py-1 rounded-lg bg-blue-100 text-blue-700">Football Players</span>
                </div>
                <p className="text-2xl font-bold text-[#0066FF]">€{team.euroBalance?.toLocaleString() || 0}</p>
                <p className="text-xs text-gray-500 mt-1">For In-App Auction</p>
              </div>
            </div>
          </div>
        )}

        {/* Multi-Season Real Players (SS Members) Contracts */}
        {team.real_players && team.real_players.length > 0 && (
          <div className="mb-6 glass-card p-6 rounded-2xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-[#9580FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Real Players (SS Members)
              <span className="ml-2 px-2 py-1 rounded-lg bg-[#9580FF]/10 text-[#9580FF] text-xs font-medium">
                {team.real_players.length} Active
              </span>
            </h3>
            <div className="space-y-3">
              {team.real_players.map((player, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-gradient-to-r from-white/50 to-white/30 border border-gray-200/50 hover:shadow-md transition-all">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-semibold text-gray-900">{player.name}</h4>
                      <div className="flex items-center gap-2 mt-1">
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
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-700">${player.salaryPerMatch}/match</p>
                      <p className="text-xs text-gray-500">Salary</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-200/50">
                    <div>
                      <p className="text-xs text-gray-600">Auction</p>
                      <p className="text-sm font-medium text-gray-900">${player.auctionValue}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Points</p>
                      <p className="text-sm font-medium text-gray-900">{player.points}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Contract</p>
                      <p className="text-sm font-medium text-gray-900">{player.startSeason}-{player.endSeason}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contract Information */}
        <div className="mb-6">
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {/* Team Stats */}
          <div className="glass-card p-4 sm:p-5 rounded-2xl hover:shadow-md transition-all duration-300 hover:translate-y-[-4px]">
            <div className="flex items-center mb-3">
              <svg className="w-5 h-5 text-[#0066FF] mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <h3 className="text-md font-medium text-dark">Team Stats</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/30 p-2 sm:p-3 rounded-xl border border-gray-100/50">
                <p className="text-xs text-gray-600">Players</p>
                <p className="text-lg font-medium text-dark flex items-baseline">
                  {stats.playerCount}
                  <span className="text-xs ml-1 text-gray-500">/ {MAX_PLAYERS_PER_TEAM}</span>
                </p>
              </div>
              <div className="bg-white/30 p-2 sm:p-3 rounded-xl border border-gray-100/50">
                <p className="text-xs text-gray-600">Avg. Rating</p>
                <p className="text-lg font-medium text-dark">
                  {stats.avgRating > 0 ? stats.avgRating.toFixed(1) : '-'}
                </p>
              </div>
              <div className="bg-white/30 p-2 sm:p-3 rounded-xl border border-gray-100/50">
                <p className="text-xs text-gray-600">Active Bids</p>
                <p className={`text-lg font-medium ${stats.activeBidsCount > 0 ? 'text-[#0066FF]' : 'text-dark'}`}>
                  {stats.activeBidsCount}
                </p>
              </div>
              <div className="bg-white/30 p-2 sm:p-3 rounded-xl border border-gray-100/50">
                <p className="text-xs text-gray-600">Total Spent</p>
                <p className={`text-lg font-medium ${stats.totalSpent > 0 ? 'text-accent' : 'text-dark'}`}>
                  £{stats.totalSpent.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="glass-card p-4 sm:p-5 rounded-2xl hover:shadow-md transition-all duration-300 hover:translate-y-[-4px]">
            <div className="flex items-center mb-3">
              <svg className="w-5 h-5 text-[#0066FF] mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <h3 className="text-md font-medium text-dark">Quick Links</h3>
            </div>
            <div className="space-y-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Link href="/dashboard/team/players" className="flex items-center px-3 py-2 rounded-xl hover:bg-white/40 transition-colors duration-200 group">
                <div className="bg-[#0066FF]/10 p-1.5 rounded-lg mr-2 group-hover:bg-[#0066FF]/20 transition-colors">
                  <svg className="w-4 h-4 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <span className="text-sm text-gray-700">View My Players</span>
              </Link>
              <Link href="/dashboard/team/statistics" className="flex items-center px-3 py-2 rounded-xl hover:bg-white/40 transition-colors duration-200 group">
                <div className="bg-[#0066FF]/10 p-1.5 rounded-lg mr-2 group-hover:bg-[#0066FF]/20 transition-colors">
                  <svg className="w-4 h-4 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <span className="text-sm text-gray-700">Player Database</span>
              </Link>
              <Link href="/dashboard/team/team-leaderboard" className="flex items-center px-3 py-2 rounded-xl hover:bg-white/40 transition-colors duration-200 group">
                <div className="bg-[#0066FF]/10 p-1.5 rounded-lg mr-2 group-hover:bg-[#0066FF]/20 transition-colors">
                  <svg className="w-4 h-4 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <span className="text-sm text-gray-700">Team Leaderboard</span>
              </Link>
              <Link href="/dashboard/team/player-leaderboard" className="flex items-center px-3 py-2 rounded-xl hover:bg-white/40 transition-colors duration-200 group">
                <div className="bg-[#0066FF]/10 p-1.5 rounded-lg mr-2 group-hover:bg-[#0066FF]/20 transition-colors">
                  <svg className="w-4 h-4 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <span className="text-sm text-gray-700">Player Leaderboard</span>
              </Link>
              <Link href="/dashboard/team/bids" className="flex items-center px-3 py-2 rounded-xl hover:bg-white/40 transition-colors duration-200 group">
                <div className="bg-[#0066FF]/10 p-1.5 rounded-lg mr-2 group-hover:bg-[#0066FF]/20 transition-colors">
                  <svg className="w-4 h-4 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <span className="text-sm text-gray-700">Bidding History</span>
              </Link>
              <Link href="/dashboard/team/transfers" className="flex items-center px-3 py-2 rounded-xl hover:bg-white/40 transition-colors duration-200 group">
                <div className="bg-accent/10 p-1.5 rounded-lg mr-2 group-hover:bg-accent/20 transition-colors">
                  <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <span className="text-sm text-gray-700">Transfer Market</span>
              </Link>
              <Link href="/dashboard/team/fantasy/my-team" className="flex items-center px-3 py-2 rounded-xl hover:bg-white/40 transition-colors duration-200 group">
                <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 p-1.5 rounded-lg mr-2 group-hover:from-purple-500/20 group-hover:to-pink-500/20 transition-colors">
                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <span className="text-sm text-gray-700">Fantasy League 🏆</span>
              </Link>
              <Link href="/dashboard/team/all-teams" className="flex items-center px-3 py-2 rounded-xl hover:bg-white/40 transition-colors duration-200 group">
                <div className="bg-[#0066FF]/10 p-1.5 rounded-lg mr-2 group-hover:bg-[#0066FF]/20 transition-colors">
                  <svg className="w-4 h-4 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <span className="text-sm text-gray-700">All Teams</span>
              </Link>
              <Link href="/dashboard/team/compare" className="flex items-center px-3 py-2 rounded-xl hover:bg-white/40 transition-colors duration-200 group">
                <div className="bg-indigo-100 p-1.5 rounded-lg mr-2 group-hover:bg-indigo-200 transition-colors">
                  <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <span className="text-sm text-gray-700">Compare Teams</span>
              </Link>
              {activeRounds.length > 0 && (
                <Link href={`/dashboard/team/round/${activeRounds[0].id}`} className="flex items-center px-3 py-2 rounded-xl hover:bg-white/40 transition-colors duration-200 group">
                  <div className="bg-green-100 p-1.5 rounded-lg mr-2 group-hover:bg-green-200 transition-colors">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <span className="text-sm text-gray-700 flex items-center">
                    Current Round 
                    <span className="ml-auto px-2 py-1 text-xs rounded-md bg-green-100 text-green-800">Active</span>
                  </span>
                </Link>
              )}
            </div>
          </div>

          {/* Position Breakdown */}
          <div className="glass-card p-4 sm:p-5 rounded-2xl hover:shadow-md transition-all duration-300 hover:translate-y-[-4px]">
            <div className="flex items-center mb-3">
              <svg className="w-5 h-5 text-[#0066FF] mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
              <h3 className="text-md font-medium text-dark">Position Breakdown</h3>
            </div>
            <div className="space-y-3">
              {POSITIONS.map(position => {
                const count = stats.positionBreakdown[position] || 0;
                const percentage = (count / 4 * 100);
                const cappedPercentage = Math.min(percentage, 100);
                
                return (
                  <div key={position} className="bg-white/30 p-2 sm:p-3 rounded-xl border border-gray-100/50">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center">
                        <span className="inline-block w-6 h-6 rounded-full bg-[#0066FF]/10 text-[#0066FF] text-xs flex items-center justify-center font-medium mr-2">
                          {position[0]}
                        </span>
                        <span className="text-sm font-medium text-gray-700">{position}</span>
                      </div>
                      <span className="text-sm font-medium text-dark">{count}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div 
                        className={`h-2.5 rounded-full ${
                          cappedPercentage >= 100 ? 'bg-green-500' :
                          cappedPercentage >= 50 ? 'bg-blue-500' :
                          cappedPercentage > 0 ? 'bg-yellow-500' : 'bg-gray-300'
                        }`}
                        style={{ width: `${cappedPercentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Active Rounds Display */}
      {activeRounds.map(round => (
        <div key={round.id} className="bg-white/90 backdrop-blur-lg rounded-2xl shadow-xl p-4 sm:p-6 mb-6 sm:mb-8 hover:shadow-2xl transition-all duration-300">
          <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-3">
            <div className="flex items-center">
              <div className="bg-[#0066FF]/10 p-2 rounded-full mr-3">
                <svg className="w-6 h-6 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-dark">Active Round: {round.position}</h2>
                <p className="text-sm text-gray-500">Place bids on available players</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link href={`/dashboard/team/round/${round.id}`} className="px-4 py-2 bg-[#0066FF] text-white rounded-xl hover:bg-[#0052CC] text-sm font-medium flex items-center transition-colors duration-300">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                View Full Round
              </Link>
              <div className="text-sm font-medium bg-gray-100 px-4 py-2 rounded-full flex items-center">
                <svg className="w-4 h-4 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Time: <span className="font-mono font-medium ml-1">{formatTime(timeRemaining[round.id] || 0)}</span>
              </div>
            </div>
          </div>

          {/* Current Bids Section */}
          <div className="glass rounded-3xl p-4 sm:p-6 mb-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-3">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-[#0066FF] mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <h2 className="text-xl font-bold text-dark">Current Bids</h2>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Search bids..." 
                    value={bidSearchTerm}
                    onChange={(e) => setBidSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-[#0066FF] focus:border-[#0066FF] text-sm w-full sm:w-auto"
                  />
                  <svg className="w-5 h-5 text-gray-500 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <button 
                  onClick={handleClearAllBids}
                  className="px-3 py-2 bg-red-100 text-red-700 rounded-xl hover:bg-red-200 transition-colors text-sm font-medium flex items-center"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Clear All Bids
                </button>
              </div>
            </div>
            
            {filteredBids.length > 0 ? (
              <div className="relative overflow-x-auto rounded-xl">
                <table className="w-full table-auto">
                  <thead className="bg-gray-100/50 text-left text-xs text-gray-700 uppercase">
                    <tr>
                      <th className="px-4 py-3 rounded-tl-xl">Player</th>
                      <th className="px-4 py-3">Position</th>
                      <th className="px-4 py-3 text-right">Bid Amount</th>
                      <th className="px-4 py-3 text-right rounded-tr-xl">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredBids.map(bid => (
                      <tr key={bid.id} className="bg-white/50 hover:bg-gray-50/50 transition-colors duration-300">
                        <td className="px-4 py-3 font-medium text-dark">{bid.player.name}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 text-gray-800 text-xs">
                            {bid.player.position}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-[#0066FF]">£{bid.amount.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end space-x-2">
                            <Link href={`/dashboard/team/edit-bid/${bid.id}`} className="text-blue-500 hover:text-blue-700 transition-colors p-1 rounded-lg hover:bg-blue-50">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </Link>
                            <button 
                              onClick={() => handleDeleteBid(bid.id)}
                              className="text-red-500 hover:text-red-700 transition-colors p-1 rounded-lg hover:bg-red-50"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 bg-white/30 rounded-xl">
                <div className="inline-flex items-center justify-center p-3 bg-blue-100 rounded-full mb-4">
                  <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-700 mb-2">You haven't placed any bids yet</h3>
                <p className="text-gray-500 text-sm max-w-md mx-auto mb-4">Browse the available players section to place bids</p>
                <Link href={`/dashboard/team/round/${round.id}`} className="inline-flex items-center px-4 py-2 bg-[#0066FF] text-white rounded-lg hover:bg-[#0052CC] transition-colors text-sm">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Place Bids Now
                </Link>
              </div>
            )}
          </div>

          {/* Round Tiebreakers Section */}
          {round.tiebreakers && round.tiebreakers.length > 0 && (
            <div className="glass rounded-3xl p-4 sm:p-6 mb-6 border-2 border-yellow-400">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-3">
                <div className="flex items-center">
                  <div className="bg-yellow-100 p-2 rounded-full mr-3">
                    <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-yellow-600">Active Tiebreakers in This Round</h2>
                    <p className="text-sm text-yellow-500">Teams with tied bids - View details and submit new bids</p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-lg bg-yellow-100 text-yellow-800 text-sm font-medium">
                  {round.tiebreakers.length} tiebreaker{round.tiebreakers.length > 1 ? 's' : ''}
                </span>
              </div>

              <div className="space-y-4">
                {round.tiebreakers.map((tiebreaker) => (
                  <div key={tiebreaker.id} className="bg-white/70 rounded-xl p-4 border-l-4 border-yellow-400">
                    {/* Player Info Header */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
                      <div className="flex items-center">
                        <span className="inline-block w-10 h-10 rounded-lg bg-gray-100 text-gray-700 text-sm flex items-center justify-center font-medium mr-3">
                          {tiebreaker.player_position}
                        </span>
                        <div>
                          <div className="font-bold text-dark text-lg">{tiebreaker.player_name}</div>
                          <div className="text-sm text-gray-600">
                            {tiebreaker.player_team} • Rating: {tiebreaker.overall_rating}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-600">Original Tied Bid</div>
                        <div className="text-xl font-bold text-[#0066FF]">£{tiebreaker.original_amount.toLocaleString()}</div>
                      </div>
                    </div>

                    {/* Teams Involved */}
                    <div className="bg-yellow-50 rounded-lg p-4 mb-3">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        Teams Involved ({tiebreaker.teams.length} teams tied)
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {tiebreaker.teams.map((teamData, idx) => {
                          const isCurrentUser = teamData.team_id === user?.uid;
                          return (
                            <div
                              key={idx}
                              className={`p-3 rounded-lg border-2 ${
                                isCurrentUser
                                  ? 'bg-blue-50 border-blue-400'
                                  : 'bg-white border-gray-200'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center">
                                  {isCurrentUser && (
                                    <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-2 animate-pulse"></span>
                                  )}
                                  <span className={`font-medium ${
                                    isCurrentUser ? 'text-blue-700' : 'text-gray-700'
                                  }`}>
                                    {teamData.team_name || 'Team'}
                                    {isCurrentUser && ' (You)'}
                                  </span>
                                </div>
                                {teamData.submitted ? (
                                  <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium">
                                    ✓ Submitted
                                  </span>
                                ) : (
                                  <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 font-medium animate-pulse">
                                    Pending
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">Original Bid:</span>
                                <span className="font-medium text-gray-700">£{teamData.original_bid.toLocaleString()}</span>
                              </div>
                              {teamData.new_bid && (
                                <div className="flex items-center justify-between text-sm mt-1 pt-2 border-t border-gray-200">
                                  <span className="text-gray-600">New Bid:</span>
                                  <span className="font-bold text-green-600">£{teamData.new_bid.toLocaleString()}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="flex justify-end">
                      {tiebreaker.teams.find(t => t.team_id === user?.uid)?.submitted ? (
                        <Link
                          href={`/dashboard/team/tiebreaker/${tiebreaker.id}`}
                          className="px-4 py-2 rounded-xl bg-[#0066FF]/10 text-[#0066FF] hover:bg-[#0066FF]/20 transition-colors duration-300 text-sm font-medium flex items-center"
                        >
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          View Details
                        </Link>
                      ) : (
                        <Link
                          href={`/dashboard/team/tiebreaker/${tiebreaker.id}`}
                          className="px-4 py-2 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors duration-300 text-sm font-medium flex items-center animate-pulse"
                        >
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Resolve Now
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Available Players Preview */}
          <div className="glass rounded-3xl p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-dark flex items-center">
                <svg className="w-5 h-5 text-[#0066FF] mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                Available Players
              </h3>
              <Link href={`/dashboard/team/round/${round.id}`} className="text-[#0066FF] hover:text-[#0052CC] text-sm font-medium">
                View All →
              </Link>
            </div>
            <p className="text-sm text-gray-600">
              {round.player_count || 0} players available in this round. 
              <Link href={`/dashboard/team/round/${round.id}`} className="text-[#0066FF] hover:underline ml-1">
                View full list to place bids
              </Link>
            </p>
          </div>
        </div>
      ))}

      {/* Leaderboards Section */}
      <div className="bg-white/90 backdrop-blur-lg rounded-2xl shadow-xl p-4 sm:p-6 mb-6 sm:mb-8 hover:shadow-lg transition-all duration-300">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center">
            <div className="bg-[#0066FF]/10 p-2 rounded-full mr-3">
              <svg className="w-6 h-6 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-dark">Leaderboards</h2>
              <p className="text-sm text-gray-500">View team and player rankings</p>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Team Leaderboard Card */}
          <div className="glass-card p-5 rounded-xl hover:shadow-md transition-all duration-300 bg-white/30 border border-gray-100/50">
            <div className="flex items-center mb-3">
              <svg className="w-5 h-5 text-[#0066FF] mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-800">Team Leaderboard</h3>
            </div>
            <p className="text-gray-600 text-sm mb-4">View team standings, stats, and points in the tournament.</p>
            <Link href="/dashboard/team/team-leaderboard" className="inline-flex items-center px-4 py-2 bg-[#0066FF] text-white rounded-lg hover:bg-[#0052CC] transition-colors text-sm">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              View Team Rankings
            </Link>
          </div>
          
          {/* Player Leaderboard Card */}
          <div className="glass-card p-5 rounded-xl hover:shadow-md transition-all duration-300 bg-white/30 border border-gray-100/50">
            <div className="flex items-center mb-3">
              <svg className="w-5 h-5 text-[#0066FF] mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-800">Player Leaderboard</h3>
            </div>
            <p className="text-gray-600 text-sm mb-4">Explore player stats, top scorers, and performance metrics.</p>
            <Link href="/dashboard/team/player-leaderboard" className="inline-flex items-center px-4 py-2 bg-[#0066FF] text-white rounded-lg hover:bg-[#0052CC] transition-colors text-sm">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              View Player Rankings
            </Link>
          </div>
        </div>
      </div>

      {/* Your Team Section */}
      <div className="bg-white/90 backdrop-blur-lg rounded-2xl shadow-xl p-4 sm:p-6 mb-6 sm:mb-8 hover:shadow-lg transition-all duration-300">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center">
            <div className="bg-[#0066FF]/10 p-2 rounded-full mr-3">
              <svg className="w-6 h-6 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-dark">Your Team</h2>
              <p className="text-sm text-gray-500">{players.length} players in roster</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard/team/players" className="text-[#0066FF] hover:text-[#0052CC] transition-colors flex items-center text-sm">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              View All Players
            </Link>
            <button 
              className="text-[#0066FF] text-sm flex items-center" 
              onClick={() => setShowYourTeam(!showYourTeam)}
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              {showYourTeam ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>
        
        {showYourTeam && (
          <>
            {players.length === 0 ? (
              <div className="text-center py-8 bg-white/30 rounded-xl">
                <div className="inline-flex items-center justify-center p-3 bg-blue-100 rounded-full mb-4">
                  <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-700 mb-2">No players in your team yet</h3>
                <p className="text-gray-500 text-sm max-w-md mx-auto mb-4">Players will appear here when you win auction rounds</p>
                {activeRounds.length > 0 && (
                  <Link href={`/dashboard/team/round/${activeRounds[0].id}`} className="inline-flex items-center px-4 py-2 bg-[#0066FF] text-white rounded-lg hover:bg-[#0052CC] transition-colors text-sm">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Bid On Players
                  </Link>
                )}
              </div>
            ) : (
              <div>
                {/* Position filters */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <button 
                    onClick={() => setSelectedPosition('all')}
                    className={`px-3 py-1.5 rounded-lg text-sm ${selectedPosition === 'all' ? 'bg-[#0066FF] text-white' : 'bg-gray-100 text-gray-800'}`}
                  >
                    All
                  </button>
                  {POSITIONS.map(position => (
                    <button 
                      key={position}
                      onClick={() => setSelectedPosition(position)}
                      className={`px-3 py-1.5 rounded-lg text-sm ${selectedPosition === position ? 'bg-[#0066FF] text-white' : 'bg-gray-100 text-gray-800'}`}
                    >
                      {position}
                    </button>
                  ))}
                </div>
                
                {/* Players Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredPlayers.map(player => (
                    <div key={player.id} className="glass p-4 rounded-xl flex items-start gap-4 hover:shadow-md transition-all duration-300">
                      <div className="bg-[#0066FF]/10 p-2 rounded-full shrink-0">
                        <span className="text-lg font-bold text-[#0066FF]">{player.position}</span>
                      </div>
                      <div className="flex-grow">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-medium text-dark">{player.name}</h3>
                            <p className="text-xs text-gray-500">{player.nfl_team}</p>
                          </div>
                          <span className="text-sm bg-gray-100 px-2 py-0.5 rounded-full flex items-center">
                            <svg className="w-3 h-3 mr-1 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            {player.overall_rating}
                          </span>
                        </div>
                        <div className="mt-2">
                          <p className="text-sm text-gray-600">Acquisition Cost:</p>
                          <p className="font-bold text-accent">
                            {player.acquisition_value ? `£${player.acquisition_value.toLocaleString()}` : '£0'}
                          </p>
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

      {/* Round Results Section */}
      {roundResults.length > 0 && (
        <div className="glass rounded-3xl p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-[#0066FF] mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="text-xl font-bold text-dark">Round Results</h2>
            </div>
            <div className="flex space-x-2 items-center">
              <span className="text-sm text-gray-500">Filter:</span>
              <select 
                value={resultFilter}
                onChange={(e) => setResultFilter(e.target.value as 'all' | 'won' | 'lost')}
                className="border border-gray-300 rounded-xl px-3 py-2 focus:ring-[#0066FF] focus:border-[#0066FF] text-sm"
              >
                <option value="all">All Results</option>
                <option value="won">Winning Bids</option>
                <option value="lost">Lost Bids</option>
              </select>
            </div>
          </div>

          {/* Stats Summary */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
            <div className="bg-white/50 rounded-xl p-3 shadow-sm border border-gray-100">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Total Results</p>
                  <p className="text-xl font-bold text-gray-800">{roundResults.length}</p>
                </div>
                <div className="bg-blue-100 p-2 rounded-lg">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="bg-white/50 rounded-xl p-3 shadow-sm border border-gray-100">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Winning Bids</p>
                  <p className="text-xl font-bold text-green-600">{roundResults.filter(r => r.won).length}</p>
                </div>
                <div className="bg-green-100 p-2 rounded-lg">
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="bg-white/50 rounded-xl p-3 shadow-sm border border-gray-100">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Lost Bids</p>
                  <p className="text-xl font-bold text-red-600">{roundResults.filter(r => !r.won).length}</p>
                </div>
                <div className="bg-red-100 p-2 rounded-lg">
                  <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Results List */}
          <div className="space-y-3">
            {filteredResults.map(result => (
              <div key={result.id} className={`p-4 rounded-xl ${result.won ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${result.won ? 'bg-green-100' : 'bg-red-100'}`}>
                      {result.won ? (
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <h4 className="font-medium text-dark">{result.player.name}</h4>
                      <p className="text-sm text-gray-600">
                        {result.player.position} • {result.player.nfl_team}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">
                      {result.won ? 'Won for' : 'Lost - Your bid'}
                    </p>
                    <p className={`text-lg font-bold ${result.won ? 'text-green-600' : 'text-red-600'}`}>
                      £{(result.won ? result.final_amount : result.bid_amount).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
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
    </div>
  );
}
