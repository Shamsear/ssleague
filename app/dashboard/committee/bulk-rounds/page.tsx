'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

interface BulkRound {
  id: number;
  season_id: string;
  round_number: number;
  status: string;
  base_price: number;
  start_time?: string;
  end_time?: string;
  duration_seconds: number;
  player_count: number;
  sold_count: number;
  created_at: string;
}

export default function BulkRoundsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [bulkRounds, setBulkRounds] = useState<BulkRound[]>([]);
  const [currentSeasonId, setCurrentSeasonId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Form state
  const [formData, setFormData] = useState({
    base_price: '10',
    duration_hours: '0',
    duration_minutes: '5',
    duration_seconds: '0',
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'committee_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  // Fetch current season
  useEffect(() => {
    const fetchCurrentSeason = async () => {
      if (!user || user.role !== 'committee_admin') return;

      try {
        const seasonsQuery = query(
          collection(db, 'seasons'),
          where('isActive', '==', true),
          limit(1)
        );
        const seasonsSnapshot = await getDocs(seasonsQuery);

        if (!seasonsSnapshot.empty) {
          const seasonId = seasonsSnapshot.docs[0].id;
          setCurrentSeasonId(seasonId);
        }
      } catch (err) {
        console.error('Error fetching season:', err);
      }
    };

    fetchCurrentSeason();
  }, [user]);

  // Fetch bulk rounds
  useEffect(() => {
    const fetchBulkRounds = async () => {
      if (!currentSeasonId) return;

      setIsLoading(true);
      try {
        const params = new URLSearchParams({ 
          season_id: currentSeasonId,
          round_type: 'bulk'
        });
        if (filterStatus !== 'all') {
          params.append('status', filterStatus);
        }

        const response = await fetch(`/api/rounds?${params}`);
        const { success, data } = await response.json();

        if (success) {
          setBulkRounds(data);
        }
      } catch (err) {
        console.error('Error fetching bulk rounds:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBulkRounds();
  }, [currentSeasonId, filterStatus]);

  const handleCreateBulkRound = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentSeasonId) {
      alert('No active season found');
      return;
    }

    // Get next round number
    const nextRoundNumber = bulkRounds.length > 0 
      ? Math.max(...bulkRounds.map(r => r.round_number)) + 1 
      : 1;

    try {
      const response = await fetch('/api/rounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          season_id: currentSeasonId,
          round_number: nextRoundNumber,
          round_type: 'bulk',
          base_price: parseInt(formData.base_price),
          duration_hours: parseInt(formData.duration_hours),
          duration_minutes: parseInt(formData.duration_minutes),
          duration_seconds: parseInt(formData.duration_seconds),
        }),
      });

      const { success, data, error } = await response.json();

      if (success) {
        alert('Bulk round created successfully!');
        setShowCreateForm(false);
        setFormData({
          base_price: '10',
          duration_hours: '0',
          duration_minutes: '5',
          duration_seconds: '0',
        });
        // Refresh rounds
        const params = new URLSearchParams({ 
          season_id: currentSeasonId,
          round_type: 'bulk'
        });
        const refreshResponse = await fetch(`/api/rounds?${params}`);
        const refreshData = await refreshResponse.json();
        if (refreshData.success) {
          setBulkRounds(refreshData.data);
        }
      } else {
        alert(`Error: ${error}`);
      }
    } catch (err) {
      console.error('Error creating bulk round:', err);
      alert('Failed to create bulk round');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-700';
      case 'scheduled': return 'bg-blue-100 text-blue-700';
      case 'active': return 'bg-green-100 text-green-700 animate-pulse';
      case 'completed': return 'bg-purple-100 text-purple-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getActiveRound = () => {
    return bulkRounds.find(r => r.status === 'active');
  };

  if (loading || !user || user.role !== 'committee_admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const activeRound = getActiveRound();

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Link
              href="/dashboard/committee"
              className="text-gray-500 hover:text-[#0066FF] transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <h1 className="text-3xl md:text-4xl font-bold gradient-text flex items-center">
              <svg className="w-8 h-8 mr-3 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Bulk Bidding Rounds
            </h1>
          </div>
          <p className="text-gray-600">Manage bulk bidding rounds where teams can bid on multiple players simultaneously</p>
        </div>

        {/* Active Round Alert */}
        {activeRound && (
          <div className="glass rounded-2xl p-6 mb-6 border-2 border-green-300 bg-green-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-green-500 text-white">
                  <svg className="w-6 h-6 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-green-900">Active Bulk Round</h3>
                  <p className="text-green-700">Round {activeRound.round_number} is currently active with {activeRound.player_count} players</p>
                </div>
              </div>
              <Link
                href={`/dashboard/committee/bulk-rounds/${activeRound.id}`}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
              >
                Manage Round
              </Link>
            </div>
          </div>
        )}

        {/* Info Card */}
        <div className="glass rounded-2xl p-6 mb-6 border border-white/20">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            How Bulk Bidding Works
          </h2>
          <div className="space-y-3">
            <div className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#0066FF]/20 text-[#0066FF] flex items-center justify-center text-sm font-bold mr-3 mt-0.5">1</span>
              <p className="text-gray-700">
                <strong>Fixed Price Bidding:</strong> Teams can bid on multiple players at a fixed base price during the round duration.
              </p>
            </div>
            <div className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#0066FF]/20 text-[#0066FF] flex items-center justify-center text-sm font-bold mr-3 mt-0.5">2</span>
              <p className="text-gray-700">
                <strong>Conflict Resolution:</strong> If multiple teams bid for the same player, a tiebreaker auction will be held.
              </p>
            </div>
            <div className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#0066FF]/20 text-[#0066FF] flex items-center justify-center text-sm font-bold mr-3 mt-0.5">3</span>
              <p className="text-gray-700">
                <strong>Quick Assignment:</strong> This helps teams fill remaining slots efficiently and ensures all players get assigned.
              </p>
            </div>
          </div>
        </div>

        {/* Actions Bar */}
        <div className="glass rounded-2xl p-4 mb-6 border border-white/20">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Filter:</span>
              {['all', 'draft', 'scheduled', 'active', 'completed'].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    filterStatus === status
                      ? 'bg-[#0066FF] text-white'
                      : 'bg-white/50 text-gray-700 hover:bg-white/80'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              disabled={!!activeRound}
              className="inline-flex items-center px-4 py-2 bg-[#0066FF] text-white rounded-lg hover:bg-[#0052CC] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              title={activeRound ? 'Cannot create while a round is active' : 'Create new bulk round'}
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Create Bulk Round
            </button>
          </div>
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <div className="glass rounded-2xl p-6 mb-6 border border-white/20">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Create New Bulk Bidding Round</h2>
            <form onSubmit={handleCreateBulkRound} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Base Price (£)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500">£</span>
                  </div>
                  <input
                    type="number"
                    required
                    value={formData.base_price}
                    onChange={(e) => setFormData({ ...formData, base_price: e.target.value })}
                    className="w-full pl-10 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0066FF] focus:border-[#0066FF]"
                    min="1"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">Fixed price for all players in this round</p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <svg className="inline h-5 w-5 text-gray-400 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Round Duration
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Hours</label>
                    <input
                      type="number"
                      value={formData.duration_hours}
                      onChange={(e) => setFormData({ ...formData, duration_hours: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0066FF] focus:border-[#0066FF] text-center"
                      min="0"
                      max="72"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Minutes</label>
                    <input
                      type="number"
                      value={formData.duration_minutes}
                      onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0066FF] focus:border-[#0066FF] text-center"
                      min="0"
                      max="59"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Seconds</label>
                    <input
                      type="number"
                      value={formData.duration_seconds}
                      onChange={(e) => setFormData({ ...formData, duration_seconds: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0066FF] focus:border-[#0066FF] text-center"
                      min="0"
                      max="59"
                    />
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Total: {parseInt(formData.duration_hours) * 3600 + parseInt(formData.duration_minutes) * 60 + parseInt(formData.duration_seconds)} seconds
                  ({parseInt(formData.duration_hours)}h {parseInt(formData.duration_minutes)}m {parseInt(formData.duration_seconds)}s)
                </p>
              </div>

              <div className="md:col-span-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-[#0066FF] text-white rounded-lg hover:bg-[#0052CC] transition-colors font-medium"
                >
                  Create Bulk Round
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Rounds List */}
        <div className="glass rounded-2xl p-6 border border-white/20">
          <h2 className="text-xl font-bold text-gray-800 mb-4">All Bulk Rounds</h2>

          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading bulk rounds...</p>
            </div>
          ) : bulkRounds.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <h3 className="text-xl font-medium text-gray-600 mb-2">No bulk rounds found</h3>
              <p className="text-gray-500">Create your first bulk bidding round to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {bulkRounds.map((round) => (
                <Link
                  key={round.id}
                  href={`/dashboard/committee/bulk-rounds/${round.id}`}
                  className="block glass p-4 rounded-xl border border-white/10 hover:border-[#0066FF]/30 transition-all hover:shadow-lg"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-gray-800">Bulk Round {round.round_number}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(round.status)}`}>
                          {round.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                        <span className="flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          £{round.base_price}
                        </span>
                        <span className="flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {round.duration_seconds}s
                        </span>
                        <span className="flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                          {round.player_count} players
                        </span>
                        {round.sold_count > 0 && (
                          <span className="flex items-center text-green-600">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {round.sold_count} sold
                          </span>
                        )}
                        {round.start_time && (
                          <span className="flex items-center text-gray-500">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {new Date(round.start_time).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
