'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface Tiebreaker {
  id: string;
  round_id: string;
  player_id: string;
  player_name: string;
  position: string;
  original_amount: number;
  status: string;
  teams_count: number;
  submitted_count: number;
  created_at: string;
  teams: TiebreakerTeam[];
}

interface TiebreakerTeam {
  team_id: string;
  team_name: string;
  bid_amount?: number;
  submitted_at?: string;
  status: string;
}

interface BulkRound {
  id: number;
  round_number: number;
  status: string;
  base_price: number;
}

export default function BulkRoundTiebreakersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const roundId = params?.id as string;

  const [bulkRound, setBulkRound] = useState<BulkRound | null>(null);
  const [tiebreakers, setTiebreakers] = useState<Tiebreaker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [expandedTiebreakers, setExpandedTiebreakers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'committee_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  // Fetch round and tiebreakers
  useEffect(() => {
    const fetchData = async () => {
      if (!roundId) return;

      setIsLoading(true);
      try {
        // TODO: Replace with actual API calls
        // Fetch round details
        // const roundResponse = await fetchWithTokenRefresh(`/api/rounds/${roundId}`);
        // const { success: roundSuccess, data: roundData } = await roundResponse.json();

        // Mock round data
        const mockRound: BulkRound = {
          id: parseInt(roundId),
          round_number: 1,
          status: 'active',
          base_price: 10,
        };
        setBulkRound(mockRound);

        // Fetch tiebreakers for this round
        // const tiebreakerResponse = await fetchWithTokenRefresh(`/api/rounds/${roundId}/tiebreakers`);
        // const { success: tbSuccess, data: tbData } = await tiebreakerResponse.json();

        // Mock tiebreakers data
        const mockTiebreakers: Tiebreaker[] = [
          {
            id: 'tb-1',
            round_id: roundId,
            player_id: 'p-1',
            player_name: 'John Doe',
            position: 'FWD',
            original_amount: 10,
            status: 'active',
            teams_count: 3,
            submitted_count: 2,
            created_at: new Date().toISOString(),
            teams: [
              { team_id: 't-1', team_name: 'Team Alpha', bid_amount: 15, submitted_at: new Date().toISOString(), status: 'submitted' },
              { team_id: 't-2', team_name: 'Team Beta', bid_amount: 12, submitted_at: new Date().toISOString(), status: 'submitted' },
              { team_id: 't-3', team_name: 'Team Gamma', status: 'pending' },
            ],
          },
          {
            id: 'tb-2',
            round_id: roundId,
            player_id: 'p-2',
            player_name: 'Jane Smith',
            position: 'MID',
            original_amount: 10,
            status: 'pending',
            teams_count: 2,
            submitted_count: 0,
            created_at: new Date().toISOString(),
            teams: [
              { team_id: 't-4', team_name: 'Team Delta', status: 'pending' },
              { team_id: 't-5', team_name: 'Team Echo', status: 'pending' },
            ],
          },
        ];
        setTiebreakers(mockTiebreakers);
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [roundId]);

  const toggleTiebreaker = (tiebreakerId: string) => {
    const newExpanded = new Set(expandedTiebreakers);
    if (newExpanded.has(tiebreakerId)) {
      newExpanded.delete(tiebreakerId);
    } else {
      newExpanded.add(tiebreakerId);
    }
    setExpandedTiebreakers(newExpanded);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-gray-100 text-gray-700';
      case 'active': return 'bg-yellow-100 text-yellow-700';
      case 'completed': return 'bg-green-100 text-green-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getTeamStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-gray-100 text-gray-600';
      case 'submitted': return 'bg-blue-100 text-blue-700';
      case 'won': return 'bg-green-100 text-green-700';
      case 'lost': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const filteredTiebreakers = tiebreakers.filter(tb => {
    if (filterStatus === 'all') return true;
    return tb.status === filterStatus;
  });

  const tiebreakerStats = {
    total: tiebreakers.length,
    active: tiebreakers.filter(tb => tb.status === 'active').length,
    pending: tiebreakers.filter(tb => tb.status === 'pending').length,
    completed: tiebreakers.filter(tb => tb.status === 'completed').length,
  };

  if (loading || !user || user.role !== 'committee_admin' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading tiebreakers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Link
              href={`/dashboard/committee/bulk-rounds/${roundId}`}
              className="text-gray-500 hover:text-[#0066FF] transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <h1 className="text-3xl md:text-4xl font-bold gradient-text flex items-center">
              <svg className="w-8 h-8 mr-3 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Bulk Round {bulkRound?.round_number} - Tiebreakers
            </h1>
          </div>
          <p className="text-gray-600">Manage tiebreakers for players with multiple bids</p>
        </div>

        {/* Info Card */}
        <div className="glass rounded-2xl p-6 mb-6 border border-white/20 bg-yellow-50">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-yellow-100">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-yellow-900 mb-2">About Tiebreakers</h3>
              <p className="text-yellow-800 text-sm">
                When multiple teams bid on the same player at the base price, a tiebreaker auction is created. 
                Teams must submit higher bids to win the player. The highest bid wins the player.
              </p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="glass rounded-xl p-4 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total</p>
                <p className="text-2xl font-bold text-gray-800">{tiebreakerStats.total}</p>
              </div>
              <div className="p-3 rounded-lg bg-gray-100">
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="glass rounded-xl p-4 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Active</p>
                <p className="text-2xl font-bold text-yellow-600">{tiebreakerStats.active}</p>
              </div>
              <div className="p-3 rounded-lg bg-yellow-100">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="glass rounded-xl p-4 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Pending</p>
                <p className="text-2xl font-bold text-gray-600">{tiebreakerStats.pending}</p>
              </div>
              <div className="p-3 rounded-lg bg-gray-100">
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="glass rounded-xl p-4 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Completed</p>
                <p className="text-2xl font-bold text-green-600">{tiebreakerStats.completed}</p>
              </div>
              <div className="p-3 rounded-lg bg-green-100">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="glass rounded-2xl p-4 mb-6 border border-white/20">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-700 mr-2">Filter by Status:</span>
            {['all', 'pending', 'active', 'completed'].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  filterStatus === status
                    ? 'bg-[#0066FF] text-white'
                    : 'bg-white/50 text-gray-700 hover:bg-white/80'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="glass rounded-2xl p-4 mb-6 border border-white/20">
          <div className="flex flex-wrap gap-3">
            {/* Placeholder buttons for future features */}
            <button
              disabled
              className="inline-flex items-center px-4 py-2 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed font-medium"
              title="Feature coming soon"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Create Tiebreaker (Coming Soon)
            </button>

            <button
              disabled
              className="inline-flex items-center px-4 py-2 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed font-medium"
              title="Feature coming soon"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              Resolve All (Coming Soon)
            </button>

            <button
              disabled
              className="inline-flex items-center px-4 py-2 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed font-medium"
              title="Feature coming soon"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh Status (Coming Soon)
            </button>
          </div>
        </div>

        {/* Tiebreakers List */}
        <div className="glass rounded-2xl p-6 border border-white/20">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            Tiebreakers ({filteredTiebreakers.length})
          </h2>

          {filteredTiebreakers.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-gray-600 font-medium">No tiebreakers found</p>
              <p className="text-sm text-gray-500 mt-2">
                {filterStatus === 'all'
                  ? 'Tiebreakers will appear here when multiple teams bid on the same player'
                  : `No ${filterStatus} tiebreakers at this time`}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTiebreakers.map((tiebreaker) => {
                const isExpanded = expandedTiebreakers.has(tiebreaker.id);
                const highestBid = Math.max(...tiebreaker.teams.filter(t => t.bid_amount).map(t => t.bid_amount!), 0);

                return (
                  <div
                    key={tiebreaker.id}
                    className="glass rounded-xl border border-white/10 overflow-hidden"
                  >
                    {/* Tiebreaker Header */}
                    <button
                      onClick={() => toggleTiebreaker(tiebreaker.id)}
                      className="w-full p-4 flex items-center justify-between hover:bg-white/30 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <svg
                          className={`w-5 h-5 text-gray-600 transition-transform ${
                            isExpanded ? 'rotate-90' : ''
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                        </svg>
                        <div className="text-left">
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="font-bold text-gray-800">{tiebreaker.player_name}</h3>
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                              {tiebreaker.position}
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(tiebreaker.status)}`}>
                              {tiebreaker.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span>Base: £{tiebreaker.original_amount}</span>
                            <span>•</span>
                            <span>{tiebreaker.teams_count} teams</span>
                            <span>•</span>
                            <span>{tiebreaker.submitted_count}/{tiebreaker.teams_count} submitted</span>
                            {highestBid > 0 && (
                              <>
                                <span>•</span>
                                <span className="font-semibold text-green-600">Highest: £{highestBid}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(tiebreaker.created_at).toLocaleDateString()}
                      </span>
                    </button>

                    {/* Tiebreaker Details */}
                    {isExpanded && (
                      <div className="border-t border-gray-200/30 bg-white/20 p-4">
                        <h4 className="font-semibold text-gray-800 mb-3">Team Bids</h4>
                        <div className="space-y-2">
                          {tiebreaker.teams
                            .sort((a, b) => (b.bid_amount || 0) - (a.bid_amount || 0))
                            .map((team) => (
                              <div
                                key={team.team_id}
                                className={`flex items-center justify-between p-3 rounded-lg border ${
                                  team.status === 'won'
                                    ? 'bg-green-50 border-green-300'
                                    : 'bg-white border-gray-200'
                                }`}
                              >
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium text-gray-900">{team.team_name}</span>
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTeamStatusColor(team.status)}`}>
                                      {team.status}
                                    </span>
                                  </div>
                                  {team.submitted_at && (
                                    <span className="text-xs text-gray-500">
                                      Submitted: {new Date(team.submitted_at).toLocaleString()}
                                    </span>
                                  )}
                                </div>
                                <div className="text-right">
                                  {team.bid_amount ? (
                                    <div className="text-lg font-bold text-gray-800">£{team.bid_amount}</div>
                                  ) : (
                                    <div className="text-sm text-gray-500 italic">No bid yet</div>
                                  )}
                                </div>
                              </div>
                            ))}
                        </div>

                        {/* Action Buttons */}
                        <div className="mt-4 pt-4 border-t border-gray-200/30 flex gap-2">
                          <button
                            disabled
                            className="px-4 py-2 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed text-sm font-medium"
                            title="Feature coming soon"
                          >
                            Resolve Tiebreaker (Coming Soon)
                          </button>
                          <button
                            disabled
                            className="px-4 py-2 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed text-sm font-medium"
                            title="Feature coming soon"
                          >
                            Cancel Tiebreaker (Coming Soon)
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}