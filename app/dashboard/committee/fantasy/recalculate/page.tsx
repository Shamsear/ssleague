'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

export default function FantasyRecalculatePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'committee' && user.role !== 'superadmin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const startRecalculation = async () => {
    if (!confirm('Are you sure you want to recalculate all fantasy points? This will:\n\n1. Recalculate all player points\n2. Recalculate all passive team bonuses\n3. Update squad totals\n4. Update team totals and ranks\n\nThis may take a few minutes.')) {
      return;
    }

    setIsRecalculating(true);
    setProgress('Starting recalculation...');
    setLogs([]);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetchWithTokenRefresh('/api/admin/fantasy/recalculate-all-points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Recalculation failed');
      }

      const data = await response.json();
      
      setProgress('Recalculation completed successfully!');
      setLogs(data.logs || []);
      setSuccess(true);
    } catch (err) {
      console.error('Recalculation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to recalculate points');
      setProgress('Recalculation failed');
    } finally {
      setIsRecalculating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <Link href="/dashboard/committee/fantasy" className="text-blue-600 hover:underline mb-2 inline-block">
          ← Back to Fantasy Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Recalculate Fantasy Points</h1>
        <p className="text-gray-600 mt-1">Recalculate all fantasy points, bonuses, and rankings</p>
      </div>

      {/* Warning Card */}
      <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-6 mb-6">
        <div className="flex items-start gap-3">
          <svg className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <h3 className="font-bold text-yellow-900 mb-2">Important Information</h3>
            <ul className="text-sm text-yellow-800 space-y-1">
              <li>• This will recalculate ALL fantasy points from scratch</li>
              <li>• Player points will be recalculated with captain/VC multipliers</li>
              <li>• Passive team bonuses will be recalculated from fixture results</li>
              <li>• Admin bonuses will be included in totals</li>
              <li>• Team rankings will be updated</li>
              <li>• This process may take 1-2 minutes</li>
            </ul>
          </div>
        </div>
      </div>

      {/* What Gets Recalculated */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">What Gets Recalculated</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">⚽</span>
              <h3 className="font-semibold text-gray-900">Player Points</h3>
            </div>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Match performance points</li>
              <li>• Captain multipliers (2x)</li>
              <li>• Vice-Captain multipliers (1.5x)</li>
              <li>• Admin player bonuses</li>
            </ul>
          </div>

          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">🏆</span>
              <h3 className="font-semibold text-gray-900">Team Bonuses</h3>
            </div>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Win/draw/loss bonuses</li>
              <li>• Clean sheet bonuses</li>
              <li>• High scoring bonuses</li>
              <li>• Admin team bonuses</li>
            </ul>
          </div>

          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">👥</span>
              <h3 className="font-semibold text-gray-900">Squad Totals</h3>
            </div>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Individual player totals</li>
              <li>• Including admin bonuses</li>
            </ul>
          </div>

          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">📊</span>
              <h3 className="font-semibold text-gray-900">Team Rankings</h3>
            </div>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Total points updated</li>
              <li>• Rankings recalculated</li>
              <li>• Leaderboard refreshed</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 mb-6">
        <button
          onClick={startRecalculation}
          disabled={isRecalculating}
          className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition-all ${
            isRecalculating
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl'
          }`}
        >
          {isRecalculating ? (
            <span className="flex items-center justify-center gap-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
              Recalculating...
            </span>
          ) : (
            'Start Recalculation'
          )}
        </button>
      </div>

      {/* Progress */}
      {progress && (
        <div className={`rounded-xl p-4 mb-6 ${
          success ? 'bg-green-50 border-2 border-green-300' :
          error ? 'bg-red-50 border-2 border-red-300' :
          'bg-blue-50 border-2 border-blue-300'
        }`}>
          <div className="flex items-center gap-3">
            {success ? (
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : error ? (
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            )}
            <p className={`font-semibold ${
              success ? 'text-green-900' :
              error ? 'text-red-900' :
              'text-blue-900'
            }`}>
              {progress}
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 mb-6">
          <p className="text-red-900 font-semibold mb-2">Error:</p>
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* Logs */}
      {logs.length > 0 && (
        <div className="bg-gray-900 rounded-xl p-4 mb-6">
          <h3 className="text-white font-bold mb-3">Recalculation Log</h3>
          <div className="space-y-1 max-h-96 overflow-y-auto font-mono text-xs">
            {logs.map((log, idx) => (
              <div key={idx} className="text-green-400">{log}</div>
            ))}
          </div>
        </div>
      )}

      {/* Success Actions */}
      {success && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
          <h3 className="font-bold text-gray-900 mb-4">Next Steps</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Link
              href="/dashboard/committee/fantasy"
              className="px-4 py-3 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors font-medium text-center"
            >
              View Fantasy Dashboard
            </Link>
            <Link
              href="/dashboard/committee/fantasy/teams/SSPSLFLS16"
              className="px-4 py-3 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors font-medium text-center"
            >
              View Teams & Leaderboard
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
