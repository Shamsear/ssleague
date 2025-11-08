'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface AuctionSettings {
  id: number;
  season_id: string;
  auction_window: string;
  max_rounds: number;
  min_balance_per_round: number;
  max_squad_size: number;
  contract_duration: number;
  phase_1_end_round: number;
  phase_1_min_balance: number;
  phase_2_end_round: number;
  phase_2_min_balance: number;
  phase_3_min_balance: number;
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
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [formData, setFormData] = useState({
    auction_window: 'season_start',
    max_rounds: 25,
    min_balance_per_round: 30,
    max_squad_size: 25,
    contract_duration: 2,
    phase_1_end_round: 18,
    phase_1_min_balance: 30,
    phase_2_end_round: 20,
    phase_2_min_balance: 30,
    phase_3_min_balance: 10,
  });

  // Auto-adjust phase end rounds when max_rounds changes
  const handleMaxRoundsChange = (newMaxRounds: number) => {
    // Calculate proportional phase ends based on typical 25-round structure (18, 20)
    // Phase 1: ~72% of rounds (18/25)
    // Phase 2: ~80% of rounds (20/25)
    const phase1Percent = 0.72;
    const phase2Percent = 0.80;
    
    const newPhase1 = Math.max(1, Math.floor(newMaxRounds * phase1Percent));
    const newPhase2 = Math.max(newPhase1 + 1, Math.floor(newMaxRounds * phase2Percent));
    
    setFormData(prev => ({
      ...prev,
      max_rounds: newMaxRounds,
      phase_1_end_round: Math.min(newPhase1, newMaxRounds - 2),
      phase_2_end_round: Math.min(newPhase2, newMaxRounds),
    }));
    setHasUnsavedChanges(true);
  };

  // Handle form data changes and mark as unsaved
  const handleFormChange = (updates: Partial<typeof formData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
    setHasUnsavedChanges(true);
  };

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
      const response = await fetchWithTokenRefresh('/api/auction-settings');
      const { data, success } = await response.json();

      if (success) {
        setSettings(data.settings);
        setStats(data.stats);
        
        // Only update form data if there are no unsaved changes
        if (!hasUnsavedChanges) {
          setFormData({
            auction_window: data.settings.auction_window || 'season_start',
            max_rounds: data.settings.max_rounds,
            min_balance_per_round: data.settings.min_balance_per_round,
            max_squad_size: data.settings.max_squad_size || 25,
            contract_duration: data.settings.contract_duration || 2,
            phase_1_end_round: data.settings.phase_1_end_round || 18,
            phase_1_min_balance: data.settings.phase_1_min_balance || 30,
            phase_2_end_round: data.settings.phase_2_end_round || 20,
            phase_2_min_balance: data.settings.phase_2_min_balance || 30,
            phase_3_min_balance: data.settings.phase_3_min_balance || 10,
          });
        }
      }
    } catch (err) {
      console.error('Error fetching auction settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation: Phase end rounds must be within max_rounds
    if (formData.phase_1_end_round >= formData.max_rounds) {
      alert(`Phase 1 End Round (${formData.phase_1_end_round}) must be less than Maximum Rounds (${formData.max_rounds})`);
      return;
    }
    
    if (formData.phase_2_end_round > formData.max_rounds) {
      alert(`Phase 2 End Round (${formData.phase_2_end_round}) cannot exceed Maximum Rounds (${formData.max_rounds})`);
      return;
    }
    
    if (formData.phase_1_end_round >= formData.phase_2_end_round) {
      alert(`Phase 1 End Round (${formData.phase_1_end_round}) must be less than Phase 2 End Round (${formData.phase_2_end_round})`);
      return;
    }
    
    setSaving(true);

    try {
      const response = await fetchWithTokenRefresh('/api/auction-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, season_id: 'SSPSLS16' }),
      });

      const result = await response.json();

      if (result.success) {
        alert('Settings saved successfully!');
        setHasUnsavedChanges(false);
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
              <div className="md:col-span-2">
                <label htmlFor="auction_window" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Auction Window Type
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </span>
                  <select
                    id="auction_window"
                    value={formData.auction_window}
                    onChange={(e) => handleFormChange({ auction_window: e.target.value })}
                    required
                    className="pl-10 w-full py-3 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all duration-200 text-base appearance-none"
                  >
                    <option value="season_start">🏆 Season Start</option>
                    <option value="transfer_window">🔄 Transfer Window</option>
                    <option value="mid_season">⚡ Mid-Season</option>
                    <option value="winter_window">❄️ Winter Window</option>
                    <option value="summer_window">☀️ Summer Window</option>
                  </select>
                </div>
                <p className="mt-1 text-xs text-gray-500">Select the type of auction window these settings apply to</p>
              </div>

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
                    onChange={(e) => handleMaxRoundsChange(parseInt(e.target.value) || 1)}
                    min="1"
                    required
                    className="pl-10 w-full py-3 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all duration-200 text-base"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">Maximum number of rounds in this auction. Phase end rounds will auto-adjust.</p>
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
                    onChange={(e) => handleFormChange({ min_balance_per_round: parseInt(e.target.value) || 0 })}
                    min="0"
                    required
                    className="pl-10 w-full py-3 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all duration-200 text-base"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">Minimum balance required per remaining round (default: 30)</p>
              </div>

              <div>
                <label htmlFor="max_squad_size" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Maximum Squad Size
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </span>
                  <input
                    type="number"
                    id="max_squad_size"
                    value={formData.max_squad_size}
                    onChange={(e) => handleFormChange({ max_squad_size: parseInt(e.target.value) || 1 })}
                    min="1"
                    max="50"
                    required
                    className="pl-10 w-full py-3 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all duration-200 text-base"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">Maximum number of players each team can have (default: 25)</p>
              </div>

              <div>
                <label htmlFor="contract_duration" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Contract Duration (years)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </span>
                  <input
                    type="number"
                    id="contract_duration"
                    value={formData.contract_duration}
                    onChange={(e) => handleFormChange({ contract_duration: parseInt(e.target.value) || 1 })}
                    min="1"
                    max="5"
                    required
                    className="pl-10 w-full py-3 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all duration-200 text-base"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">Default contract duration for players (default: 2 years)</p>
              </div>
            </div>

            {/* Phase Configuration */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h4 className="text-md font-semibold text-gray-800 mb-4">Budget Reserve Phases</h4>
              <p className="text-sm text-gray-600 mb-4">Configure three-phase reserve system to ensure teams maintain enough balance throughout the auction.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="phase_1_end_round" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Phase 1 End Round (Strict Reserve)
                  </label>
                  <input
                    type="number"
                    id="phase_1_end_round"
                    value={formData.phase_1_end_round}
                    onChange={(e) => handleFormChange({ phase_1_end_round: parseInt(e.target.value) || 1 })}
                    min="1"
                    max={formData.max_rounds - 1}
                    required
                    className={`w-full py-3 px-4 bg-white/60 border rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all duration-200 text-base ${
                      formData.phase_1_end_round >= formData.max_rounds ? 'border-red-300 bg-red-50/50' : 'border-gray-200'
                    }`}
                  />
                  <p className="mt-1 text-xs text-gray-500">Last round of Phase 1 (bids exceeding reserve are rejected)</p>
                  {formData.phase_1_end_round >= formData.max_rounds && (
                    <p className="mt-1 text-xs text-red-600">⚠ Must be less than max rounds ({formData.max_rounds})</p>
                  )}
                </div>

                <div>
                  <label htmlFor="phase_1_min_balance" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Phase 1 Reserve Amount (£)
                  </label>
                  <input
                    type="number"
                    id="phase_1_min_balance"
                    value={formData.phase_1_min_balance}
                    onChange={(e) => handleFormChange({ phase_1_min_balance: parseInt(e.target.value) || 0 })}
                    min="0"
                    required
                    className="w-full py-3 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all duration-200 text-base"
                  />
                  <p className="mt-1 text-xs text-gray-500">Reserve amount per round in Phase 1 (default: £30)</p>
                </div>

                <div>
                  <label htmlFor="phase_2_end_round" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Phase 2 End Round (Soft Reserve)
                  </label>
                  <input
                    type="number"
                    id="phase_2_end_round"
                    value={formData.phase_2_end_round}
                    onChange={(e) => handleFormChange({ phase_2_end_round: parseInt(e.target.value) || 1 })}
                    min="1"
                    max={formData.max_rounds}
                    required
                    className={`w-full py-3 px-4 bg-white/60 border rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all duration-200 text-base ${
                      formData.phase_2_end_round > formData.max_rounds || formData.phase_2_end_round <= formData.phase_1_end_round
                        ? 'border-red-300 bg-red-50/50'
                        : 'border-gray-200'
                    }`}
                  />
                  <p className="mt-1 text-xs text-gray-500">Last round of Phase 2 (bids allowed with warnings)</p>
                  {formData.phase_2_end_round > formData.max_rounds && (
                    <p className="mt-1 text-xs text-red-600">⚠ Cannot exceed max rounds ({formData.max_rounds})</p>
                  )}
                  {formData.phase_2_end_round <= formData.phase_1_end_round && (
                    <p className="mt-1 text-xs text-red-600">⚠ Must be greater than Phase 1 ({formData.phase_1_end_round})</p>
                  )}
                </div>

                <div>
                  <label htmlFor="phase_2_min_balance" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Phase 2 Reserve Amount (£)
                  </label>
                  <input
                    type="number"
                    id="phase_2_min_balance"
                    value={formData.phase_2_min_balance}
                    onChange={(e) => handleFormChange({ phase_2_min_balance: parseInt(e.target.value) || 0 })}
                    min="0"
                    required
                    className="w-full py-3 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all duration-200 text-base"
                  />
                  <p className="mt-1 text-xs text-gray-500">Reserve amount per round in Phase 2 (default: £30)</p>
                </div>

                <div>
                  <label htmlFor="phase_3_min_balance" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Phase 3 Reserve Amount (£)
                  </label>
                  <input
                    type="number"
                    id="phase_3_min_balance"
                    value={formData.phase_3_min_balance}
                    onChange={(e) => handleFormChange({ phase_3_min_balance: parseInt(e.target.value) || 0 })}
                    min="0"
                    required
                    className="w-full py-3 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all duration-200 text-base"
                  />
                  <p className="mt-1 text-xs text-gray-500">Reserve amount per slot in Phase 3 (default: £10)</p>
                </div>
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
