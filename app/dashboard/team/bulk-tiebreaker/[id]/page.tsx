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
}

interface Bid {
  team_id: string;
  team_name: string;
  amount: number;
  timestamp: string;
}

interface Tiebreaker {
  id: string;
  round_id: string;
  player_id: string;
  player_name: string;
  position: string;
  original_amount: number;
  current_highest_bid: number;
  highest_bidder_team_id?: string;
  highest_bidder_team_name?: string;
  status: string;
  my_last_bid?: number;
  bid_history: Bid[];
}

export default function TeamBulkTiebreakerPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const tiebreakerId = params?.id as string;

  const [tiebreaker, setTiebreaker] = useState<Tiebreaker | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [bidAmount, setBidAmount] = useState<string>('');
  const [teamBalance, setTeamBalance] = useState(1000); // Mock balance
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'team') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  // Fetch tiebreaker data
  useEffect(() => {
    const fetchData = async () => {
      if (!tiebreakerId) return;

      setIsLoading(true);
      try {
        // TODO: Replace with actual API calls
        // const response = await fetch(`/api/team/tiebreakers/${tiebreakerId}`);
        // const { success, data } = await response.json();

        // Mock tiebreaker data
        const mockTiebreaker: Tiebreaker = {
          id: tiebreakerId,
          round_id: 'round-1',
          player_id: 'player-1',
          player_name: 'John Doe',
          position: 'FWD',
          original_amount: 10,
          current_highest_bid: 25,
          highest_bidder_team_id: 'team-2',
          highest_bidder_team_name: 'Team Beta',
          status: 'active',
          my_last_bid: 20,
          bid_history: [
            { team_id: 'team-1', team_name: 'Team Alpha', amount: 15, timestamp: new Date(Date.now() - 300000).toISOString() },
            { team_id: 'team-2', team_name: 'Team Beta', amount: 18, timestamp: new Date(Date.now() - 240000).toISOString() },
            { team_id: 'team-1', team_name: 'Team Alpha', amount: 20, timestamp: new Date(Date.now() - 180000).toISOString() },
            { team_id: 'team-2', team_name: 'Team Beta', amount: 25, timestamp: new Date(Date.now() - 120000).toISOString() },
          ],
        };
        setTiebreaker(mockTiebreaker);

        // Mock player data
        const mockPlayer: Player = {
          id: 'player-1',
          name: 'John Doe',
          position: 'FWD',
          team_name: 'Club United',
          overall_rating: 85,
        };
        setPlayer(mockPlayer);

        // Set default bid amount (current highest + 1)
        setBidAmount((mockTiebreaker.current_highest_bid + 1).toString());
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();

    // Poll for updates every 5 seconds
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [tiebreakerId]);

  const handlePlaceBid = async () => {
    if (!tiebreaker) return;

    const amount = parseInt(bidAmount);

    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid bid amount');
      return;
    }

    if (amount <= tiebreaker.current_highest_bid) {
      alert(`Bid must be higher than the current highest bid (£${tiebreaker.current_highest_bid})`);
      return;
    }

    if (amount > teamBalance) {
      alert('Insufficient balance!');
      return;
    }

    if (!confirm(`Place bid of £${amount} for ${tiebreaker.player_name}?`)) {
      return;
    }

    setIsSubmitting(true);
    try {
      // TODO: API call to place bid
      // const response = await fetch(`/api/team/tiebreakers/${tiebreakerId}/bid`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ amount }),
      // });

      alert('Bid placed successfully! (Feature coming soon)');
      
      // Update local state optimistically
      setTiebreaker({
        ...tiebreaker,
        current_highest_bid: amount,
        highest_bidder_team_id: user?.uid,
        highest_bidder_team_name: (user as any)?.teamName || 'Your Team',
        my_last_bid: amount,
        bid_history: [
          ...tiebreaker.bid_history,
          {
            team_id: user?.uid || '',
            team_name: (user as any)?.teamName || 'Your Team',
            amount,
            timestamp: new Date().toISOString(),
          },
        ],
      });

      // Update bid amount to next increment
      setBidAmount((amount + 1).toString());
    } catch (err) {
      console.error('Error placing bid:', err);
      alert('Failed to place bid');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    if (!confirm('Are you sure you want to withdraw from this tiebreaker? You will lose the player.')) {
      return;
    }

    try {
      // TODO: API call to withdraw
      // const response = await fetch(`/api/team/tiebreakers/${tiebreakerId}/withdraw`, {
      //   method: 'POST',
      // });

      alert('Withdrawn successfully! (Feature coming soon)');
      router.push('/dashboard/team');
    } catch (err) {
      console.error('Error withdrawing:', err);
      alert('Failed to withdraw');
    }
  };

  const isMyBid = (teamId: string) => {
    return teamId === user?.uid;
  };

  const isWinning = tiebreaker?.highest_bidder_team_id === user?.uid;

  if (loading || !user || user.role !== 'team' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading tiebreaker...</p>
        </div>
      </div>
    );
  }

  if (!tiebreaker || !player) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Tiebreaker not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="container mx-auto max-w-5xl">
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
              <h1 className="text-3xl md:text-4xl font-bold gradient-text">Tiebreaker Auction</h1>
              <p className="text-gray-600 mt-1">Bidding for contested player</p>
            </div>
          </div>
        </div>

        {/* Status Banner */}
        {isWinning ? (
          <div className="glass rounded-2xl p-6 mb-6 border-2 border-green-300 bg-green-50">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-500 text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-green-900">You're Winning!</h3>
                <p className="text-green-700">Your bid of £{tiebreaker.current_highest_bid} is currently the highest</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="glass rounded-2xl p-6 mb-6 border-2 border-orange-300 bg-orange-50">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-orange-500 text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-orange-900">You're Being Outbid!</h3>
                <p className="text-orange-700">
                  {tiebreaker.highest_bidder_team_name} has the highest bid at £{tiebreaker.current_highest_bid}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Player Card */}
        <div className="glass rounded-2xl p-6 mb-6 border border-white/20">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Player Information</h2>
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
              <svg className="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zm-4 7a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-gray-800 mb-2">{player.name}</h3>
              <div className="flex items-center gap-4 text-sm">
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">
                  {player.position}
                </span>
                <span className="text-gray-600">{player.team_name}</span>
                <span className="text-gray-600">Rating: {player.overall_rating}</span>
              </div>
              <div className="mt-3 text-sm text-gray-600">
                <p>Original bid: £{tiebreaker.original_amount}</p>
                {tiebreaker.my_last_bid && (
                  <p>Your last bid: £{tiebreaker.my_last_bid}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bidding Section */}
        <div className="glass rounded-2xl p-6 mb-6 border border-white/20">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Place Your Bid</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="glass rounded-xl p-4 border border-white/10">
              <div className="text-sm text-gray-600 mb-1">Current Highest Bid</div>
              <div className="text-3xl font-bold text-red-600">£{tiebreaker.current_highest_bid}</div>
              {tiebreaker.highest_bidder_team_name && (
                <div className="text-sm text-gray-600 mt-1">by {tiebreaker.highest_bidder_team_name}</div>
              )}
            </div>

            <div className="glass rounded-xl p-4 border border-white/10">
              <div className="text-sm text-gray-600 mb-1">Your Balance</div>
              <div className="text-3xl font-bold text-green-600">£{teamBalance}</div>
              <div className="text-sm text-gray-600 mt-1">
                Available after bid: £{teamBalance - parseInt(bidAmount || '0')}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Your Bid Amount</label>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <span className="text-gray-500 text-lg">£</span>
                  </div>
                  <input
                    type="number"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    min={tiebreaker.current_highest_bid + 1}
                    className="w-full pl-10 pr-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0066FF] focus:border-[#0066FF]"
                    placeholder="Enter amount"
                  />
                </div>
                <button
                  onClick={() => setBidAmount((tiebreaker.current_highest_bid + 1).toString())}
                  className="px-4 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors text-sm font-medium"
                >
                  Min Bid
                </button>
                <button
                  onClick={() => setBidAmount((tiebreaker.current_highest_bid + 5).toString())}
                  className="px-4 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors text-sm font-medium"
                >
                  +£5
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Minimum bid: £{tiebreaker.current_highest_bid + 1}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handlePlaceBid}
                disabled={isSubmitting || parseInt(bidAmount) <= tiebreaker.current_highest_bid}
                className="flex-1 px-6 py-4 bg-[#0066FF] text-white rounded-xl hover:bg-[#0052CC] transition-colors font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Placing Bid...' : 'Place Bid'}
              </button>
              <button
                onClick={handleWithdraw}
                className="px-6 py-4 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors font-medium"
              >
                Withdraw
              </button>
            </div>
          </div>
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
              <h3 className="text-lg font-bold text-yellow-900 mb-2">How Tiebreaker Auctions Work</h3>
              <ul className="space-y-1 text-sm text-yellow-800">
                <li>• This is an open auction - the highest bidder wins the player</li>
                <li>• You can continue bidding until the committee closes the auction</li>
                <li>• Each bid must be higher than the current highest bid</li>
                <li>• The last team to bid when the auction closes wins the player</li>
                <li>• You can withdraw at any time if you don't want to continue</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bid History */}
        <div className="glass rounded-2xl p-6 border border-white/20">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Bid History</h2>
          
          {tiebreaker.bid_history.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No bids yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {[...tiebreaker.bid_history].reverse().map((bid, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-4 rounded-xl border ${
                    isMyBid(bid.team_id)
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      isMyBid(bid.team_id)
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-300 text-gray-700'
                    }`}>
                      {isMyBid(bid.team_id) ? 'You' : bid.team_name[0]}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">
                        {isMyBid(bid.team_id) ? 'Your Team' : bid.team_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(bid.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900">£{bid.amount}</div>
                    {index === 0 && (
                      <div className="text-xs text-green-600 font-semibold">Highest Bid</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
