'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface LineupHistoryEntry {
  lineup_id: string;
  fixture_id: string;
  team_id: string;
  team_name: string;
  round_number: number;
  match_number: number;
  starting_xi: string[];
  substitutes: string[];
  submitted_by_name: string;
  submitted_at: string;
  is_locked: boolean;
  locked_at?: string;
  selected_by_opponent?: boolean;
}

interface SubstitutionEntry {
  id: number;
  fixture_id: string;
  team_id: string;
  team_name: string;
  round_number: number;
  player_out_name: string;
  player_in_name: string;
  made_at: string;
  made_by_name: string;
  notes?: string;
}

export default function LineupHistoryPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  
  const [seasonId, setSeasonId] = useState<string>('');
  const [seasons, setSeasons] = useState<any[]>([]);
  const [view, setView] = useState<'lineups' | 'substitutions'>('lineups');
  const [lineupHistory, setLineupHistory] = useState<LineupHistoryEntry[]>([]);
  const [substitutionHistory, setSubstitutionHistory] = useState<SubstitutionEntry[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'committee') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && user.role === 'committee') {
      fetchSeasons();
    }
  }, [user]);

  useEffect(() => {
    if (seasonId) {
      if (view === 'lineups') {
        fetchLineupHistory();
      } else {
        fetchSubstitutionHistory();
      }
    }
  }, [seasonId, view]);

  const fetchSeasons = async () => {
    try {
      const response = await fetchWithTokenRefresh('/api/seasons?status=active');
      const data = await response.json();
      if (data.success && data.seasons.length > 0) {
        setSeasons(data.seasons);
        setSeasonId(data.seasons[0].id);
      }
    } catch (err) {
      console.error('Error fetching seasons:', err);
    }
  };

  const fetchLineupHistory = async () => {
    try {
      setLoadingData(true);
      setError(null);

      const response = await fetchWithTokenRefresh(`/api/lineups/history?season_id=${seasonId}`);
      const data = await response.json();

      if (data.success) {
        setLineupHistory(data.history || []);
      } else {
        setError(data.error || 'Failed to load lineup history');
      }
    } catch (err: any) {
      console.error('Error fetching lineup history:', err);
      setError(err.message || 'Failed to load lineup history');
    } finally {
      setLoadingData(false);
    }
  };

  const fetchSubstitutionHistory = async () => {
    try {
      setLoadingData(true);
      setError(null);

      const response = await fetchWithTokenRefresh(`/api/substitutions/history?season_id=${seasonId}`);
      const data = await response.json();

      if (data.success) {
        setSubstitutionHistory(data.history || []);
      } else {
        setError(data.error || 'Failed to load substitution history');
      }
    } catch (err: any) {
      console.error('Error fetching substitution history:', err);
      setError(err.message || 'Failed to load substitution history');
    } finally {
      setLoadingData(false);
    }
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'committee') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 py-8 px-4">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/dashboard/committee"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white text-gray-700 hover:text-blue-600 font-medium transition-all rounded-lg shadow-sm hover:shadow-md"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </Link>
        </div>

        {/* Title */}
        <div className="glass rounded-2xl p-6 mb-6 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-xl">
              <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                Lineup History & Audit Log
              </h1>
              <p className="text-gray-600 mt-1">Track all lineup submissions and substitutions</p>
            </div>
          </div>
        </div>

        {/* Filters & View Toggle */}
        <div className="glass rounded-2xl p-6 mb-6 shadow-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Season</label>
              <select
                value={seasonId}
                onChange={(e) => setSeasonId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {seasons.map(season => (
                  <option key={season.id} value={season.id}>
                    {season.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">View</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setView('lineups')}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                    view === 'lineups'
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg'
                      : 'bg-white text-gray-700 border border-gray-300 hover:border-purple-400'
                  }`}
                >
                  Lineup Submissions
                </button>
                <button
                  onClick={() => setView('substitutions')}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                    view === 'substitutions'
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg'
                      : 'bg-white text-gray-700 border border-gray-300 hover:border-purple-400'
                  }`}
                >
                  Substitutions
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Lineup History Table */}
        {view === 'lineups' && (
          <div className="glass rounded-2xl overflow-hidden shadow-lg">
            <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Lineup Submissions</h2>
              <p className="text-sm text-gray-600">Total: {lineupHistory.length}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-800">Round</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-800">Team</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-800">Starting XI</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-800">Subs</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-800">Submitted By</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-800">Submitted At</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-800">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white/50">
                  {lineupHistory.map((entry, idx) => (
                    <tr key={entry.lineup_id} className={idx % 2 === 0 ? 'bg-white/30' : 'bg-white/50'}>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">R{entry.round_number}</div>
                        <div className="text-xs text-gray-500">M{entry.match_number}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{entry.team_name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-700">{entry.starting_xi.length} players</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-700">{entry.substitutes.length} players</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-700">{entry.submitted_by_name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-700">
                          {new Date(entry.submitted_at).toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {entry.selected_by_opponent ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-500 text-white">
                            Opponent Selected
                          </span>
                        ) : entry.is_locked ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-400 text-white">
                            🔒 Locked
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-500 text-white">
                            ✓ Submitted
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Substitution History Table */}
        {view === 'substitutions' && (
          <div className="glass rounded-2xl overflow-hidden shadow-lg">
            <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Match Substitutions</h2>
              <p className="text-sm text-gray-600">Total: {substitutionHistory.length}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-800">Round</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-800">Team</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-800">Player Out</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-800">Player In</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-800">Made By</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-800">Made At</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-800">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white/50">
                  {substitutionHistory.map((entry, idx) => (
                    <tr key={entry.id} className={idx % 2 === 0 ? 'bg-white/30' : 'bg-white/50'}>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">R{entry.round_number}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{entry.team_name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-red-600 font-medium">⬅️ {entry.player_out_name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-green-600 font-medium">➡️ {entry.player_in_name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-700">{entry.made_by_name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-700">
                          {new Date(entry.made_at).toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-600">{entry.notes || '-'}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
