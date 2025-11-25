'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import ConfirmModal from './ConfirmModal';

interface PendingAllocation {
  id: number;
  team_id: string;
  team_name: string;
  player_id: string;
  player_name: string;
  amount: number;
  phase: 'regular' | 'incomplete';
  created_at?: string;
}

interface AllocationsSummary {
  total_players: number;
  total_spent: number;
  average_bid: number;
  teams_allocated?: number;
  teams_skipped?: number;
}

interface PendingAllocationsModalProps {
  roundId: string;
  isOpen: boolean;
  onClose: () => void;
  onApply: () => void;
  onCancel: () => void;
}

export default function PendingAllocationsModal({
  roundId,
  isOpen,
  onClose,
  onApply,
  onCancel,
}: PendingAllocationsModalProps) {
  const [mounted, setMounted] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [allocations, setAllocations] = useState<PendingAllocation[]>([]);
  const [summary, setSummary] = useState<AllocationsSummary | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [applyLoading, setApplyLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [showApplyConfirm, setShowApplyConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Create portal container
  useEffect(() => {
    const container = document.createElement('div');
    container.id = 'pending-allocations-modal-portal';
    container.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 9999;';
    document.body.appendChild(container);
    setPortalContainer(container);
    setMounted(true);
    
    return () => {
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
      setMounted(false);
    };
  }, []);

  // Handle escape key and body overflow
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !applyLoading && !cancelLoading) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose, applyLoading, cancelLoading]);

  // Fetch pending allocations when modal opens
  useEffect(() => {
    if (isOpen && roundId) {
      fetchPendingAllocations();
    }
  }, [isOpen, roundId]);

  const fetchPendingAllocations = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/admin/rounds/${roundId}/pending-allocations`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch pending allocations');
      }

      setAllocations(data.data.allocations);
      setSummary(data.data.summary);
      
      // Generate warnings based on allocations
      const generatedWarnings: string[] = [];
      const incompleteCount = data.data.allocations.filter((a: PendingAllocation) => a.phase === 'incomplete').length;
      
      if (incompleteCount > 0) {
        generatedWarnings.push(`${incompleteCount} team(s) received incomplete/random allocations`);
      }
      
      if (data.data.summary.teams_skipped && data.data.summary.teams_skipped > 0) {
        generatedWarnings.push(`${data.data.summary.teams_skipped} team(s) did not receive any allocation`);
      }
      
      setWarnings(generatedWarnings);
    } catch (err) {
      console.error('Error fetching pending allocations:', err);
      setError(err instanceof Error ? err.message : 'Failed to load pending allocations');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyClick = () => {
    setShowApplyConfirm(true);
  };

  const handleApplyConfirm = () => {
    setShowApplyConfirm(false);
    setApplyLoading(true);
    onApply();
  };

  const handleCancelClick = () => {
    setShowCancelConfirm(true);
  };

  const handleCancelConfirm = () => {
    setShowCancelConfirm(false);
    setCancelLoading(true);
    onCancel();
  };

  if (!isOpen || !mounted || !portalContainer) return null;

  return (
    <>
      {/* Confirmation Modals */}
      <ConfirmModal
        isOpen={showApplyConfirm}
        onConfirm={handleApplyConfirm}
        onCancel={() => setShowApplyConfirm(false)}
        title="Finalize Allocations?"
        message={`Are you sure you want to finalize these allocations? This will:\n\n• Update team budgets\n• Allocate ${allocations.length} player(s) to teams\n• Create player contracts\n• Make results visible to all teams\n\nThis action cannot be undone.`}
        confirmText="Yes, Finalize"
        cancelText="No, Go Back"
        type="warning"
      />

      <ConfirmModal
        isOpen={showCancelConfirm}
        onConfirm={handleCancelConfirm}
        onCancel={() => setShowCancelConfirm(false)}
        title="Cancel Pending Allocations?"
        message={`Are you sure you want to cancel these pending allocations?\n\nThis will delete all ${allocations.length} pending allocation(s) and reset the round status. You can preview finalization again after canceling.`}
        confirmText="Yes, Cancel"
        cancelText="No, Keep Them"
        type="danger"
      />

      {createPortal(
    <div style={{ pointerEvents: 'auto', position: 'relative', width: '100%', height: '100%' }}>
      {/* Backdrop */}
      <div
        className="bg-black/20 backdrop-blur-sm"
        onClick={!applyLoading && !cancelLoading ? onClose : undefined}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
          cursor: applyLoading || cancelLoading ? 'not-allowed' : 'pointer',
        }}
      />

      {/* Modal */}
      <div 
        className="w-[calc(100%-2rem)] sm:w-auto sm:min-w-[600px] sm:max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          margin: '0',
          maxWidth: 'min(90vw, 896px)',
        }}
        aria-labelledby="modal-title" 
        role="dialog" 
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200">
          <h3 id="modal-title" className="text-xl font-semibold text-gray-900">
            Pending Allocation Results
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Review the calculated allocations before finalizing
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
              <p className="mt-3 text-sm text-gray-500">Loading pending allocations...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="mt-3 text-sm text-red-600">{error}</p>
            </div>
          ) : allocations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No pending allocations found for this round.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Allocations Table */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Allocations</h4>
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Player
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Team
                        </th>
                        <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Amount
                        </th>
                        <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Type
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {allocations.map((allocation) => (
                        <tr 
                          key={allocation.id}
                          className={allocation.phase === 'incomplete' ? 'bg-yellow-50' : ''}
                        >
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                            {allocation.player_name}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                            {allocation.team_name}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-semibold text-gray-900">
                            ${allocation.amount.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-center">
                            {allocation.phase === 'incomplete' ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
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

              {/* Summary Statistics */}
              {summary && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Summary Statistics</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                    <div className="bg-blue-50 rounded-lg px-4 py-3 border border-blue-100">
                      <p className="text-xs text-blue-600 font-medium uppercase tracking-wide">Total Players</p>
                      <p className="mt-1 text-2xl font-bold text-blue-900">{summary.total_players}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg px-4 py-3 border border-green-100">
                      <p className="text-xs text-green-600 font-medium uppercase tracking-wide">Total Spent</p>
                      <p className="mt-1 text-2xl font-bold text-green-900">${summary.total_spent.toLocaleString()}</p>
                    </div>
                    <div className="bg-purple-50 rounded-lg px-4 py-3 border border-purple-100">
                      <p className="text-xs text-purple-600 font-medium uppercase tracking-wide">Average Bid</p>
                      <p className="mt-1 text-2xl font-bold text-purple-900">${summary.average_bid.toLocaleString()}</p>
                    </div>
                    {summary.teams_allocated !== undefined && (
                      <div className="bg-indigo-50 rounded-lg px-4 py-3 border border-indigo-100">
                        <p className="text-xs text-indigo-600 font-medium uppercase tracking-wide">Teams Allocated</p>
                        <p className="mt-1 text-2xl font-bold text-indigo-900">{summary.teams_allocated}</p>
                      </div>
                    )}
                    {summary.teams_skipped !== undefined && (
                      <div className="bg-orange-50 rounded-lg px-4 py-3 border border-orange-100">
                        <p className="text-xs text-orange-600 font-medium uppercase tracking-wide">Teams Skipped</p>
                        <p className="mt-1 text-2xl font-bold text-orange-900">{summary.teams_skipped}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Warnings */}
              {warnings.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div className="ml-3 flex-1">
                      <h4 className="text-sm font-semibold text-yellow-800">Warnings</h4>
                      <ul className="mt-2 space-y-1 text-sm text-yellow-700">
                        {warnings.map((warning, index) => (
                          <li key={index} className="flex items-start">
                            <span className="mr-2">•</span>
                            <span>{warning}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={applyLoading || cancelLoading}
            className="inline-flex w-full sm:w-auto justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-gray-700 shadow-md ring-1 ring-inset ring-gray-300 hover:bg-gray-50 hover:shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleCancelClick}
            disabled={applyLoading || cancelLoading || loading}
            className="inline-flex w-full sm:w-auto justify-center rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-lg bg-red-600 hover:bg-red-700 hover:shadow-xl transition-all duration-200 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {cancelLoading ? 'Canceling...' : 'Cancel Pending'}
          </button>
          <button
            type="button"
            onClick={handleApplyClick}
            disabled={applyLoading || cancelLoading || loading}
            className="inline-flex w-full sm:w-auto justify-center rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-lg bg-green-600 hover:bg-green-700 hover:shadow-xl transition-all duration-200 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {applyLoading ? 'Finalizing...' : 'Finalize for Real'}
          </button>
        </div>
      </div>
    </div>,
    portalContainer
      )}
    </>
  );
}
