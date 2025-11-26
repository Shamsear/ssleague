'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { History, Download, Filter, ArrowUpDown } from 'lucide-react';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';
import { usePermissions } from '@/hooks/usePermissions';

interface TransferTransaction {
  id: string;
  transaction_type: 'transfer' | 'swap' | 'release';
  season_id: string;
  processed_by: string;
  processed_by_name: string;
  created_at: string;
  // Transfer specific
  player?: {
    id: string;
    name: string;
    type: 'real' | 'football';
  };
  old_team_id?: string;
  new_team_id?: string;
  values?: {
    old_value: number;
    new_value: number;
  };
  star_rating?: {
    old: number;
    new: number;
    points_added: number;
  };
  financial?: {
    committee_fee?: number;
    buying_team_paid?: number;
    selling_team_received?: number;
    refund_amount?: number;
    team_a_fee?: number;
    team_b_fee?: number;
    total_committee_fees?: number;
    cash_amount?: number;
    cash_direction?: 'A_to_B' | 'B_to_A' | 'none';
  };
  new_salary?: number;
  // Swap specific
  player_a?: {
    id: string;
    name: string;
    type: 'real' | 'football';
    old_value: number;
    new_value: number;
    old_star: number;
    new_star: number;
    points_added: number;
    new_salary: number;
  };
  player_b?: {
    id: string;
    name: string;
    type: 'real' | 'football';
    old_value: number;
    new_value: number;
    old_star: number;
    new_star: number;
    points_added: number;
    new_salary: number;
  };
  teams?: {
    team_a_id: string;
    team_b_id: string;
    team_a_pays: number;
    team_b_pays: number;
  };
}

