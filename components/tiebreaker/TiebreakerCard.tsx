'use client';

import React from 'react';
import Link from 'next/link';
import { Tiebreaker, MyTiebreakerStatus } from '@/types/tiebreaker';
import {
  formatCurrency,
  getStatusBadge,
  getPositionColor,
  getUrgencyLevel,
  getUrgencyColor,
  isCountdownUrgent,
} from '@/lib/utils/tiebreakerUtils';
import { Clock, TrendingUp, Users, AlertCircle } from 'lucide-react';

interface TiebreakerCardProps {
  tiebreaker: Tiebreaker;
  myStatus?: MyTiebreakerStatus;
  showMyStatus?: boolean;
}

export default function TiebreakerCard({ 
  tiebreaker, 
  myStatus,
  showMyStatus = false 
}: TiebreakerCardProps) {
  const statusBadge = getStatusBadge(tiebreaker.status);
  const urgency = getUrgencyLevel(tiebreaker.time_remaining);
  const urgencyColor = getUrgencyColor(urgency);
  const isUrgent = isCountdownUrgent(tiebreaker.time_remaining);
  const positionColor = getPositionColor(tiebreaker.player_position);

  return (
    <Link href={`/tiebreakers/${tiebreaker.id}`}>
      <div className="bg-white rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow p-6 cursor-pointer">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-xl font-bold text-gray-900">
                {tiebreaker.player_name}
              </h3>
              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${positionColor}`}>
                {tiebreaker.player_position}
              </span>
            </div>
            <p className="text-sm text-gray-600">{tiebreaker.player_team}</p>
            <p className="text-xs text-gray-500 mt-1">{tiebreaker.round_name}</p>
          </div>

          {/* Status Badge */}
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusBadge.bgColor} ${statusBadge.color}`}>
            {statusBadge.label}
          </span>
        </div>

        {/* Bid Information */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-600 mb-1">Starting Bid</p>
            <p className="text-lg font-semibold text-gray-900">
              {formatCurrency(tiebreaker.tie_amount)}
            </p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-xs text-gray-600 mb-1">Current Highest</p>
            <p className="text-lg font-semibold text-blue-700 flex items-center gap-1">
              <TrendingUp className="w-4 h-4" />
              {formatCurrency(tiebreaker.current_highest_bid)}
            </p>
          </div>
        </div>

        {/* My Status (if applicable) */}
        {showMyStatus && myStatus && (
          <div className={`mb-4 p-3 rounded-lg ${
            myStatus.you_are_highest 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-gray-50 border border-gray-200'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600">Your Status</p>
                <p className="text-sm font-semibold">
                  {myStatus.you_are_highest ? (
                    <span className="text-green-700">🏆 Leading Bid</span>
                  ) : myStatus.status === 'withdrawn' ? (
                    <span className="text-gray-600">Withdrawn</span>
                  ) : (
                    <span className="text-gray-700">
                      {myStatus.current_bid ? `Bid: ${formatCurrency(myStatus.current_bid)}` : 'No bid yet'}
                    </span>
                  )}
                </p>
              </div>
              {myStatus.you_are_highest && (
                <AlertCircle className="w-5 h-5 text-green-600" />
              )}
            </div>
          </div>
        )}

        {/* Time Remaining (Active only) */}
        {tiebreaker.status === 'active' && tiebreaker.time_remaining && (
          <div className={`flex items-center gap-2 p-3 rounded-lg ${
            isUrgent ? 'bg-red-50 border border-red-200' : 'bg-gray-50'
          }`}>
            <Clock className={`w-4 h-4 ${isUrgent ? 'text-red-600' : 'text-gray-600'}`} />
            <div className="flex-1">
              <p className="text-xs text-gray-600">Time Remaining</p>
              <p className={`text-sm font-semibold ${isUrgent ? urgencyColor : 'text-gray-900'}`}>
                {tiebreaker.time_remaining}
                {isUrgent && <span className="ml-2 text-xs">⚠️ Urgent</span>}
              </p>
            </div>
          </div>
        )}

        {/* Teams Info */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Users className="w-4 h-4" />
            <span>{tiebreaker.tied_team_count} teams</span>
          </div>

          {/* Action Hint */}
          {showMyStatus && myStatus && tiebreaker.status === 'active' && (
            <div className="text-sm font-medium">
              {myStatus.you_are_highest ? (
                <span className="text-green-600">You&apos;re leading!</span>
              ) : myStatus.can_bid ? (
                <span className="text-blue-600">Bid now →</span>
              ) : myStatus.can_withdraw ? (
                <span className="text-orange-600">Withdraw?</span>
              ) : (
                <span className="text-gray-500">View details →</span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
