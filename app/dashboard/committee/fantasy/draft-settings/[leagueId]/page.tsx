'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useModal } from '@/hooks/useModal';
import AlertModal from '@/components/modals/AlertModal';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface DraftSettings {
  id?: string;
  budget_per_team: number;
  min_squad_size: number;
  max_squad_size: number;
  require_team_affiliation: boolean;
  draft_status: string;
}

export default function DraftSettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const leagueId = params?.leagueId as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<DraftSettings>({
    budget_per_team: 1000, // Default 1000 points
    min_squad_size: 11,
    max_squad_size: 15,
    require_team_affiliation: true,
    draft_status: 'pending',
  });

  const { alertState, showAlert, closeAlert } = useModal();

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
    const loadSettings = async () => {
      if (!leagueId) return;

      try {
        const response = await fetchWithTokenRefresh(`/api/fantasy/draft/settings?fantasy_league_id=${leagueId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.id) {
            setSettings(data);
          }
        }
      } catch (error) {
        console.error('Error loading draft settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      loadSettings();
    }
  }, [user, leagueId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const response = await fetchWithTokenRefresh('/api/fantasy/draft/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fantasy_league_id: leagueId,
          ...settings,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save settings');
      }

      showAlert({
        type: 'success',
        title: 'Success!',
        message: 'Draft settings saved successfully',
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      showAlert({
        type: 'error',
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to save settings',
      });
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
      <AlertModal {...alertState} onClose={closeAlert} />

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <Link
            href={`/dashboard/committee/fantasy/${leagueId}`}
            className="inline-flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to League Dashboard
          </Link>

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Draft Settings</h1>
              <p className="text-gray-600 mt-1">Configure salary cap draft rules</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Budget Configuration */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">💰 Budget Configuration</h2>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Budget Per Team
              </label>
              <div className="relative">
                <span className="absolute left-4 top-3 text-gray-500">💰</span>
                <input
                  type="number"
                  value={settings.budget_per_team || ''}
                  onChange={(e) => setSettings({ ...settings, budget_per_team: parseInt(e.target.value) || 0 })}
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  step="100"
                  min="0"
                  required
                />
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Total budget points each team has to spend on players
              </p>
            </div>
          </div>

          {/* Squad Size */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">👥 Squad Size Limits</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Minimum Squad Size
                </label>
                <input
                  type="number"
                  value={settings.min_squad_size || ''}
                  onChange={(e) => setSettings({ ...settings, min_squad_size: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  min="1"
                  max={settings.max_squad_size}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Maximum Squad Size
                </label>
                <input
                  type="number"
                  value={settings.max_squad_size || ''}
                  onChange={(e) => setSettings({ ...settings, max_squad_size: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  min={settings.min_squad_size}
                  required
                />
              </div>
            </div>
          </div>

          {/* Additional Rules */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">📋 Additional Rules</h2>
            
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.require_team_affiliation}
                onChange={(e) => setSettings({ ...settings, require_team_affiliation: e.target.checked })}
                className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
              />
              <div>
                <p className="font-semibold text-gray-900">Require Team Affiliation</p>
                <p className="text-sm text-gray-600">Each fantasy team must select a real team affiliation</p>
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
              className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : '💾 Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
