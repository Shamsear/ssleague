'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useModal } from '@/hooks/useModal';
import AlertModal from '@/components/modals/AlertModal';
import ConfirmModal from '@/components/modals/ConfirmModal';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface Tiebreaker {
  id: string;
  player_name: string;
  position: string;
  overall_rating: number;
  round_position: string;
  original_amount: number;
  status: string;
  winning_team_id: string | null;
  winning_amount: number | null;
  duration_minutes: number;
  created_at: string;
  resolved_at: string | null;
  teams_count: number;
  submitted_count: number;
  teams: Array<{
    team_id: string;
    team_name: string;
    submitted: boolean;
    new_bid_amount: number | null;
    submitted_at: string | null;
  }>;
  expiresAt: string;
  timeRemaining: number;
  isExpired: boolean;
}

export default function CommitteeTiebreakerPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [tiebreakers, setTiebreakers] = useState<Tiebreaker[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [statusFilter, setStatusFilter] = useState('active');
  const [resolving, setResolving] = useState<string | null>(null);

  // Modal system
  const {
    alertState,
    showAlert,
    closeAlert,
    confirmState,
    showConfirm,
    closeConfirm,
    handleConfirm,
  } = useModal();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'committee_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const fetchTiebreakers = async () => {
    try {
      const response = await fetchWithTokenRefresh(`/api/admin/tiebreakers?status=${statusFilter}`);
      const result = await response.json();
      
      if (result.success) {
        setTiebreakers(result.data.tiebreakers);
      }
    } catch (error) {
      console.error('Error fetching tiebreakers:', error);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (user && user.role === 'committee_admin') {
      fetchTiebreakers();
      
      // Auto-refresh every 5 seconds for active tiebreakers
      if (statusFilter === 'active') {
        const interval = setInterval(fetchTiebreakers, 5000);
        return () => clearInterval(interval);
      }
    }
  }, [user, statusFilter]);

  const handleResolve = async (tiebreakerId: string, resolutionType: 'auto' | 'exclude') => {
    const confirmMessage = resolutionType === 'auto'
        ? 'Are you sure you want to resolve this tiebreaker? The highest bid will be selected as the winner.'
        : 'Are you sure you want to exclude this tiebreaker? No team will receive the player.';

    const confirmed = await showConfirm({
      type: resolutionType === 'auto' ? 'info' : 'warning',
      title: resolutionType === 'auto' ? 'Resolve Tiebreaker' : 'Exclude Tiebreaker',
      message: confirmMessage,
      confirmText: resolutionType === 'auto' ? 'Resolve' : 'Exclude',
      cancelText: 'Cancel'
    });

    if (!confirmed) return;

    setResolving(tiebreakerId);
    
    try {
      const response = await fetchWithTokenRefresh(`/api/tiebreakers/${tiebreakerId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolutionType }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        showAlert({
          type: 'success',
          title: 'Success',
          message: `Tiebreaker ${resolutionType === 'auto' ? 'resolved' : 'excluded'} successfully!`
        });
        fetchTiebreakers();
      } else {
        showAlert({
          type: 'error',
          title: 'Error',
          message: result.error || 'Failed to resolve tiebreaker'
        });
      }
    } catch (error) {
      console.error('Error resolving tiebreaker:', error);
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'An error occurred. Please try again.'
      });
    } finally {
      setResolving(null);
    }
  };

  const formatTimeRemaining = (milliseconds: number) => {
    if (milliseconds <= 0) return 'Expired';
    
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m remaining`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s remaining`;
    return `${seconds}s remaining`;
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (user.role !== 'committee_admin') {
    return null;
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="container mx-auto max-w-screen-2xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center">
              <div className="bg-yellow-100 p-2.5 rounded-xl mr-4 shadow-sm">
                <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold gradient-text">Tiebreaker Management</h1>
                <p className="text-gray-600 text-sm mt-1">Monitor and resolve bid tiebreakers</p>
              </div>
            </div>
            
            <Link
              href="/dashboard/committee"
              className="flex items-center text-gray-600 hover:text-[#0066FF] transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
              Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="mb-6">
          <div className="flex gap-2 flex-wrap">
            {['active', 'resolved', 'excluded', 'all'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 rounded-xl font-medium transition-colors ${
                  statusFilter === status
                    ? 'bg-[#0066FF] text-white'
                    : 'bg-white/60 text-gray-700 hover:bg-white'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Tiebreakers Grid */}
        {loadingData ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading tiebreakers...</p>
          </div>
        ) : tiebreakers.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Tiebreakers Found</h3>
            <p className="text-gray-500">There are no {statusFilter !== 'all' ? statusFilter : ''} tiebreakers at the moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {tiebreakers.map((tiebreaker) => (
              <div key={tiebreaker.id} className="glass rounded-2xl p-6 shadow-sm hover:shadow-md transition-all">
                {/* Tiebreaker Header */}
                <div className="flex flex-col md:flex-row justify-between items-start mb-6 gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-gray-800">{tiebreaker.player_name}</h3>
                      <span className="px-2.5 py-0.5 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                        {tiebreaker.position}
                      </span>
                      {tiebreaker.status === 'active' && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          <span className="animate-ping absolute h-2 w-2 rounded-full bg-yellow-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500 mr-2"></span>
                          Active
                        </span>
                      )}
                      {tiebreaker.status === 'resolved' && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Resolved
                        </span>
                      )}
                      {tiebreaker.status === 'excluded' && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Excluded
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      Round {tiebreaker.round_position} • Original Bid: £{tiebreaker.original_amount.toLocaleString()}
                    </p>
                    {tiebreaker.status === 'active' && (
                      <p className="text-sm font-medium mt-1 text-orange-600">
                        {formatTimeRemaining(tiebreaker.timeRemaining)}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <Link
                      href={`/api/tiebreakers/${tiebreaker.id}`}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors text-sm font-medium"
                    >
                      View Details
                    </Link>
                    {tiebreaker.status === 'active' && (
                      <>
                        <button
                          onClick={() => handleResolve(tiebreaker.id, 'auto')}
                          disabled={resolving === tiebreaker.id}
                          className="px-4 py-2 bg-[#0066FF] text-white rounded-xl hover:bg-[#0052CC] transition-colors text-sm font-medium disabled:opacity-50"
                        >
                          {resolving === tiebreaker.id ? 'Processing...' : 'Resolve'}
                        </button>
                        <button
                          onClick={() => handleResolve(tiebreaker.id, 'exclude')}
                          disabled={resolving === tiebreaker.id}
                          className="px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors text-sm font-medium disabled:opacity-50"
                        >
                          Exclude
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-white/60 p-3 rounded-xl">
                    <p className="text-xs text-gray-500 uppercase">Teams</p>
                    <p className="text-lg font-bold text-gray-800">{tiebreaker.teams_count}</p>
                  </div>
                  <div className="bg-white/60 p-3 rounded-xl">
                    <p className="text-xs text-gray-500 uppercase">Submitted</p>
                    <p className="text-lg font-bold text-[#0066FF]">
                      {tiebreaker.submitted_count} / {tiebreaker.teams_count}
                    </p>
                  </div>
                  <div className="bg-white/60 p-3 rounded-xl">
                    <p className="text-xs text-gray-500 uppercase">Original Bid</p>
                    <p className="text-lg font-bold text-gray-800">£{tiebreaker.original_amount.toLocaleString()}</p>
                  </div>
                  <div className="bg-white/60 p-3 rounded-xl">
                    <p className="text-xs text-gray-500 uppercase">Highest New</p>
                    <p className="text-lg font-bold text-green-600">
                      {tiebreaker.teams.some((t) => t.new_bid_amount)
                        ? `£${Math.max(...tiebreaker.teams.map((t) => t.new_bid_amount || 0)).toLocaleString()}`
                        : 'None'}
                    </p>
                  </div>
                </div>

                {/* Teams Table */}
                <div className="bg-white/40 rounded-xl overflow-hidden">
                  <table className="min-w-full">
                    <thead className="bg-gray-50/80">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Team</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">New Bid</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {tiebreaker.teams.map((team) => (
                        <tr key={team.team_id} className="hover:bg-gray-50/60">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="font-medium text-gray-800">{team.team_name}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {team.new_bid_amount ? (
                              <span className="font-medium text-[#0066FF]">
                                £{team.new_bid_amount.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-orange-600">Pending</span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {team.submitted ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Submitted
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                Waiting
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Components */}
      <AlertModal
        isOpen={alertState.isOpen}
        onClose={closeAlert}
        title={alertState.title}
        message={alertState.message}
        type={alertState.type}
      />

      <ConfirmModal
        isOpen={confirmState.isOpen}
        onConfirm={handleConfirm}
        onCancel={closeConfirm}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        cancelText={confirmState.cancelText}
        type={confirmState.type}
      />
    </div>
  );
}
