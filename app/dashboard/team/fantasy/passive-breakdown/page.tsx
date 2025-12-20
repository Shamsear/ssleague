'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface PassiveBreakdownData {
  team: {
    team_id: string;
    team_name: string;
    owner_name: string;
    supported_team_id: string;
    supported_team_name: string;
    passive_points: number;
    league_id: string;
  };
  stats: {
    total_rounds: number;
    total_passive_points: number;
    total_admin_bonus: number;
    average_per_round: string;
    best_round: number;
    rounds_with_bonus: number;
  };
  admin_bonuses: Array<{
    id: number;
    points: number;
    reason: string;
    awarded_at: string;
  }>;
  rounds: Array<{
    fixture_id: string;
    round_number: number;
    real_team_name: string;
    bonus_breakdown: Record<string, number>;
    total_bonus: number;
    calculated_at: string;
  }>;
}

export default function PassiveBreakdownPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<PassiveBreakdownData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'team') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const loadBreakdown = async () => {
      if (!user) return;

      try {
        // First get the team ID
        const teamResponse = await fetchWithTokenRefresh(`/api/fantasy/teams/my-team?user_id=${user.uid}`);
        if (!teamResponse.ok) {
          throw new Error('Failed to load fantasy team');
        }

        const teamData = await teamResponse.json();
        const teamId = teamData.team.id;

        // Then get the breakdown
        const breakdownResponse = await fetchWithTokenRefresh(`/api/fantasy/teams/${teamId}/passive-breakdown`);
        if (!breakdownResponse.ok) {
          throw new Error('Failed to load passive breakdown');
        }

        const breakdownData = await breakdownResponse.json();
        setData(breakdownData);
      } catch (err) {
        console.error('Error loading breakdown:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      loadBreakdown();
    }
  }, [user]);

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading breakdown...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-600 font-medium">{error || 'Failed to load data'}</p>
          <Link href="/dashboard/team/fantasy/my-team" className="mt-4 inline-block text-blue-600 hover:underline">
            ← Back to My Team
          </Link>
        </div>
      </div>
    );
  }

  const teamBonusTotal = data.rounds.reduce((sum, r) => sum + r.total_bonus, 0);
  const adminBonusTotal = data.admin_bonuses.reduce((sum, b) => sum + b.points, 0);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <Link href="/dashboard/team/fantasy/my-team" className="text-blue-600 hover:underline mb-2 inline-block">
          ← Back to My Team
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Passive Points Breakdown</h1>
        <p className="text-gray-600 mt-1">Detailed breakdown of all passive points earned</p>
      </div>

      {/* Team Info */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-2xl shadow-xl border border-green-200 p-6 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">{data.team.team_name}</h2>
            <p className="text-lg text-gray-700">Supported Team: <span className="font-semibold text-green-600">{data.team.supported_team_name}</span></p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">Total Passive Points</p>
            <p className="text-4xl font-bold text-blue-600">{data.stats.total_passive_points}</p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Team Performance Bonuses */}
        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600">Team Performance</p>
              <p className="text-2xl font-bold text-green-600">{teamBonusTotal}</p>
            </div>
          </div>
          <p className="text-xs text-gray-500">{data.stats.total_rounds} rounds • Avg {data.stats.average_per_round}/round</p>
        </div>

        {/* Admin Bonuses */}
        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-yellow-500">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600">Admin Bonuses</p>
              <p className="text-2xl font-bold text-yellow-600">{adminBonusTotal > 0 ? '+' : ''}{adminBonusTotal}</p>
            </div>
          </div>
          <p className="text-xs text-gray-500">{data.admin_bonuses.length} award{data.admin_bonuses.length !== 1 ? 's' : ''}</p>
        </div>

        {/* Total */}
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-blue-100">Total Passive</p>
              <p className="text-2xl font-bold">{data.stats.total_passive_points}</p>
            </div>
          </div>
          <p className="text-xs text-blue-100">= {teamBonusTotal} + {adminBonusTotal}</p>
        </div>
      </div>

      {/* Admin Bonuses Section */}
      {data.admin_bonuses.length > 0 && (
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span>🎁</span> Admin Bonus Points
          </h2>
          <div className="space-y-3">
            {data.admin_bonuses.map((bonus) => (
              <div key={bonus.id} className="border-2 border-yellow-300 rounded-lg p-4 bg-gradient-to-r from-yellow-50 to-amber-50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900 text-lg">{bonus.reason}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Awarded: {new Date(bonus.awarded_at).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-yellow-600">{bonus.points > 0 ? '+' : ''}{bonus.points}</p>
                    <p className="text-xs text-gray-500">bonus pts</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Round-by-Round Breakdown */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <span>📊</span> Round-by-Round Team Performance Bonuses
        </h2>
        
        {data.rounds.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No team performance bonuses earned yet</p>
        ) : (
          <div className="space-y-3">
            {data.rounds.map((round, idx) => {
              const breakdown = round.bonus_breakdown || {};
              const bonusTypes = Object.keys(breakdown);
              
              return (
                <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-gradient-to-r from-green-50 to-blue-50 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-blue-600 rounded-lg flex items-center justify-center shadow-md">
                        <span className="font-bold text-white">R{round.round_number}</span>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-lg">Round {round.round_number}</p>
                        <p className="text-sm text-gray-600">{round.real_team_name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-green-600">+{round.total_bonus}</p>
                      <p className="text-xs text-gray-500">bonus pts</p>
                    </div>
                  </div>
                  
                  {/* Bonus Breakdown */}
                  {bonusTypes.length > 0 && (
                    <div className="pt-3 border-t border-green-200">
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {bonusTypes.map((type) => (
                          <div key={type} className="flex items-center justify-between px-3 py-2 bg-white rounded-lg border border-green-200 text-sm">
                            <span className="text-gray-700 capitalize">{type.replace(/_/g, ' ')}</span>
                            <span className="font-bold text-green-600">+{breakdown[type]}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Summary Footer */}
      <div className="mt-8 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 mb-1">Total Passive Points Breakdown</p>
            <p className="text-lg text-gray-700">
              <span className="font-semibold text-green-600">{teamBonusTotal} pts</span> (Team Performance) + 
              <span className="font-semibold text-yellow-600"> {adminBonusTotal} pts</span> (Admin Bonuses) = 
              <span className="font-bold text-blue-600 text-xl"> {data.stats.total_passive_points} pts</span>
            </p>
          </div>
          <Link 
            href="/dashboard/team/fantasy/my-team"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Back to My Team
          </Link>
        </div>
      </div>
    </div>
  );
}
