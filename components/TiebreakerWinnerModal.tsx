'use client';

import { useRouter } from 'next/navigation';

interface WinnerPageProps {
  playerName: string;
  position: string;
  winnerTeamName: string;
  finalBid: number;
  isCurrentTeamWinner: boolean;
}

export default function TiebreakerWinnerPage({
  playerName,
  position,
  winnerTeamName,
  finalBid,
  isCurrentTeamWinner,
}: WinnerPageProps) {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="glass rounded-3xl p-8 md:p-12 max-w-2xl w-full border-2 border-gray-200 shadow-2xl bg-white/90">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          {isCurrentTeamWinner ? (
            <div className="p-4 rounded-full bg-green-500 text-white">
              <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          ) : (
            <div className="p-4 rounded-full bg-blue-500 text-white">
              <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          )}
        </div>

        {/* Title */}
        <h2 className="text-3xl font-bold text-center mb-2">
          {isCurrentTeamWinner ? '🎉 Congratulations!' : 'Tiebreaker Completed'}
        </h2>

        {/* Winner Info */}
        <div className="text-center mb-6">
          <p className="text-lg text-gray-600 mb-4">
            {isCurrentTeamWinner
              ? `You won ${playerName}!`
              : `${winnerTeamName} won ${playerName}`}
          </p>

          {/* Player Details Card */}
          <div className="glass rounded-2xl p-6 mb-4 border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-500">Player</span>
              <span className="text-lg font-bold">{playerName}</span>
            </div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-500">Position</span>
              <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-medium">
                {position}
              </span>
            </div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-500">Winner</span>
              <span className="text-lg font-bold text-green-600">{winnerTeamName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500">Final Bid</span>
              <span className="text-2xl font-bold text-[#0066FF]">£{finalBid}</span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={() => router.push('/dashboard/team')}
          className="w-full px-6 py-4 bg-[#0066FF] text-white rounded-xl font-semibold text-lg hover:bg-blue-600 transition-all hover:shadow-lg transform hover:-translate-y-0.5"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}
