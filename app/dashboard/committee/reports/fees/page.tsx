'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DollarSign, TrendingUp, Download } from 'lucide-react';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';
import { usePermissions } from '@/hooks/usePermissions';

interface FeeReport {
  totalFees: number;
  transferFees: number;
  swapFees: number;
  transactionCount: number;
  transferCount: number;
  swapCount: number;
  byTeam: Array<{
    team_id: string;
    team_name: string;
    total_fees: number;
    transaction_count: number;
  }>;
  byMonth: Array<{
    month: string;
    total_fees: number;
    transaction_count: number;
  }>;
}

export default function CommitteeFeeReportsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { userSeasonId } = usePermissions();
  
  const [report, setReport] = useState<FeeReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      loadFeeReport();
    }
  }, [user, userSeasonId]);

  const loadFeeReport = async () => {
    if (!userSeasonId) return;

    try {
      setIsLoading(true);
      setError(null);
      
      const res = await fetchWithTokenRefresh(`/api/reports/committee-fees?season_id=${userSeasonId}`);
      
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setReport(data.report);
        } else {
          setError(data.error || 'Failed to load report');
        }
      } else {
        setError('Failed to load report');
      }
    } catch (err) {
      console.error('Error loading fee report:', err);
      setError('An error occurred while loading the report');
    } finally {
      setIsLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!report) return;

    const headers = ['Team', 'Total Fees', 'Transaction Count'];
    const rows = report.byTeam.map(team => [
      team.team_name,
      team.total_fees.toFixed(2),
      team.transaction_count.toString()
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `committee-fees-${userSeasonId}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 py-4 sm:py-6 lg:py-8 px-3 sm:px-4 lg:px-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <Link
            href="/dashboard/committee/players/transfers"
            className="inline-flex items-center gap-2 text-sm sm:text-base text-gray-600 hover:text-green-600 transition-colors mb-3 sm:mb-4 group"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Transfers
          </Link>
          <div className="glass rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-white/30 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 sm:p-3 rounded-xl bg-gradient-to-br from-green-500 to-green-600 shadow-lg">
                  <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold gradient-text">Committee Fee Reports</h1>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1">Track all committee fees collected from transfers and swaps</p>
                </div>
              </div>
              <button
                onClick={exportToCSV}
                disabled={!report}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Export CSV</span>
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-lg">
            <p className="font-semibold">Error</p>
            <p>{error}</p>
          </div>
        )}

        {report && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="glass rounded-2xl p-6 border border-white/30 shadow-xl">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-600">Total Fees Collected</p>
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <p className="text-3xl font-bold text-green-600">${report.totalFees.toFixed(2)}</p>
                <p className="text-xs text-gray-500 mt-1">{report.transactionCount} transactions</p>
              </div>

              <div className="glass rounded-2xl p-6 border border-white/30 shadow-xl">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-600">Transfer Fees</p>
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                </div>
                <p className="text-3xl font-bold text-blue-600">${report.transferFees.toFixed(2)}</p>
                <p className="text-xs text-gray-500 mt-1">{report.transferCount} transfers</p>
              </div>

              <div className="glass rounded-2xl p-6 border border-white/30 shadow-xl">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-600">Swap Fees</p>
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                </div>
                <p className="text-3xl font-bold text-purple-600">${report.swapFees.toFixed(2)}</p>
                <p className="text-xs text-gray-500 mt-1">{report.swapCount} swaps</p>
              </div>

              <div className="glass rounded-2xl p-6 border border-white/30 shadow-xl">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-600">Avg Fee per Transaction</p>
                  <DollarSign className="w-5 h-5 text-orange-600" />
                </div>
                <p className="text-3xl font-bold text-orange-600">
                  ${report.transactionCount > 0 ? (report.totalFees / report.transactionCount).toFixed(2) : '0.00'}
                </p>
                <p className="text-xs text-gray-500 mt-1">Average</p>
              </div>
            </div>

            {/* Fees by Team */}
            <div className="glass rounded-2xl sm:rounded-3xl border border-white/30 shadow-xl p-4 sm:p-6 mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                Fees by Team
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Team</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Total Fees</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Transactions</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Avg Fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.byTeam.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-8 text-gray-500">
                          No fee data available
                        </td>
                      </tr>
                    ) : (
                      report.byTeam.map((team, index) => (
                        <tr key={team.team_id} className={`border-b border-gray-100 ${index % 2 === 0 ? 'bg-white/50' : 'bg-gray-50/50'}`}>
                          <td className="py-3 px-4 font-medium text-gray-900">{team.team_name}</td>
                          <td className="py-3 px-4 text-right font-bold text-green-600">${team.total_fees.toFixed(2)}</td>
                          <td className="py-3 px-4 text-right text-gray-700">{team.transaction_count}</td>
                          <td className="py-3 px-4 text-right text-gray-700">
                            ${team.transaction_count > 0 ? (team.total_fees / team.transaction_count).toFixed(2) : '0.00'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {report.byTeam.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-gray-300 bg-gray-100/50 font-bold">
                        <td className="py-3 px-4">Total</td>
                        <td className="py-3 px-4 text-right text-green-600">${report.totalFees.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right">{report.transactionCount}</td>
                        <td className="py-3 px-4 text-right">
                          ${report.transactionCount > 0 ? (report.totalFees / report.transactionCount).toFixed(2) : '0.00'}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* Fees by Month */}
            {report.byMonth.length > 0 && (
              <div className="glass rounded-2xl sm:rounded-3xl border border-white/30 shadow-xl p-4 sm:p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  Fees by Month
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-gray-200">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Month</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Total Fees</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Transactions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.byMonth.map((month, index) => (
                        <tr key={month.month} className={`border-b border-gray-100 ${index % 2 === 0 ? 'bg-white/50' : 'bg-gray-50/50'}`}>
                          <td className="py-3 px-4 font-medium text-gray-900">{month.month}</td>
                          <td className="py-3 px-4 text-right font-bold text-green-600">${month.total_fees.toFixed(2)}</td>
                          <td className="py-3 px-4 text-right text-gray-700">{month.transaction_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {!report && !isLoading && !error && (
          <div className="glass rounded-2xl sm:rounded-3xl p-8 sm:p-12 text-center border border-white/30 shadow-xl">
            <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 mb-4 sm:mb-6">
              <DollarSign className="w-8 h-8 sm:w-10 sm:h-10 text-gray-400" />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">No Fee Data Available</h3>
            <p className="text-sm sm:text-base text-gray-600 max-w-md mx-auto">No committee fees have been collected yet for this season</p>
          </div>
        )}
      </div>
    </div>
  );
}
