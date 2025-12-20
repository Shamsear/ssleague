'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RecalculateFantasyPointsPage() {
  const router = useRouter();
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRecalculate = async () => {
    if (!confirm('Are you sure you want to recalculate ALL fantasy points? This will:\n\n1. Delete all existing player points\n2. Delete all existing passive bonus points\n3. Recalculate everything from scratch\n4. Update all team totals and ranks\n\nThis operation may take several minutes.')) {
      return;
    }

    setIsRecalculating(true);
    setError(null);
    setResults(null);

    try {
      const response = await fetch('/api/admin/fantasy/recalculate-all-points', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to recalculate points');
      }

      setResults(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsRecalculating(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="text-blue-600 hover:text-blue-800 flex items-center gap-2"
        >
          ← Back
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-3xl font-bold mb-6">Recalculate Fantasy Points</h1>

        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Warning</h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>This operation will completely recalculate all fantasy points from scratch. Use this when:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Scoring rules have been changed</li>
                  <li>Match results have been corrected</li>
                  <li>Data inconsistencies are detected</li>
                  <li>Captain/Vice-captain assignments have been updated</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">What this does</h3>
              <div className="mt-2 text-sm text-blue-700">
                <ol className="list-decimal list-inside space-y-1">
                  <li><strong>Player Points:</strong> Recalculates all player performance points with captain (2x) and vice-captain (1.5x) multipliers</li>
                  <li><strong>Passive Bonuses:</strong> Recalculates team affiliation bonuses based on supported real team performance</li>
                  <li><strong>Squad Totals:</strong> Updates total points for each player in each fantasy squad</li>
                  <li><strong>Team Totals:</strong> Updates total points and ranks for all fantasy teams</li>
                </ol>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-center">
          <button
            onClick={handleRecalculate}
            disabled={isRecalculating}
            className={`px-8 py-3 rounded-lg font-semibold text-white transition-colors ${
              isRecalculating
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isRecalculating ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Recalculating... This may take several minutes
              </span>
            ) : (
              'Start Recalculation'
            )}
          </button>
        </div>

        {error && (
          <div className="mt-6 bg-red-50 border-l-4 border-red-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {results && (
          <div className="mt-6 bg-green-50 border-l-4 border-green-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">Success!</h3>
                <div className="mt-2 text-sm text-green-700">
                  <p className="mb-3">Fantasy points have been successfully recalculated.</p>
                  <div className="bg-white rounded p-3 space-y-2">
                    <div className="flex justify-between">
                      <span className="font-medium">Player point records:</span>
                      <span className="text-green-600 font-bold">{results.playerPointsInserted.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Passive bonus points:</span>
                      <span className="text-green-600 font-bold">{results.passiveBonusesAwarded.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Squad players updated:</span>
                      <span className="text-green-600 font-bold">{results.squadPlayersUpdated.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Teams updated:</span>
                      <span className="text-green-600 font-bold">{results.teamsUpdated.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Leagues ranked:</span>
                      <span className="text-green-600 font-bold">{results.leaguesRanked.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {results && (
          <div className="mt-6 flex justify-center gap-4">
            <button
              onClick={() => router.push('/dashboard/committee/fantasy')}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              View Fantasy Leagues
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Recalculate Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
