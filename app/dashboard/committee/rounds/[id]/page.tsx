'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, use } from 'react';
import Link from 'next/link';

interface Bid {
  id: string;
  team_id: string;
  player_id: string;
  player_name: string;
  position: string;
  team_name: string;
  overall_rating: number;
  round_id: string;
  amount: number;
  status: string;
  created_at: string;
  phase?: 'regular' | 'incomplete';
  actual_bid_amount?: number;
}

interface BidsByPlayer {
  [playerId: string]: {
    player: {
      id: string;
      name: string;
      position: string;
      overall_rating: number;
    };
    bids: Bid[];
    winningBid: Bid | null;
  };
}

interface TeamBids {
  [teamId: string]: {
    team: {
      id: string;
      name: string;
    };
    bids: Array<{
      player: { id: string; name: string; position: string };
      amount: number;
      timestamp: string;
      won: boolean;
    }>;
  };
}

interface Round {
  id: string;
  season_id: string;
  position: string;
  max_bids_per_team: number;
  status: string;
  start_time?: string;
  end_time?: string;
  created_at: string;
  updated_at: string;
  bids: Bid[];
}

interface TeamBidCount {
  team_id: string;
  team_name: string;
  bid_count: number;
  required_bids: number;
}

export default function RoundDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { id: roundId } = use(params);
  const [round, setRound] = useState<Round | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);
  const [teamBidCounts, setTeamBidCounts] = useState<TeamBidCount[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'committee_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  // Fetch round details
  useEffect(() => {
    const fetchRound = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/rounds/${roundId}`);
        const { success, data } = await response.json();

        if (success) {
          setRound(data);
          // Calculate team bid counts
          if (data.bids) {
            const counts = new Map<string, { name: string; count: number }>();
            data.bids.forEach((bid: Bid) => {
              if (!counts.has(bid.team_id)) {
                counts.set(bid.team_id, { name: bid.team_name, count: 0 });
              }
              counts.get(bid.team_id)!.count++;
            });
            const countArray = Array.from(counts.entries()).map(([teamId, info]) => ({
              team_id: teamId,
              team_name: info.name,
              bid_count: info.count,
              required_bids: data.max_bids_per_team,
            }));
            setTeamBidCounts(countArray);
          }
        }
      } catch (err) {
        console.error('Error fetching round:', err);
      } finally {
        setIsLoading(false);
      }
    };

    if (roundId) {
      fetchRound();
    }
  }, [roundId]);

  // Organize bids by player
  const organizeBidsByPlayer = (): BidsByPlayer => {
    if (!round?.bids) return {};

    const bidsByPlayer: BidsByPlayer = {};

    round.bids.forEach((bid) => {
      if (!bidsByPlayer[bid.player_id]) {
        bidsByPlayer[bid.player_id] = {
          player: {
            id: bid.player_id,
            name: bid.player_name,
            position: bid.position,
            overall_rating: bid.overall_rating,
          },
          bids: [],
          winningBid: null,
        };
      }

      bidsByPlayer[bid.player_id].bids.push(bid);

      // Set winning bid (status 'won' for completed rounds)
      if (bid.status === 'won') {
        bidsByPlayer[bid.player_id].winningBid = bid;
      }
    });

    return bidsByPlayer;
  };

  // Organize bids by team
  const organizeBidsByTeam = (bidsByPlayer: BidsByPlayer): TeamBids => {
    const teamBids: TeamBids = {};

    Object.values(bidsByPlayer).forEach((playerData) => {
      playerData.bids.forEach((bid) => {
        if (!teamBids[bid.team_id]) {
          teamBids[bid.team_id] = {
            team: {
              id: bid.team_id,
              name: bid.team_name,
            },
            bids: [],
          };
        }

        teamBids[bid.team_id].bids.push({
          player: playerData.player,
          amount: bid.amount,
          timestamp: bid.created_at,
          won: bid.status === 'won',
        });
      });
    });

    return teamBids;
  };

  const toggleTeam = (teamId: string) => {
    setExpandedTeams((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(teamId)) {
        newSet.delete(teamId);
      } else {
        newSet.add(teamId);
      }
      return newSet;
    });
  };

  const getPositionColor = (position: string) => {
    const positionMap: { [key: string]: string } = {
      GK: 'bg-blue-100 text-blue-800',
      CB: 'bg-green-100 text-green-800',
      RB: 'bg-green-100 text-green-800',
      LB: 'bg-green-100 text-green-800',
      CMF: 'bg-yellow-100 text-yellow-800',
      DMF: 'bg-yellow-100 text-yellow-800',
      AMF: 'bg-purple-100 text-purple-800',
      RMF: 'bg-purple-100 text-purple-800',
      LMF: 'bg-purple-100 text-purple-800',
      RWF: 'bg-purple-100 text-purple-800',
      LWF: 'bg-purple-100 text-purple-800',
      SS: 'bg-orange-100 text-orange-800',
      CF: 'bg-red-100 text-red-800',
    };
    return positionMap[position] || 'bg-gray-100 text-gray-800';
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 85) return 'bg-green-100 text-green-800';
    if (rating >= 75) return 'bg-blue-100 text-blue-800';
    if (rating >= 65) return 'bg-yellow-100 text-yellow-800';
    return 'bg-gray-100 text-gray-800';
  };

  const handleExport = () => {
    setShowLoadingOverlay(true);
    // Simulate export - replace with actual export logic
    setTimeout(() => {
      setShowLoadingOverlay(false);
      alert('Export functionality coming soon!');
    }, 1500);
  };

  if (loading || isLoading || !round) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary/30 border-t-primary mx-auto mb-4"></div>
          <p className="text-gray-700 font-medium">Loading data...</p>
        </div>
      </div>
    );
  }

  const bidsByPlayer = organizeBidsByPlayer();
  const teamBids = organizeBidsByTeam(bidsByPlayer);
  const winningBids = Object.values(bidsByPlayer).filter((p) => p.winningBid);
  const isCompleted = round.status === 'completed';

  return (
    <>
      {/* Loading Overlay */}
      {showLoadingOverlay && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center transition-opacity duration-300">
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4"></div>
            <p className="text-gray-700 font-medium">Exporting data...</p>
          </div>
        </div>
      )}

      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="glass rounded-3xl p-4 sm:p-6 shadow-lg border border-gray-100/30">
          {/* Header & Navigation - hidden on mobile */}
          <div className="flex flex-col gap-4 mb-5 hidden sm:flex">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center">
                <h2 className="text-2xl font-bold text-dark gradient-text flex items-center">
                  Round Details
                  <span className="ml-2 inline-flex items-center justify-center bg-primary/10 text-primary px-2.5 py-1 rounded-full text-sm font-medium">
                    #{round.id.substring(0, 8)}
                  </span>
                </h2>
                <span
                  className={`ml-3 inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                    round.status === 'active'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {round.status === 'active' ? 'Active' : 'Completed'}
                </span>
              </div>
              <div className="text-sm text-gray-600 italic">
                {round.created_at && new Date(round.created_at).toLocaleString()}
              </div>
            </div>

            {/* Navigation Links */}
            <div className="flex flex-wrap gap-3">
              <Link
                href="/dashboard/committee/rounds"
                className="inline-flex items-center px-4 py-2.5 rounded-xl bg-white/60 text-gray-700 hover:bg-white/80 transition-all duration-200 backdrop-blur-sm border border-gray-200/50 shadow-sm touch-action-manipulation transform hover:scale-[1.01] active:scale-[0.99]"
              >
                <svg
                  className="w-5 h-5 mr-1.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                Back to Rounds
              </Link>

              <button
                onClick={handleExport}
                className="inline-flex items-center px-4 py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 transition-all duration-200 shadow-sm touch-action-manipulation transform hover:scale-[1.01] active:scale-[0.99]"
              >
                <svg
                  className="w-5 h-5 mr-1.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                Export to Excel
              </button>
            </div>
          </div>

          {/* Round Summary */}
          <div className="glass rounded-2xl p-4 sm:p-5 mb-5 border border-gray-100/20 bg-white/10 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-300">
            <h3 className="text-lg font-semibold mb-4 text-dark flex items-center">
              <svg
                className="w-5 h-5 mr-2 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Round Summary
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div className="glass rounded-xl p-4 backdrop-blur-sm bg-white/30 hover:bg-white/40 transition-all shadow-sm">
                <h4 className="font-medium mb-1.5 text-gray-600 text-sm">Position</h4>
                <p className="text-lg font-semibold">{round.position}</p>
              </div>

              <div className="glass rounded-xl p-4 backdrop-blur-sm bg-white/30 hover:bg-white/40 transition-all shadow-sm">
                <h4 className="font-medium mb-1.5 text-gray-600 text-sm">Status</h4>
                <p className="text-lg">
                  <span
                    className={`px-2 py-1 rounded-full text-sm font-medium ${
                      round.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {round.status === 'active' ? 'Active' : 'Completed'}
                  </span>
                </p>
              </div>

              <div className="glass rounded-xl p-4 backdrop-blur-sm bg-white/30 hover:bg-white/40 transition-all shadow-sm">
                <h4 className="font-medium mb-1.5 text-gray-600 text-sm">Date/Time</h4>
                <p className="text-lg">
                  {round.created_at && new Date(round.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Winning Bids Section - Only show if completed */}
          {isCompleted && winningBids.length > 0 && (
            <div className="glass rounded-2xl p-4 sm:p-5 mb-5 border border-gray-100/20 bg-white/10 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-300">
              <h3 className="text-lg font-semibold mb-4 text-dark flex items-center">
                <svg
                  className="w-5 h-5 mr-2 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Winning Bids
              </h3>

              {/* Mobile-friendly card view for small screens */}
              <div className="block md:hidden space-y-3">
                {winningBids.map((playerData, index) => {
                  const bid = playerData.winningBid!;
                  const isIncomplete = bid.phase === 'incomplete';
                  const teamInfo = teamBidCounts.find(t => t.team_id === bid.team_id);
                  return (
                    <div
                      key={playerData.player.id}
                      className="glass rounded-xl p-4 backdrop-blur-sm border-l-4 border-green-400/40 hover:shadow-md transition-all duration-200 animate-fade-in"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="flex flex-col space-y-3">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center">
                            <div className="h-8 w-8 flex-shrink-0 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-full flex items-center justify-center mr-2">
                              <span className="text-xs font-medium text-gray-700">
                                {playerData.player.name.substring(0, 2)}
                              </span>
                            </div>
                            <div className="font-medium truncate mr-2 text-base">
                              {playerData.player.name}
                            </div>
                          </div>
                          <div className="text-sm rounded-full px-2.5 py-0.5 bg-white/60 backdrop-blur-sm">
                            {playerData.player.position}
                          </div>
                        </div>
                        {isIncomplete && teamInfo && (
                          <div className="bg-orange-50 border border-orange-200 rounded-lg p-2.5 text-xs">
                            <div className="flex items-start gap-1.5">
                              <svg className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              <div className="text-orange-800">
                                <strong>Incomplete Bid:</strong> {bid.team_name} only submitted {teamInfo.bid_count}/{teamInfo.required_bids} bids. Player assigned at average price of £{bid.amount.toLocaleString()}
                                {bid.actual_bid_amount && (
                                  <span className="block mt-1 text-orange-700">
                                    Original bid: £{bid.actual_bid_amount.toLocaleString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="glass rounded-lg p-2.5 bg-white/40">
                            <div className="text-xs text-gray-600 mb-0.5">Team</div>
                            <div className="font-medium truncate">{bid.team_name}</div>
                          </div>
                          <div className="glass rounded-lg p-2.5 bg-white/40">
                            <div className="text-xs text-gray-600 mb-0.5">Amount</div>
                            <div className="font-semibold text-primary">
                              £{bid.amount.toLocaleString()}
                            </div>
                          </div>
                          <div className="glass rounded-lg p-2.5 bg-white/40">
                            <div className="text-xs text-gray-600 mb-0.5">Rating</div>
                            <div className="flex items-center">
                              <span
                                className={`px-1.5 py-0.5 rounded-md ${getRatingColor(
                                  playerData.player.overall_rating
                                )}`}
                              >
                                {playerData.player.overall_rating}
                              </span>
                            </div>
                          </div>
                          <div className="glass rounded-lg p-2.5 bg-white/40">
                            <div className="text-xs text-gray-600 mb-0.5">Status</div>
                            <div>
                              <span className="px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                Won
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Table for larger screens */}
              <div className="hidden md:block overflow-x-auto rounded-xl shadow-sm border border-gray-100/20">
                <table className="min-w-full divide-y divide-gray-200/50">
                  <thead className="bg-white/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Player
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Position
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Team
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Bid Amount
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Overall Rating
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white/30 divide-y divide-gray-200/50">
                    {winningBids.map((playerData, index) => {
                      const bid = playerData.winningBid!;
                      const isIncomplete = bid.phase === 'incomplete';
                      const teamInfo = teamBidCounts.find(t => t.team_id === bid.team_id);
                      return (
                        <tr
                          key={playerData.player.id}
                          className={`hover:bg-white/50 transition-colors animate-fade-in ${isIncomplete ? 'bg-orange-50/30' : ''}`}
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="h-8 w-8 flex-shrink-0 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-full flex items-center justify-center mr-2">
                                <span className="text-xs font-medium text-gray-700">
                                  {playerData.player.name.substring(0, 2)}
                                </span>
                              </div>
                              <div>
                                <div className="font-medium">{playerData.player.name}</div>
                                {isIncomplete && teamInfo && (
                                  <div className="text-xs text-orange-600 flex items-center gap-1 mt-0.5">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    Incomplete ({teamInfo.bid_count}/{teamInfo.required_bids})
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getPositionColor(
                                playerData.player.position
                              )}`}
                            >
                              {playerData.player.position}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">{bid.team_name}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="font-semibold text-primary">
                              £{bid.amount.toLocaleString()}
                              {isIncomplete && (
                                <span className="text-orange-600 text-xs block font-normal">
                                  (Average price)
                                  {bid.actual_bid_amount && (
                                    <span className="block">Bid: £{bid.actual_bid_amount.toLocaleString()}</span>
                                  )}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-md ${getRatingColor(
                                playerData.player.overall_rating
                              )}`}
                            >
                              {playerData.player.overall_rating}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-center">
                            <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                              Won
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* All Bids Section */}
          <div className="glass rounded-2xl p-4 sm:p-5 mb-5 border border-gray-100/20 bg-white/10 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-300">
            <h3 className="text-lg font-semibold mb-4 text-dark flex items-center">
              <svg
                className="w-5 h-5 mr-2 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              All Bids by Team
            </h3>

            <div className="space-y-4">
              {Object.keys(teamBids).length > 0 ? (
                Object.entries(teamBids).map(([teamId, teamData], index) => {
                  const isExpanded = expandedTeams.has(teamId);
                  const wonCount = teamData.bids.filter((b) => b.won).length;

                  return (
                    <div
                      key={teamId}
                      className="glass rounded-xl overflow-hidden backdrop-blur-sm hover:shadow-md transition-all duration-200 border border-gray-100/20 animate-fade-in"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      {/* Expandable header */}
                      <div
                        className="p-4 bg-white/30 flex justify-between items-center cursor-pointer relative hover:bg-white/40 transition-colors"
                        onClick={() => toggleTeam(teamId)}
                      >
                        <h4 className="text-base font-semibold flex items-center gap-2">
                          <svg
                            className="w-5 h-5 text-primary"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                            />
                          </svg>
                          {teamData.team.name}
                        </h4>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5 pl-2 pr-3 py-1 rounded-full bg-white/30">
                            <svg
                              className="w-4 h-4 text-primary"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z"
                              />
                            </svg>
                            <span className="text-sm font-medium">{teamData.bids.length}</span>
                          </div>
                          {wonCount > 0 && (
                            <div className="flex items-center gap-1.5 pl-2 pr-3 py-1 rounded-full bg-green-100/60">
                              <svg
                                className="w-4 h-4 text-green-600"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                              <span className="text-sm font-medium text-green-700">
                                {wonCount}
                              </span>
                            </div>
                          )}
                          <div
                            className={`bg-white/40 rounded-full h-7 w-7 flex items-center justify-center transition-transform duration-300 ${
                              isExpanded ? 'rotate-180' : ''
                            }`}
                          >
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M19 9l-7 7-7-7"
                              />
                            </svg>
                          </div>
                        </div>
                      </div>

                      {/* Collapsible content */}
                      {isExpanded && (
                        <div className="divide-y divide-gray-100/30 bg-white/5">
                          {teamData.bids
                            .sort(
                              (a, b) =>
                                new Date(b.timestamp).getTime() -
                                new Date(a.timestamp).getTime()
                            )
                            .map((bid, bidIndex) => (
                              <div
                                key={bidIndex}
                                className={`p-4 hover:bg-white/10 transition-colors duration-200 ${
                                  bid.won ? 'border-l-4 border-green-400/40' : ''
                                }`}
                              >
                                <div className="flex justify-between items-start sm:items-center flex-col sm:flex-row gap-2 sm:gap-0">
                                  <div className="flex items-start">
                                    <div className="h-8 w-8 flex-shrink-0 bg-gradient-to-br from-gray-50/30 to-gray-100/30 rounded-full flex items-center justify-center mr-2 mt-0.5">
                                      <span className="text-xs font-medium text-gray-700">
                                        {bid.player.name.substring(0, 2)}
                                      </span>
                                    </div>
                                    <div className="flex flex-col">
                                      <div className="font-medium flex items-center gap-2">
                                        {bid.player.name}
                                        {bid.won && (
                                          <span className="inline-flex items-center justify-center bg-green-100/70 text-green-800 text-xs px-1.5 py-0.5 rounded-full">
                                            Won
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-xs text-gray-500 flex items-center gap-1.5">
                                        <span
                                          className={`px-1.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${getPositionColor(
                                            bid.player.position
                                          )}`}
                                        >
                                          {bid.player.position}
                                        </span>
                                        <span className="flex items-center">
                                          <svg
                                            className="w-3.5 h-3.5 mr-0.5"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                          >
                                            <path
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              strokeWidth="2"
                                              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                            />
                                          </svg>
                                          {new Date(bid.timestamp).toLocaleTimeString()}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex flex-col items-end">
                                    <div
                                      className={`text-lg sm:text-xl font-semibold ${
                                        bid.won ? 'text-green-600' : 'text-gray-700'
                                      }`}
                                    >
                                      £{bid.amount.toLocaleString()}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {new Date(bid.timestamp).toLocaleDateString()}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 glass rounded-xl bg-white/40 backdrop-blur-sm">
                  <svg
                    className="w-12 h-12 mx-auto text-gray-400 mb-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <h3 className="text-base font-medium text-gray-600 mb-1">No bids found</h3>
                  <p className="text-sm text-gray-500">This round has no bidding activity.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          opacity: 0;
          animation: fadeIn 0.5s ease forwards;
        }
        .glass {
          transition: all 0.3s ease;
        }
        .glass:hover {
          box-shadow: 0 10px 20px -10px rgba(0, 0, 0, 0.1);
        }
      `}</style>
    </>
  );
}
