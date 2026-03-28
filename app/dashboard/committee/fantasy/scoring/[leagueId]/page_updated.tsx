'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface ScoringSettings {
  // Base scoring
  goal_points: number;
  assist_points: number;
  clean_sheet_points: number;
  motm_points: number;
  
  // NEW: Captain multipliers
  captain_multiplier: number;
  vice_captain_multiplier: number;
  
  // NEW: Form multipliers
  form_hot_multiplier: number;
  form_cold_multiplier: number;
  
  // Bench scoring
  bench_points_enabled: boolean;
}

export default function ScoringRulesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const leagueId = params?.leagueId as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<ScoringSettings>({
    goal_points: 10,
    assist_points: 5,
    clean_sheet_points: 5,
    motm_points: 10,
    captain_multiplier: 2.0,
    vice_captain_multiplier: 1.5,
    form_hot_multiplier: 1.15,
    form_cold_multiplier: 0.85,
    bench_points_enabled: false,
  });

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
    if (user && leagueId) {
      loadSettings();
    }
  }, [user, leagueId]);

  const loadSettings = async () => {
    try {
      const response = await fetchWithTokenRefresh(`/api/fantasy/scoring-settings?league_id=${leagueId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.settings) {
          setSettings(data.settings);
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const response = await fetchWithTokenRefresh('/api/fantasy/scoring-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          league_id: leagueId,
          ...settings,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save settings');
      }

      alert('Scoring settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert(error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <Link
          href={`/dashboard/committee/fantasy/${leagueId}`}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors mb-6"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to League Dashboard
        </Link>

        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-xl">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Scoring Rules</h1>
            <p className="text-gray-600 mt-1">Configure points for player performance</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Base Points */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">⚽ Base Points</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Goal Scored
                </label>
                <input
                  type="number"
                  value={settings.goal_points}
                  onChange={(e) => setSettings({ ...settings, goal_points: parseFloat(e.target.value) })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  step="0.5"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Assist
                </label>
                <input
                  type="number"
                  value={settings.assist_points}
                  onChange={(e) => setSettings({ ...settings, assist_points: parseFloat(e.target.value) })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  step="0.5"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Clean Sheet
                </label>
                <input
                  type="number"
                  value={settings.clean_sheet_points}
                  onChange={(e) => setSettings({ ...settings, clean_sheet_points: parseFloat(e.target.value) })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  step="0.5"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Man of the Match
                </label>
                <input
                  type="number"
                  value={settings.motm_points}
                  onChange={(e) => setSettings({ ...settings, motm_points: parseFloat(e.target.value) })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  step="0.5"
                  required
                />
              </div>
            </div>
          </div>

          {/* Captain Multipliers */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded">UPDATED</span>
              <h2 className="text-xl font-bold text-gray-900">©️ Captain & Vice-Captain Multipliers</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Captain Multiplier
                </label>
                <input
                  type="number"
                  value={settings.captain_multiplier}
                  onChange={(e) => setSettings({ ...settings, captain_multiplier: parseFloat(e.target.value) })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  step="0.1"
                  min="1"
                  max="3"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">Captain's points are multiplied by this value (Recommended: 2.0)</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Vice-Captain Multiplier
                </label>
                <input
                  type="number"
                  value={settings.vice_captain_multiplier}
                  onChange={(e) => setSettings({ ...settings, vice_captain_multiplier: parseFloat(e.target.value) })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  step="0.1"
                  min="1"
                  max="2"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">Vice-Captain's points are multiplied by this value (Recommended: 1.5)</p>
              </div>
            </div>

            <div className="mt-4 p-4 bg-indigo-50 rounded-lg">
              <p className="text-sm text-indigo-900">
                <strong>Example:</strong> If a player scores 10 points and is selected as Captain (2x), they earn 20 points for that round.
              </p>
            </div>
          </div>

          {/* Form Multipliers */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded">UPDATED</span>
              <h2 className="text-xl font-bold text-gray-900">📈 Form Multipliers</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Hot Form Multiplier 🔥
                </label>
                <input
                  type="number"
                  value={settings.form_hot_multiplier}
                  onChange={(e) => setSettings({ ...settings, form_hot_multiplier: parseFloat(e.target.value) })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  step="0.05"
                  min="1"
                  max="1.5"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">Bonus for players in hot form (Recommended: 1.15 = +15%)</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Cold Form Multiplier ❄️
                </label>
                <input
                  type="number"
                  value={settings.form_cold_multiplier}
                  onChange={(e) => setSettings({ ...settings, form_cold_multiplier: parseFloat(e.target.value) })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  step="0.05"
                  min="0.5"
                  max="1"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">Penalty for players in cold form (Recommended: 0.85 = -15%)</p>
              </div>
            </div>

            <div className="mt-4 p-4 bg-amber-50 rounded-lg">
              <p className="text-sm text-amber-900">
                <strong>Note:</strong> Form is calculated based on last 5 games performance. Hot form = above average, Cold form = below average.
              </p>
            </div>
          </div>

          {/* Bench Scoring */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">🪑 Bench Scoring</h2>
            
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.bench_points_enabled}
                onChange={(e) => setSettings({ ...settings, bench_points_enabled: e.target.checked })}
                className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
              />
              <div>
                <p className="font-semibold text-gray-900">Enable Bench Points by Default</p>
                <p className="text-sm text-gray-600">If disabled, bench players earn 0 points (unless Bench Boost power-up is active)</p>
              </div>
            </label>
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-4">
            <Link
              href={`/dashboard/committee/fantasy/${leagueId}`}
              className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-300 transition-colors text-center"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : '💾 Save Scoring Rules'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
