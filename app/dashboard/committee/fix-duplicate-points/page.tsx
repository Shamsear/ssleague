'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface DuplicatePlayer {
  id: string;
  player_id: string;
  player_name: string;
  season_id: string;
  current_points: number;
  correct_points: number;
  points_difference: number;
  current_goals: number;
  correct_goals: number;
  current_assists: number;
  correct_assists: number;
  recorded_fixtures: number;
  actual_fixtures: number;
}

export default function FixDuplicatePointsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicatePlayer[]>([]);
  const [fixed, setFixed] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (!authLoading && user && user.role !== 'committee_admin' && user.role !== 'super_admin') {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  const analyzeDuplicates = async () => {
    setAnalyzing(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/fix-duplicate-points?action=analyze');
      if (!response.ok) throw new Error('Failed to analyze duplicates');
      const data = await response.json();
      setDuplicates(data.duplicates || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze');
    } finally {
      setAnalyzing(false);
    }
  };

  const fixAllDuplicates = async () => {
    if (!confirm(`Fix ${duplicates.length} players with duplicate points?`)) return;
    
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/fix-duplicate-points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fix_all' }),
      });
      
      if (!response.ok) throw new Error('Failed to fix duplicates');
      const data = await response.json();
      setFixed(data.fixed || []);
      
      // Refresh the analysis
      await analyzeDuplicates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fix duplicates');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || (user.role !== 'committee_admin' && user.role !== 'super_admin')) return null;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <Link
            href="/dashboard/committee"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition-colors mb-4"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Committee Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Fix Duplicate Player Points</h1>
          <p className="text-gray-600 mt-2">
            Identify and fix players whose points were calculated multiple times due to duplicate result submissions
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-lg flex items-start gap-3">
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-semibold">Error</p>
              <p>{error}</p>
            </div>
          </div>
        )}

        {fixed.length > 0 && (
          <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 text-green-700 rounded-lg flex items-start gap-3">
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-semibold">Success!</p>
              <p>Successfully fixed {fixed.length} player(s)</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex gap-4">
            <button
              onClick={analyzeDuplicates}
              disabled={analyzing}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {analyzing && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              )}
              Analyze Duplicates
            </button>

            {duplicates.length > 0 && (
              <button
                onClick={fixAllDuplicates}
                disabled={loading}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
              >
                {loading && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                )}
                Fix All ({duplicates.length})
              </button>
            )}
          </div>
        </div>

        {duplicates.length > 0 && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Found {duplicates.length} player(s) with duplicate points
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-4 text-sm font-semibold text-gray-700">Player</th>
                    <th className="text-right p-4 text-sm font-semibold text-gray-700">Current Points</th>
                    <th className="text-right p-4 text-sm font-semibold text-gray-700">Correct Points</th>
                    <th className="text-right p-4 text-sm font-semibold text-gray-700">Difference</th>
                    <th className="text-right p-4 text-sm font-semibold text-gray-700">Goals</th>
                    <th className="text-right p-4 text-sm font-semibold text-gray-700">Assists</th>
                    <th className="text-right p-4 text-sm font-semibold text-gray-700">Fixtures</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {duplicates.map((dup) => (
                    <tr key={dup.id} className="hover:bg-gray-50">
                      <td className="p-4 font-medium text-gray-900">{dup.player_name}</td>
                      <td className="text-right p-4 text-gray-700">{dup.current_points}</td>
                      <td className="text-right p-4 text-green-600 font-semibold">
                        {dup.correct_points}
                      </td>
                      <td className="text-right p-4 text-red-600 font-semibold">
                        -{dup.points_difference}
                      </td>
                      <td className="text-right p-4 text-gray-700">
                        {dup.current_goals} → {dup.correct_goals}
                      </td>
                      <td className="text-right p-4 text-gray-700">
                        {dup.current_assists} → {dup.correct_assists}
                      </td>
                      <td className="text-right p-4 text-gray-700">
                        {dup.recorded_fixtures} → {dup.actual_fixtures}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!analyzing && duplicates.length === 0 && (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">All Clear!</h3>
            <p className="text-gray-600">No duplicate points found. All player stats are correct!</p>
          </div>
        )}
      </div>
    </div>
  );
}
