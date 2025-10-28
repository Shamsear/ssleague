'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DollarSign, TrendingDown, TrendingUp, Calendar, Filter, Download } from 'lucide-react';

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
      // First get current season
      const seasonResponse = await fetch('/api/seasons/current');
      if (!seasonResponse.ok) {
        throw new Error('Failed to fetch current season');
      }
      const seasonData = await seasonResponse.json();
      const currentSeasonId = seasonData.season?.id;
      
      if (!currentSeasonId) {
        throw new Error('No active season found');
      }
      
      setSeasonId(currentSeasonId);
      
      // Fetch transactions for this season
      const response = await fetch(`/api/team/transactions?season_id=${currentSeasonId}`);
      if (!response.ok) throw new Error('Failed to load transactions');
      
      const data = await response.json();
      
      if (data.success) {
        setFootballData(data.football);
        setRealPlayerData(data.real_player);
      } else {
        throw new Error(data.error || 'Failed to load transactions');
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
      // Mock data for now
      setFootballData({
        current_balance: 7500,
        starting_balance: 10000,
        total_spent: 2500,
        total_earned: 0,
        transactions: [
          {
            id: '1',
            date: '2025-01-22T10:00:00Z',
            type: 'fine',
            amount: -200,
            reason: '2 Yellow cards in Match vs Team Alpha',
            balance_after: 7500,
          },
          {
            id: '2',
            date: '2025-01-20T18:00:00Z',
            type: 'salary',
            amount: -800,
            reason: 'Match 1 player salaries',
            balance_after: 7700,
          },
          {
            id: '3',
            date: '2025-01-15T14:30:00Z',
            type: 'auction',
            amount: -1500,
            reason: 'Won bid for Player Ronaldo',
            balance_after: 8500,
          },
        ],
      });
      setRealPlayerData({
        current_balance: 4200,
        starting_balance: 5000,
        total_spent: 800,
        total_earned: 0,
        transactions: [
          {
            id: '4',
            date: '2025-01-22T09:00:00Z',
            type: 'fine',
            amount: -300,
            reason: 'Late lineup submission',
            balance_after: 4200,
          },
          {
            id: '5',
            date: '2025-01-18T12:00:00Z',
            type: 'real_player_fee',
            amount: -500,
            reason: 'Registered Real Player: John Doe',
            balance_after: 4500,
          },
        ],
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
      default: return '📝';
    }
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

    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-blue-100 text-sm font-medium">Current Balance</span>
              <DollarSign className="w-5 h-5 text-blue-100" />
            </div>
            <p className="text-3xl font-bold">{data.current_balance.toLocaleString()}</p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">Starting Balance</span>
              <Calendar className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{data.starting_balance.toLocaleString()}</p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg border border-red-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">Total Spent</span>
              <TrendingDown className="w-5 h-5 text-red-500" />
            </div>
            <p className="text-2xl font-bold text-red-600">{data.total_spent.toLocaleString()}</p>
          </div>

          {data.total_earned > 0 && (
            <div className="bg-white rounded-xl p-6 shadow-lg border border-green-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 text-sm font-medium">Total Earned</span>
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
              <p className="text-2xl font-bold text-green-600">+{data.total_earned.toLocaleString()}</p>
            </div>
          )}
        </div>

        {/* Export Button */}
        <div className="flex justify-end">
          <button
            onClick={() => exportTransactions(currencyType)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>

        {/* Transactions Table */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
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
                {data.transactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      No transactions yet
                    </td>
                  </tr>
                ) : (
                  data.transactions.map((transaction) => (
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard/team"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Transaction History</h1>
          <p className="text-gray-600">View all your financial transactions and budget breakdown</p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-t-xl shadow-lg border border-gray-200 border-b-0">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('football')}
              className={`flex-1 px-6 py-4 text-center font-semibold transition-colors ${
                activeTab === 'football'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl">⚽</span>
                <span>Football Budget (Coins)</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('real_player')}
              className={`flex-1 px-6 py-4 text-center font-semibold transition-colors ${
                activeTab === 'real_player'
                  ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl">💎</span>
                <span>Real Player Budget (Credits)</span>
              </div>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-gray-50 rounded-b-xl shadow-lg border border-gray-200 border-t-0 p-6">
          {activeTab === 'football' && renderCurrencySection(footballData, 'Football Budget', 'football')}
          {activeTab === 'real_player' && renderCurrencySection(realPlayerData, 'Real Player Budget', 'real_player')}
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">💡 About Your Budgets:</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• <strong>Football Budget (Coins):</strong> Used for player auctions, salaries, and match-related expenses</li>
            <li>• <strong>Real Player Budget (Credits):</strong> Used for registering real players and special fees</li>
            <li>• Negative amounts (in red) are deductions from your balance</li>
            <li>• Positive amounts (in green) are additions to your balance</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
