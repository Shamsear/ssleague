'use client';

import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  playerName: string;
  teamsRemaining: number;
}

export default function WithdrawModal({
  isOpen,
  onClose,
  onConfirm,
  playerName,
  teamsRemaining,
}: WithdrawModalProps) {
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    try {
      setSubmitting(true);
      await onConfirm();
      onClose();
    } catch (err) {
      // Error handled by parent
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-orange-600" />
            <h2 className="text-2xl font-bold text-gray-900">Confirm Withdrawal</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={submitting}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-700 mb-4">
            Are you sure you want to withdraw from the tiebreaker for{' '}
            <strong className="text-gray-900">{playerName}</strong>?
          </p>

          {/* Warning Box */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-orange-900 mb-2">⚠️ Warning</h3>
            <ul className="text-sm text-orange-800 space-y-1 list-disc list-inside">
              <li>This action cannot be undone</li>
              <li>You will lose your chance to win this player</li>
              <li>You cannot rejoin this tiebreaker</li>
              {teamsRemaining === 2 && (
                <li className="font-semibold">
                  Only 1 team will remain - they will win immediately!
                </li>
              )}
            </ul>
          </div>

          {/* Info */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-700">
              <strong>Teams Remaining:</strong> {teamsRemaining}
              {teamsRemaining === 2 && (
                <span className="ml-2 text-orange-600 font-semibold">(Last 2!)</span>
              )}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting}
              className="flex-1 px-4 py-3 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Withdrawing...' : 'Yes, Withdraw'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
