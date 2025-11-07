'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

interface PlayerBid {
  team_id: string;
  team_name: string;
  amount: number;
  status: string;
  is_you: boolean;
  is_winner: boolean;
}

interface Player {
  player_id: string;
  player_name: string;
  position: string;
  overall_rating: number;
  player_team: string;
  phase: 'phase1' | 'phase2' | 'phase3';
  phase_note: string | null;
  winning_bid: {
    amount: number;
    team_id: string;
    team_name: string;
    is_you: boolean;
  };
  your_bid: {
    amount: number;
    status: string;
    won: boolean;
    lost_by: number;
  } | null;
  all_bids: PlayerBid[];
  total_bids: number;
}

interface RoundResult {
  round_id: string;
  round_number: number;
  position: string;
  round_type: string;
  status: string;
  end_time: string;
  created_at: string;
  players: Player[];
  total_players: number;
  your_wins: number;
  your_losses: number;
  no_bids: number;
}

export default function AuctionResultsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [rounds, setRounds] = useState<RoundResult[]>([]);
  const [selectedRound, setSelectedRound] = useState<string>('all');
  const [expandedPlayers, setExpandedPlayers] = useState<Set<string>>(new Set());
  const [expandedOthers, setExpandedOthers] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [seasonId, setSeasonId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'amount' | 'status' | 'name'>('amount');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const fetchSeasonAndResults = async () => {
      if (!user) return;

      try {
        // Get active season
        const seasonsQuery = query(
          collection(db, 'seasons'),
          where('isActive', '==', true),
          limit(1)
        );
        const seasonsSnapshot = await getDocs(seasonsQuery);

        if (seasonsSnapshot.empty) {
          setIsLoading(false);
          return;
        }

        const activeSeason = seasonsSnapshot.docs[0].id;
        setSeasonId(activeSeason);

        // Fetch auction results
        const response = await fetchWithTokenRefresh(
          `/api/team/auction-results?season_id=${activeSeason}`
        );
        const result = await response.json();

        if (result.success) {
          setRounds(result.data.rounds);
          if (result.data.rounds.length > 0) {
            setSelectedRound(result.data.rounds[0].round_id);
          }
        }
      } catch (error) {
        console.error('Error fetching auction results:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSeasonAndResults();
  }, [user]);

  const togglePlayerExpand = (playerId: string) => {
    setExpandedPlayers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(playerId)) {
        newSet.delete(playerId);
      } else {
        newSet.add(playerId);
      }
      return newSet;
    });
  };

  const toggleOthersExpand = (roundId: string) => {
    setExpandedOthers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(roundId)) {
        newSet.delete(roundId);
      } else {
        newSet.add(roundId);
      }
      return newSet;
    });
  };

  const filteredRounds = selectedRound === 'all' 
    ? rounds 
    : rounds.filter(r => r.round_id === selectedRound);

  const sortPlayers = (players: Player[]) => {
    const sorted = [...players];
    switch (sortBy) {
      case 'amount':
        return sorted.sort((a, b) => b.winning_bid.amount - a.winning_bid.amount);
      case 'status':
        return sorted.sort((a, b) => {
          if (a.your_bid?.won && !b.your_bid?.won) return -1;
          if (!a.your_bid?.won && b.your_bid?.won) return 1;
          return 0;
        });
      case 'name':
        return sorted.sort((a, b) => a.player_name.localeCompare(b.player_name));
      default:
        return sorted;
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading results...</p>
        </div>
      </div>
    );
  }

  if (rounds.length === 0) {
    return (
      <div className="min-h-screen py-8 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="glass rounded-3xl p-8 text-center">
            <div className="inline-flex items-center justify-center p-4 bg-gray-100 rounded-full mb-4">
              <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No Completed Rounds Yet</h2>
            <p className="text-gray-600 mb-6">Auction results will appear here after rounds are completed</p>
            <Link
              href="/dashboard/team"
              className="inline-block px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-medium hover:from-orange-600 hover:to-red-600 transition-all"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="container mx-auto max-w-6xl">
        <div className="glass rounded-3xl p-6 sm:p-8 shadow-lg">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Auction Results</h1>
              <p className="text-gray-600 mt-1">{rounds.length} completed rounds</p>
            </div>
            <Link
              href="/dashboard/team"
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
            >
              ← Back
            </Link>
          </div>

          {/* Round Filter Pills */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Filter by Round</h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedRound('all')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  selectedRound === 'all'
                    ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All Rounds
              </button>
              {rounds.map(round => (
                <button
                  key={round.round_id}
                  onClick={() => setSelectedRound(round.round_id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    selectedRound === round.round_id
                      ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Round {round.round_number} - {round.position}
                </button>
              ))}
            </div>
          </div>

          {/* Results for each round */}
          {filteredRounds.map(round => (
            <div key={round.round_id} className="mb-8">
              {/* Round Header */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 mb-4 border border-blue-200">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      Round {round.round_number} - {round.position}
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                      📅 Ended {new Date(round.end_time).toLocaleDateString()} • 
                      {' '}{round.total_players} Players • 
                      {' '}{round.total_players > 0 ? Math.round((round.total_players - round.no_bids) / round.total_players * 100) : 0}% Participation
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <span className="px-3 py-1 rounded-lg bg-green-100 text-green-700 text-sm font-medium">
                      ✅ {round.your_wins} Won
                    </span>
                    <span className="px-3 py-1 rounded-lg bg-red-100 text-red-700 text-sm font-medium">
                      ❌ {round.your_losses} Lost
                    </span>
                  </div>
                </div>
              </div>

              {/* Sort Controls */}
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-600">
                  {round.players.length} player{round.players.length !== 1 ? 's' : ''} in this round
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Sort by:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="amount">Bid Amount</option>
                    <option value="status">Status</option>
                    <option value="name">Player Name</option>
                  </select>
                </div>
              </div>

              {/* Your Result - Show prominently */}
              {(() => {
                const yourPlayer = round.players.find(p => p.winning_bid.is_you);
                const otherPlayers = round.players.filter(p => !p.winning_bid.is_you);
                const isOthersExpanded = expandedOthers.has(round.round_id);

                return (
                  <div className="space-y-4">
                    {/* YOUR RESULT */}
                    {yourPlayer && (
                      <div>
                        <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                          <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Your Result
                        </h3>
                        {/* Render your player card */}
                        {(() => {
                      </div>
                    )}

                    {/* OTHER TEAM RESULTS - Collapsed by default */}
                    {otherPlayers.length > 0 && (
                      <div>
                        <button
                          onClick={() => toggleOthersExpand(round.round_id)}
                          className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium text-gray-700"
                        >
                          <span className="flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            Other Team Results ({otherPlayers.length})
                          </span>
                          <svg 
                            className={`w-5 h-5 transition-transform ${isOthersExpanded ? 'rotate-180' : ''}`} 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        
                        {isOthersExpanded && (
                          <div className="mt-3 space-y-3">
                            {sortPlayers(otherPlayers).map(player => {
                              const isExpanded = expandedPlayers.has(player.player_id);
                              const statusColor = player.your_bid?.won 
                                ? 'border-green-500 bg-green-50/50' 
                                : player.your_bid 
                                ? 'border-red-500 bg-red-50/50' 
                                : 'border-gray-300 bg-gray-50/50';

                              return player; // Just returning for now to fix the map
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          ))}

                    <div key={player.player_id} className={`glass-card rounded-xl border-l-4 ${statusColor} overflow-hidden transition-all`}>
                      {/* Player Card Header */}
                      <div className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            {/* Position Badge */}
                            <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0 ${
                              player.your_bid?.won 
                                ? 'bg-gradient-to-br from-green-500 to-emerald-600' 
                                : player.your_bid 
                                ? 'bg-gradient-to-br from-red-500 to-rose-600'
                                : 'bg-gradient-to-br from-gray-400 to-gray-600'
                            }`}>
                              {player.position}
                            </div>

                            {/* Player Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-bold text-gray-900 text-lg">{player.player_name}</h3>
                                <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 text-xs font-medium">
                                  {player.overall_rating} OVR
                                </span>
                                {player.player_team && (
                                  <span className="text-sm text-gray-600">{player.player_team}</span>
                                )}
                                {/* Phase Badge */}
                                {player.phase && (
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                    player.phase === 'phase1' ? 'bg-green-100 text-green-700' :
                                    player.phase === 'phase2' ? 'bg-orange-100 text-orange-700' :
                                    'bg-purple-100 text-purple-700'
                                  }`}>
                                    {player.phase === 'phase1' ? 'Phase 1: Regular' :
                                     player.phase === 'phase2' ? 'Phase 2: Incomplete' :
                                     'Phase 3: Random'}
                                  </span>
                                )}
                              </div>

                              {/* Phase Note */}
                              {player.phase_note && (
                                <div className="mt-2 p-2 rounded-lg bg-yellow-50 border border-yellow-200">
                                  <p className="text-xs text-yellow-800">
                                    <span className="font-semibold">⚠️ Note:</span> {player.phase_note}
                                  </p>
                                </div>
                              )}

                              {/* Bid Info */}
                              <div className="flex flex-wrap items-center gap-3 mt-2">
                                {player.your_bid ? (
                                  <>
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm text-gray-600">Your Bid:</span>
                                      <span className="font-bold text-gray-900">£{player.your_bid.amount.toLocaleString()}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm text-gray-600">Winner:</span>
                                      {!player.your_bid.won && (
                                        <span className="text-sm text-gray-700 font-medium">{player.winning_bid.team_name} •</span>
                                      )}
                                      <span className={`font-bold ${player.your_bid.won ? 'text-green-600' : 'text-red-600'}`}>
                                        £{player.winning_bid.amount.toLocaleString()}
                                      </span>
                                    </div>
                                    {!player.your_bid.won && player.your_bid.lost_by > 0 && (
                                      <span className="text-sm text-red-600 font-medium">
                                        Lost by £{player.your_bid.lost_by.toLocaleString()}
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-500">No bid placed</span>
                                    <span className="text-sm text-gray-600">• Winner: {player.winning_bid.team_name}</span>
                                    <span className="font-bold text-gray-900">£{player.winning_bid.amount.toLocaleString()}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Status Badge & Expand Button */}
                          <div className="flex items-center gap-2 shrink-0">
                            {player.your_bid && (
                              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                player.your_bid.won 
                                  ? 'bg-green-100 text-green-700' 
                                  : 'bg-red-100 text-red-700'
                              }`}>
                                {player.your_bid.won ? '✓ WON' : '✗ LOST'}
                              </span>
                            )}
                            <button
                              onClick={() => togglePlayerExpand(player.player_id)}
                              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                              title="View all bids"
                            >
                              <svg 
                                className={`w-5 h-5 text-gray-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                                fill="none" 
                                stroke="currentColor" 
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Expanded View - All Bids */}
                      {isExpanded && (
                        <div className="border-t border-gray-200 bg-white/50 p-4">
                          <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            All Bids ({player.total_bids})
                          </h4>
                          <div className="space-y-2">
                            {player.all_bids.map((bid, idx) => (
                              <div 
                                key={idx} 
                                className={`flex items-center justify-between p-3 rounded-lg ${
                                  bid.is_winner 
                                    ? 'bg-green-100 border border-green-300' 
                                    : bid.is_you 
                                    ? 'bg-blue-50 border border-blue-200'
                                    : 'bg-gray-50'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-gray-700">
                                    #{idx + 1}
                                  </span>
                                  <span className={`font-medium ${bid.is_you ? 'text-blue-700' : 'text-gray-900'}`}>
                                    {bid.team_name}
                                    {bid.is_you && ' (You)'}
                                  </span>
                                  {bid.is_winner && (
                                    <span className="px-2 py-0.5 rounded-md bg-green-600 text-white text-xs font-bold">
                                      🏆 WINNER
                                    </span>
                                  )}
                                </div>
                                <div className="font-bold text-gray-900">
                                  £{bid.amount.toLocaleString()}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
