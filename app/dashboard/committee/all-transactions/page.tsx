'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DollarSign, Users, Filter, TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import { db } from '@/lib/firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { usePermissions } from '@/hooks/usePermissions';

interface Transaction {
  id: string;
  team_id: string;
  team_name?: string;
  season_id: string;
  transaction_type: string;
  currency_type: 'football' | 'real';
  amount: number;
  amount_football?: number;
  amount_real?: number;
  description: string;
  created_at: any;
  metadata?: any;
}

interface TeamSummary {
  teamId: string;
  teamName: string;
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  eCoinIncome: number;
  eCoinExpense: number;
  sSCoinIncome: number;
  sSCoinExpense: number;
  transactionCount: number;
}

export default function AllTransactionsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { userSeasonId } = usePermissions();

  const [selectedTeamId, setSelectedTeamId] = useState<string>('all');
  const [selectedTransactionType, setSelectedTransactionType] = useState<string>('all');
  const [selectedCurrency, setSelectedCurrency] = useState<string>('all');
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('current');
  const [teams, setTeams] = useState<any[]>([]);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingTransactions, setIsFetchingTransactions] = useState(false);
  const [teamSummary, setTeamSummary] = useState<TeamSummary[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);
  const [totalTransactions, setTotalTransactions] = useState(0);

  // Transaction type categories
  const INCOME_TYPES = ['match_reward', 'position_reward', 'completion_bonus', 'knockout_reward', 'bonus', 'transfer_compensation', 'swap_fee_received', 'release_refund', 'player_release_refund', 'initial_balance'];
  const EXPENSE_TYPES = ['salary_payment', 'salary', 'real_player_fee', 'auction_win', 'fine', 'transfer_payment', 'swap_fee_paid'];

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
      setCurrentPage(1); // Reset to page 1 when filters change
      
      // Reload teams when season changes
      if (selectedSeasonId !== 'current' && selectedSeasonId !== 'all') {
        loadTeamsForSeason(selectedSeasonId);
      } else {
        loadTeamsForSeason(userSeasonId);
      }
      
      if (showSummary) {
        loadTeamSummary();
      } else {
        loadTransactions();
      }
    }
  }, [selectedTeamId, selectedTransactionType, selectedCurrency, selectedSeasonId, userSeasonId, showSummary]);

  useEffect(() => {
    if (userSeasonId && !showSummary) {
      loadTransactions();
    }
  }, [currentPage]);

  const loadTeamsForSeason = async (seasonId: string) => {
    try {
      const teamSeasonsQuery = query(
        collection(db, 'team_seasons'),
        where('season_id', '==', seasonId)
      );
      
      const teamSeasonsSnapshot = await getDocs(teamSeasonsQuery);

      const teamsList: any[] = [];
      const teamsMap: Record<string, string> = {};

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
      
      // Store teams map for quick lookup
      (window as any).teamsMap = teamsMap;
    } catch (error) {
      console.error('Error loading teams for season:', error);
    }
  };

  const loadInitialData = async () => {
    if (!userSeasonId) return;

    try {
      setIsLoading(true);

      // Load teams from team_seasons for the current season
      await loadTeamsForSeason(userSeasonId);

      // Load seasons that have team_seasons records
      const teamSeasonsSnapshot = await getDocs(collection(db, 'team_seasons'));
      const seasonIdsSet = new Set<string>();
      
      teamSeasonsSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.season_id) {
          seasonIdsSet.add(data.season_id);
        }
      });

      // Fetch season details from seasons collection
      const seasonsSnapshot = await getDocs(collection(db, 'seasons'));
      const seasonsList: any[] = [];
      const foundSeasonIds = new Set<string>();
      
      seasonsSnapshot.forEach(doc => {
        if (seasonIdsSet.has(doc.id)) {
          foundSeasonIds.add(doc.id);
          seasonsList.push({
            id: doc.id,
            ...doc.data()
          });
        }
      });

      // Add season IDs that have team_seasons but no season document
      seasonIdsSet.forEach(seasonId => {
        if (!foundSeasonIds.has(seasonId)) {
          seasonsList.push({
            id: seasonId,
            name: seasonId, // Use ID as name if no document exists
            created_at: null
          });
        }
      });

      seasonsList.sort((a, b) => {
        if (a.created_at && b.created_at) {
          return b.created_at.toMillis() - a.created_at.toMillis();
        }
        // Put seasons without created_at at the end, or sort by name
        if (!a.created_at && !b.created_at) {
          return a.name.localeCompare(b.name);
        }
        return a.created_at ? -1 : 1;
      });

      setSeasons(seasonsList);
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

      // Fetch all transactions
      let q = query(collection(db, 'transactions'));

      const snapshot = await getDocs(q);
      const allTransactions: Transaction[] = [];

      // Determine which season to filter by
      const filterSeasonId = selectedSeasonId === 'current' ? userSeasonId : selectedSeasonId;

      snapshot.forEach(doc => {
        const data = doc.data();

        // Apply season filter
        if (selectedSeasonId === 'all') {
          // Show all seasons
        } else if (data.season_id !== filterSeasonId) {
          return;
        }

        // Apply team filter
        if (selectedTeamId !== 'all' && data.team_id !== selectedTeamId) {
          return;
        }

        // Apply transaction type filter
        if (selectedTransactionType !== 'all' && data.transaction_type !== selectedTransactionType) {
          return;
        }

        const teamName = teams.find(t => t.team.id === data.team_id)?.team.name || 
                        (window as any).teamsMap?.[data.team_id] || 
                        data.team_id;
        
        // Handle both old and new format
        // Check if fields exist (not just if they're non-zero)
        const hasFootball = data.amount_football !== undefined && data.amount_football !== null;
        const hasReal = data.amount_real !== undefined && data.amount_real !== null;
        const hasRefundAmount = data.refund_amount !== undefined && data.refund_amount !== null;

        if (hasFootball || hasReal) {
          // New format with separate amounts
          if (hasFootball && data.amount_football !== 0 && (selectedCurrency === 'all' || selectedCurrency === 'football')) {
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

          if (hasReal && data.amount_real !== 0 && (selectedCurrency === 'all' || selectedCurrency === 'real')) {
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
        } else if (data.amount !== undefined && data.amount !== null && data.amount !== 0) {
          // Old format with single amount
          // First check currency_type, then fallback to player_type
          let currencyType = data.currency_type;
          
          if (!currencyType && data.player_type) {
            // Fallback to player_type if currency_type not found
            currencyType = data.player_type;
          }
          
          const isSSCoin = currencyType === 'real' || currencyType === 'real_player';
          const isECoin = currencyType === 'football';
          
          const shouldInclude = 
            selectedCurrency === 'all' ||
            (selectedCurrency === 'real' && isSSCoin) ||
            (selectedCurrency === 'football' && isECoin);
          
          if (shouldInclude) {
            allTransactions.push({
              id: doc.id,
              team_id: data.team_id,
              team_name: teamName,
              season_id: data.season_id,
              transaction_type: data.transaction_type,
              currency_type: isSSCoin ? 'real' : 'football', // Normalize to 'real' or 'football'
              amount: data.amount,
              description: data.description || '',
              created_at: data.created_at,
              metadata: data.metadata || {}
            });
          }
        } else if (hasRefundAmount && data.refund_amount !== 0) {
          // Handle release transactions with refund_amount
          // Use player_type to determine currency
          const isSSCoin = data.player_type === 'real' || data.player_type === 'real_player';
          const isECoin = data.player_type === 'football';
          
          const shouldInclude = 
            selectedCurrency === 'all' ||
            (selectedCurrency === 'real' && isSSCoin) ||
            (selectedCurrency === 'football' && isECoin);
          
          if (shouldInclude) {
            allTransactions.push({
              id: doc.id,
              team_id: data.team_id,
              team_name: teamName,
              season_id: data.season_id,
              transaction_type: data.transaction_type,
              currency_type: isSSCoin ? 'real' : 'football',
              amount: data.refund_amount, // Use refund_amount as the amount
              description: data.description || `Player release refund: ${data.player_name || 'Unknown'} (${data.refund_percentage || 0}% refund)`,
              created_at: data.created_at,
              metadata: data.metadata || {}
            });
          }
        }
      });

      // Sort by created_at
      allTransactions.sort((a, b) => {
        const aTime = a.created_at?.toDate?.() || new Date(a.created_at);
        const bTime = b.created_at?.toDate?.() || new Date(b.created_at);
        return bTime.getTime() - aTime.getTime();
      });

      setTotalTransactions(allTransactions.length);
      setTransactions(allTransactions);
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

      // Fetch all transactions for the season
      const q = query(collection(db, 'transactions'));
      const snapshot = await getDocs(q);

      const teamTotals: Record<string, TeamSummary> = {};

      // Initialize team totals
      teams.forEach(teamData => {
        teamTotals[teamData.team.id] = {
          teamId: teamData.team.id,
          teamName: teamData.team.name,
          totalIncome: 0,
          totalExpense: 0,
          netBalance: 0,
          eCoinIncome: 0,
          eCoinExpense: 0,
          sSCoinIncome: 0,
          sSCoinExpense: 0,
          transactionCount: 0,
        };
      });

      // Determine which season to filter by
      const filterSeasonId = selectedSeasonId === 'current' ? userSeasonId : selectedSeasonId;

      snapshot.forEach(doc => {
        const data = doc.data();

        // Apply season filter
        if (selectedSeasonId === 'all') {
          // Show all seasons
        } else if (data.season_id !== filterSeasonId) {
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
            totalIncome: 0,
            totalExpense: 0,
            netBalance: 0,
            eCoinIncome: 0,
            eCoinExpense: 0,
            sSCoinIncome: 0,
            sSCoinExpense: 0,
            transactionCount: 0,
          };
        }

        const eCoinAmount = data.amount_football || (data.currency_type === 'football' ? data.amount : 0) || 0;
        const sSCoinAmount = data.amount_real || ((data.currency_type === 'real' || data.currency_type === 'real_player') ? data.amount : 0) || 0;

        // If no currency_type, check player_type as fallback
        let finalECoinAmount = eCoinAmount;
        let finalSSCoinAmount = sSCoinAmount;
        
        if (!data.currency_type && data.player_type && data.amount) {
          if (data.player_type === 'football') {
            finalECoinAmount = data.amount;
          } else if (data.player_type === 'real' || data.player_type === 'real_player') {
            finalSSCoinAmount = data.amount;
          }
        }

        const isIncome = INCOME_TYPES.includes(data.transaction_type) || 
                        (data.amount > 0 && !EXPENSE_TYPES.includes(data.transaction_type));

        // Track if we counted this transaction
        let transactionCounted = false;

        if (finalECoinAmount !== 0) {
          if (isIncome || finalECoinAmount > 0) {
            teamTotals[teamId].eCoinIncome += Math.abs(finalECoinAmount);
          } else {
            teamTotals[teamId].eCoinExpense += Math.abs(finalECoinAmount);
          }
          transactionCounted = true;
        }

        if (finalSSCoinAmount !== 0) {
          if (isIncome || finalSSCoinAmount > 0) {
            teamTotals[teamId].sSCoinIncome += Math.abs(finalSSCoinAmount);
          } else {
            teamTotals[teamId].sSCoinExpense += Math.abs(finalSSCoinAmount);
          }
          transactionCounted = true;
        }

        // Only count the transaction once, even if it has both currencies
        if (transactionCounted) {
          teamTotals[teamId].transactionCount++;
        }
      });

      // Calculate net balance and sort
      const summaryArray = Object.values(teamTotals)
        .map(team => {
          const totalIncome = team.eCoinIncome + team.sSCoinIncome;
          const totalExpense = team.eCoinExpense + team.sSCoinExpense;
          return {
            ...team,
            totalIncome,
            totalExpense,
            netBalance: totalIncome - totalExpense
          };
        })
        .filter(team => team.transactionCount > 0)
        .sort((a, b) => b.netBalance - a.netBalance);

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

  const getTransactionIcon = (type: string) => {
    const icons: Record<string, string> = {
      'match_reward': '🏆',
      'position_reward': '🥇',
      'completion_bonus': '🎉',
      'knockout_reward': '🏆',
      'salary_payment': '💰',
      'salary': '💰',
      'real_player_fee': '👤',
      'auction_win': '🔨',
      'fine': '⚠️',
      'bonus': '🎁',
      'transfer_payment': '➡️',
      'transfer_compensation': '⬅️',
      'swap_fee_paid': '🔄',
      'swap_fee_received': '🔁',
      'release_refund': '↩️',
      'player_release_refund': '↩️',
      'initial_balance': '🏬',
      'adjustment': '🔧',
    };
    return icons[type] || '📝';
  };

  const formatTransactionType = (type: string) => {
    const typeMap: Record<string, string> = {
      'match_reward': 'Match Reward',
      'position_reward': 'Position Reward',
      'completion_bonus': 'Completion Bonus',
      'knockout_reward': 'Knockout Reward',
      'salary_payment': 'Salary Payment',
      'real_player_fee': 'Real Player Fee',
      'auction_win': 'Auction Win',
      'initial_balance': 'Initial Balance',
      'transfer_payment': 'Transfer Payment',
      'transfer_compensation': 'Transfer Compensation',
      'swap_fee_paid': 'Swap Fee Paid',
      'swap_fee_received': 'Swap Fee Received',
      'player_release_refund': 'Player Release Refund',
      'release_refund': 'Release Refund',
    };
    
    return typeMap[type] || type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const isIncomeTransaction = (type: string, amount: number) => {
    return INCOME_TYPES.includes(type) || amount > 0;
  };

  const copyTeamSummaryToWhatsApp = () => {
    if (teamSummary.length === 0) return;

    let message = `*💰 COMPLETE TRANSACTION SUMMARY*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    teamSummary.forEach((team, index) => {
      const rank = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;

      message += `${rank} *${team.teamName}*\n`;
      message += `   💵 Net Balance: ${team.netBalance >= 0 ? '+' : ''}${team.netBalance}\n\n`;
      
      message += `   📈 INCOME:\n`;
      message += `      🔵 eCoin: +${team.eCoinIncome}\n`;
      message += `      🟣 SSCoin: +${team.sSCoinIncome}\n`;
      message += `      Total: +${team.totalIncome}\n\n`;
      
      message += `   📉 EXPENSES:\n`;
      message += `      🔵 eCoin: -${team.eCoinExpense}\n`;
      message += `      🟣 SSCoin: -${team.sSCoinExpense}\n`;
      message += `      Total: -${team.totalExpense}\n\n`;
      
      message += `   📊 Transactions: ${team.transactionCount}\n\n`;
    });

    message += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `*GRAND TOTALS*\n`;
    message += `Total Income: +${teamSummary.reduce((sum, t) => sum + t.totalIncome, 0)}\n`;
    message += `Total Expenses: -${teamSummary.reduce((sum, t) => sum + t.totalExpense, 0)}\n`;
    message += `Teams: ${teamSummary.length}`;

    navigator.clipboard.writeText(message).then(() => {
      alert('✅ Summary copied to clipboard! You can now paste it in WhatsApp.');
    }).catch(() => {
      alert('❌ Failed to copy to clipboard');
    });
  };

  // Pagination - only for "all teams" view
  const shouldPaginate = selectedTeamId === 'all';
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const displayTransactions = shouldPaginate ? transactions.slice(startIndex, endIndex) : transactions;
  const totalPages = shouldPaginate ? Math.ceil(totalTransactions / itemsPerPage) : 1;
  const paginatedTransactions = displayTransactions;

  // Calculate overall summary stats
  const overallStats = {
    totalIncome: transactions.filter(t => isIncomeTransaction(t.transaction_type, t.amount)).reduce((sum, t) => sum + Math.abs(t.amount), 0),
    totalExpense: transactions.filter(t => !isIncomeTransaction(t.transaction_type, t.amount)).reduce((sum, t) => sum + Math.abs(t.amount), 0),
    totalECoin: transactions.filter(t => t.currency_type === 'football').reduce((sum, t) => {
      const isIncome = isIncomeTransaction(t.transaction_type, t.amount);
      return sum + (isIncome ? Math.abs(t.amount) : -Math.abs(t.amount));
    }, 0),
    totalSSCoin: transactions.filter(t => t.currency_type === 'real').reduce((sum, t) => {
      const isIncome = isIncomeTransaction(t.transaction_type, t.amount);
      return sum + (isIncome ? Math.abs(t.amount) : -Math.abs(t.amount));
    }, 0),
    matchRewards: transactions.filter(t => t.transaction_type === 'match_reward').reduce((sum, t) => sum + Math.abs(t.amount), 0),
    tournamentRewards: transactions.filter(t => ['position_reward', 'completion_bonus', 'knockout_reward'].includes(t.transaction_type)).reduce((sum, t) => sum + Math.abs(t.amount), 0),
    salaries: transactions.filter(t => ['salary_payment', 'salary'].includes(t.transaction_type)).reduce((sum, t) => sum + Math.abs(t.amount), 0),
    realPlayerFees: transactions.filter(t => t.transaction_type === 'real_player_fee').reduce((sum, t) => sum + Math.abs(t.amount), 0),
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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 py-4 sm:py-6 lg:py-8 px-3 sm:px-4 lg:px-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <Link
            href="/dashboard/committee"
            className="inline-flex items-center gap-2 text-sm sm:text-base text-gray-600 hover:text-indigo-600 transition-colors mb-3 sm:mb-4 group"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </Link>
          <div className="glass rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-white/30 shadow-xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 sm:p-3 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg">
                <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold gradient-text">All Transactions</h1>
                <p className="text-xs sm:text-sm text-gray-600 mt-1">Complete financial transaction history</p>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        {!showSummary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="glass rounded-xl p-4 border border-green-200/50 shadow-lg">
              <div className="text-center">
                <TrendingUp className="w-6 h-6 text-green-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-green-600">{overallStats.totalIncome}</div>
                <div className="text-xs text-gray-600 mt-1">Total Income</div>
              </div>
            </div>

            <div className="glass rounded-xl p-4 border border-red-200/50 shadow-lg">
              <div className="text-center">
                <TrendingDown className="w-6 h-6 text-red-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-red-600">{overallStats.totalExpense}</div>
                <div className="text-xs text-gray-600 mt-1">Total Expenses</div>
              </div>
            </div>

            <div className="glass rounded-xl p-4 border border-blue-200/50 shadow-lg">
              <div className="text-center">
                <div className="text-3xl mb-2">🔵</div>
                <div className="text-2xl font-bold text-blue-600">{overallStats.totalECoin}</div>
                <div className="text-xs text-gray-600 mt-1">Net eCoin</div>
              </div>
            </div>

            <div className="glass rounded-xl p-4 border border-purple-200/50 shadow-lg">
              <div className="text-center">
                <div className="text-3xl mb-2">🟣</div>
                <div className="text-2xl font-bold text-purple-600">{overallStats.totalSSCoin}</div>
                <div className="text-xs text-gray-600 mt-1">Net SSCoin</div>
              </div>
            </div>
          </div>
        )}

        {/* View Toggle */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex rounded-lg bg-white shadow-lg border border-gray-200 p-1">
            <button
              onClick={() => setShowSummary(false)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                !showSummary
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              📋 Detailed View
            </button>
            <button
              onClick={() => setShowSummary(true)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                showSummary
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              📊 Team Summary
            </button>
          </div>
        </div>

        {/* Filters - Only show in detailed view */}
        {!showSummary && (
          <div className="glass rounded-2xl sm:rounded-3xl border border-white/30 shadow-xl p-4 sm:p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-bold text-gray-900">Filters</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Season Filter */}
              <div>
                <label className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-2">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  Season
                </label>
                <select
                  value={selectedSeasonId}
                  onChange={(e) => setSelectedSeasonId(e.target.value)}
                  className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white shadow-sm transition-all"
                >
                  <option value="current">Current Season</option>
                  <option value="all">All Seasons</option>
                  {seasons.map((season) => (
                    <option key={season.id} value={season.id}>
                      {season.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Team Filter */}
              <div>
                <label className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-2">
                  <Users className="w-4 h-4 text-indigo-600" />
                  Team
                </label>
                <select
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white shadow-sm transition-all"
                >
                  <option value="all">All Teams</option>
                  {teams.map((teamData) => (
                    <option key={teamData.team.id} value={teamData.team.id}>
                      {teamData.team.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Transaction Type Filter */}
              <div>
                <label className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-2">
                  <DollarSign className="w-4 h-4 text-indigo-600" />
                  Transaction Type
                </label>
                <select
                  value={selectedTransactionType}
                  onChange={(e) => setSelectedTransactionType(e.target.value)}
                  className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white shadow-sm transition-all"
                >
                  <option value="all">All Types</option>
                  <optgroup label="Income">
                    <option value="match_reward">🏆 Match Rewards</option>
                    <option value="position_reward">🥇 Position Rewards</option>
                    <option value="completion_bonus">🎉 Completion Bonus</option>
                    <option value="knockout_reward">🏆 Knockout Rewards</option>
                    <option value="bonus">🎁 Bonus</option>
                  </optgroup>
                  <optgroup label="Expenses">
                    <option value="salary_payment">💰 Salary Payments</option>
                    <option value="real_player_fee">👤 Real Player Fees</option>
                    <option value="auction_win">🔨 Auction Wins</option>
                    <option value="fine">⚠️ Fines</option>
                  </optgroup>
                  <optgroup label="Transfers">
                    <option value="transfer_payment">➡️ Transfer Payments</option>
                    <option value="transfer_compensation">⬅️ Transfer Compensation</option>
                    <option value="swap_fee_paid">� Swap Fee Paid</option>
                    <option value="swap_fee_received">� Swap Fee Received</option>
                  </optgroup>
                  <optgroup label="Other">
                    <option value="player_release_refund">↩️ Release Refunds</option>
                    <option value="initial_balance">🏬 Initial Balance</option>
                  </optgroup>
                </select>
              </div>

              {/* Currency Filter */}
              <div>
                <label className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-2">
                  <Filter className="w-4 h-4 text-indigo-600" />
                  Currency
                </label>
                <select
                  value={selectedCurrency}
                  onChange={(e) => setSelectedCurrency(e.target.value)}
                  className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white shadow-sm transition-all"
                >
                  <option value="all">All Currencies</option>
                  <option value="football">🔵 eCoin Only</option>
                  <option value="real">🟣 SSCoin Only</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isFetchingTransactions && (
          <div className="glass rounded-2xl sm:rounded-3xl p-8 sm:p-12 text-center border border-white/30 shadow-xl">
            <div className="animate-spin rounded-full h-12 w-12 sm:h-16 sm:w-16 border-4 border-indigo-200 border-t-indigo-600 mx-auto mb-4"></div>
            <p className="text-gray-600 text-sm sm:text-base font-medium">Loading transactions...</p>
          </div>
        )}

        {/* Team Summary View */}
        {!isFetchingTransactions && showSummary && teamSummary.length > 0 && (
          <div className="glass rounded-2xl sm:rounded-3xl border border-white/30 shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-4 sm:px-6 py-4 sm:py-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <DollarSign className="w-6 h-6" />
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold">Team Financial Summary</h2>
                    <p className="text-indigo-100 text-sm">Income vs Expenses by team</p>
                  </div>
                </div>
                <button
                  onClick={copyTeamSummaryToWhatsApp}
                  className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white font-semibold rounded-lg transition-colors shadow-lg"
                  title="Copy summary to clipboard for WhatsApp"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                  </svg>
                  <span className="hidden sm:inline">Copy to WhatsApp</span>
                  <span className="sm:hidden">Copy</span>
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b-2 border-gray-200">
                    <tr>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Rank</th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Team Name</th>
                      <th className="px-4 lg:px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Income</th>
                      <th className="px-4 lg:px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Expenses</th>
                      <th className="px-4 lg:px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Net Balance</th>
                      <th className="px-4 lg:px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Transactions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {teamSummary.map((team, index) => (
                      <tr key={team.teamId} className="hover:bg-indigo-50/50 transition-colors">
                        <td className="px-4 lg:px-6 py-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                            index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600' :
                            index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500' :
                            index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600' :
                            'bg-gradient-to-br from-indigo-400 to-indigo-600'
                          }`}>
                            {index + 1}
                          </div>
                        </td>
                        <td className="px-4 lg:px-6 py-4">
                          <div className="font-semibold text-gray-900">{team.teamName}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            <span className="text-blue-600">eCoin: +{team.eCoinIncome}/-{team.eCoinExpense}</span>
                            {' | '}
                            <span className="text-purple-600">SSCoin: +{team.sSCoinIncome}/-{team.sSCoinExpense}</span>
                          </div>
                        </td>
                        <td className="px-4 lg:px-6 py-4 text-right">
                          <span className="font-semibold text-green-600">+{team.totalIncome}</span>
                        </td>
                        <td className="px-4 lg:px-6 py-4 text-right">
                          <span className="font-semibold text-red-600">-{team.totalExpense}</span>
                        </td>
                        <td className="px-4 lg:px-6 py-4 text-right">
                          <span className={`text-lg font-bold ${team.netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {team.netBalance >= 0 ? '+' : ''}{team.netBalance}
                          </span>
                        </td>
                        <td className="px-4 lg:px-6 py-4 text-center">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-indigo-100 text-indigo-700">
                            {team.transactionCount}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gradient-to-r from-indigo-50 to-purple-50 border-t-2 border-indigo-200">
                    <tr>
                      <td colSpan={2} className="px-4 lg:px-6 py-4 text-right font-bold text-gray-900">
                        Grand Total:
                      </td>
                      <td className="px-4 lg:px-6 py-4 text-right font-bold text-green-600">
                        +{teamSummary.reduce((sum, team) => sum + team.totalIncome, 0)}
                      </td>
                      <td className="px-4 lg:px-6 py-4 text-right font-bold text-red-600">
                        -{teamSummary.reduce((sum, team) => sum + team.totalExpense, 0)}
                      </td>
                      <td className="px-4 lg:px-6 py-4 text-right font-bold text-indigo-600 text-xl">
                        {teamSummary.reduce((sum, team) => sum + team.netBalance, 0)}
                      </td>
                      <td className="px-4 lg:px-6 py-4 text-center font-bold text-gray-900">
                        {teamSummary.reduce((sum, team) => sum + team.transactionCount, 0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* No Transactions */}
        {!isFetchingTransactions && !showSummary && transactions.length === 0 && (
          <div className="glass rounded-2xl sm:rounded-3xl p-8 sm:p-12 text-center border border-white/30 shadow-xl">
            <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 mb-4 sm:mb-6">
              <DollarSign className="w-8 h-8 sm:w-10 sm:h-10 text-gray-400" />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">No Transactions Found</h3>
            <p className="text-sm sm:text-base text-gray-600 max-w-md mx-auto">No transactions found for the selected filters</p>
          </div>
        )}

        {/* Detailed Transactions List - Grouped by Category */}
        {!isFetchingTransactions && !showSummary && transactions.length > 0 && (
          <>
            {/* Income Transactions */}
            {(() => {
              const incomeTransactions = paginatedTransactions.filter(t => isIncomeTransaction(t.transaction_type, t.amount));
              const incomeByTypeCurrency = incomeTransactions.reduce((acc, txn) => {
                const key = `${txn.transaction_type}_${txn.currency_type}`;
                if (!acc[key]) acc[key] = { type: txn.transaction_type, currency: txn.currency_type, transactions: [] };
                acc[key].transactions.push(txn);
                return acc;
              }, {} as Record<string, { type: string; currency: string; transactions: Transaction[] }>);

              const eCoinIncome = incomeTransactions.filter(t => t.currency_type === 'football').reduce((sum, t) => sum + Math.abs(t.amount), 0);
              const sSCoinIncome = incomeTransactions.filter(t => t.currency_type === 'real').reduce((sum, t) => sum + Math.abs(t.amount), 0);

              return Object.keys(incomeByTypeCurrency).length > 0 && (
                <div className="glass rounded-2xl sm:rounded-3xl border border-white/30 shadow-xl overflow-hidden mb-6">
                  <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 sm:px-6 py-4 sm:py-5">
                    <div className="flex items-center gap-3">
                      <TrendingUp className="w-6 h-6" />
                      <div className="flex-1">
                        <h2 className="text-xl sm:text-2xl font-bold">💰 Income Transactions</h2>
                        <div className="flex gap-4 mt-1">
                          <p className="text-green-100 text-sm">🔵 eCoin: +{eCoinIncome.toLocaleString()}</p>
                          <p className="text-green-100 text-sm">🟣 SSCoin: +{sSCoinIncome.toLocaleString()}</p>
                          <p className="text-green-100 text-sm font-bold">Total: +{(eCoinIncome + sSCoinIncome).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 sm:p-6 space-y-6">
                    {Object.entries(incomeByTypeCurrency).map(([key, data]) => {
                      const typeTotal = data.transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
                      const currencyLabel = data.currency === 'football' ? '🔵 eCoin' : '🟣 SSCoin';
                      return (
                        <div key={key} className="border border-green-200 rounded-xl overflow-hidden">
                          <div className="bg-green-50 px-4 py-3 border-b border-green-200">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-2xl">{getTransactionIcon(data.type)}</span>
                                <h3 className="font-bold text-gray-900">{formatTransactionType(data.type)}</h3>
                                <span className="px-2 py-1 bg-white rounded-lg text-xs font-bold">{currencyLabel}</span>
                                <span className="text-sm text-gray-600">({data.transactions.length} transactions)</span>
                              </div>
                              <span className="text-lg font-bold text-green-600">+{typeTotal.toLocaleString()}</span>
                            </div>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-4 py-2 text-left text-xs font-bold text-gray-700">Date</th>
                                  <th className="px-4 py-2 text-left text-xs font-bold text-gray-700">Team</th>
                                  <th className="px-4 py-2 text-left text-xs font-bold text-gray-700">Description</th>
                                  <th className="px-4 py-2 text-right text-xs font-bold text-gray-700">Amount</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 bg-white">
                                {data.transactions.map((txn) => (
                                  <tr key={txn.id} className="hover:bg-green-50/30 transition-colors">
                                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{formatDate(txn.created_at)}</td>
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{txn.team_name}</td>
                                    <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate">{txn.description}</td>
                                    <td className="px-4 py-3 text-right text-sm font-bold text-green-600">+{Math.abs(txn.amount).toLocaleString()}</td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot className="bg-green-50 border-t-2 border-green-200">
                                <tr>
                                  <td colSpan={3} className="px-4 py-2 text-right text-sm font-bold text-gray-900">Subtotal ({currencyLabel}):</td>
                                  <td className="px-4 py-2 text-right text-base font-bold text-green-600">+{typeTotal.toLocaleString()}</td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Expense Transactions */}
            {(() => {
              const expenseTransactions = paginatedTransactions.filter(t => !isIncomeTransaction(t.transaction_type, t.amount));
              const expenseByTypeCurrency = expenseTransactions.reduce((acc, txn) => {
                const key = `${txn.transaction_type}_${txn.currency_type}`;
                if (!acc[key]) acc[key] = { type: txn.transaction_type, currency: txn.currency_type, transactions: [] };
                acc[key].transactions.push(txn);
                return acc;
              }, {} as Record<string, { type: string; currency: string; transactions: Transaction[] }>);

              const eCoinExpense = expenseTransactions.filter(t => t.currency_type === 'football').reduce((sum, t) => sum + Math.abs(t.amount), 0);
              const sSCoinExpense = expenseTransactions.filter(t => t.currency_type === 'real').reduce((sum, t) => sum + Math.abs(t.amount), 0);

              return Object.keys(expenseByTypeCurrency).length > 0 && (
                <div className="glass rounded-2xl sm:rounded-3xl border border-white/30 shadow-xl overflow-hidden mb-6">
                  <div className="bg-gradient-to-r from-red-500 to-orange-600 text-white px-4 sm:px-6 py-4 sm:py-5">
                    <div className="flex items-center gap-3">
                      <TrendingDown className="w-6 h-6" />
                      <div className="flex-1">
                        <h2 className="text-xl sm:text-2xl font-bold">💸 Expense Transactions</h2>
                        <div className="flex gap-4 mt-1">
                          <p className="text-red-100 text-sm">🔵 eCoin: -{eCoinExpense.toLocaleString()}</p>
                          <p className="text-red-100 text-sm">🟣 SSCoin: -{sSCoinExpense.toLocaleString()}</p>
                          <p className="text-red-100 text-sm font-bold">Total: -{(eCoinExpense + sSCoinExpense).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 sm:p-6 space-y-6">
                    {Object.entries(expenseByTypeCurrency).map(([key, data]) => {
                      const typeTotal = data.transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
                      const currencyLabel = data.currency === 'football' ? '🔵 eCoin' : '🟣 SSCoin';
                      return (
                        <div key={key} className="border border-red-200 rounded-xl overflow-hidden">
                          <div className="bg-red-50 px-4 py-3 border-b border-red-200">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-2xl">{getTransactionIcon(data.type)}</span>
                                <h3 className="font-bold text-gray-900">{formatTransactionType(data.type)}</h3>
                                <span className="px-2 py-1 bg-white rounded-lg text-xs font-bold">{currencyLabel}</span>
                                <span className="text-sm text-gray-600">({data.transactions.length} transactions)</span>
                              </div>
                              <span className="text-lg font-bold text-red-600">-{typeTotal.toLocaleString()}</span>
                            </div>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-4 py-2 text-left text-xs font-bold text-gray-700">Date</th>
                                  <th className="px-4 py-2 text-left text-xs font-bold text-gray-700">Team</th>
                                  <th className="px-4 py-2 text-left text-xs font-bold text-gray-700">Description</th>
                                  <th className="px-4 py-2 text-right text-xs font-bold text-gray-700">Amount</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 bg-white">
                                {data.transactions.map((txn) => (
                                  <tr key={txn.id} className="hover:bg-red-50/30 transition-colors">
                                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{formatDate(txn.created_at)}</td>
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{txn.team_name}</td>
                                    <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate">{txn.description}</td>
                                    <td className="px-4 py-3 text-right text-sm font-bold text-red-600">-{Math.abs(txn.amount).toLocaleString()}</td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot className="bg-red-50 border-t-2 border-red-200">
                                <tr>
                                  <td colSpan={3} className="px-4 py-2 text-right text-sm font-bold text-gray-900">Subtotal ({currencyLabel}):</td>
                                  <td className="px-4 py-2 text-right text-base font-bold text-red-600">-{typeTotal.toLocaleString()}</td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Pagination Controls - Only show when viewing all teams */}
            {shouldPaginate && totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 glass rounded-2xl p-4 border border-white/30 shadow-lg">
                <div className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="px-3 py-2 rounded-lg bg-white border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    First
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-2 rounded-lg bg-white border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 rounded-lg bg-white border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 rounded-lg bg-white border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Last
                  </button>
                </div>
                <div className="text-sm text-gray-600">
                  Showing {startIndex + 1}-{Math.min(endIndex, totalTransactions)} of {totalTransactions}
                </div>
              </div>
            )}
          </>
        )}

        {/* Info Box */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">💡 About Transaction Types:</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-blue-800">
            <div>
              <strong>Income:</strong>
              <ul className="ml-4 mt-1 space-y-1">
                <li>• Match Rewards (Win/Draw/Loss)</li>
                <li>• Tournament Rewards (Position/Completion/Knockout)</li>
                <li>• Transfer Compensation</li>
                <li>• Release Refunds</li>
              </ul>
            </div>
            <div>
              <strong>Expenses:</strong>
              <ul className="ml-4 mt-1 space-y-1">
                <li>• Salary Payments (Real & Football Players)</li>
                <li>• Real Player Registration Fees</li>
                <li>• Auction Wins</li>
                <li>• Transfer Payments</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
