'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

export default function PopulateFantasyPlayersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const leagueId = params?.leagueId as string;

  const [league, setLeague] = useState<any>(null);
  const [isPopulating, setIsPopulating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }
    if (!loading && user && user.role !== 'committee_admin' && user.role !== 'super_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const loadLeague = async () => {
      if (!leagueId) return;

      try {
        const response = await fetchWithTokenRefresh(`/api/fantasy/leagues/${leagueId}`);
        if (!response.ok) throw new Error('League not found');
        
        const data = await response.json();
        setLeague(data.league);
      } catch (error) {
        console.error('Error loading league:', error);
        setError('Failed to load fantasy league');
      }
    };

    if (user) {
      loadLeague();
    }
  }, [user, leagueId]);

  const handlePopulate = async () => {
    if (!league) return;

    setIsPopulating(true);
    setError('');
    setResult(null);

    try {
      const response = await fetchWithTokenRefresh('/api/fantasy/players/populate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          league_id: leagueId,
          season_id: league.season_id
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to populate players');
      }

      setResult(data);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to populate players');
    } finally {
      setIsPopulating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <Link
          href={`/dashboard/committee/fantasy/${leagueId}`}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors mb-6"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to League Dashboard
        </Link>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Populate Fantasy Players
            </h1>
            <p className="text-gray-600">
              {league ? `${league.season_name} - ${league.league_name}` : 'Loading...'}
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-900 mb-2">ℹ️ What does this do?</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Copies all players from <code className="bg-blue-100 px-1 rounded">player_seasons</code> table</li>
              <li>• Creates fantasy player entries with draft prices based on star ratings</li>
              <li>• Makes players available for teams to draft</li>
              <li>• <strong>Run this before teams start drafting!</strong></li>
            </ul>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-800 font-medium">❌ {error}</p>
            </div>
          )}

          {result && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-green-900 mb-3">✅ Success!</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-white rounded p-3">
                  <p className="text-gray-600">Found in player_seasons</p>
                  <p className="text-2xl font-bold text-gray-900">{result.stats?.found_in_player_seasons || 0}</p>
                </div>
                <div className="bg-white rounded p-3">
                  <p className="text-gray-600">Inserted/Updated</p>
                  <p className="text-2xl font-bold text-green-600">{result.stats?.inserted_or_updated || 0}</p>
                </div>
                <div className="bg-white rounded p-3">
                  <p className="text-gray-600">Skipped</p>
                  <p className="text-2xl font-bold text-yellow-600">{result.stats?.skipped || 0}</p>
                </div>
                <div className="bg-white rounded p-3">
                  <p className="text-gray-600">Total in Database</p>
                  <p className="text-2xl font-bold text-indigo-600">{result.stats?.total_in_database || 0}</p>
                </div>
              </div>
              {result.errors && result.errors.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-red-700 mb-2">Errors ({result.errors.length}):</p>
                  <div className="max-h-32 overflow-y-auto text-xs text-red-600 bg-red-50 rounded p-2">
                    {result.errors.map((err: string, i: number) => (
                      <div key={i}>{err}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            onClick={handlePopulate}
            disabled={isPopulating || !league}
            className="w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPopulating ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Populating Players...
              </span>
            ) : (
              '🎮 Populate Fantasy Players'
            )}
          </button>

          <div className="mt-6 text-center text-sm text-gray-500">
            <p>This will populate players from the current season's player_seasons table.</p>
            <p>You can run this multiple times - it will update existing players.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
