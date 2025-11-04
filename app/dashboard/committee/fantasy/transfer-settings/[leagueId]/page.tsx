'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeftRight, Calendar, Save, AlertCircle } from 'lucide-react';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface TransferSettings {
  max_transfers_per_window: number;
  transfer_window_start: string;
  transfer_window_end: string;
  is_transfer_window_open: boolean;
  points_cost_per_transfer: number;
}

export default function TransferSettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const leagueId = params?.leagueId as string;

  const [settings, setSettings] = useState<TransferSettings>({
    max_transfers_per_window: 3,
    transfer_window_start: '',
    transfer_window_end: '',
    is_transfer_window_open: false,
    points_cost_per_transfer: 4,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
    fetchSettings();
  }, [leagueId]);

  const fetchSettings = async () => {
    try {
      const res = await fetchWithTokenRefresh(`/api/fantasy/transfers/settings?league_id=${leagueId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          setSettings(data.settings);
        }
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetchWithTokenRefresh('/api/fantasy/transfers/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...settings, fantasy_league_id: leagueId }),
      });

      if (res.ok) {
        alert('Transfer settings saved successfully');
        fetchSettings();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to save settings');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const toggleTransferWindow = async () => {
    const newStatus = !settings.is_transfer_window_open;
    try {
      const res = await fetchWithTokenRefresh('/api/fantasy/transfers/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...settings,
          fantasy_league_id: leagueId,
          is_transfer_window_open: newStatus,
        }),
      });

      if (res.ok) {
        setSettings({ ...settings, is_transfer_window_open: newStatus });
        alert(`Transfer window ${newStatus ? 'opened' : 'closed'}`);
      }
    } catch (error) {
      console.error('Failed to toggle transfer window:', error);
      alert('Failed to toggle transfer window');
    }
  };

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href={`/dashboard/committee/fantasy/${leagueId}`}
            className="inline-flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to League
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl">
              <ArrowLeftRight className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Transfer Settings</h1>
              <p className="text-gray-600">Configure transfer windows and limits</p>
            </div>
          </div>
        </div>

        {/* Transfer Window Status */}
        <div className="glass rounded-3xl shadow-xl backdrop-blur-md border border-white/20 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Transfer Window Status</h2>
              <p className="text-gray-600">
                {settings.is_transfer_window_open
                  ? 'Transfer window is currently open'
                  : 'Transfer window is currently closed'}
              </p>
            </div>
            <button
              onClick={toggleTransferWindow}
              className={`px-6 py-3 rounded-lg font-medium text-white ${
                settings.is_transfer_window_open
                  ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'
                  : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700'
              }`}
            >
              {settings.is_transfer_window_open ? 'Close Window' : 'Open Window'}
            </button>
          </div>
        </div>

        {/* Settings Form */}
        <div className="glass rounded-3xl shadow-xl backdrop-blur-md border border-white/20 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Transfer Configuration</h2>

          <div className="space-y-6">
            {/* Max Transfers */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Maximum Transfers Per Window
              </label>
              <input
                type="number"
                value={settings.max_transfers_per_window}
                onChange={e =>
                  setSettings({
                    ...settings,
                    max_transfers_per_window: parseInt(e.target.value) || 0,
                  })
                }
                min="0"
                className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
              <p className="text-sm text-gray-500 mt-1">
                Number of player swaps allowed per transfer window
              </p>
            </div>

            {/* Points Cost */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Points Cost Per Transfer
              </label>
              <input
                type="number"
                value={settings.points_cost_per_transfer}
                onChange={e =>
                  setSettings({
                    ...settings,
                    points_cost_per_transfer: parseInt(e.target.value) || 0,
                  })
                }
                min="0"
                className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
              <p className="text-sm text-gray-500 mt-1">
                Fantasy points deducted for each transfer (0 for free transfers)
              </p>
            </div>

            {/* Window Start Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-2" />
                Window Start Date
              </label>
              <input
                type="datetime-local"
                value={settings.transfer_window_start}
                onChange={e =>
                  setSettings({ ...settings, transfer_window_start: e.target.value })
                }
                className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>

            {/* Window End Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-2" />
                Window End Date
              </label>
              <input
                type="datetime-local"
                value={settings.transfer_window_end}
                onChange={e =>
                  setSettings({ ...settings, transfer_window_end: e.target.value })
                }
                className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>

            {/* Info Alert */}
            <div className="flex items-start gap-3 p-4 bg-cyan-50/50 border border-cyan-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-cyan-600 mt-0.5" />
              <div className="text-sm text-gray-700">
                <p className="font-medium text-cyan-800 mb-1">Transfer Window Rules</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Teams can only make transfers when the window is open</li>
                  <li>Each transfer swaps one player out for one player in (same position)</li>
                  <li>Budget and squad composition rules still apply</li>
                  <li>Transfer count resets at the start of each new window</li>
                </ul>
              </div>
            </div>

            {/* Save Button */}
            <button
              onClick={saveSettings}
              disabled={saving}
              className="w-full px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save Settings
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
