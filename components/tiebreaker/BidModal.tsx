'use client';

import React, { useState } from 'react';
import { X, TrendingUp, AlertCircle } from 'lucide-react';
import {
  formatCurrency,
  getMinimumBid,
  getBidSuggestions,
  validateBidAmount,
} from '@/lib/utils/tiebreakerUtils';

interface BidModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (bidAmount: number) => Promise<void>;
  currentHighestBid: number;
  playerName: string;
  balance: number;
}

export default function BidModal({
  isOpen,
  onClose,
  onSubmit,
  currentHighestBid,
  playerName,
  balance,
}: BidModalProps) {
  const [bidAmount, setBidAmount] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const minimumBid = getMinimumBid(currentHighestBid);
  const suggestions = getBidSuggestions(currentHighestBid);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const amount = parseInt(bidAmount);

    // Validate
    const validation = validateBidAmount(amount, currentHighestBid, balance);
    if (!validation.valid) {
      setError(validation.error || 'Invalid bid amount');
      return;
    }

    try {
      setSubmitting(true);
      await onSubmit(amount);
      setBidAmount('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to place bid');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSuggestionClick = (amount: number) => {
    setBidAmount(amount.toString());
    setError(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Place Bid</h2>
            <p className="text-sm text-gray-600 mt-1">{playerName}</p>
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
        <form onSubmit={handleSubmit} className="p-6">
          {/* Current Info */}
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-700">Current Highest Bid</span>
              <span className="text-lg font-bold text-blue-700 flex items-center gap-1">
                <TrendingUp className="w-4 h-4" />
                {formatCurrency(currentHighestBid)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Your Balance</span>
              <span className="text-lg font-semibold text-gray-900">
                {formatCurrency(balance)}
              </span>
            </div>
          </div>

          {/* Bid Input */}
          <div className="mb-6">
            <label htmlFor="bidAmount" className="block text-sm font-medium text-gray-700 mb-2">
              Your Bid Amount (£)
            </label>
            <input
              id="bidAmount"
              type="number"
              value={bidAmount}
              onChange={(e) => {
                setBidAmount(e.target.value);
                setError(null);
              }}
              min={minimumBid}
              max={balance}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg font-semibold"
              placeholder={`Minimum: £${minimumBid}`}
              disabled={submitting}
              required
            />
            <p className="text-xs text-gray-500 mt-2">
              Minimum bid: {formatCurrency(minimumBid)}
            </p>
          </div>

          {/* Quick Suggestions */}
          <div className="mb-6">
            <p className="text-sm font-medium text-gray-700 mb-2">Quick Suggestions</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => handleSuggestionClick(amount)}
                  disabled={amount > balance || submitting}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    amount > balance
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-700 hover:bg-blue-100 hover:text-blue-700'
                  }`}
                >
                  {formatCurrency(amount)}
                </button>
              ))}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Warning */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6">
            <p className="text-sm text-yellow-800">
              <strong>⚠️ Warning:</strong> If your bid is the highest, you will NOT be able to
              withdraw until someone outbids you.
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
              type="submit"
              disabled={submitting || !bidAmount}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Placing Bid...' : 'Place Bid'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
