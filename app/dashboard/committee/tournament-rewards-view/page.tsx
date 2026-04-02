'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trophy, Users, Filter, Award, Target } from 'lucide-react';
import { db } from '@/lib/firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { usePermissions } from '@/hooks/usePermissions';

interface RewardTransaction {
  id: string;
  team_id: string;
  team_name?: string;
  season_id: string;
  transaction_type: 'position_reward' | 'completion_bonus' | 'knockout_reward';
  currency_type: 'football' | 'real';
  amount: number;
  description: string;
  created_at: any;
  metadata?: {
    tournament_id?: string;
    tournament_name?: string;
    position?: number;
    knockout_stage?: string;
  };
}

export default function TournamentRewardsViewPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { userSeasonId } = usePermissions();

  const [selectedTeamId, setSelectedTeamId] = useState<string>('all');
  const [selectedRewardType, setSelectedRewardType] = useState<string>('all');
  const [teams, setTeams] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<RewardTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingTransactions, setIsFetchingTransactions] = useState(false);
  const [teamSummary, setTeamSummary] = useState<{
    teamId: string;
    teamName: string;
    positionRewardECoin: number;
    positionRewardSSCoin: number;
    completionBonusECoin: number;
    completionBonusSSCoin: number;
    knockoutRewardECoin: number;
    knockoutRewardSSCoin: number;
    totalECoin: number;
    totalSSCoin: number;
    grandTotal: number;
  }[]>([]);

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
      if (selectedTeamId === 'ALL_SUMMARY') {
        loadTeamSummary();
      } else {
        loadTransactions();
      }
    }
  }, [selectedTeamId, selectedRewardType, userSeasonId]);

  const loadInitialData = async () => {
    if (!userSeasonId) return;

    try {
      setIsLoading(true);

      // Load teams from team_seasons for the current season
      const teamSeasonsQuery = query(
        collection(db, 'team_seasons'),
        where('season_id', '==', userSeasonId)
      );
      
      const teamSeasonsSnapshot = await getDocs(teamSeasonsQuery);

      const teamsList: any[] = [];
      const teamsMap: Record<string, string> = {}; // Map of team_id to team_name

      teamSeasonsSnapshot.forEach(doc => {
        const data = doc.data();
        const teamId = data.team_id;
        const teamName = data.team_name || teamId;
        
        teamsMap[teamId] = teamName;
        teamsList.push({
          team: {
            id: teamId,
            name: teamName
          }
        });
      });

      teamsList.sort((a, b) => a.team.name.localeCompare(b.team.name));
      setTeams(teamsList);
      
      // Store teams map in state for quick lookup
      (window as any).teamsMap = teamsMap;
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

      // Query for tournament reward transactions
      const rewardTypes = ['position_reward', 'completion_bonus', 'knockout_reward'];
      const allTransactions: RewardTransaction[] = [];

      for (const rewardType of rewardTypes) {
        let q;

        if (selectedTeamId !== 'all' && selectedTeamId !== 'ALL_SUMMARY') {
          q = query(
            collection(db, 'transactions'),
            where('transaction_type', '==', rewardType),
            where('team_id', '==', selectedTeamId)
          );
        } else {
          q = query(
            collection(db, 'transactions'),
            where('transaction_type', '==', rewardType)
          );
        }

        const snapshot = await getDocs(q);

        snapshot.forEach(doc => {
          const data = doc.data();

          // Apply season filter
          if (data.season_id !== userSeasonId) {
            return;
          }

          // Apply reward type filter
          if (selectedRewardType !== 'all' && data.transaction_type !== selectedRewardType) {
            return;
          }

          const teamName = teams.find(t => t.team.id === data.team_id)?.team.name || 
                          (window as any).teamsMap?.[data.team_id] || 
                          data.team_id;
          
          // Check if both amounts exist (stored together in database)
          const hasFootball = data.amount_football && data.amount_football > 0;
          const hasReal = data.amount_real && data.amount_real > 0;

          // Create separate transactions for each currency type
          if (hasFootball) {
            allTransactions.push({
              id: `${doc.id}_football`,
              team_id: data.team_id,
              team_name: teamName,
              season_id: data.season_id,
              transaction_type: data.transaction_type,
              currency_type: 'football',
              amount: data.amount_football,
              description: data.description || '',
              created_at: data.created_at,
              metadata: data.metadata || {}
            });
          }

          if (hasReal) {
            allTransactions.push({
              id: `${doc.id}_real`,
              team_id: data.team_id,
              team_name: teamName,
              season_id: data.season_id,
              transaction_type: data.transaction_type,
              currency_type: 'real',
              amount: data.amount_real,
              description: data.description || '',
              created_at: data.created_at,
              metadata: data.metadata || {}
            });
          }

          // Fallback for old format (single currency_type field)
          if (!hasFootball && !hasReal && data.amount) {
            allTransactions.push({
              id: doc.id,
              team_id: data.team_id,
              team_name: teamName,
              season_id: data.season_id,
              transaction_type: data.transaction_type,
              currency_type: data.currency_type || 'football',
              amount: data.amount,
              description: data.description || '',
              created_at: data.created_at,
              metadata: data.metadata || {}
            });
          }
        });
      }

      // Sort by created_at
      allTransactions.sort((a, b) => {
        const aTime = a.created_at?.toDate?.() || new Date(a.created_at);
        const bTime = b.created_at?.toDate?.() || new Date(b.created_at);
        return bTime.getTime() - aTime.getTime();
      });

      setTransactions(allTransactions);
      console.log(`Loaded ${allTransactions.length} tournament reward transactions`);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setIsFetchingTransactions(false);
    }
  };

  const loadTeamSummary = async () => {
    if (!userSeasonId) return;

    try {
      setIsFetchingTransactions(true);

      const rewardTypes = ['position_reward', 'completion_bonus', 'knockout_reward'];
      const teamTotals: Record<string, any> = {};

      // Initialize team totals
      teams.forEach(teamData => {
        teamTotals[teamData.team.id] = {
          teamId: teamData.team.id,
          teamName: teamData.team.name,
          positionRewardECoin: 0,
          positionRewardSSCoin: 0,
          completionBonusECoin: 0,
          completionBonusSSCoin: 0,
          knockoutRewardECoin: 0,
          knockoutRewardSSCoin: 0,
          totalECoin: 0,
          totalSSCoin: 0,
          grandTotal: 0,
        };
      });

      // Fetch all reward transactions
      for (const rewardType of rewardTypes) {
        const q = query(
          collection(db, 'transactions'),
          where('transaction_type', '==', rewardType)
        );

        const snapshot = await getDocs(q);

        snapshot.forEach(doc => {
          const data = doc.data();

          // Apply season filter
          if (data.season_id !== userSeasonId) {
            return;
          }

          const teamId = data.team_id;
          if (!teamTotals[teamId]) {
            const teamName = teams.find(t => t.team.id === teamId)?.team.name || 
                           (window as any).teamsMap?.[teamId] || 
                           teamId;
            teamTotals[teamId] = {
              teamId,
              teamName,
              positionRewardECoin: 0,
              positionRewardSSCoin: 0,
              completionBonusECoin: 0,
              completionBonusSSCoin: 0,
              knockoutRewardECoin: 0,
              knockoutRewardSSCoin: 0,
              totalECoin: 0,
              totalSSCoin: 0,
              grandTotal: 0,
            };
          }

          const eCoinAmount = data.amount_football || 0;
          const sSCoinAmount = data.amount_real || 0;

          // Add to specific reward type totals
          if (rewardType === 'position_reward') {
            teamTotals[teamId].positionRewardECoin += eCoinAmount;
            teamTotals[teamId].positionRewardSSCoin += sSCoinAmount;
          } else if (rewardType === 'completion_bonus') {
            teamTotals[teamId].completionBonusECoin += eCoinAmount;
            teamTotals[teamId].completionBonusSSCoin += sSCoinAmount;
          } else if (rewardType === 'knockout_reward') {
            teamTotals[teamId].knockoutRewardECoin += eCoinAmount;
            teamTotals[teamId].knockoutRewardSSCoin += sSCoinAmount;
          }

          // Add to totals
          teamTotals[teamId].totalECoin += eCoinAmount;
          teamTotals[teamId].totalSSCoin += sSCoinAmount;
          teamTotals[teamId].grandTotal += eCoinAmount + sSCoinAmount;
        });
      }

      // Convert to array and sort by grand total
      const summaryArray = Object.values(teamTotals)
        .filter(team => team.grandTotal > 0) // Only show teams with rewards
        .sort((a, b) => b.grandTotal - a.grandTotal);

      setTeamSummary(summaryArray);
    } catch (error) {
      console.error('Error loading team summary:', error);
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

  const getRewardTypeBadge = (type: string) => {
    const badges = {
      'position_reward': <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-bold rounded-lg flex items-center gap-1"><Trophy className="w-3 h-3" />Position</span>,
      'completion_bonus': <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-lg flex items-center gap-1"><Award className="w-3 h-3" />Completion</span>,
      'knockout_reward': <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-lg flex items-center gap-1"><Target className="w-3 h-3" />Knockout</span>
    };
    return badges[type as keyof typeof badges] || null;
  };

  const getRewardTypeIcon = (type: string) => {
    const icons = {
      'position_reward': '🥇',
      'completion_bonus': '🎉',
      'knockout_reward': '🏆'
    };
    return icons[type as keyof typeof icons] || '💰';
  };

  // Group transactions by tournament
  const groupedByTournament = transactions.reduce((acc, txn) => {
    const tournamentId = txn.metadata?.tournament_id || 'unknown';
    if (!acc[tournamentId]) {
      acc[tournamentId] = {
        name: txn.metadata?.tournament_name || tournamentId,
        transactions: []
      };
    }
    acc[tournamentId].transactions.push(txn);
    return acc;
  }, {} as Record<string, { name: string; transactions: RewardTransaction[] }>);

  // Calculate summary stats
  const summaryStats = {
    totalPositionRewards: transactions.filter(t => t.transaction_type === 'position_reward').reduce((sum, t) => sum + t.amount, 0),
    totalCompletionBonus: transactions.filter(t => t.transaction_type === 'completion_bonus').reduce((sum, t) => sum + t.amount, 0),
    totalKnockoutRewards: transactions.filter(t => t.transaction_type === 'knockout_reward').reduce((sum, t) => sum + t.amount, 0),
    totalECoin: transactions.filter(t => t.currency_type === 'football').reduce((sum, t) => sum + t.amount, 0),
    totalSSCoin: transactions.filter(t => t.currency_type === 'real').reduce((sum, t) => sum + t.amount, 0),
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 py-4 sm:py-6 lg:py-8 px-3 sm:px-4 lg:px-6">
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
                <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold gradient-text">Tournament Rewards</h1>
                <p className="text-xs sm:text-sm text-gray-600 mt-1">View position rewards, completion bonuses, and knockout rewards</p>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          <div className="glass rounded-xl p-4 border border-yellow-200/50 shadow-lg">
            <div className="text-center">
              <div className="text-3xl mb-2">🥇</div>
              <div className="text-2xl font-bold text-yellow-600">{summaryStats.totalPositionRewards}</div>
              <div className="text-xs text-gray-600 mt-1">Position Rewards</div>
            </div>
          </div>

          <div className="glass rounded-xl p-4 border border-green-200/50 shadow-lg">
            <div className="text-center">
              <div className="text-3xl mb-2">🎉</div>
              <div className="text-2xl font-bold text-green-600">{summaryStats.totalCompletionBonus}</div>
              <div className="text-xs text-gray-600 mt-1">Completion Bonus</div>
            </div>
          </div>

          <div className="glass rounded-xl p-4 border border-red-200/50 shadow-lg">
            <div className="text-center">
              <div className="text-3xl mb-2">🏆</div>
              <div className="text-2xl font-bold text-red-600">{summaryStats.totalKnockoutRewards}</div>
              <div className="text-xs text-gray-600 mt-1">Knockout Rewards</div>
            </div>
          </div>

          <div className="glass rounded-xl p-4 border border-blue-200/50 shadow-lg">
            <div className="text-center">
              <div className="text-3xl mb-2">🔵</div>
              <div className="text-2xl font-bold text-blue-600">{summaryStats.totalECoin}</div>
              <div className="text-xs text-gray-600 mt-1">Total eCoin</div>
            </div>
          </div>

          <div className="glass rounded-xl p-4 border border-purple-200/50 shadow-lg">
            <div className="text-center">
              <div className="text-3xl mb-2">🟣</div>
              <div className="text-2xl font-bold text-purple-600">{summaryStats.totalSSCoin}</div>
              <div className="text-xs text-gray-600 mt-1">Total SSCoin</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="glass rounded-2xl sm:rounded-3xl border border-white/30 shadow-xl p-4 sm:p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-bold text-gray-900">Filters</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Team Filter */}
            <div>
              <label className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-2">
                <Users className="w-4 h-4 text-purple-600" />
                Team
              </label>
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 bg-white shadow-sm transition-all"
              >
                <option value="all">All Teams</option>
                <option value="ALL_SUMMARY" className="font-bold bg-purple-50">📊 ALL TEAMS SUMMARY</option>
                {teams.map((teamData) => (
                  <option key={teamData.team.id} value={teamData.team.id}>
                    {teamData.team.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Reward Type Filter */}
            <div>
              <label className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-2">
                <Trophy className="w-4 h-4 text-purple-600" />
                Reward Type
              </label>
              <select
                value={selectedRewardType}
                onChange={(e) => setSelectedRewardType(e.target.value)}
                className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 bg-white shadow-sm transition-all"
              >
                <option value="all">All Reward Types</option>
                <option value="position_reward">🥇 Position Rewards</option>
                <option value="completion_bonus">🎉 Completion Bonus</option>
                <option value="knockout_reward">🏆 Knockout Rewards</option>
              </select>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isFetchingTransactions && (
          <div className="glass rounded-2xl sm:rounded-3xl p-8 sm:p-12 text-center border border-white/30 shadow-xl">
            <div className="animate-spin rounded-full h-12 w-12 sm:h-16 sm:w-16 border-4 border-purple-200 border-t-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600 text-sm sm:text-base font-medium">Loading tournament rewards...</p>
          </div>
        )}

        {/* Team Summary View */}
        {!isFetchingTransactions && selectedTeamId === 'ALL_SUMMARY' && teamSummary.length > 0 && (
          <div className="glass rounded-2xl sm:rounded-3xl border border-white/30 shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-purple-500 to-blue-600 text-white px-4 sm:px-6 py-4 sm:py-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Trophy className="w-6 h-6" />
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold">All Teams Tournament Rewards Summary</h2>
                    <p className="text-purple-100 text-sm">Sorted by total rewards (descending)</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-6">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b-2 border-gray-200">
                    <tr>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Rank</th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Team Name</th>
                      <th className="px-4 lg:px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Position<br/>🥇</th>
                      <th className="px-4 lg:px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Completion<br/>🎉</th>
                      <th className="px-4 lg:px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Knockout<br/>🏆</th>
                      <th className="px-4 lg:px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Total eCoin</th>
                      <th className="px-4 lg:px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Total SSCoin</th>
                      <th className="px-4 lg:px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Grand Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {teamSummary.map((team, index) => (
                      <tr key={team.teamId} className="hover:bg-purple-50/50 transition-colors">
                        <td className="px-4 lg:px-6 py-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                            index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600' :
                            index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500' :
                            index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600' :
                            'bg-gradient-to-br from-purple-400 to-purple-600'
                          }`}>
                            {index + 1}
                          </div>
                        </td>
                        <td className="px-4 lg:px-6 py-4">
                          <button
                            onClick={() => setSelectedTeamId(team.teamId)}
                            className="font-semibold text-purple-600 hover:text-purple-800 hover:underline text-left"
                          >
                            {team.teamName}
                          </button>
                        </td>
                        <td className="px-4 lg:px-6 py-4 text-center">
                          <div className="text-xs space-y-1">
                            <div className="text-blue-600 font-semibold">{team.positionRewardECoin}</div>
                            <div className="text-purple-600 font-semibold">{team.positionRewardSSCoin}</div>
                          </div>
                        </td>
                        <td className="px-4 lg:px-6 py-4 text-center">
                          <div className="text-xs space-y-1">
                            <div className="text-blue-600 font-semibold">{team.completionBonusECoin}</div>
                            <div className="text-purple-600 font-semibold">{team.completionBonusSSCoin}</div>
                          </div>
                        </td>
                        <td className="px-4 lg:px-6 py-4 text-center">
                          <div className="text-xs space-y-1">
                            <div className="text-blue-600 font-semibold">{team.knockoutRewardECoin}</div>
                            <div className="text-purple-600 font-semibold">{team.knockoutRewardSSCoin}</div>
                          </div>
                        </td>
                        <td className="px-4 lg:px-6 py-4 text-right">
                          <span className="font-semibold text-blue-600">
                            {team.totalECoin}
                          </span>
                        </td>
                        <td className="px-4 lg:px-6 py-4 text-right">
                          <span className="font-semibold text-purple-600">
                            {team.totalSSCoin}
                          </span>
                        </td>
                        <td className="px-4 lg:px-6 py-4 text-right">
                          <span className="text-lg font-bold text-green-600">
                            {team.grandTotal}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gradient-to-r from-purple-50 to-blue-50 border-t-2 border-purple-200">
                    <tr>
                      <td colSpan={5} className="px-4 lg:px-6 py-4 text-right font-bold text-gray-900">
                        Grand Total:
                      </td>
                      <td className="px-4 lg:px-6 py-4 text-right font-bold text-blue-600">
                        {teamSummary.reduce((sum, team) => sum + team.totalECoin, 0)}
                      </td>
                      <td className="px-4 lg:px-6 py-4 text-right font-bold text-purple-600">
                        {teamSummary.reduce((sum, team) => sum + team.totalSSCoin, 0)}
                      </td>
                      <td className="px-4 lg:px-6 py-4 text-right font-bold text-green-600 text-xl">
                        {teamSummary.reduce((sum, team) => sum + team.grandTotal, 0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* No Transactions */}
        {!isFetchingTransactions && selectedTeamId !== 'ALL_SUMMARY' && transactions.length === 0 && (
          <div className="glass rounded-2xl sm:rounded-3xl p-8 sm:p-12 text-center border border-white/30 shadow-xl">
            <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 mb-4 sm:mb-6">
              <Trophy className="w-8 h-8 sm:w-10 sm:h-10 text-gray-400" />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">No Rewards Found</h3>
            <p className="text-sm sm:text-base text-gray-600 max-w-md mx-auto">No tournament reward transactions found for the selected filters</p>
          </div>
        )}

        {/* Transactions List - Grouped by Tournament */}
        {!isFetchingTransactions && selectedTeamId !== 'ALL_SUMMARY' && transactions.length > 0 && (
          <div className="space-y-4 sm:space-y-6">
            {Object.entries(groupedByTournament).map(([tournamentId, tournamentData]) => {
              const positionRewards = tournamentData.transactions.filter(t => t.transaction_type === 'position_reward');
              const completionBonus = tournamentData.transactions.filter(t => t.transaction_type === 'completion_bonus');
              const knockoutRewards = tournamentData.transactions.filter(t => t.transaction_type === 'knockout_reward');

              return (
                <div key={tournamentId} className="glass rounded-2xl sm:rounded-3xl border border-white/30 shadow-xl overflow-hidden transition-all hover:shadow-2xl">
                  {/* Tournament Header */}
                  <div className="bg-gradient-to-r from-purple-500 to-blue-600 text-white px-4 sm:px-6 py-4 sm:py-5">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold mb-1">{tournamentData.name}</h3>
                        <div className="flex items-center gap-2 flex-wrap">
                          {positionRewards.length > 0 && (
                            <span className="px-2 py-1 bg-white/20 rounded-lg text-xs font-bold">
                              🥇 {positionRewards.length} Position
                            </span>
                          )}
                          {completionBonus.length > 0 && (
                            <span className="px-2 py-1 bg-white/20 rounded-lg text-xs font-bold">
                              🎉 {completionBonus.length} Completion
                            </span>
                          )}
                          {knockoutRewards.length > 0 && (
                            <span className="px-2 py-1 bg-white/20 rounded-lg text-xs font-bold">
                              🏆 {knockoutRewards.length} Knockout
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-white/80">Total Rewards</p>
                        <p className="text-2xl font-bold">
                          {tournamentData.transactions.reduce((sum, t) => sum + t.amount, 0)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Transactions Table */}
                  <div className="p-4 sm:p-6">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b-2 border-gray-200">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Type</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Team</th>
                            <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Currency</th>
                            <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Amount</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Description</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {tournamentData.transactions.map((txn) => (
                            <tr key={txn.id} className="hover:bg-purple-50/50 transition-colors">
                              <td className="px-4 py-4">
                                {getRewardTypeBadge(txn.transaction_type)}
                              </td>
                              <td className="px-4 py-4">
                                <span className="font-semibold text-gray-900 text-sm">{txn.team_name}</span>
                              </td>
                              <td className="px-4 py-4 text-center">
                                {getCurrencyBadge(txn.currency_type)}
                              </td>
                              <td className="px-4 py-4 text-right">
                                <span className="font-bold text-purple-600 text-lg">+{txn.amount}</span>
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
      </div>
    </div>
  );
}
