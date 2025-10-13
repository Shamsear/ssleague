'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

interface AuctionSettings {
  id: number;
  season_id: string;
  max_rounds: number;
  min_balance_per_round: number;
  created_at: string;
  updated_at: string;
}

interface AuctionStats {
  total_rounds: number;
  completed_rounds: number;
  remaining_rounds: number;
}

export default function AuctionSettingsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [settings, setSettings] = useState<AuctionSettings | null>(null);
  const [stats, setStats] = useState<AuctionStats>({
    total_rounds: 0,
    completed_rounds: 0,
    remaining_rounds: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [formData, setFormData] = useState({
    max_rounds: 25,
    min_balance_per_round: 30,
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
    if (!authLoading && user && user.role !== 'committee_admin') {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user?.role === 'committee_admin') {
      fetchSettings();
    }
  }, [user]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoRefresh && user?.role === 'committee_admin') {
      interval = setInterval(fetchSettings, 15000); // Refresh every 15 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, user]);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/auction-settings');
      const { data, success } = await response.json();

      if (success) {
        setSettings(data.settings);
        setStats(data.stats);
        setFormData({
          max_rounds: data.settings.max_rounds,
          min_balance_per_round: data.settings.min_balance_per_round,
        });
      }
    } catch (err) {
      console.error('Error fetching auction settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch('/api/auction-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        alert('Settings saved successfully!');
        fetchSettings();
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (err) {
      console.error('Error saving settings:', err);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading auction settings...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'committee_admin') {
    return null;
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-6">
      <div className="glass rounded-3xl p-3 sm:p-6 mb-3 backdrop-blur-md">
        {/* Header */}
        <div className="flex flex-col gap-3 mb-3">
          <h2 className="text-xl sm:text-2xl font-bold text-dark gradient-text">Auction Settings</h2>
          
          {/* Navigation Links */}
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/committee"
              className="px-4 py-2.5 text-sm glass rounded-xl hover:bg-white/90 transition-all duration-300 flex items-center justify-center text-dark w-full sm:w-auto"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Auction Settings Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="glass p-4 rounded-xl bg-white/40 backdrop-blur-sm border border-gray-100/20">
            <h3 className="text-gray-700 text-lg font-medium mb-2">Total Rounds</h3>
            <div className="flex items-end">
              <span className="text-3xl font-bold text-primary">{stats.total_rounds}</span>
              <span className="text-gray-500 ml-2 text-sm">/ {formData.max_rounds}</span>
            </div>
            <p className="text-sm text-gray-600 mt-1">Rounds created in this auction</p>
          </div>

          <div className="glass p-4 rounded-xl bg-white/40 backdrop-blur-sm border border-gray-100/20">
            <h3 className="text-gray-700 text-lg font-medium mb-2">Completed Rounds</h3>
            <div className="flex items-end">
              <span className="text-3xl font-bold text-green-600">{stats.completed_rounds}</span>
              <span className="text-gray-500 ml-2 text-sm">/ {formData.max_rounds}</span>
            </div>
            <p className="text-sm text-gray-600 mt-1">Rounds that have been finalized</p>
          </div>

          <div className="glass p-4 rounded-xl bg-white/40 backdrop-blur-sm border border-gray-100/20">
            <h3 className="text-gray-700 text-lg font-medium mb-2">Remaining Rounds</h3>
            <div className="flex items-end">
              <span className="text-3xl font-bold text-blue-600">{stats.remaining_rounds}</span>
              <span className="text-gray-500 ml-2 text-sm">/ {formData.max_rounds}</span>
            </div>
            <p className="text-sm text-gray-600 mt-1">Rounds that can still be created</p>
          </div>
        </div>

        {/* Settings Form */}
        <div className="glass p-5 sm:p-6 rounded-2xl bg-white/40 backdrop-blur-sm border border-gray-100/20">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Configure Auction Settings</h3>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="max_rounds" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Maximum Rounds
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </span>
                  <input
                    type="number"
                    id="max_rounds"
                    value={formData.max_rounds}
                    onChange={(e) => setFormData({ ...formData, max_rounds: parseInt(e.target.value) })}
                    min="1"
                    required
                    className="pl-10 w-full py-3 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all duration-200 text-base"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">Maximum number of rounds in this auction (default: 25)</p>
              </div>

              <div>
                <label htmlFor="min_balance_per_round" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Minimum Balance Per Round
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </span>
                  <input
                    type="number"
                    id="min_balance_per_round"
                    value={formData.min_balance_per_round}
                    onChange={(e) => setFormData({ ...formData, min_balance_per_round: parseInt(e.target.value) })}
                    min="0"
                    required
                    className="pl-10 w-full py-3 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all duration-200 text-base"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">Minimum balance required per remaining round (default: 30)</p>
              </div>
            </div>

            <div className="mt-6">
              <button
                type="submit"
                disabled={saving}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-medium hover:from-primary/90 hover:to-secondary/90 transform hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 shadow-md disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </form>
        </div>

        {/* Explanation Section */}
        <div className="mt-6 glass p-5 rounded-2xl bg-blue-50/60 backdrop-blur-sm border border-blue-100/30">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-base font-medium text-blue-800">About Minimum Balance Requirements</h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>The minimum balance requirement ensures teams can participate in all remaining rounds of the auction.</p>
                <p className="mt-2">
                  For example, if 15 rounds are completed and 10 remain, with a minimum balance requirement of 30 per round,
                  each team must have at least 300 in their balance to start the next round.
                </p>
                <p className="mt-2">This helps ensure fair competition throughout the entire auction process.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Auto-refresh Controls */}
        <div className="mt-6 flex items-center">
          <label htmlFor="auto-refresh-toggle" className="flex items-center cursor-pointer">
            <div className="relative">
              <input
                type="checkbox"
                id="auto-refresh-toggle"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="sr-only"
              />
              <div className={`block w-10 h-6 rounded-full ${autoRefresh ? 'bg-primary' : 'bg-gray-300'}`}></div>
              <div
                className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${
                  autoRefresh ? 'translate-x-4' : ''
                }`}
              ></div>
            </div>
            <div className="ml-3 text-gray-700 text-sm font-medium">
              Auto-refresh data{' '}
              <span className={autoRefresh ? 'text-green-600' : 'text-gray-500'}>
                ({autoRefresh ? 'enabled' : 'disabled'})
              </span>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}
