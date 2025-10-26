'use client';

import { useState } from 'react';

export default function CleanupFantasyPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCleanup = async () => {
    if (!confirm('⚠️ WARNING: This will permanently delete ALL fantasy data from Firebase!\n\nAre you sure you want to continue?')) {
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/admin/cleanup-firebase-fantasy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm_delete: 'DELETE_ALL_FANTASY_DATA' }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Cleanup failed');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            🧹 Firebase Fantasy Data Cleanup
          </h1>
          
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Warning: Irreversible Action
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>This will permanently delete all fantasy-related data from Firebase:</p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>fantasy_leagues</li>
                    <li>fantasy_teams</li>
                    <li>fantasy_drafts</li>
                    <li>fantasy_squad</li>
                    <li>fantasy_player_points</li>
                    <li>fantasy_scoring_rules</li>
                    <li>fantasy_transfers</li>
                    <li>fantasy_player_prices</li>
                  </ul>
                  <p className="mt-2 font-semibold">The fantasy system now uses PostgreSQL exclusively.</p>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleCleanup}
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg transition-colors"
          >
            {loading ? 'Deleting...' : '🗑️ Delete All Firebase Fantasy Data'}
          </button>

          {result && (
            <div className="mt-6 bg-green-50 border-l-4 border-green-400 p-4">
              <h3 className="text-lg font-semibold text-green-900 mb-2">
                ✅ Cleanup Complete!
              </h3>
              <p className="text-green-800 mb-4">{result.message}</p>
              
              <div className="bg-white rounded p-4">
                <h4 className="font-semibold text-gray-900 mb-2">Statistics:</h4>
                <ul className="space-y-1 text-sm">
                  {Object.entries(result.stats).map(([collection, count]) => (
                    <li key={collection} className="flex justify-between">
                      <span className="text-gray-700">{collection}:</span>
                      <span className="font-mono text-gray-900">{count as number} documents</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-lg font-bold text-gray-900">
                    Total Deleted: {result.total_deleted} documents
                  </p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-6 bg-red-50 border-l-4 border-red-400 p-4">
              <h3 className="text-lg font-semibold text-red-900 mb-2">
                ❌ Error
              </h3>
              <p className="text-red-800">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
