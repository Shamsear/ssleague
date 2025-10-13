'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Player {
  id: string;
  name: string;
  position: string;
  team_name: string;
  overall_rating: number;
  playing_style?: string;
  is_starred?: boolean;
}

interface BulkRound {
  id: number;
  round_number: number;
  status: string;
  base_price: number;
  start_time?: string;
  end_time?: string;
  duration_seconds: number;
  player_count: number;
}

export default function TeamBulkRoundPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const roundId = params?.id as string;

  const [bulkRound, setBulkRound] = useState<BulkRound | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [teamBalance, setTeamBalance] = useState(1000); // Mock balance
  const [filterPosition, setFilterPosition] = useState<string>('all');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'team') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  // Fetch round and players
  useEffect(() => {
    const fetchData = async () => {
      if (!roundId) return;

      setIsLoading(true);
      try {
        // TODO: Replace with actual API calls
        // const response = await fetch(`/api/team/bulk-rounds/${roundId}`);
        // const { success, data } = await response.json();

        // Mock round data
        const mockRound: BulkRound = {
          id: parseInt(roundId),
          round_number: 1,
          status: 'active',
          base_price: 10,
          start_time: new Date().toISOString(),
          end_time: new Date(Date.now() + 3600000).toISOString(),
          duration_seconds: 3600,
          player_count: 20,
        };
        setBulkRound(mockRound);

        // Mock players data
        const mockPlayers: Player[] = Array.from({ length: 20 }, (_, i) => ({
          id: `player-${i + 1}`,
          name: `Player ${i + 1}`,
          position: ['GK', 'DEF', 'MID', 'FWD'][Math.floor(Math.random() * 4)],
          team_name: `Team ${String.fromCharCode(65 + Math.floor(Math.random() * 5))}`,
          overall_rating: 70 + Math.floor(Math.random() * 20),
          playing_style: ['Defensive', 'Balanced', 'Attacking'][Math.floor(Math.random() * 3)],
          is_starred: Math.random() > 0.7,
        }));
        setPlayers(mockPlayers);
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [roundId]);

  // Timer countdown
  useEffect(() => {
    if (bulkRound?.status === 'active' && bulkRound.end_time) {
      const timer = setInterval(() => {
        const now = new Date().getTime();
        const end = new Date(bulkRound.end_time!).getTime();
        const remaining = Math.max(0, Math.floor((end - now) / 1000));
        setTimeRemaining(remaining);
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [bulkRound]);

  const handleTogglePlayer = (playerId: string) => {
    const newSelected = new Set(selectedPlayers);
    if (newSelected.has(playerId)) {
      newSelected.delete(playerId);
    } else {
      newSelected.add(playerId);
    }
    setSelectedPlayers(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedPlayers.size === filteredPlayers.length) {
      setSelectedPlayers(new Set());
    } else {
      setSelectedPlayers(new Set(filteredPlayers.map(p => p.id)));
    }
  };

  const handleSubmitBids = async () => {
    if (selectedPlayers.size === 0) {
      alert('Please select at least one player');
      return;
    }

    const totalCost = selectedPlayers.size * (bulkRound?.base_price || 10);
    if (totalCost > teamBalance) {
      alert('Insufficient balance!');
      return;
    }

    if (!confirm(`Submit bids for ${selectedPlayers.size} player(s) at £${bulkRound?.base_price} each (Total: £${totalCost})?`)) {
      return;
    }

    try {
      // TODO: API call to submit bulk bids
      // const response = await fetch(`/api/team/bulk-rounds/${roundId}/bids`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ player_ids: Array.from(selectedPlayers) }),
      // });

      alert('Bids submitted successfully! (Feature coming soon)');
      setSelectedPlayers(new Set());
    } catch (err) {
      console.error('Error submitting bids:', err);
      alert('Failed to submit bids');
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimerColor = () => {
    if (timeRemaining === 0) return 'text-red-600';
    if (timeRemaining < 300) return 'text-red-600 animate-pulse';
    if (timeRemaining < 600) return 'text-orange-500';
    return 'text-green-600';
  };

  const filteredPlayers = players.filter(player => {
    const matchesSearch = player.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPosition = filterPosition === 'all' || player.position === filterPosition;
    return matchesSearch && matchesPosition;
  });

  const sortedPlayers = [...filteredPlayers].sort((a, b) => {
    if (a.is_starred && !b.is_starred) return -1;
    if (!a.is_starred && b.is_starred) return 1;
    return b.overall_rating - a.overall_rating;
  });

  const totalCost = selectedPlayers.size * (bulkRound?.base_price || 10);
  const remainingBalance = teamBalance - totalCost;

  if (loading || !user || user.role !== 'team' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading bulk round...</p>
        </div>
      </div>
    );
  }

  if (!bulkRound) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Bulk round not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Link
              href="/dashboard/team"
              className="text-gray-500 hover:text-[#0066FF] transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div className="flex-1">
              <h1 className="text-3xl md:text-4xl font-bold gradient-text">
                Bulk Round {bulkRound.round_number}
              </h1>
              <p className="text-gray-600 mt-1">Select players to bid at £{bulkRound.base_price} each</p>
            </div>
          </div>
        </div>

        {/* Timer and Info Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="glass rounded-xl p-4 border border-white/20">
            <div className="text-sm text-gray-600 mb-1">Time Remaining</div>
            <div className={`text-2xl font-bold font-mono ${getTimerColor()}`}>
              {formatTime(timeRemaining)}
            </div>
          </div>

          <div className="glass rounded-xl p-4 border border-white/20">
            <div className="text-sm text-gray-600 mb-1">Base Price</div>
            <div className="text-2xl font-bold text-gray-800">£{bulkRound.base_price}</div>
          </div>

          <div className="glass rounded-xl p-4 border border-white/20">
            <div className="text-sm text-gray-600 mb-1">Your Balance</div>
            <div className="text-2xl font-bold text-green-600">£{teamBalance}</div>
          </div>

          <div className="glass rounded-xl p-4 border border-white/20">
            <div className="text-sm text-gray-600 mb-1">Selected</div>
            <div className="text-2xl font-bold text-blue-600">{selectedPlayers.size}</div>
          </div>
        </div>

        {/* Cost Summary */}
        {selectedPlayers.size > 0 && (
          <div className="glass rounded-2xl p-6 mb-6 border-2 border-blue-300 bg-blue-50">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-blue-900 mb-1">Bid Summary</h3>
                <p className="text-blue-700">
                  {selectedPlayers.size} player(s) × £{bulkRound.base_price} = £{totalCost}
                </p>
                <p className="text-sm text-blue-600 mt-1">
                  Remaining balance after bids: £{remainingBalance}
                </p>
              </div>
              <button
                onClick={handleSubmitBids}
                disabled={remainingBalance < 0}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Submit Bids
              </button>
            </div>
          </div>
        )}

        {/* Info Card */}
        <div className="glass rounded-2xl p-6 mb-6 border border-white/20">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">How Bulk Bidding Works</h3>
              <ul className="space-y-1 text-sm text-gray-700">
                <li>• Select any number of players you want to bid on</li>
                <li>• All bids are placed at the fixed base price of £{bulkRound.base_price}</li>
                <li>• If you're the only bidder, you get the player automatically</li>
                <li>• If multiple teams bid on the same player, a tiebreaker auction will be held</li>
                <li>• You can change your selections until you submit</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Filters and Controls */}
        <div className="glass rounded-2xl p-4 mb-6 border border-white/20">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search players..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0066FF] focus:border-[#0066FF]"
              />
            </div>
            <div className="flex gap-2">
              {['all', 'GK', 'DEF', 'MID', 'FWD'].map((pos) => (
                <button
                  key={pos}
                  onClick={() => setFilterPosition(pos)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    filterPosition === pos
                      ? 'bg-[#0066FF] text-white'
                      : 'bg-white/50 text-gray-700 hover:bg-white/80'
                  }`}
                >
                  {pos === 'all' ? 'All' : pos}
                </button>
              ))}
            </div>
            <button
              onClick={handleSelectAll}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
            >
              {selectedPlayers.size === filteredPlayers.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
        </div>

        {/* Players List */}
        <div className="glass rounded-2xl p-6 border border-white/20">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            Available Players ({filteredPlayers.length})
          </h2>

          {sortedPlayers.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <p className="text-gray-600 font-medium">No players found</p>
              <p className="text-sm text-gray-500 mt-2">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedPlayers.map((player) => (
                <button
                  key={player.id}
                  onClick={() => handleTogglePlayer(player.id)}
                  className={`glass rounded-xl p-4 border-2 transition-all text-left hover:shadow-lg ${
                    selectedPlayers.has(player.id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-white/20 hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-gray-800">{player.name}</h3>
                        {player.is_starred && (
                          <svg className="w-4 h-4 text-yellow-500 fill-current" viewBox="0 0 24 24">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                          {player.position}
                        </span>
                        <span>•</span>
                        <span>{player.team_name}</span>
                      </div>
                    </div>
                    <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                      selectedPlayers.has(player.id)
                        ? 'bg-blue-600 border-blue-600'
                        : 'border-gray-300'
                    }`}>
                      {selectedPlayers.has(player.id) && (
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Rating: {player.overall_rating}</span>
                    <span className="text-xs text-gray-500">{player.playing_style}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
