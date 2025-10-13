'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { TiebreakerDetails } from '@/types/tiebreaker';
import BidModal from '@/components/tiebreaker/BidModal';
import WithdrawModal from '@/components/tiebreaker/WithdrawModal';
import {
  formatCurrency,
  formatRelativeTime,
  getStatusBadge,
  getPositionColor,
  getUrgencyColor,
  getUrgencyLevel,
  isCountdownUrgent,
} from '@/lib/utils/tiebreakerUtils';
import {
  ArrowLeft,
  Clock,
  TrendingUp,
  Users,
  Trophy,
  AlertCircle,
  History,
  UserX,
} from 'lucide-react';

export default function TiebreakerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tiebreakerId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TiebreakerDetails | null>(null);
  const [balance, setBalance] = useState(1000); // TODO: Fetch from API
  const [showBidModal, setShowBidModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchTiebreakerDetails();
    // Auto-refresh every 10 seconds for active tiebreakers
    const interval = setInterval(() => {
      if (data?.tiebreaker.status === 'active') {
        fetchTiebreakerDetails();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [tiebreakerId]);

  const fetchTiebreakerDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/team/bulk-tiebreakers/${tiebreakerId}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch tiebreaker details');
      }

      setData(result.data);
    } catch (err: any) {
      console.error('Error fetching tiebreaker:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePlaceBid = async (bidAmount: number) => {
    try {
      const response = await fetch(`/api/team/bulk-tiebreakers/${tiebreakerId}/bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bid_amount: bidAmount }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to place bid');
      }

      setSuccessMessage(result.data.message);
      setTimeout(() => setSuccessMessage(null), 5000);
      fetchTiebreakerDetails();
    } catch (err: any) {
      throw err;
    }
  };

  const handleWithdraw = async () => {
    try {
      const response = await fetch(`/api/team/bulk-tiebreakers/${tiebreakerId}/withdraw`, {
        method: 'POST',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to withdraw');
      }

      setSuccessMessage(result.data.message);
      setTimeout(() => setSuccessMessage(null), 5000);
      fetchTiebreakerDetails();
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(null), 5000);
      throw err;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading tiebreaker details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto px-4 py-8">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle className="w-6 h-6 text-red-600" />
            <h2 className="text-xl font-semibold text-red-900">Error</h2>
          </div>
          <p className="text-red-700">{error || 'Failed to load tiebreaker'}</p>
        </div>
      </div>
    );
  }

  const { tiebreaker, my_status, statistics, participating_teams, recent_bids } = data;
  const statusBadge = getStatusBadge(tiebreaker.status);
  const positionColor = getPositionColor(tiebreaker.player_position);
  const urgency = getUrgencyLevel(tiebreaker.time_remaining);
  const urgencyColor = getUrgencyColor(urgency);
  const isUrgent = isCountdownUrgent(tiebreaker.time_remaining);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Tiebreakers
      </button>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex items-start gap-3">
          <Trophy className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-green-700">{successMessage}</p>
        </div>
      )}

      {/* Player Header */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-gray-900">{tiebreaker.player_name}</h1>
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${positionColor}`}>
                {tiebreaker.player_position}
              </span>
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${statusBadge.bgColor} ${statusBadge.color}`}>
                {statusBadge.label}
              </span>
            </div>
            <p className="text-lg text-gray-600">{tiebreaker.player_team}</p>
            <p className="text-sm text-gray-500 mt-1">{tiebreaker.round_name}</p>
          </div>
        </div>

        {/* Bid Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Starting Bid</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(tiebreaker.tie_amount)}</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Current Highest</p>
            <p className="text-2xl font-bold text-blue-700 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              {formatCurrency(tiebreaker.current_highest_bid)}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Teams</p>
            <p className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5" />
              {statistics.active_teams} active
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Timer (Active only) */}
          {tiebreaker.status === 'active' && tiebreaker.time_remaining && (
            <div className={`rounded-lg border p-6 ${isUrgent ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
              <div className="flex items-center gap-3 mb-3">
                <Clock className={`w-6 h-6 ${isUrgent ? 'text-red-600' : 'text-gray-600'}`} />
                <h2 className="text-xl font-bold text-gray-900">Time Remaining</h2>
              </div>
              <p className={`text-4xl font-bold ${isUrgent ? urgencyColor : 'text-gray-900'}`}>
                {tiebreaker.time_remaining}
              </p>
              {isUrgent && (
                <p className="text-sm text-red-600 mt-2">⚠️ Hurry! Time is running out</p>
              )}
            </div>
          )}

          {/* My Status */}
          {my_status && (
            <div className={`rounded-lg border p-6 ${my_status.you_are_highest ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Your Status</h2>
              
              {my_status.status === 'withdrawn' ? (
                <div className="flex items-center gap-3 text-gray-600">
                  <UserX className="w-6 h-6" />
                  <span className="text-lg font-semibold">You have withdrawn from this tiebreaker</span>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-600">Your Current Bid</p>
                      <p className="text-xl font-bold text-gray-900">
                        {my_status.current_bid ? formatCurrency(my_status.current_bid) : 'No bid yet'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Position</p>
                      <p className="text-xl font-bold">
                        {my_status.you_are_highest ? (
                          <span className="text-green-700">🏆 Leading!</span>
                        ) : (
                          <span className="text-gray-700">Not leading</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  {tiebreaker.status === 'active' && (
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowBidModal(true)}
                        disabled={!my_status.can_bid}
                        className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {my_status.can_bid ? 'Place Bid' : 'Cannot Bid'}
                      </button>
                      <button
                        onClick={() => setShowWithdrawModal(true)}
                        disabled={!my_status.can_withdraw}
                        className="flex-1 px-4 py-3 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {my_status.can_withdraw ? 'Withdraw' : 'Cannot Withdraw'}
                      </button>
                    </div>
                  )}

                  {my_status.you_are_highest && tiebreaker.status === 'active' && (
                    <p className="text-sm text-green-700 mt-3">
                      💡 You&apos;re leading! You cannot withdraw until someone outbids you.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Bid History */}
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <History className="w-6 h-6 text-gray-600" />
              <h2 className="text-xl font-bold text-gray-900">Recent Bids</h2>
            </div>
            {recent_bids.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No bids yet</p>
            ) : (
              <div className="space-y-2">
                {recent_bids.map((bid, index) => (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-3 rounded-lg ${bid.is_you ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'}`}
                  >
                    <div>
                      <p className="font-semibold text-gray-900">
                        {bid.team_name}
                        {bid.is_you && <span className="ml-2 text-blue-600">(You)</span>}
                      </p>
                      <p className="text-sm text-gray-600">{formatRelativeTime(bid.bid_time)}</p>
                    </div>
                    <p className="text-lg font-bold text-gray-900">{formatCurrency(bid.bid_amount)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Participating Teams */}
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Users className="w-6 h-6 text-gray-600" />
            <h2 className="text-xl font-bold text-gray-900">Teams</h2>
          </div>
          <div className="space-y-2">
            {participating_teams.map((team) => (
              <div
                key={team.team_id}
                className={`p-3 rounded-lg ${
                  team.is_you
                    ? 'bg-blue-50 border border-blue-200'
                    : team.status === 'withdrawn'
                    ? 'bg-gray-100'
                    : 'bg-gray-50'
                }`}
              >
                <p className="font-semibold text-gray-900">
                  {team.team_name}
                  {team.is_you && <span className="ml-2 text-blue-600">(You)</span>}
                </p>
                <div className="flex items-center justify-between mt-1">
                  <span className={`text-sm ${team.status === 'withdrawn' ? 'text-gray-500' : 'text-gray-700'}`}>
                    {team.status === 'withdrawn' ? 'Withdrawn' : 'Active'}
                  </span>
                  {team.current_bid && (
                    <span className="text-sm font-semibold text-gray-900">
                      {formatCurrency(team.current_bid)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="mt-6 pt-4 border-t border-gray-200 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Active</span>
              <span className="font-semibold text-gray-900">{statistics.active_teams}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Withdrawn</span>
              <span className="font-semibold text-gray-900">{statistics.withdrawn_teams}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total Bids</span>
              <span className="font-semibold text-gray-900">{statistics.total_bids}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <BidModal
        isOpen={showBidModal}
        onClose={() => setShowBidModal(false)}
        onSubmit={handlePlaceBid}
        currentHighestBid={tiebreaker.current_highest_bid}
        playerName={tiebreaker.player_name}
        balance={balance}
      />

      <WithdrawModal
        isOpen={showWithdrawModal}
        onClose={() => setShowWithdrawModal(false)}
        onConfirm={handleWithdraw}
        playerName={tiebreaker.player_name}
        teamsRemaining={statistics.active_teams}
      />
    </div>
  );
}
