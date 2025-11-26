'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DollarSign, Download, TrendingUp, PieChart } from 'lucide-react';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';
import { usePermissions } from '@/hooks/usePermissions';

interface SeasonReport {
  total_transfer_fees: number;
  total_swap_fees: number;
  total_fees: number;
  transfer_count: number;
  swap_count: number;
  total_transactions: number;
}

interface TeamFeeData {
  team_id: string;
  team_name: string;
  transfer_fees: number;
  swap_fees: number;
  total_fees: number;
  transaction_count: number;
}

interface BreakdownTransaction {
  id: string;
  transaction_type: 'transfer' | 'swap';
  created_at: string;
  player_name?: string;
  player_a_name?: string;
  player_b_name?: string;
  team_id?: string;
  team_name?: string;
  committee_fee: number;
}

export default function CommitteeFeeReportPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { userSeasonId } = usePermissions();
  
  const [reportType, setReportType] = useState<'by_season' | 'by_team' | 'breakdown'>('by_season');
  const [seasonReport, setSeasonReport] = useState<SeasonReport | null>(null);
  const [teamReports, setTeamReports] = useState<TeamFeeData[]>([]);
  const [breakdown, setBreakdown] = useState<BreakdownTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
      loadReport();
    }
  }, [user, userSeasonId, reportType]);

  const loadReport = async () => {
    if (!userSeasonId) return;

    try {
      setIsLoading(true);
      
      const url = `/api/committee/fee-reports?season_id=${userSeasonId}&report_type=${reportType}`;
      const res = await fetchWithTokenRefresh(url);

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          if (reportType === 'by_season') {
            setSeasonReport(data.data);
          } else if (reportType === 'by_team') {
            setTeamReports(data.data || []);
          } else if (reportType === 'breakdown') {
            setBreakdown(data.data || []);
          }
        }
      }
    } catch (error) {
      console.error('Error loading fee report:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const exportToCSV = () => {
    let csvContent = '';
    let filename = '';

    if (reportType === 'by_season' && seasonReport) {
      csvContent = [
        ['Metric', 'Value'],
        ['Total Transfer Fees', (seasonReport?.total_transfer_fees || 0).toFixed(2)],
        ['Total Swap Fees', (seasonReport?.total_swap_fees || 0).toFixed(2)],
        ['Total Fees Collected', (seasonReport?.total_fees || 0).toFixed(2)],
        ['Transfer Count', seasonReport.transfer_count],
        ['Swap Count', seasonReport.swap_count],
        ['Total Transactions', seasonReport.total_transactions]
      ].map(row => row.join(',')).join('\n');
      filename = `committee-fees-season-${userSeasonId}.csv`;
    } else if (reportType === 'by_team' && teamReports.length > 0) {
      csvContent = [
        ['Team ID', 'Team Name', 'Transfer Fees', 'Swap Fees', 'Total Fees', 'Transactions'],
        ...teamReports.map(team => [
          team.team_id,
          team.team_name,
          (team.transfer_fees || 0).toFixed(2),
          (team.swap_fees || 0).toFixed(2),
          (team.total_fees || 0).toFixed(2),
          team.transaction_count
        ])
      ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
      filename = `committee-fees-by-team-${userSeasonId}.csv`;
    } else if (reportType === 'breakdown' && breakdown.length > 0) {
      csvContent = [
        ['Date', 'Type', 'Player(s)', 'Team', 'Fee'],
        ...breakdown.map(tx => [
          new Date(tx.created_at).toLocaleDateString(),
          tx.transaction_type.toUpperCase(),
          tx.transaction_type === 'transfer' ? tx.player_name : `${tx.player_a_name} ↔ ${tx.player_b_name}`,
          tx.team_name || tx.team_id || '',
          (tx.committee_fee || 0).toFixed(2)
        ])
      ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
      filename = `committee-fees-breakdown-${userSeasonId}.csv`;
    }

    if (csvContent) {
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric'
    });
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 sm:p-3 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg">
                  <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold gradient-text">Committee Fee Reports</h1>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1">Track transfer and swap fees collected</p>
                </div>
              </div>
              <button
                onClick={exportToCSV}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all shadow-lg"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Export</span>
              </button>
            </div>
          </div>
        </div>

        {/* Report Type Selector */}
        <div className="glass rounded-2xl sm:rounded-3xl border border-white/30 shadow-xl p-4 sm:p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-bold text-gray-900">Report Type</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={() => setReportType('by_season')}
              className={`p-4 rounded-xl border-2 transition-all ${
                reportType === 'by_season'
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-200 hover:border-purple-300'
              }`}
            >
              <div className="font-bold text-gray-900 mb-1">Season Summary</div>
              <div className="text-xs text-gray-600">Total fees collected</div>
            </button>
            <button
              onClick={() => setReportType('by_team')}
              className={`p-4 rounded-xl border-2 transition-all ${
                reportType === 'by_team'
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-200 hover:border-purple-300'
              }`}
            >
              <div className="font-bold text-gray-900 mb-1">By Team</div>
              <div className="text-xs text-gray-600">Fees paid per team</div>
            </button>
            <button
              onClick={() => setReportType('breakdown')}
              className={`p-4 rounded-xl border-2 transition-all ${
                reportType === 'breakdown'
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-200 hover:border-purple-300'
              }`}
            >
              <div className="font-bold text-gray-900 mb-1">Detailed Breakdown</div>
              <div className="text-xs text-gray-600">Transaction-level details</div>
            </button>
          </div>
        </div>

        {/* Report Content */}
        {reportType === 'by_season' && seasonReport && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="glass rounded-2xl border border-white/30 shadow-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-xl bg-blue-100">
                    <TrendingUp className="w-6 h-6 text-blue-600" />
                  </div>
                  <span className="text-sm font-semibold text-blue-600">Transfer Fees</span>
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-2">
                  ${(seasonReport?.total_transfer_fees || 0).toFixed(2)}
                </div>
                <div className="text-sm text-gray-600">
                  From {seasonReport?.transfer_count || 0} transfers
                </div>
              </div>

              <div className="glass rounded-2xl border border-white/30 shadow-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-xl bg-purple-100">
                    <TrendingUp className="w-6 h-6 text-purple-600" />
                  </div>
                  <span className="text-sm font-semibold text-purple-600">Swap Fees</span>
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-2">
                  ${(seasonReport?.total_swap_fees || 0).toFixed(2)}
                </div>
                <div className="text-sm text-gray-600">
                  From {seasonReport?.swap_count || 0} swaps
                </div>
              </div>

              <div className="glass rounded-2xl border border-white/30 shadow-xl p-6 bg-gradient-to-br from-green-50 to-emerald-50">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-xl bg-green-100">
                    <DollarSign className="w-6 h-6 text-green-600" />
                  </div>
                  <span className="text-sm font-semibold text-green-600">Total Collected</span>
                </div>
                <div className="text-3xl font-bold text-green-700 mb-2">
                  ${(seasonReport?.total_fees || 0).toFixed(2)}
                </div>
                <div className="text-sm text-green-600">
                  From {seasonReport?.total_transactions || 0} transactions
                </div>
              </div>
            </div>

            {/* Info Box */}
            <div className="glass rounded-2xl border border-purple-200/50 p-6 shadow-lg">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-purple-100 flex-shrink-0">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-bold text-purple-900 mb-2">About Committee Fees</h4>
                  <ul className="text-sm text-purple-800 space-y-1">
                    <li>• Transfer fees: 10% of new player value</li>
                    <li>• Swap fees: Fixed amount based on star rating (30-100)</li>
                    <li>• Fees are tracked for reporting but not added to any balance</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {reportType === 'by_team' && (
          <div className="glass rounded-2xl border border-white/30 shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-bold">Team</th>
                    <th className="px-6 py-4 text-right text-sm font-bold">Transfer Fees</th>
                    <th className="px-6 py-4 text-right text-sm font-bold">Swap Fees</th>
                    <th className="px-6 py-4 text-right text-sm font-bold">Total Fees</th>
                    <th className="px-6 py-4 text-center text-sm font-bold">Transactions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {teamReports.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                        No fee data available
                      </td>
                    </tr>
                  ) : (
                    teamReports.map((team, index) => (
                      <tr key={team.team_id || `team-${index}`} className="hover:bg-purple-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-gray-900">{team.team_name}</div>
                          <div className="text-xs text-gray-500">{team.team_id}</div>
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-blue-600">
                          ${(team.transfer_fees || 0).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-purple-600">
                          ${(team.swap_fees || 0).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-green-600">
                          ${(team.total_fees || 0).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="px-3 py-1 bg-gray-100 rounded-full text-sm font-semibold text-gray-700">
                            {team.transaction_count}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {teamReports.length > 0 && (
                  <tfoot className="bg-gradient-to-r from-purple-50 to-indigo-50 border-t-2 border-purple-200">
                    <tr>
                      <td className="px-6 py-4 font-bold text-gray-900">TOTAL</td>
                      <td className="px-6 py-4 text-right font-bold text-blue-700">
                        ${teamReports.reduce((sum, t) => sum + (t.transfer_fees || 0), 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-purple-700">
                        ${teamReports.reduce((sum, t) => sum + (t.swap_fees || 0), 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-green-700 text-lg">
                        ${teamReports.reduce((sum, t) => sum + (t.total_fees || 0), 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-gray-700">
                        {teamReports.reduce((sum, t) => sum + (t.transaction_count || 0), 0)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {reportType === 'breakdown' && (
          <div className="space-y-4">
            {breakdown.length === 0 ? (
              <div className="glass rounded-2xl p-12 text-center border border-white/30 shadow-xl">
                <DollarSign className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">No Transactions</h3>
                <p className="text-gray-600">No fee transactions found for this season</p>
              </div>
            ) : (
              breakdown.map((tx) => (
                <div key={tx.id} className="glass rounded-xl border border-white/30 shadow-lg p-4 hover:shadow-xl transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                          tx.transaction_type === 'transfer' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                        }`}>
                          {tx.transaction_type.toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-500">{formatDate(tx.created_at)}</span>
                      </div>
                      <p className="font-semibold text-gray-900">
                        {tx.transaction_type === 'transfer' && tx.player_name}
                        {tx.transaction_type === 'swap' && `${tx.player_a_name} ↔ ${tx.player_b_name}`}
                      </p>
                      {tx.team_name && (
                        <p className="text-sm text-gray-600 mt-1">{tx.team_name}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-600">Fee Collected</p>
                      <p className="text-2xl font-bold text-green-600">${(tx.committee_fee || 0).toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
