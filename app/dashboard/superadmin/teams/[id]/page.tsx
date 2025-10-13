'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getTeamById } from '@/lib/firebase/teams';
import { TeamData } from '@/types/team';

interface Player {
  id: string;
  player_id: string;
  name: string;
  position: string;
  overall_rating: number;
  price_paid?: number;
  acquired_at?: Date;
}

interface Transaction {
  id: string;
  type: 'bid_won' | 'bid_lost' | 'balance_adjustment';
  amount: number;
  description: string;
  player_name?: string;
  timestamp: Date;
}

export default function TeamDetailsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const teamId = params.id as string;

  const [team, setTeam] = useState<TeamData | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'overview' | 'players' | 'transactions' | 'settings'>('overview');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAdjustBalanceModal, setShowAdjustBalanceModal] = useState(false);
  const [balanceAdjustment, setBalanceAdjustment] = useState({ amount: 0, reason: '' });

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'super_admin') {
      router.push('/dashboard');
    }
    if (!loading && user && user.role === 'super_admin') {
      loadTeamData();
    }
  }, [user, loading, router]);

  const loadTeamData = async () => {
    try {
      setLoadingData(true);
      setError(null);
      
      const teamData = await getTeamById(teamId);
      if (!teamData) {
        setError('Team not found');
        return;
      }
      
      setTeam(teamData);
      
      // TODO: Load actual players and transactions from database
      // For now, we'll leave them empty as the structure might be different
      setPlayers([]);
      setTransactions([]);
      
    } catch (err) {
      console.error('Error loading team data:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load team data';
      setError(errorMessage);
    } finally {
      setLoadingData(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (date: Date) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleAdjustBalance = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement API call to adjust balance
    alert(`Adjust balance by ${formatCurrency(balanceAdjustment.amount)} - Backend to be implemented`);
    setShowAdjustBalanceModal(false);
    setBalanceAdjustment({ amount: 0, reason: '' });
  };

  const handleToggleStatus = () => {
    // TODO: Implement API call to toggle status
    alert(`Toggle team status - Backend to be implemented`);
  };

  const handleRemovePlayer = (player: Player) => {
    if (confirm(`Remove ${player.name} from the team?`)) {
      // TODO: Implement API call to remove player
      alert(`Remove player - Backend to be implemented`);
    }
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'super_admin') {
    return null;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Error Loading Team</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => loadTeamData()}
              className="px-4 py-2 bg-[#0066FF] text-white rounded-xl text-sm font-medium hover:bg-[#0066FF]/90 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => router.push('/dashboard/superadmin/teams')}
              className="px-4 py-2 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Back to Teams
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!team) {
    return null;
  }

  const spendingPercentage = (team.total_spent / team.initial_balance) * 100;
  const balancePercentage = (team.balance / team.initial_balance) * 100;

  return (
    <div className="min-h-screen py-4 sm:py-8 px-4">
      <div className="container mx-auto max-w-screen-2xl">
        {/* Page Header */}
        <header className="mb-6 sm:mb-8">
          <div className="flex flex-col gap-4">
            {/* Back button and team info */}
            <div className="flex items-start gap-3">
              <button
                onClick={() => router.push('/dashboard/superadmin/teams')}
                className="p-2 rounded-xl hover:bg-white/50 transition-colors flex-shrink-0 mt-1"
              >
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl overflow-hidden bg-gradient-to-br from-[#0066FF]/20 to-[#0066FF]/10 flex items-center justify-center flex-shrink-0">
                    {team.logo ? (
                      <img 
                        src={team.logo} 
                        alt={`${team.team_name} logo`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            parent.innerHTML = `<span class="text-[#0066FF] font-bold text-lg sm:text-2xl">${team.team_code}</span>`;
                          }
                        }}
                      />
                    ) : (
                      <span className="text-[#0066FF] font-bold text-lg sm:text-2xl">{team.team_code}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold gradient-text truncate">{team.team_name}</h1>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mt-1">
                      <span className="text-sm text-gray-600 truncate">{team.season_name}</span>
                      <span className="text-gray-400 hidden sm:inline">•</span>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium self-start ${
                        team.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {team.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-2 sm:ml-auto">
              <button
                onClick={() => setShowEditModal(true)}
                className="inline-flex items-center justify-center px-4 py-2 bg-white border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Team
              </button>
              <button
                onClick={handleToggleStatus}
                className={`inline-flex items-center justify-center px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  team.is_active
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {team.is_active ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        </header>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="glass rounded-2xl p-6 shadow-lg backdrop-blur-md border border-white/20">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs sm:text-sm text-gray-600 mb-1">Current Balance</p>
                <p className="text-lg sm:text-2xl font-bold text-[#0066FF]">{formatCurrency(team.balance)}</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-[#0066FF]/20 to-[#0066FF]/10">
                <svg className="w-8 h-8 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <div
                className="bg-[#0066FF] h-2 rounded-full transition-all duration-300"
                style={{ width: `${balancePercentage}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500">{balancePercentage.toFixed(1)}% of initial balance</p>
          </div>

          <div className="glass rounded-2xl p-6 shadow-lg backdrop-blur-md border border-white/20">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs sm:text-sm text-gray-600 mb-1">Total Spent</p>
                <p className="text-lg sm:text-2xl font-bold text-red-600">{formatCurrency(team.total_spent)}</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-red-500/20 to-red-500/10">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                </svg>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <div
                className="bg-red-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${spendingPercentage}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500">{spendingPercentage.toFixed(1)}% of initial balance</p>
          </div>

          <div className="glass rounded-2xl p-6 shadow-lg backdrop-blur-md border border-white/20">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-xs sm:text-sm text-gray-600 mb-1">Squad Size</p>
                <p className="text-lg sm:text-2xl font-bold text-green-600">{team.players_count}</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/10">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-4">Players in squad</p>
          </div>

          <div className="glass rounded-2xl p-6 shadow-lg backdrop-blur-md border border-white/20">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-xs sm:text-sm text-gray-600 mb-1">Initial Budget</p>
                <p className="text-lg sm:text-2xl font-bold text-purple-600">{formatCurrency(team.initial_balance)}</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/10">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <button
              onClick={() => setShowAdjustBalanceModal(true)}
              className="text-xs text-purple-600 hover:text-purple-700 font-medium mt-4"
            >
              Adjust Balance →
            </button>
          </div>
        </div>

        {/* Owner Information */}
        <div className="glass rounded-3xl p-6 mb-8 shadow-lg backdrop-blur-md border border-white/20">
          <h2 className="text-xl font-bold gradient-text mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zm-4 7a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Owner Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center">
              <div className="p-3 rounded-xl bg-blue-50 mr-3">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zm-4 7a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-500">Owner Name</p>
                <p className="text-sm font-semibold text-gray-900">{team.owner_name || 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-center">
              <div className="p-3 rounded-xl bg-green-50 mr-3">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-500">Email</p>
                <p className="text-sm font-semibold text-gray-900">{team.owner_email || 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-center">
              <div className="p-3 rounded-xl bg-purple-50 mr-3">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-500">Phone</p>
                <p className="text-sm font-semibold text-gray-900">{team.owner_phone || 'N/A'}</p>
              </div>
            </div>
          </div>
          {team.description && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600">{team.description}</p>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="glass rounded-t-3xl p-1.5 sm:p-2 shadow-lg backdrop-blur-md border border-white/20 border-b-0">
          <div className="flex gap-1 sm:gap-2 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex-shrink-0 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'overview'
                  ? 'bg-gradient-to-r from-[#0066FF] to-[#0066FF]/80 text-white shadow-md'
                  : 'text-gray-600 hover:bg-white/30'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('players')}
              className={`flex-shrink-0 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === 'players'
                  ? 'bg-gradient-to-r from-[#0066FF] to-[#0066FF]/80 text-white shadow-md'
                  : 'text-gray-600 hover:bg-white/30'
              }`}
            >
              <span className="hidden sm:inline">Players ({players.length})</span>
              <span className="sm:hidden">Players</span>
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`flex-shrink-0 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === 'transactions'
                  ? 'bg-gradient-to-r from-[#0066FF] to-[#0066FF]/80 text-white shadow-md'
                  : 'text-gray-600 hover:bg-white/30'
              }`}
            >
              Transactions
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex-shrink-0 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'settings'
                  ? 'bg-gradient-to-r from-[#0066FF] to-[#0066FF]/80 text-white shadow-md'
                  : 'text-gray-600 hover:bg-white/30'
              }`}
            >
              Settings
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="glass rounded-b-3xl shadow-lg backdrop-blur-md border border-white/20 overflow-hidden mb-8">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Team Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="text-sm text-gray-600">Team Code:</span>
                    <span className="text-sm font-semibold text-gray-900">{team.team_code}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="text-sm text-gray-600">Season:</span>
                    <span className="text-sm font-semibold text-gray-900">{team.season_name}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="text-sm text-gray-600">Created Date:</span>
                    <span className="text-sm font-semibold text-gray-900">{formatDate(team.created_at)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="text-sm text-gray-600">Status:</span>
                    <span className={`text-sm font-semibold ${team.is_active ? 'text-green-600' : 'text-gray-600'}`}>
                      {team.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="text-sm text-gray-600">Initial Balance:</span>
                    <span className="text-sm font-semibold text-gray-900">{formatCurrency(team.initial_balance)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="text-sm text-gray-600">Current Balance:</span>
                    <span className="text-sm font-semibold text-[#0066FF]">{formatCurrency(team.balance)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="text-sm text-gray-600">Total Spent:</span>
                    <span className="text-sm font-semibold text-red-600">{formatCurrency(team.spent_amount)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="text-sm text-gray-600">Squad Size:</span>
                    <span className="text-sm font-semibold text-gray-900">{team.players_count} players</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Players Tab */}
          {activeTab === 'players' && (
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Squad Players</h3>
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#0066FF]/20 text-[#0066FF]">
                  {players.length} Players
                </span>
              </div>
              
              {players.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Player ID</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Position</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Rating</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Price Paid</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Acquired</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white/30">
                      {players.map((player) => (
                        <tr key={player.id} className="hover:bg-white/60 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="text-sm font-mono text-[#0066FF] font-medium">{player.player_id}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-sm font-semibold text-gray-900">{player.name}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {player.position}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center">
                              <span className="text-sm font-semibold text-gray-900">{player.overall_rating}</span>
                              <svg className="w-4 h-4 text-yellow-500 ml-1" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="text-sm font-semibold text-gray-900">
                              {player.price_paid ? formatCurrency(player.price_paid) : 'N/A'}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="text-sm text-gray-600">
                              {player.acquired_at ? formatDate(player.acquired_at) : 'N/A'}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <button
                              onClick={() => handleRemovePlayer(player)}
                              className="text-red-600 hover:text-red-800 p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                              title="Remove Player"
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
              ) : (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-600 mb-2">No players yet</h3>
                  <p className="text-sm text-gray-500">Players will appear here once they are acquired through auctions</p>
                </div>
              )}
            </div>
          )}

          {/* Transactions Tab */}
          {activeTab === 'transactions' && (
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Transaction History</h3>
              
              {transactions.length > 0 ? (
                <div className="space-y-3">
                  {transactions.map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between p-4 rounded-xl border border-gray-200 hover:bg-white/30 transition-colors">
                      <div className="flex items-center flex-1">
                        <div className={`p-3 rounded-xl mr-4 ${
                          transaction.type === 'bid_won' ? 'bg-green-50' :
                          transaction.type === 'bid_lost' ? 'bg-red-50' :
                          'bg-blue-50'
                        }`}>
                          {transaction.type === 'bid_won' && (
                            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                          {transaction.type === 'bid_lost' && (
                            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                          {transaction.type === 'balance_adjustment' && (
                            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-900">{transaction.description}</p>
                          {transaction.player_name && (
                            <p className="text-xs text-gray-500 mt-1">{transaction.player_name}</p>
                          )}
                          <p className="text-xs text-gray-400 mt-1">{formatDateTime(transaction.timestamp)}</p>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <p className={`text-lg font-bold ${
                          transaction.amount < 0 ? 'text-red-600' : 
                          transaction.amount > 0 ? 'text-green-600' : 
                          'text-gray-600'
                        }`}>
                          {transaction.amount !== 0 ? formatCurrency(transaction.amount) : '-'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-600 mb-2">No transactions yet</h3>
                  <p className="text-sm text-gray-500">Transaction history will appear here</p>
                </div>
              )}
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Team Settings</h3>
              <div className="space-y-4">
                <div className="p-4 rounded-xl border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-900">Team Status</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        {team.is_active ? 'Team is currently active and can participate in auctions' : 'Team is currently inactive'}
                      </p>
                    </div>
                    <button
                      onClick={handleToggleStatus}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        team.is_active
                          ? 'bg-red-100 text-red-700 hover:bg-red-200'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {team.is_active ? 'Deactivate Team' : 'Activate Team'}
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-900">Balance Adjustment</h4>
                      <p className="text-sm text-gray-600 mt-1">Manually adjust team balance for corrections</p>
                    </div>
                    <button
                      onClick={() => setShowAdjustBalanceModal(true)}
                      className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-200 transition-colors"
                    >
                      Adjust Balance
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-red-200 bg-red-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-red-900">Danger Zone</h4>
                      <p className="text-sm text-red-600 mt-1">Permanently delete this team and all associated data</p>
                    </div>
                    <button
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this team? This action cannot be undone.')) {
                          alert('Delete team - Backend to be implemented');
                          router.push('/dashboard/superadmin/teams');
                        }
                      }}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
                    >
                      Delete Team
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Adjust Balance Modal */}
        {showAdjustBalanceModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="glass rounded-3xl p-6 max-w-md w-full shadow-2xl border border-white/20">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold gradient-text">Adjust Balance</h2>
                <button
                  onClick={() => setShowAdjustBalanceModal(false)}
                  className="p-2 hover:bg-white/50 rounded-lg transition-colors"
                >
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleAdjustBalance} className="space-y-4">
                <div>
                  <label htmlFor="adjustment_amount" className="block text-sm font-medium text-gray-700 mb-2">
                    Adjustment Amount (₹) *
                  </label>
                  <input
                    type="number"
                    id="adjustment_amount"
                    required
                    value={balanceAdjustment.amount}
                    onChange={(e) => setBalanceAdjustment({ ...balanceAdjustment, amount: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all"
                    placeholder="Enter amount (positive to add, negative to subtract)"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Current balance: {formatCurrency(team.balance)}
                  </p>
                  {balanceAdjustment.amount !== 0 && (
                    <p className="text-xs font-semibold mt-1">
                      New balance: {formatCurrency(team.balance + balanceAdjustment.amount)}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="adjustment_reason" className="block text-sm font-medium text-gray-700 mb-2">
                    Reason for Adjustment *
                  </label>
                  <textarea
                    id="adjustment_reason"
                    required
                    rows={3}
                    value={balanceAdjustment.reason}
                    onChange={(e) => setBalanceAdjustment({ ...balanceAdjustment, reason: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all resize-none"
                    placeholder="Explain why you're adjusting the balance..."
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAdjustBalanceModal(false)}
                    className="px-6 py-3 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-3 bg-[#0066FF] text-white rounded-xl text-sm font-medium hover:bg-[#0066FF]/90 transition-colors"
                  >
                    Apply Adjustment
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
