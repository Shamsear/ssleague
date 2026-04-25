'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import TransferFormV2 from './TransferFormV2';
import SwapFormV2 from './SwapFormV2';
import FootballPlayerForm from './FootballPlayerForm';
import ReleaseRealPlayerForm from './ReleaseRealPlayerForm';
import ReleaseFootballPlayerForm from './ReleaseFootballPlayerForm';
import BulkReleaseFootballPlayerForm from './BulkReleaseFootballPlayerForm';
import Link from 'next/link';

type TabType = 'transfer' | 'swap' | 'release' | 'bulk_release';

export default function PlayerTransfersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { isCommitteeAdmin } = usePermissions();

  const [activeTab, setActiveTab] = useState<TabType>('transfer');
  const [playerType, setPlayerType] = useState<'real' | 'football'>('real');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && !isCommitteeAdmin) {
      router.push('/dashboard');
    }
  }, [user, loading, router, isCommitteeAdmin]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-lg text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !isCommitteeAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-4 sm:py-8 px-4">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Enhanced Player Transfer System v2.0
              </h1>
              <p className="text-gray-600">
                Transfer and swap players with star-based value increases, committee fees, and automatic upgrades
              </p>
            </div>

            {/* Player Type Selector */}
            <div className="flex gap-2">
              <button
                onClick={() => setPlayerType('real')}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${playerType === 'real'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
                  }`}
              >
                👤 Real Players
              </button>
              <button
                onClick={() => setPlayerType('football')}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${playerType === 'football'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
                  }`}
              >
                ⚽ Football Players
              </button>
            </div>
          </div>

          {/* Quick Links */}
          <div className="flex gap-3 flex-wrap">
            <Link
              href="/dashboard/committee/players/transfers/history"
              className="px-4 py-2 bg-white text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-50 transition-all text-sm font-medium"
            >
              📊 Transaction History
            </Link>
            <Link
              href="/dashboard/committee/reports/fees"
              className="px-4 py-2 bg-white text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-50 transition-all text-sm font-medium"
            >
              💰 Committee Fee Reports
            </Link>
          </div>
        </div>

        {/* Info Banner */}
        <div className="mb-6 bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-2">🌟 New Features in v2.0</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• <strong>Transfer Limits:</strong> 2 operations per team per season</li>
            <li>• <strong>Star-Based Values:</strong> Player values increase 115%-150% based on star rating</li>
            <li>• <strong>Committee Fees:</strong> 10% on transfers, fixed fees on swaps</li>
            <li>• <strong>Auto Upgrades:</strong> Players can upgrade their star rating automatically</li>
            <li>• <strong>Real-Time Preview:</strong> See all calculations before confirming</li>
          </ul>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Only show tabs for real players */}
          {playerType === 'real' && (
            <div className="border-b border-gray-200">
              <div className="flex">
                <button
                  onClick={() => setActiveTab('transfer')}
                  className={`flex-1 py-4 px-6 text-center font-semibold transition-all ${activeTab === 'transfer'
                    ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:bg-gray-50'
                    }`}
                >
                  ➡️ Transfer Player (Sale)
                </button>
                <button
                  onClick={() => setActiveTab('swap')}
                  className={`flex-1 py-4 px-6 text-center font-semibold transition-all ${activeTab === 'swap'
                    ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:bg-gray-50'
                    }`}
                >
                  🔄 Swap Players
                </button>
                <button
                  onClick={() => setActiveTab('release')}
                  className={`flex-1 py-4 px-6 text-center font-semibold transition-all ${activeTab === 'release'
                    ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:bg-gray-50'
                    }`}
                >
                  🔓 Release Player
                </button>
              </div>
            </div>
          )}

          <div className="p-6">
            {/* FOOTBALL PLAYERS - Swap and Release with Refund */}
            {playerType === 'football' ? (
              <>
                {/* Tabs for Football Players */}
                <div className="border-b border-gray-200 mb-6">
                  <div className="flex">
                    <button
                      onClick={() => setActiveTab('swap')}
                      className={`flex-1 py-4 px-6 text-center font-semibold transition-all ${activeTab === 'swap'
                        ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-600 hover:bg-gray-50'
                        }`}
                    >
                      🔄 Swap Players
                    </button>
                    <button
                      onClick={() => setActiveTab('release')}
                      className={`flex-1 py-4 px-6 text-center font-semibold transition-all ${activeTab === 'release'
                        ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-600 hover:bg-gray-50'
                        }`}
                    >
                      🔓 Release Player
                    </button>
                    <button
                      onClick={() => setActiveTab('bulk_release')}
                      className={`flex-1 py-4 px-6 text-center font-semibold transition-all ${activeTab === 'bulk_release'
                        ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-600 hover:bg-gray-50'
                        }`}
                    >
                      🗑️ Bulk Release
                    </button>
                  </div>
                </div>

                {/* Football Player Swap */}
                {activeTab === 'swap' && (
                  <div>
                    <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <h3 className="font-semibold text-gray-900 mb-2">How Football Player Swaps Work</h3>
                      <ul className="text-sm text-gray-700 space-y-1">
                        <li>• Exchange team assignments AND acquisition values between two players</li>
                        <li>• First 3 swaps FREE, 4th swap = 100, 5th swap = 125</li>
                        <li>• Values are swapped: Player A gets Player B's value, Player B gets Player A's value</li>
                      </ul>
                    </div>
                    <FootballPlayerForm key={playerType} />
                  </div>
                )}

                {/* Football Player Release */}
                {activeTab === 'release' && (
                  <div>
                    <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <h3 className="font-semibold text-gray-900 mb-2">How Football Player Release Works</h3>
                      <ul className="text-sm text-gray-700 space-y-1">
                        <li>• Release players at season start or mid-season (X.5)</li>
                        <li>• <strong>Manually select refund percentage</strong> (0-100%)</li>
                        <li>• Refund added to team's football budget</li>
                        <li>• Player becomes a free agent immediately</li>
                        <li>• Example: 1000 eCoin player with 75% refund = 750 eCoin back to team</li>
                      </ul>
                    </div>
                    <ReleaseFootballPlayerForm />
                  </div>
                )}

                {/* Football Player Bulk Release */}
                {activeTab === 'bulk_release' && (
                  <div>
                    <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <h3 className="font-semibold text-gray-900 mb-2">How Bulk Release Works</h3>
                      <ul className="text-sm text-gray-700 space-y-1">
                        <li>• Release multiple players at once with individual refund percentages</li>
                        <li>• Set a default refund percentage for all players</li>
                        <li>• Customize refund percentage for each player individually</li>
                        <li>• See total refund amount before confirming</li>
                        <li>• All refunds added to respective team's football budget</li>
                      </ul>
                    </div>
                    <BulkReleaseFootballPlayerForm />
                  </div>
                )}
              </>
            ) : (
              <>
                {/* REAL PLAYERS - Complex Transfer System */}
                {/* TRANSFER TAB */}
                {activeTab === 'transfer' && (
                  <div>
                    <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <h3 className="font-semibold text-gray-900 mb-2">How Transfers Work</h3>
                      <ul className="text-sm text-gray-700 space-y-1">
                        <li>• Player value increases based on star rating (115%-150%)</li>
                        <li>• Buying team pays: New Value + 10% committee fee</li>
                        <li>• Selling team receives: New Value - 10% committee fee</li>
                        <li>• Player may upgrade star rating based on value increase</li>
                        <li>• Both teams use 1 transfer slot (max 2 per season)</li>
                      </ul>
                    </div>
                    <TransferFormV2 key={playerType} playerType={playerType} />
                  </div>
                )}

                {/* SWAP TAB */}
                {activeTab === 'swap' && (
                  <div>
                    <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <h3 className="font-semibold text-gray-900 mb-2">How Swaps Work</h3>
                      <ul className="text-sm text-gray-700 space-y-1">
                        <li>• Both player values increase based on star ratings</li>
                        <li>• Fixed committee fees based on star ratings (30-100)</li>
                        <li>• Optional cash addition up to 30% of player value</li>
                        <li>• Both players may upgrade star ratings</li>
                        <li>• Both teams use 1 transfer slot (max 2 per season)</li>
                      </ul>
                    </div>
                    <SwapFormV2 key={playerType} playerType={playerType} />
                  </div>
                )}

                {/* RELEASE TAB */}
                {activeTab === 'release' && (
                  <div>
                    <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <h3 className="font-semibold text-gray-900 mb-2">How Player Release Works</h3>
                      <ul className="text-sm text-gray-700 space-y-1">
                        <li>• Release players at season start or mid-season (X.5)</li>
                        <li>• <strong>Manually select refund percentage</strong> (0-100%)</li>
                        <li>• Refund added to team's dollar balance</li>
                        <li>• Player becomes a free agent immediately</li>
                        <li>• Example: $1000 player with 75% refund = $750 back to team</li>
                      </ul>
                    </div>
                    <ReleaseRealPlayerForm />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-6 text-center text-sm text-gray-600">
          <p>
            Need help? Check the{' '}
            <a href="#" className="text-blue-600 hover:underline font-semibold">
              Committee Admin Guide
            </a>
            {' '}or contact support.
          </p>
        </div>
      </div>
    </div>
  );
}
