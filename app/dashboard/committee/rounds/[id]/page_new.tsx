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
}

interface BidStat {
  player_id: string;
  player_name: string;
  position: string;
  bid_count: number;
  highest_bid: number;
  lowest_bid: number;
  teams_count: number;
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
  bidStats: BidStat[];
}

export default function RoundDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { id: roundId } = use(params);
  const [round, setRound] = useState<Round | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddPlayers, setShowAddPlayers] = useState(false);
  const [availablePlayers, setAvailablePlayers] = useState<any[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

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

  // Fetch available players when adding
  useEffect(() => {
    const fetchAvailablePlayers = async () => {
      if (!showAddPlayers) return;

      try {
        const response = await fetch('/api/players?is_auction_eligible=true');
        const { success, data } = await response.json();

        if (success) {
          // Filter out players already bid on in this round
          const currentPlayerIds = round?.bids?.map(b => b.player_id) || [];
          const available = data.filter((p: any) => !currentPlayerIds.includes(p.id));
          setAvailablePlayers(available);
        }
      } catch (err) {
        console.error('Error fetching players:', err);
      }
    };

    fetchAvailablePlayers();
  }, [showAddPlayers, round]);

  const handleUpdateStatus = async (newStatus: string) => {
    if (!round) return;

    const confirmMessage = `Are you sure you want to change the round status to "${newStatus}"?`;
    if (!confirm(confirmMessage)) return;

    try {
      const response = await fetch(`/api/rounds/${round.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      const { success, data } = await response.json();

      if (success) {
        setRound({ ...round, ...data });
        alert(`Round status updated to ${newStatus}`);
      }
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Failed to update status');
    }
  };

  const handleDeleteRound = async () => {
    if (!round) return;

    if (round.status === 'active' || round.status === 'completed') {
      alert('Cannot delete active or completed rounds');
      return;
    }

    const confirmMessage = 'Are you sure you want to delete this round? This action cannot be undone.';
    if (!confirm(confirmMessage)) return;

    try {
      const response = await fetch(`/api/rounds/${round.id}`, {
        method: 'DELETE',
      });

      const { success } = await response.json();

      if (success) {
        alert('Round deleted successfully');
        router.push('/dashboard/committee/rounds');
      }
    } catch (err) {
      console.error('Error deleting round:', err);
      alert('Failed to delete round');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-700 border-gray-300';
      case 'scheduled': return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'active': return 'bg-green-100 text-green-700 border-green-300';
      case 'completed': return 'bg-purple-100 text-purple-700 border-purple-300';
      case 'cancelled': return 'bg-red-100 text-red-700 border-red-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const filteredPlayers = availablePlayers.filter(p =>
    p.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.position?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading || isLoading || !round) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
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
              href="/dashboard/committee/rounds"
              className="text-gray-500 hover:text-[#0066FF] transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <h1 className="text-3xl md:text-4xl font-bold gradient-text">{round.position} Round</h1>
            <span className={`px-3 py-1.5 rounded-full text-sm font-medium border ${getStatusColor(round.status)}`}>
              {round.status}
            </span>
          </div>
          <p className="text-gray-600">Manage players and control auction round</p>
        </div>

        {/* Round Info Card */}
        <div className="glass rounded-2xl p-6 mb-6 border border-white/20">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Round Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Position</label>
              <p className="text-lg font-semibold text-gray-800">{round.position}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Max Bids Per Team</label>
              <p className="text-lg font-semibold text-gray-800">{round.max_bids_per_team}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Total Bids</label>
              <p className="text-lg font-semibold text-gray-800">{round.bids?.length || 0}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Unique Players</label>
              <p className="text-lg font-semibold text-gray-800">{new Set(round.bids?.map(b => b.player_id) || []).size}</p>
            </div>
          </div>

          {/* Status Controls */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <label className="block text-sm font-medium text-gray-600 mb-3">Round Status Controls</label>
            <div className="flex flex-wrap gap-2">
              {round.status === 'draft' && (
                <>
                  <button
                    onClick={() => handleUpdateStatus('scheduled')}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
                  >
                    Schedule Round
                  </button>
                  <button
                    onClick={() => handleUpdateStatus('active')}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium"
                  >
                    Start Round Now
                  </button>
                </>
              )}
              {round.status === 'scheduled' && (
                <>
                  <button
                    onClick={() => handleUpdateStatus('active')}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium"
                  >
                    Start Round
                  </button>
                  <button
                    onClick={() => handleUpdateStatus('draft')}
                    className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium"
                  >
                    Back to Draft
                  </button>
                </>
              )}
              {round.status === 'active' && (
                <button
                  onClick={() => handleUpdateStatus('completed')}
                  className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors font-medium"
                >
                  Complete Round
                </button>
              )}
              {(round.status === 'draft' || round.status === 'scheduled') && (
                <button
                  onClick={handleDeleteRound}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium ml-auto"
                >
                  Delete Round
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Bids Section */}
        <div className="glass rounded-2xl p-6 border border-white/20">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-800">Round Bids</h2>
          </div>

          {/* Bids List */}
          {!round.bids || round.bids.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-xl font-medium text-gray-600 mb-2">No bids placed</h3>
              <p className="text-gray-500">Bids will appear here once teams start bidding</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Player Name</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Team</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Position</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Rating</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Bid Amount</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {round.bids.map((bid) => (
                    <tr key={bid.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium text-gray-800">{bid.player_name}</td>
                      <td className="py-3 px-4 text-gray-600">{bid.team_name}</td>
                      <td className="py-3 px-4 text-gray-600">{bid.position}</td>
                      <td className="py-3 px-4 text-gray-600">{bid.overall_rating}</td>
                      <td className="py-3 px-4 font-semibold text-gray-800">£{bid.amount.toLocaleString()}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          bid.status === 'accepted' ? 'bg-green-100 text-green-700' :
                          bid.status === 'rejected' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {bid.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600 text-sm">
                        {new Date(bid.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
