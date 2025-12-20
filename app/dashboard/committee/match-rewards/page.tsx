'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trophy, Users, Filter } from 'lucide-react';
import { db } from '@/lib/firebase/config';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { usePermissions } from '@/hooks/usePermissions';

interface RewardTransaction {
  id: string;
  team_id: string;
  team_name?: string;
  season_id: string;
  transaction_type: string;
  currency_type: 'football' | 'real';
  amount: number;
  description: string;
  created_at: any;
  metadata?: {
    fixture_id?: string;
    round_number?: number;
    leg?: number;
    result?: string;
    currency?: string;
    retroactive?: boolean;
  };
}

export default function CommitteeMatchRewardsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { userSeasonId } = usePermissions();
  
  const [selectedTeamId, setSelectedTeamId] = useState<string>('all');
  const [selectedCurrency, setSelectedCurrency] = useState<string>('all');
  const [teams, setTeams] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<RewardTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingTransactions, setIsFetchingTransactions] = useState(false);

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
  }, [selectedTeamId, selectedCurrency, userSeasonId]);

  const loadInitialData = async () => {
    if (!userSeasonId) return;
    
    try {
      setIsLoading(true);

      // Load teams from Firebase team_seasons
      const teamSeasonsSnapshot = await getDocs(
        query(collection(db, 'team_seasons'))
      );
      
      const teamsList: any[] = [];
      teamSeasonsSnapshot.forEach(doc => {
        const data = doc.data();
        if (doc.id.endsWith(`_${userSeasonId}`)) {
          teamsList.push({
            team: {
              id: data.team_id,
              name: data.team_name || data.team_id
            }
          });
        }
      });

      teamsList.sort((a, b) => a.team.name.localeCompare(b.team.name));
      setTeams(teamsList);
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTransactions = async () => {
    if (!userSeasonId) return;

    try {
      setIsFetchingTransactions(true);

      // Build query - simplified to avoid composite index requirement
      let q;
      
      if (selectedTeamId !== 'all') {
        // Query with team filter
        q = query(
          collection(db, 'transactions'),
          where('transaction_type', '==', 'match_reward'),
          where('team_id', '==', selectedTeamId)
        );
      } else {
        // Query without team filter
        q = query(
          collection(db, 'transactions'),
          where('transaction_type', '==', 'match_reward')
        );
      }

      const snapshot = await getDocs(q);
      const txns: RewardTransaction[] = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        
        // Apply season filter in code
        if (data.season_id !== userSeasonId) {
          return;
        }
        
        // Apply currency filter in code
        if (selectedCurrency !== 'all' && data.currency_type !== selectedCurrency) {
          return;
        }

        txns.push({
          id: doc.id,
          team_id: data.team_id,
          team_name: teams.find(t => t.team.id === data.team_id)?.team.name || data.team_id,
          season_id: data.season_id,
          transaction_type: data.transaction_type,
          currency_type: data.currency_type,
          amount: data.amount || 0,
          description: data.description || '',
          created_at: data.created_at,
          metadata: data.metadata || {}
        });
      });

      // Sort by created_at in code
      txns.sort((a, b) => {
        const aTime = a.created_at?.toDate?.() || new Date(a.created_at);
        const bTime = b.created_at?.toDate?.() || new Date(b.created_at);
        return bTime.getTime() - aTime.getTime();
      });

      setTransactions(txns);
      console.log(`Loaded ${txns.length} transactions`);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setIsFetchingTransactions(false);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getCurrencyBadge = (type: string) => {
    if (type === 'football') {
      return <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-lg">eCoin</span>;
    }
    return <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-bold rounded-lg">SSCoin</span>;
  };

  const getResultBadge = (result?: string) => {
    if (!result) return null;
    
    const colors = {
      'Win': 'bg-green-100 text-green-700',
      'Draw': 'bg-yellow-100 text-yellow-700',
      'Loss': 'bg-red-100 text-red-700'
    };
    
    return (
      <span className={`px-2 py-1 text-xs font-bold rounded-lg ${colors[result as keyof typeof colors] || 'bg-gray-100 text-gray-700'}`}>
        {result}
      </span>
    );
  };

  // Group transactions by fixture
  const groupedTransactions = transactions.reduce((acc, txn) => {
    const fixtureId = txn.metadata?.fixture_id || 'unknown';
    if (!acc[fixtureId]) {
      acc[fixtureId] = [];
    }
    acc[fixtureId].push(txn);
    return acc;
  }, {} as Record<string, RewardTransaction[]>);

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 py-4 sm:py-6 lg:py-8 px-3 sm:px-4 lg:px-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <Link
            href="/dashboard/committee"
            className="inline-flex items-center gap-2 text-sm sm:text-base text-gray-600 hover:text-green-600 transition-colors mb-3 sm:mb-4 group"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </Link>
          <div className="glass rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-white/30 shadow-xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 sm:p-3 rounded-xl bg-gradient-to-br from-green-500 to-green-600 shadow-lg">
                <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold gradient-text">Match Rewards</h1>
                <p className="text-xs sm:text-sm text-gray-600 mt-1">View all match reward transactions</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="glass rounded-2xl sm:rounded-3xl border border-white/30 shadow-xl p-4 sm:p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-bold text-gray-900">Filters</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Team Filter */}
            <div>
              <label className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-2">
                <Users className="w-4 h-4 text-green-600" />
                Team
              </label>
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-green-500/20 focus:border-green-500 bg-white shadow-sm transition-all"
              >
                <option value="all">All Teams</option>
                {teams.map((teamData) => (
                  <option key={teamData.team.id} value={teamData.team.id}>
                    {teamData.team.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Currency Filter */}
            <div>
              <label className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-2">
                <Trophy className="w-4 h-4 text-green-600" />
                Currency
              </label>
              <select
                value={selectedCurrency}
                onChange={(e) => setSelectedCurrency(e.target.value)}
                className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-green-500/20 focus:border-green-500 bg-white shadow-sm transition-all"
              >
                <option value="all">All Currencies</option>
                <option value="football">eCoin Only</option>
                <option value="real">SSCoin Only</option>
              </select>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isFetchingTransactions && (
          <div className="glass rounded-2xl sm:rounded-3xl p-8 sm:p-12 text-center border border-white/30 shadow-xl">
            <div className="animate-spin rounded-full h-12 w-12 sm:h-16 sm:w-16 border-4 border-green-200 border-t-green-600 mx-auto mb-4"></div>
            <p className="text-gray-600 text-sm sm:text-base font-medium">Loading reward transactions...</p>
          </div>
        )}

        {/* No Transactions */}
        {!isFetchingTransactions && transactions.length === 0 && (
          <div className="glass rounded-2xl sm:rounded-3xl p-8 sm:p-12 text-center border border-white/30 shadow-xl">
            <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 mb-4 sm:mb-6">
              <Trophy className="w-8 h-8 sm:w-10 sm:h-10 text-gray-400" />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">No Rewards Found</h3>
            <p className="text-sm sm:text-base text-gray-600 max-w-md mx-auto">No match reward transactions found for the selected filters</p>
          </div>
        )}

        {/* Transactions List - Grouped by Fixture */}
        {!isFetchingTransactions && transactions.length > 0 && (
          <div className="space-y-4 sm:space-y-6">
            {Object.entries(groupedTransactions).map(([fixtureId, fixtureTxns]) => {
              const firstTxn = fixtureTxns[0];
              const totalECoin = fixtureTxns.filter(t => t.currency_type === 'football').reduce((sum, t) => sum + t.amount, 0);
              const totalSSCoin = fixtureTxns.filter(t => t.currency_type === 'real').reduce((sum, t) => sum + t.amount, 0);

              return (
                <div key={fixtureId} className="glass rounded-2xl sm:rounded-3xl border border-white/30 shadow-xl overflow-hidden transition-all hover:shadow-2xl">
                  {/* Fixture Header */}
                  <div className="bg-gradient-to-r from-green-500 to-blue-600 text-white px-4 sm:px-6 py-4 sm:py-5">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-1 bg-white/20 rounded-lg text-xs font-bold">
                            R{firstTxn.metadata?.round_number || '?'}
                            {firstTxn.metadata?.leg && firstTxn.metadata.leg > 1 ? ` L${firstTxn.metadata.leg}` : ''}
                          </span>
                          {getResultBadge(firstTxn.metadata?.result)}
                          {firstTxn.metadata?.retroactive && (
                            <span className="px-2 py-1 bg-orange-500/80 text-white text-xs font-bold rounded-lg">
                              Retroactive
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-white/90">
                          Fixture: {fixtureId}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        {totalECoin > 0 && (
                          <div className="text-right">
                            <p className="text-xs text-white/80">eCoin</p>
                            <p className="text-xl font-bold">+{totalECoin}</p>
                          </div>
                        )}
                        {totalSSCoin > 0 && (
                          <div className="text-right">
                            <p className="text-xs text-white/80">SSCoin</p>
                            <p className="text-xl font-bold">+{totalSSCoin}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Transactions Table */}
                  <div className="p-4 sm:p-6">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b-2 border-gray-200">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Team</th>
                            <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Currency</th>
                            <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Amount</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Description</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {fixtureTxns.map((txn) => (
                            <tr key={txn.id} className="hover:bg-green-50/50 transition-colors">
                              <td className="px-4 py-4">
                                <span className="font-semibold text-gray-900 text-sm">{txn.team_name}</span>
                              </td>
                              <td className="px-4 py-4 text-center">
                                {getCurrencyBadge(txn.currency_type)}
                              </td>
                              <td className="px-4 py-4 text-right">
                                <span className="font-bold text-green-600 text-lg">+{txn.amount}</span>
                              </td>
                              <td className="px-4 py-4">
                                <span className="text-sm text-gray-700">{txn.description}</span>
                              </td>
                              <td className="px-4 py-4">
                                <span className="text-xs text-gray-600">{formatDate(txn.created_at)}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Summary Stats */}
        {transactions.length > 0 && (
          <div className="mt-6 glass rounded-2xl sm:rounded-3xl border border-green-200/50 p-4 sm:p-6 shadow-lg">
            <h3 className="font-bold text-gray-900 mb-4">Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-white rounded-xl border border-gray-200">
                <p className="text-2xl font-bold text-gray-900">{Object.keys(groupedTransactions).length}</p>
                <p className="text-xs text-gray-600 mt-1">Fixtures</p>
              </div>
              <div className="text-center p-4 bg-white rounded-xl border border-gray-200">
                <p className="text-2xl font-bold text-gray-900">{transactions.length}</p>
                <p className="text-xs text-gray-600 mt-1">Transactions</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-xl border border-blue-200">
                <p className="text-2xl font-bold text-blue-600">
                  {transactions.filter(t => t.currency_type === 'football').reduce((sum, t) => sum + t.amount, 0)}
                </p>
                <p className="text-xs text-blue-700 mt-1">Total eCoin</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-xl border border-purple-200">
                <p className="text-2xl font-bold text-purple-600">
                  {transactions.filter(t => t.currency_type === 'real').reduce((sum, t) => sum + t.amount, 0)}
                </p>
                <p className="text-xs text-purple-700 mt-1">Total SSCoin</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