export default function TransferHistoryPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { userSeasonId } = usePermissions();
  
  const [transactions, setTransactions] = useState<TransferTransaction[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filters
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(0);
  const [limit] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }
    if (!loading && user && user.role !== 'committee_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && user.role === 'committee_admin' && userSeasonId) {
      loadInitialData();
    }
  }, [user, userSeasonId]);

  useEffect(() => {
    if (userSeasonId) {
      loadTransactions();
    }
  }, [userSeasonId, selectedTeamId, selectedType, currentPage]);

  const loadInitialData = async () => {
    if (!userSeasonId) return;
    
    try {
      // Load teams for filtering
      const teamsRes = await fetchWithTokenRefresh(`/api/team/all?season_id=${userSeasonId}`);
      if (teamsRes.ok) {
        const teamsData = await teamsRes.json();
        if (teamsData.success && teamsData.data?.teams) {
          setTeams(teamsData.data.teams);
        }
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  };

  const loadTransactions = async () => {
    if (!userSeasonId) return;

    try {
      setIsLoading(true);
      
      const params = new URLSearchParams({
        season_id: userSeasonId,
        limit: limit.toString(),
        offset: (currentPage * limit).toString(),
        order_by: 'created_at',
        order_direction: 'desc'
      });
      
      if (selectedTeamId) {
        params.append('team_id', selectedTeamId);
      }
      
      if (selectedType) {
        params.append('transaction_type', selectedType);
      }
      
      const url = `/api/players/transfer-history?${params.toString()}`;
      const res = await fetchWithTokenRefresh(url);

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setTransactions(data.transactions || []);
          setTotalCount(data.pagination?.total || 0);
          setHasMore(data.pagination?.has_more || false);
        }
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const exportToCSV = () => {
    if (transactions.length === 0) return;

    const headers = ['Date', 'Type', 'Player(s)', 'Teams', 'Values', 'Fees', 'Star Changes', 'Processed By'];
    const rows = transactions.map(tx => {
      const date = new Date(tx.created_at).toLocaleDateString();
      const type = tx.transaction_type.toUpperCase();
      
      let players = '';
      let teams = '';
      let values = '';
      let fees = '';
      let starChanges = '';
      
      if (tx.transaction_type === 'transfer') {
        players = tx.player?.name || '';
        teams = `${tx.old_team_id} → ${tx.new_team_id}`;
        values = `${tx.values?.old_value} → ${tx.values?.new_value}`;
        fees = tx.financial?.committee_fee?.toFixed(2) || '';
        starChanges = `${tx.star_rating?.old}⭐ → ${tx.star_rating?.new}⭐`;
      } else if (tx.transaction_type === 'swap') {
        players = `${tx.player_a?.name} ↔ ${tx.player_b?.name}`;
        teams = `${tx.teams?.team_a_id} ↔ ${tx.teams?.team_b_id}`;
        values = `${tx.player_a?.old_value}/${tx.player_b?.old_value} → ${tx.player_a?.new_value}/${tx.player_b?.new_value}`;
        fees = tx.financial?.total_committee_fees?.toFixed(2) || '';
        starChanges = `${tx.player_a?.old_star}⭐→${tx.player_a?.new_star}⭐ / ${tx.player_b?.old_star}⭐→${tx.player_b?.new_star}⭐`;
      }
      
      return [date, type, players, teams, values, fees, starChanges, tx.processed_by_name];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transfer-history-${userSeasonId}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'transfer': return 'bg-blue-100 text-blue-700';
      case 'swap': return 'bg-purple-100 text-purple-700';
      case 'release': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 py-4 sm:py-6 lg:py-8 px-3 sm:px-4 lg:px-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <Link
            href="/dashboard/committee/players/transfers"
            className="inline-flex items-center gap-2 text-sm sm:text-base text-gray-600 hover:text-purple-600 transition-colors mb-3 sm:mb-4 group"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Transfers
          </Link>
          <div className="glass rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-white/30 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 sm:p-3 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg">
                  <History className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold gradient-text">Transfer History</h1>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1">View all player transfers, swaps, and releases</p>
                </div>
              </div>
              <button
                onClick={exportToCSV}
                disabled={transactions.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Export CSV</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="glass rounded-2xl sm:rounded-3xl border border-white/30 shadow-xl p-4 sm:p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-bold text-gray-900">Filters</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Team</label>
              <select
                value={selectedTeamId}
                onChange={(e) => {
                  setSelectedTeamId(e.target.value);
                  setCurrentPage(0);
                }}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 bg-white"
              >
                <option value="">All Teams</option>
                {teams.map((teamData) => (
                  <option key={teamData.team?.id} value={teamData.team?.id}>
                    {teamData.team?.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Transaction Type</label>
              <select
                value={selectedType}
                onChange={(e) => {
                  setSelectedType(e.target.value);
                  setCurrentPage(0);
                }}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 bg-white"
              >
                <option value="">All Types</option>
                <option value="transfer">Transfers</option>
                <option value="swap">Swaps</option>
                <option value="release">Releases</option>
              </select>
            </div>
          </div>
        </div>

        {/* Transactions List */}
        {transactions.length === 0 ? (
          <div className="glass rounded-2xl sm:rounded-3xl p-8 sm:p-12 text-center border border-white/30 shadow-xl">
            <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 mb-4 sm:mb-6">
              <History className="w-8 h-8 sm:w-10 sm:h-10 text-gray-400" />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">No Transactions Found</h3>
            <p className="text-sm sm:text-base text-gray-600 max-w-md mx-auto">No transfer transactions found for the selected filters</p>
          </div>
        ) : (
          <div className="space-y-4">
            {transactions.map((tx) => (
              <div key={tx.id} className="glass rounded-2xl border border-white/30 shadow-xl overflow-hidden">
                {/* Transaction Header */}
                <div className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-4 sm:px-6 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-lg text-xs font-bold ${getTypeColor(tx.transaction_type)} bg-white`}>
                        {tx.transaction_type.toUpperCase()}
                      </span>
                      <span className="text-sm">{formatDate(tx.created_at)}</span>
                    </div>
                    <span className="text-xs text-purple-100">By: {tx.processed_by_name}</span>
                  </div>
                </div>

                {/* Transaction Details */}
                <div className="p-4 sm:p-6">
                  {tx.transaction_type === 'transfer' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600">Player</p>
                          <p className="text-lg font-bold text-gray-900">{tx.player?.name}</p>
                          <p className="text-xs text-gray-500">{tx.player?.type === 'real' ? 'Real Player' : 'Football Player'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600">Teams</p>
                          <p className="text-sm font-semibold text-gray-900">{tx.old_team_id} → {tx.new_team_id}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t">
                        <div>
                          <p className="text-xs text-gray-600">Old Value</p>
                          <p className="text-sm font-bold text-gray-900">{tx.values?.old_value.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">New Value</p>
                          <p className="text-sm font-bold text-green-600">{tx.values?.new_value.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Committee Fee</p>
                          <p className="text-sm font-bold text-purple-600">{tx.financial?.committee_fee?.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Star Rating</p>
                          <p className="text-sm font-bold text-yellow-600">
                            {tx.star_rating?.old}⭐ → {tx.star_rating?.new}⭐
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {tx.transaction_type === 'swap' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-blue-50 rounded-xl p-4">
                          <p className="text-xs text-blue-600 font-semibold mb-2">Player A</p>
                          <p className="font-bold text-gray-900 mb-1">{tx.player_a?.name}</p>
                          <div className="text-xs space-y-1">
                            <p>Value: {tx.player_a?.old_value.toFixed(2)} → {tx.player_a?.new_value.toFixed(2)}</p>
                            <p>Stars: {tx.player_a?.old_star}⭐ → {tx.player_a?.new_star}⭐</p>
                            <p>Team: {tx.teams?.team_a_id}</p>
                          </div>
                        </div>
                        <div className="bg-purple-50 rounded-xl p-4">
                          <p className="text-xs text-purple-600 font-semibold mb-2">Player B</p>
                          <p className="font-bold text-gray-900 mb-1">{tx.player_b?.name}</p>
                          <div className="text-xs space-y-1">
                            <p>Value: {tx.player_b?.old_value.toFixed(2)} → {tx.player_b?.new_value.toFixed(2)}</p>
                            <p>Stars: {tx.player_b?.old_star}⭐ → {tx.player_b?.new_star}⭐</p>
                            <p>Team: {tx.teams?.team_b_id}</p>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t">
                        <div>
                          <p className="text-xs text-gray-600">Total Fees</p>
                          <p className="text-sm font-bold text-purple-600">{tx.financial?.total_committee_fees?.toFixed(2)}</p>
                        </div>
                        {tx.financial?.cash_amount && tx.financial.cash_amount > 0 && (
                          <div>
                            <p className="text-xs text-gray-600">Cash</p>
                            <p className="text-sm font-bold text-green-600">{tx.financial.cash_amount.toFixed(2)}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalCount > limit && (
          <div className="mt-6 flex items-center justify-between glass rounded-xl p-4 border border-white/30">
            <button
              onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {currentPage + 1} of {Math.ceil(totalCount / limit)} ({totalCount} total)
            </span>
            <button
              onClick={() => setCurrentPage(p => p + 1)}
              disabled={!hasMore}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
