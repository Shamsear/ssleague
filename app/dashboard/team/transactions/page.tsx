'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DollarSign, TrendingDown, TrendingUp, Calendar, Filter, Download } from 'lucide-react';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface Transaction {
  id: string;
  date: string;
  type: string;
  amount: number;
  reason: string;
  balance_after: number;
  metadata?: any;
}

interface CurrencyData {
  current_balance: number;
  starting_balance: number;
  total_spent: number;
  total_earned: number;
  transactions: Transaction[];
}

export default function TransactionsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState<'football' | 'real_player'>('football');
  const [footballData, setFootballData] = useState<CurrencyData | null>(null);
  const [realPlayerData, setRealPlayerData] = useState<CurrencyData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [seasonId, setSeasonId] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('all');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }
    if (!loading && user && user.role !== 'team') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      loadTransactions();
    }
  }, [user]);

  const loadTransactions = async () => {
    try {
      setErrorMessage(null);
      
      // Try to fetch transactions - the API will determine which season the team is registered for
      const response = await fetchWithTokenRefresh('/api/team/transactions');
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Transaction API error:', errorData);
        
        // Special handling for "not registered" error
        if (errorData.error?.includes('not registered') || errorData.error === 'Season ID is required') {
          setErrorMessage('You are not registered for any season yet. Please register to view transactions.');
        } else {
          setErrorMessage(errorData.error || 'Failed to load transactions');
        }
        throw new Error(errorData.error || 'Failed to load transactions');
      }
      
      const data = await response.json();
      
      if (data.success) {
        setFootballData(data.football);
        setRealPlayerData(data.real_player);
      } else {
        throw new Error(data.error || 'Failed to load transactions');
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
      // Set empty data instead of mock data
      setFootballData({
        current_balance: 0,
        starting_balance: 0,
        total_spent: 0,
        total_earned: 0,
        transactions: [],
      });
      setRealPlayerData({
        current_balance: 0,
        starting_balance: 0,
        total_spent: 0,
        total_earned: 0,
        transactions: [],
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'salary': return '💰';
      case 'fine': return '⚠️';
      case 'auction': return '🔨';
      case 'real_player_fee': return '👤';
      case 'bonus': return '🎁';
      case 'adjustment': return '🔧';
      case 'transfer_payment': return '➡️';
      case 'transfer_compensation': return '⬅️';
      case 'swap_fee_paid': return '🔄';
      case 'swap_fee_received': return '🔁';
      case 'player_release_refund': return '↩️';
      case 'initial_balance': return '🏦';
      default: return '📝';
    }
  };

  const getTransactionTypes = () => {
    return [
      { value: 'all', label: 'All Transactions' },
      { value: 'auction', label: 'Auction Wins' },
      { value: 'salary', label: 'Salaries' },
      { value: 'fine', label: 'Fines' },
      { value: 'bonus', label: 'Bonuses' },
      { value: 'adjustment', label: 'Adjustments' },
      { value: 'transfer_payment', label: 'Transfer Payments' },
      { value: 'transfer_compensation', label: 'Transfer Compensation' },
      { value: 'swap_fee_paid', label: 'Swap Fees Paid' },
      { value: 'swap_fee_received', label: 'Swap Fees Received' },
      { value: 'player_release_refund', label: 'Release Refunds' },
      { value: 'real_player_fee', label: 'Real Player Fees' },
      { value: 'initial_balance', label: 'Initial Balance' },
    ];
  };

  const filterTransactions = (transactions: Transaction[]) => {
    if (filterType === 'all') return transactions;
    return transactions.filter(t => t.type === filterType);
  };

  const getTransactionColor = (amount: number) => {
    return amount < 0 ? 'text-red-600' : 'text-green-600';
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

  const exportTransactions = (currency: 'football' | 'real_player') => {
    const data = currency === 'football' ? footballData : realPlayerData;
    if (!data) return;

    const csv = [
      ['Date', 'Type', 'Amount', 'Reason', 'Balance After'],
      ...data.transactions.map(t => [
        formatDate(t.date),
        t.type,
        t.amount.toString(),
        t.reason,
        t.balance_after.toString()
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currency}_transactions.csv`;
    a.click();
  };

  const renderCurrencySection = (data: CurrencyData | null, currencyName: string, currencyType: 'football' | 'real_player') => {
    if (!data) {
      return (
        <div className="text-center py-12 text-gray-500">
          <p>No transaction data available</p>
        </div>
      );
    }

    const isFootball = currencyType === 'football';

    return (
      <div className="space-y-4 sm:space-y-6">
        {/* Summary Cards - Responsive Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Current Balance - Featured Card */}
          <div className={`col-span-2 lg:col-span-1 ${
            isFootball 
              ? 'bg-gradient-to-br from-blue-500 to-blue-600' 
              : 'bg-gradient-to-br from-purple-500 to-purple-600'
          } text-white rounded-xl p-4 sm:p-6 shadow-lg hover:shadow-xl transition-shadow`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/80 text-xs sm:text-sm font-medium">Current Balance</span>
              <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-white/80" />
            </div>
            <p className="text-2xl sm:text-3xl lg:text-4xl font-bold">{data.current_balance.toLocaleString()}</p>
            <p className="text-white/60 text-xs mt-1">{isFootball ? 'Coins' : 'Credits'}</p>
          </div>

          {/* Starting Balance */}
          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-md hover:shadow-lg transition-shadow border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-xs sm:text-sm font-medium">Starting</span>
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-gray-900">{data.starting_balance.toLocaleString()}</p>
          </div>

          {/* Total Spent */}
          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-md hover:shadow-lg transition-shadow border border-red-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-xs sm:text-sm font-medium">Spent</span>
              <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-red-600">{data.total_spent.toLocaleString()}</p>
          </div>

          {/* Total Earned */}
          {data.total_earned > 0 && (
            <div className="bg-white rounded-xl p-4 sm:p-6 shadow-md hover:shadow-lg transition-shadow border border-green-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 text-xs sm:text-sm font-medium">Earned</span>
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-green-600">+{data.total_earned.toLocaleString()}</p>
            </div>
          )}
        </div>

        {/* Filter and Export Bar - Mobile Optimized */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center justify-between">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 flex-1">
            <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg">
              <Filter className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 flex-shrink-0" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="flex-1 text-sm sm:text-base focus:outline-none bg-transparent"
              >
                {getTransactionTypes().map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            {filterType !== 'all' && (
              <button
                onClick={() => setFilterType('all')}
                className="text-sm text-blue-600 hover:text-blue-800 underline self-start sm:self-center"
              >
                Clear filter
              </button>
            )}
          </div>
          <button
            onClick={() => exportTransactions(currencyType)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm sm:text-base"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>

        {/* Transactions - Desktop Table View (hidden on mobile) */}
        <div className="hidden md:block bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Reason
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Balance After
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filterTransactions(data.transactions).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      {data.transactions.length === 0 ? 'No transactions yet' : 'No transactions match the selected filter'}
                    </td>
                  </tr>
                ) : (
                  filterTransactions(data.transactions).map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatDate(transaction.date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="flex items-center gap-2">
                          <span className="text-xl">{getTransactionIcon(transaction.type)}</span>
                          <span className="text-sm font-medium text-gray-900 capitalize">
                            {transaction.type.replace('_', ' ')}
                          </span>
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {transaction.reason}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-bold ${getTransactionColor(transaction.amount)}`}>
                        {transaction.amount > 0 ? '+' : ''}{transaction.amount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-gray-900">
                        {transaction.balance_after.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Transactions - Mobile Card View (visible on mobile) */}
        <div className="md:hidden space-y-3">
          {filterTransactions(data.transactions).length === 0 ? (
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-8 text-center">
              <p className="text-gray-500">
                {data.transactions.length === 0 ? 'No transactions yet' : 'No transactions match the selected filter'}
              </p>
            </div>
          ) : (
            filterTransactions(data.transactions).map((transaction) => (
              <div
                key={transaction.id}
                className="bg-white rounded-xl shadow-md border border-gray-200 p-4 hover:shadow-lg transition-shadow"
              >
                {/* Card Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{getTransactionIcon(transaction.type)}</span>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 capitalize">
                        {transaction.type.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(transaction.date)}
                      </p>
                    </div>
                  </div>
                  <div className={`text-right font-bold text-lg ${getTransactionColor(transaction.amount)}`}>
                    {transaction.amount > 0 ? '+' : ''}{transaction.amount.toLocaleString()}
                  </div>
                </div>

                {/* Card Body */}
                <div className="space-y-2 pt-3 border-t border-gray-100">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Reason</p>
                    <p className="text-sm text-gray-700">{transaction.reason}</p>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                    <span className="text-xs text-gray-500 uppercase tracking-wide">Balance After</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {transaction.balance_after.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-4 sm:py-8 px-3 sm:px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <Link
            href="/dashboard/team"
            className="inline-flex items-center gap-2 text-sm sm:text-base text-gray-600 hover:text-indigo-600 transition-colors mb-3 sm:mb-4"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </Link>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">Transaction History</h1>
          <p className="text-sm sm:text-base text-gray-600">View all your financial transactions and budget breakdown</p>
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <h3 className="font-semibold text-yellow-900">Unable to Load Transactions</h3>
                <p className="text-yellow-800 text-sm mt-1">{errorMessage}</p>
              </div>
            </div>
          </div>
        )}

        {/* Tabs - Mobile Optimized */}
        <div className="bg-white rounded-t-xl shadow-lg border border-gray-200 border-b-0">
          <div className="grid grid-cols-2 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('football')}
              className={`px-3 sm:px-6 py-3 sm:py-4 text-center font-semibold transition-colors ${
                activeTab === 'football'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2">
                <span className="text-xl sm:text-2xl">⚽</span>
                <span className="text-xs sm:text-base">Football</span>
                <span className="hidden lg:inline text-xs sm:text-base">(Coins)</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('real_player')}
              className={`px-3 sm:px-6 py-3 sm:py-4 text-center font-semibold transition-colors ${
                activeTab === 'real_player'
                  ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2">
                <span className="text-xl sm:text-2xl">💎</span>
                <span className="text-xs sm:text-base">Real Player</span>
                <span className="hidden lg:inline text-xs sm:text-base">(Credits)</span>
              </div>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-gray-50 rounded-b-xl shadow-lg border border-gray-200 border-t-0 p-3 sm:p-6">
          {activeTab === 'football' && renderCurrencySection(footballData, 'Football Budget', 'football')}
          {activeTab === 'real_player' && renderCurrencySection(realPlayerData, 'Real Player Budget', 'real_player')}
        </div>

        {/* Info Box - Mobile Optimized */}
        <div className="mt-4 sm:mt-6 bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
          <h4 className="font-semibold text-blue-900 mb-2 text-sm sm:text-base">💡 About Your Budgets:</h4>
          <ul className="text-xs sm:text-sm text-blue-800 space-y-1.5 sm:space-y-1">
            <li>• <strong>Football Budget (Coins):</strong> For player auctions, salaries, and match expenses</li>
            <li>• <strong>Real Player Budget (Credits):</strong> For registering real players and special fees</li>
            <li>• Negative amounts (red) are deductions from your balance</li>
            <li>• Positive amounts (green) are additions to your balance</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
