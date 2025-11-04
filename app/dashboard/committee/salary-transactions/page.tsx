'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DollarSign, Users } from 'lucide-react';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';
import { usePermissions } from '@/hooks/usePermissions';

interface SalaryTransaction {
  fixture_id?: string;
  round_number?: number;
  match_date?: string;
  team_id: string;
  team_name: string;
  opponent_team_id?: string;
  result?: string;
  players: {
    player_id: string;
    player_name: string;
    salary_per_match: number;
    points_change: number;
    star_rating: number;
    amount: number;
  }[];
  total_salary: number;
}

export default function CommitteeSalaryTransactionsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { userSeasonId } = usePermissions();
  
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [teams, setTeams] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<SalaryTransaction[]>([]);
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
    if (selectedTeamId && userSeasonId) {
      loadTransactions();
    }
  }, [selectedTeamId, userSeasonId]);

  const loadInitialData = async () => {
    if (!userSeasonId) {
      console.log('No userSeasonId available yet');
      return;
    }
    
    try {
      setIsLoading(true);
      console.log('Loading teams for season:', userSeasonId);

      // Load teams for the current season
      const teamsRes = await fetchWithTokenRefresh(`/api/team/all?season_id=${userSeasonId}`);
      console.log('Teams API response status:', teamsRes.status);
      
      if (teamsRes.ok) {
        const teamsData = await teamsRes.json();
        console.log('Teams data:', teamsData);
        console.log('Teams array:', teamsData.data?.teams);
        
        if (teamsData.success && teamsData.data?.teams) {
          const teamsList = teamsData.data.teams;
          console.log('Setting teams state with:', teamsList);
          console.log('First team:', teamsList[0]);
          setTeams(teamsList);
          console.log('Teams state should now have:', teamsList.length, 'teams');
        } else {
          console.warn('No teams found in response');
          setTeams([]);
        }
      } else {
        console.error('Failed to load teams:', await teamsRes.text());
        setTeams([]);
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTransactions = async () => {
    if (!userSeasonId || !selectedTeamId) return;

    try {
      setIsFetchingTransactions(true);
      const url = `/api/committee/salary-transactions?seasonId=${userSeasonId}&teamId=${selectedTeamId}`;
      console.log('🔍 Fetching transactions from:', url);
      
      const res = await fetchWithTokenRefresh(url);
      console.log('📡 Transaction API response status:', res.status);

      if (res.ok) {
        const data = await res.json();
        console.log('📊 Transaction data:', data);
        if (data.success) {
          console.log('✅ Setting transactions:', data.data?.length || 0, 'items');
          setTransactions(data.data || []);
        } else {
          console.warn('⚠️ API returned success: false');
        }
      } else {
        console.error('❌ Failed to load transactions:', await res.text());
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setIsFetchingTransactions(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric'
    });
  };

  const getPointsColor = (points: number) => {
    if (points > 0) return 'text-green-600';
    if (points < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getPointsIcon = (points: number) => {
    if (points > 0) return '↑';
    if (points < 0) return '↓';
    return '→';
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
            href="/dashboard/committee"
            className="inline-flex items-center gap-2 text-sm sm:text-base text-gray-600 hover:text-purple-600 transition-colors mb-3 sm:mb-4 group"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </Link>
          <div className="glass rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-white/30 shadow-xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 sm:p-3 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg">
                <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold gradient-text">Real Player Salaries</h1>
                <p className="text-xs sm:text-sm text-gray-600 mt-1">Match-by-match salary transactions</p>
              </div>
            </div>
          </div>
        </div>

        {/* Team Selector */}
        <div className="glass rounded-2xl sm:rounded-3xl border border-white/30 shadow-xl p-4 sm:p-6 mb-6">
          <label className="flex items-center gap-2 text-sm sm:text-base font-bold text-gray-900 mb-3">
            <div className="p-2 rounded-lg bg-purple-100">
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
            </div>
            Select Team
            {teams.length > 0 && (
              <span className="text-xs font-normal text-gray-500">({teams.length} teams)</span>
            )}
          </label>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-200 border-t-purple-600"></div>
              <span className="ml-3 text-gray-600">Loading teams...</span>
            </div>
          ) : teams.length === 0 ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
              <p className="text-yellow-800 text-sm">No teams found for this season</p>
            </div>
          ) : (
            <div>
              <select
                value={selectedTeamId}
                onChange={(e) => {
                  console.log('Team selected:', e.target.value);
                  setSelectedTeamId(e.target.value);
                }}
                className="w-full px-4 py-3 sm:py-4 text-sm sm:text-base border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 bg-white shadow-sm transition-all"
              >
                <option value="">-- Choose a team to view salary data --</option>
                {teams.map((teamData, index) => {
                  console.log('Rendering option for team:', teamData);
                  return (
                    <option key={teamData.team?.id || `team-${index}`} value={teamData.team?.id}>
                      {teamData.team?.name || 'Unnamed Team'}
                    </option>
                  );
                })}
              </select>
              <p className="text-xs text-gray-500 mt-2">Debug: {teams.length} teams in state</p>
            </div>
          )}
        </div>

        {/* Loading State */}
        {isFetchingTransactions && (
          <div className="glass rounded-2xl sm:rounded-3xl p-8 sm:p-12 text-center border border-white/30 shadow-xl">
            <div className="animate-spin rounded-full h-12 w-12 sm:h-16 sm:w-16 border-4 border-purple-200 border-t-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600 text-sm sm:text-base font-medium">Loading salary transactions...</p>
          </div>
        )}

        {/* Empty State */}
        {!isFetchingTransactions && !selectedTeamId && (
          <div className="glass rounded-2xl sm:rounded-3xl p-8 sm:p-12 lg:p-16 text-center border border-white/30 shadow-xl">
            <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-purple-100 to-indigo-100 mb-4 sm:mb-6">
              <DollarSign className="w-8 h-8 sm:w-10 sm:h-10 text-purple-600" />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Select a Team</h3>
            <p className="text-sm sm:text-base text-gray-600 max-w-md mx-auto">Choose a team from the dropdown above to view their real player salary transactions</p>
          </div>
        )}

        {/* No Transactions */}
        {!isFetchingTransactions && selectedTeamId && userSeasonId && transactions.length === 0 && (
          <div className="glass rounded-2xl sm:rounded-3xl p-8 sm:p-12 text-center border border-white/30 shadow-xl">
            <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 mb-4 sm:mb-6">
              <svg className="w-8 h-8 sm:w-10 sm:h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">No Transactions Found</h3>
            <p className="text-sm sm:text-base text-gray-600 max-w-md mx-auto">No real player salary payments found for this team in this season</p>
          </div>
        )}

        {/* Transactions List */}
        {!isFetchingTransactions && transactions.length > 0 && (
          <div className="space-y-4 sm:space-y-6">
            {transactions.map((txn, idx) => (
              <div key={idx} className="glass rounded-2xl sm:rounded-3xl border border-white/30 shadow-xl overflow-hidden transition-all hover:shadow-2xl">
                {/* Match Header */}
                <div className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-4 sm:px-6 py-4 sm:py-5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-1 bg-white/20 rounded-lg text-xs font-bold">
                          R{txn.round_number || '?'}
                        </span>
                        <h3 className="text-base sm:text-lg font-bold">
                          {formatDate(txn.match_date)}
                        </h3>
                      </div>
                      <p className="text-purple-100 text-xs sm:text-sm">
                        {txn.result || 'Match result'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 sm:text-right">
                      <div className="p-2 sm:p-3 rounded-xl bg-white/10">
                        <DollarSign className="w-5 h-5 sm:w-6 sm:h-6" />
                      </div>
                      <div>
                        <p className="text-xs text-purple-100">Total Paid</p>
                        <p className="text-xl sm:text-2xl font-bold">{txn.total_salary.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Players List - Mobile Optimized */}
                <div className="p-4 sm:p-6">
                  {/* Mobile: Card View */}
                  <div className="block sm:hidden space-y-3">
                    {txn.players.map((player, pidx) => (
                      <div key={pidx} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <p className="font-bold text-gray-900 mb-1">{player.player_name}</p>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-yellow-500 font-semibold">
                                {'⭐'.repeat(player.star_rating)}
                              </span>
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${player.points_change > 0 ? 'bg-green-100 text-green-700' : player.points_change < 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                                {getPointsIcon(player.points_change)} {player.points_change > 0 ? '+' : ''}{player.points_change}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-500">Paid</p>
                            <p className="text-lg font-bold text-red-600">{player.amount.toFixed(2)}</p>
                          </div>
                        </div>
                        <div className="flex justify-between text-xs text-gray-600 pt-3 border-t">
                          <span>Salary: {player.salary_per_match.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                    <div className="bg-purple-50 rounded-xl border-2 border-purple-200 p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-900">Total Salary Paid:</span>
                        <span className="text-xl font-bold text-red-600">-{txn.total_salary.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Desktop: Table View */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b-2 border-gray-200">
                        <tr>
                          <th className="px-4 lg:px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Player</th>
                          <th className="px-4 lg:px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Rating</th>
                          <th className="px-4 lg:px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Salary</th>
                          <th className="px-4 lg:px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Points</th>
                          <th className="px-4 lg:px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Paid</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {txn.players.map((player, pidx) => (
                          <tr key={pidx} className="hover:bg-purple-50/50 transition-colors">
                            <td className="px-4 lg:px-6 py-4">
                              <span className="font-semibold text-gray-900 text-sm">{player.player_name}</span>
                            </td>
                            <td className="px-4 lg:px-6 py-4 text-center">
                              <span className="inline-block text-yellow-500 text-sm font-bold">
                                {'⭐'.repeat(player.star_rating)}
                              </span>
                            </td>
                            <td className="px-4 lg:px-6 py-4 text-right">
                              <span className="font-semibold text-gray-900 text-sm">{player.salary_per_match.toFixed(2)}</span>
                            </td>
                            <td className="px-4 lg:px-6 py-4 text-center">
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${player.points_change > 0 ? 'bg-green-100 text-green-700' : player.points_change < 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                                {getPointsIcon(player.points_change)} {player.points_change > 0 ? '+' : ''}{player.points_change}
                              </span>
                            </td>
                            <td className="px-4 lg:px-6 py-4 text-right">
                              <span className="font-bold text-red-600 text-sm">{player.amount.toFixed(2)}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gradient-to-r from-purple-50 to-indigo-50 border-t-2 border-purple-200">
                        <tr>
                          <td colSpan={4} className="px-4 lg:px-6 py-4 text-right font-bold text-gray-900">
                            Total Salary Paid:
                          </td>
                          <td className="px-4 lg:px-6 py-4 text-right font-bold text-red-600 text-lg">
                            -{txn.total_salary.toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info Box */}
        {transactions.length > 0 && (
          <div className="mt-6 glass rounded-2xl sm:rounded-3xl border border-purple-200/50 p-4 sm:p-6 shadow-lg">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-purple-100 flex-shrink-0">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-purple-900 mb-3 text-sm sm:text-base">About Salary Transactions</h4>
                <ul className="text-xs sm:text-sm text-purple-800 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-purple-500 flex-shrink-0">•</span>
                    <span>Salary = (auction_value ÷ 100) × star_rating ÷ 10</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-500 flex-shrink-0">•</span>
                    <span>Deducted from Real Player Budget per match</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-500 flex-shrink-0">•</span>
                    <span>Points: ±5 max (based on goal difference)</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
