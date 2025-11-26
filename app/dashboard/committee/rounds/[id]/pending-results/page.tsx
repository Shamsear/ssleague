'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';
import { useModal } from '@/hooks/useModal';
import AlertModal from '@/components/modals/AlertModal';
import ConfirmModal from '@/components/modals/ConfirmModal';
import Link from 'next/link';

interface PendingAllocation {
  id: number;
  team_id: string;
  team_name: string;
  player_id: string;
  player_name: string;
  amount: number;
  phase: 'regular' | 'incomplete';
  created_at: string;
}

interface PendingAllocationsData {
  allocations: PendingAllocation[];
  summary: {
    total_players: number;
    total_spent: number;
    average_bid: number;
  };
}

interface Round {
  id: string;
  season_id: string;
  position: string;
  round_number: number;
  status: string;
  finalization_mode?: string;
  created_at: string;
  max_bids_per_team: number;
}

export default function PendingResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { id: roundId } = use(params);

  const [round, setRound] = useState<Round | null>(null);
  const [pendingData, setPendingData] = useState<PendingAllocationsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isApplying, setIsApplying] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());

  const {
    alertState,
    showAlert,
    closeAlert,
    confirmState,
    showConfirm,
    closeConfirm,
  } = useModal();

  // Auth check
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
    if (!authLoading && user && user.role !== 'committee_admin') {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  // Fetch data
  useEffect(() => {
    if (!roundId || !user || user.role !== 'committee_admin') return;

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const [roundResponse, allocationsResponse] = await Promise.all([
          fetchWithTokenRefresh(`/api/admin/rounds/${roundId}`),
          fetchWithTokenRefresh(`/api/admin/rounds/${roundId}/pending-allocations`)
        ]);

        const roundData = await roundResponse.json();
        const allocationsData = await allocationsResponse.json();

        if (!roundData.success) {
          throw new Error(roundData.error || 'Failed to fetch round details');
        }

        if (!allocationsData.success) {
          throw new Error(allocationsData.error || 'Failed to fetch pending allocations');
        }

        if (!allocationsData.data?.allocations || allocationsData.data.allocations.length === 0) {
          showAlert({
            type: 'info',
            title: 'No Pending Results',
            message: 'This round has no pending allocations. Redirecting to rounds list...'
          });
          setTimeout(() => {
            router.push('/dashboard/committee/rounds');
          }, 2000);
          return;
        }

        setRound(roundData.data);
        setPendingData(allocationsData.data);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [roundId, user, router, showAlert]);

  const handleFinalizeForReal = async () => {
    const confirmed = await showConfirm({
      type: 'warning',
      title: 'Finalize Round',
      message: 'Are you sure you want to finalize this round? This will apply all pending allocations, deduct team budgets, and assign players. This action cannot be undone.',
      confirmText: 'Finalize for Real',
      cancelText: 'Cancel'
    });

    if (!confirmed) return;

    setIsApplying(true);

    try {
      const response = await fetchWithTokenRefresh(
        `/api/admin/rounds/${roundId}/apply-pending-allocations`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }
      );

      const data = await response.json();

      if (data.success) {
        showAlert({
          type: 'success',
          title: 'Round Finalized',
          message: 'The round has been successfully finalized. All allocations have been applied.'
        });

        setTimeout(() => {
          router.push('/dashboard/committee/rounds');
        }, 2000);
      } else {
        showAlert({
          type: 'error',
          title: 'Finalization Failed',
          message: data.error || 'Failed to finalize round. Please try again.'
        });
      }
    } catch (err) {
      console.error('Error finalizing round:', err);
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'An unexpected error occurred while finalizing the round.'
      });
    } finally {
      setIsApplying(false);
    }
  };

  const handleCancelPending = async () => {
    const confirmed = await showConfirm({
      type: 'danger',
      title: 'Cancel Pending Results',
      message: 'Are you sure you want to cancel these pending results? All pending allocations will be deleted and you can preview finalization again.',
      confirmText: 'Cancel Pending Results',
      cancelText: 'Keep Results'
    });

    if (!confirmed) return;

    setIsCanceling(true);

    try {
      const response = await fetchWithTokenRefresh(
        `/api/admin/rounds/${roundId}/pending-allocations`,
        {
          method: 'DELETE'
        }
      );

      const data = await response.json();

      if (data.success) {
        showAlert({
          type: 'success',
          title: 'Pending Results Canceled',
          message: 'The pending results have been canceled. Redirecting to rounds list...'
        });

        setTimeout(() => {
          router.push('/dashboard/committee/rounds');
        }, 2000);
      } else {
        showAlert({
          type: 'error',
          title: 'Cancellation Failed',
          message: data.error || 'Failed to cancel pending results. Please try again.'
        });
      }
    } catch (err) {
      console.error('Error canceling pending results:', err);
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'An unexpected error occurred while canceling pending results.'
      });
    } finally {
      setIsCanceling(false);
    }
  };

  const toggleTeam = (teamId: string) => {
    setExpandedTeams((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(teamId)) {
        newSet.delete(teamId);
      } else {
        newSet.add(teamId);
      }
      return newSet;
    });
  };

  const formatCurrency = (amount: number) => {
    return `£${amount.toLocaleString()}`;
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary/30 border-t-primary mx-auto mb-4"></div>
          <p className="text-gray-700 font-medium">Loading pending results...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="glass rounded-3xl p-6 shadow-lg border border-red-200">
          <div className="text-center">
            <svg className="mx-auto h-12 w-12 text-red-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h3 className="text-lg font-semibold text-red-800 mb-2">Error Loading Data</h3>
            <p className="text-red-600 mb-4">{error}</p>
            <Link
              href="/dashboard/committee/rounds"
              className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Back to Rounds
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!round || !pendingData) {
    return null;
  }

  // Organize allocations by team
  const allocationsByTeam = pendingData.allocations.reduce((acc, allocation) => {
    if (!acc[allocation.team_id]) {
      acc[allocation.team_id] = {
        team_id: allocation.team_id,
        team_name: allocation.team_name,
        allocations: []
      };
    }
    acc[allocation.team_id].allocations.push(allocation);
    return acc;
  }, {} as Record<string, { team_id: string; team_name: string; allocations: PendingAllocation[] }>);

  const sortedAllocations = [...pendingData.allocations].sort((a, b) => b.amount - a.amount);

  return (
    <>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="glass rounded-3xl p-4 sm:p-6 shadow-lg border border-gray-100/30">
          {/* Header & Navigation */}
          <div className="flex flex-col gap-4 mb-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center flex-wrap gap-2">
                <h2 className="text-2xl font-bold text-dark gradient-text flex items-center">
                  Pending Results
                  <span className="ml-2 inline-flex items-center justify-center bg-primary/10 text-primary px-2.5 py-1 rounded-full text-sm font-medium">
                    #{round.id.substring(0, 8)}
                  </span>
                </h2>
                <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  <svg className="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Pending Finalization
                </span>
                {round.finalization_mode === 'manual' && (
                  <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    Manual Mode
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-600 italic">
                {round.created_at && new Date(round.created_at).toLocaleString()}
              </div>
            </div>

            {/* Navigation Links */}
            <div className="flex flex-wrap gap-3">
              <Link
                href="/dashboard/committee/rounds"
                className="inline-flex items-center px-4 py-2.5 rounded-xl bg-white/60 text-gray-700 hover:bg-white/80 transition-all duration-200 backdrop-blur-sm border border-gray-200/50 shadow-sm"
              >
                <svg className="w-5 h-5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Rounds
              </Link>
            </div>
          </div>

          {/* Round Summary */}
          <div className="glass rounded-2xl p-4 sm:p-5 mb-5 border border-gray-100/20 bg-white/10 backdrop-blur-sm shadow-sm">
            <h3 className="text-lg font-semibold mb-4 text-dark flex items-center">
              <svg className="w-5 h-5 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Round Summary
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div className="glass rounded-xl p-4 backdrop-blur-sm bg-white/30">
                <h4 className="font-medium mb-1.5 text-gray-600 text-sm">Position</h4>
                <p className="text-lg font-semibold">{round.position}</p>
              </div>

              <div className="glass rounded-xl p-4 backdrop-blur-sm bg-white/30">
                <h4 className="font-medium mb-1.5 text-gray-600 text-sm">Round Number</h4>
                <p className="text-lg font-semibold">Round {round.round_number}</p>
              </div>

              <div className="glass rounded-xl p-4 backdrop-blur-sm bg-white/30">
                <h4 className="font-medium mb-1.5 text-gray-600 text-sm">Max Bids Per Team</h4>
                <p className="text-lg font-semibold">{round.max_bids_per_team}</p>
              </div>
            </div>
          </div>

          {/* Summary Statistics */}
          <div className="glass rounded-2xl p-4 sm:p-5 mb-5 border border-gray-100/20 bg-white/10 backdrop-blur-sm shadow-sm">
            <h3 className="text-lg font-semibold mb-4 text-dark flex items-center">
              <svg className="w-5 h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Allocation Statistics
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div className="glass rounded-xl p-4 backdrop-blur-sm bg-gradient-to-br from-blue-50 to-blue-100">
                <h4 className="font-medium mb-1.5 text-blue-600 text-sm">Total Players</h4>
                <p className="text-3xl font-bold text-blue-900">{pendingData.summary.total_players}</p>
              </div>

              <div className="glass rounded-xl p-4 backdrop-blur-sm bg-gradient-to-br from-green-50 to-green-100">
                <h4 className="font-medium mb-1.5 text-green-600 text-sm">Total Spent</h4>
                <p className="text-3xl font-bold text-green-900">{formatCurrency(pendingData.summary.total_spent)}</p>
              </div>

              <div className="glass rounded-xl p-4 backdrop-blur-sm bg-gradient-to-br from-purple-50 to-purple-100">
                <h4 className="font-medium mb-1.5 text-purple-600 text-sm">Average Bid</h4>
                <p className="text-3xl font-bold text-purple-900">{formatCurrency(Math.round(pendingData.summary.average_bid))}</p>
              </div>
            </div>
          </div>

          {/* All Allocations - Sorted by Amount */}
          <div className="glass rounded-2xl p-4 sm:p-5 mb-5 border border-gray-100/20 bg-white/10 backdrop-blur-sm shadow-sm">
            <h3 className="text-lg font-semibold mb-4 text-dark flex items-center">
              <svg className="w-5 h-5 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              All Pending Allocations (Sorted by Bid Amount)
            </h3>

            {/* Mobile Cards */}
            <div className="block md:hidden space-y-3">
              {sortedAllocations.map((allocation, index) => (
                <div
                  key={allocation.id}
                  className={`glass rounded-xl p-4 backdrop-blur-sm border-l-4 transition-all duration-200 animate-fade-in ${
                    allocation.phase === 'incomplete' 
                      ? 'border-orange-400/40 bg-orange-50/30' 
                      : 'border-green-400/40 bg-white/30'
                  }`}
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <div className="flex flex-col space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="font-medium text-base">{allocation.player_name}</div>
                      {allocation.phase === 'incomplete' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                          <svg className="mr-1 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          Incomplete
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Regular
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="glass rounded-lg p-2.5 bg-white/40">
                        <div className="text-xs text-gray-600 mb-0.5">Team</div>
                        <div className="font-medium truncate">{allocation.team_name}</div>
                      </div>
                      <div className="glass rounded-lg p-2.5 bg-white/40">
                        <div className="text-xs text-gray-600 mb-0.5">Amount</div>
                        <div className="font-semibold text-primary">{formatCurrency(allocation.amount)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto rounded-xl shadow-sm border border-gray-100/20">
              <table className="min-w-full divide-y divide-gray-200/50">
                <thead className="bg-white/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Player Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Team Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Bid Amount
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white/30 divide-y divide-gray-200/50">
                  {sortedAllocations.map((allocation, index) => (
                    <tr
                      key={allocation.id}
                      className={`hover:bg-white/50 transition-colors animate-fade-in ${
                        allocation.phase === 'incomplete' ? 'bg-orange-50/30' : ''
                      }`}
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-8 w-8 flex-shrink-0 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-full flex items-center justify-center mr-2">
                            <span className="text-xs font-medium text-gray-700">
                              {allocation.player_name.substring(0, 2)}
                            </span>
                          </div>
                          <div className="font-medium">{allocation.player_name}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{allocation.team_name}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-semibold text-primary">{formatCurrency(allocation.amount)}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        {allocation.phase === 'incomplete' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                            <svg className="mr-1 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            Incomplete
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Regular
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Allocations by Team */}
          <div className="glass rounded-2xl p-4 sm:p-5 mb-5 border border-gray-100/20 bg-white/10 backdrop-blur-sm shadow-sm">
            <h3 className="text-lg font-semibold mb-4 text-dark flex items-center">
              <svg className="w-5 h-5 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Allocations by Team
            </h3>

            <div className="space-y-4">
              {Object.values(allocationsByTeam).map((teamData) => {
                const isExpanded = expandedTeams.has(teamData.team_id);
                const totalSpent = teamData.allocations.reduce((sum, a) => sum + a.amount, 0);
                const hasIncomplete = teamData.allocations.some(a => a.phase === 'incomplete');

                return (
                  <div
                    key={teamData.team_id}
                    className="glass rounded-xl backdrop-blur-sm border border-gray-200/50 overflow-hidden transition-all duration-200 hover:shadow-md"
                  >
                    <button
                      onClick={() => toggleTeam(teamData.team_id)}
                      className="w-full px-4 py-3 flex items-center justify-between bg-white/40 hover:bg-white/60 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-700">
                            {teamData.team_name.substring(0, 2)}
                          </span>
                        </div>
                        <div className="text-left">
                          <div className="font-semibold text-gray-900">{teamData.team_name}</div>
                          <div className="text-sm text-gray-600">
                            {teamData.allocations.length} player{teamData.allocations.length !== 1 ? 's' : ''} • {formatCurrency(totalSpent)}
                          </div>
                        </div>
                        {hasIncomplete && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                            <svg className="mr-1 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            Has Incomplete
                          </span>
                        )}
                      </div>
                      <svg
                        className={`w-5 h-5 text-gray-500 transition-transform ${
                          isExpanded ? 'transform rotate-180' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {isExpanded && (
                      <div className="px-4 py-3 bg-white/20 border-t border-gray-200/50">
                        <div className="space-y-2">
                          {teamData.allocations.map((allocation) => (
                            <div
                              key={allocation.id}
                              className={`flex items-center justify-between p-3 rounded-lg ${
                                allocation.phase === 'incomplete' 
                                  ? 'bg-orange-50/50 border border-orange-200/50' 
                                  : 'bg-white/40'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <div className="h-8 w-8 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-full flex items-center justify-center">
                                  <span className="text-xs font-medium text-gray-700">
                                    {allocation.player_name.substring(0, 2)}
                                  </span>
                                </div>
                                <div>
                                  <div className="font-medium text-gray-900">{allocation.player_name}</div>
                                  {allocation.phase === 'incomplete' && (
                                    <div className="text-xs text-orange-600 flex items-center gap-1">
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                      </svg>
                                      Incomplete Bid
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="font-semibold text-primary">{formatCurrency(allocation.amount)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="glass rounded-2xl p-4 sm:p-5 border border-gray-100/20 bg-white/10 backdrop-blur-sm shadow-sm">
            <h3 className="text-lg font-semibold mb-4 text-dark flex items-center">
              <svg className="w-5 h-5 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Actions
            </h3>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleFinalizeForReal}
                disabled={isApplying || isCanceling}
                className="flex-1 inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold rounded-xl hover:from-green-600 hover:to-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.01] active:scale-[0.99]"
              >
                {isApplying ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Finalizing...
                  </>
                ) : (
                  <>
                    <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    Finalize for Real
                  </>
                )}
              </button>
              
              <button
                onClick={handleCancelPending}
                disabled={isApplying || isCanceling}
                className="flex-1 inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold rounded-xl hover:from-red-600 hover:to-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.01] active:scale-[0.99]"
              >
                {isCanceling ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Canceling...
                  </>
                ) : (
                  <>
                    <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Cancel Pending Results
                  </>
                )}
              </button>
            </div>

            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm text-blue-800">
                  <strong>Note:</strong> Finalizing will deduct team budgets, assign players, and mark the round as completed. This action cannot be undone. Canceling will delete these pending results and allow you to preview finalization again.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AlertModal
        isOpen={alertState.isOpen}
        onClose={closeAlert}
        title={alertState.title}
        message={alertState.message}
        type={alertState.type}
      />
      <ConfirmModal
        isOpen={confirmState.isOpen}
        onConfirm={confirmState.onConfirm}
        onCancel={closeConfirm}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        cancelText={confirmState.cancelText}
        type={confirmState.type}
      />
    </>
  );
}
