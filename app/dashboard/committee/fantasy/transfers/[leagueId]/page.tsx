'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeftRight, Calendar, Save, AlertCircle, Plus, Settings } from 'lucide-react';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface TransferWindow {
  window_id: string;
  window_name: string;
  opens_at: string;
  closes_at: string;
  is_active: boolean;
  status: 'upcoming' | 'active' | 'closed';
}

interface TransferSettings {
  max_transfers_per_window: number;
  transfer_window_start: string;
  transfer_window_end: string;
  is_transfer_window_open: boolean;
  points_cost_per_transfer: number;
}

export default function TransfersManagementPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const leagueId = params.leagueId as string;

  const [activeTab, setActiveTab] = useState<'windows' | 'settings'>('windows');
  
  // Windows state
  const [windows, setWindows] = useState<TransferWindow[]>([]);
  const [isLoadingWindows, setIsLoadingWindows] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newWindowName, setNewWindowName] = useState('');
  const [newOpensAt, setNewOpensAt] = useState('');
  const [newClosesAt, setNewClosesAt] = useState('');

  // Settings state
  const [selectedWindowId, setSelectedWindowId] = useState<string>('');
  const [settings, setSettings] = useState<TransferSettings>({
    max_transfers_per_window: 3,
    transfer_window_start: '',
    transfer_window_end: '',
    is_transfer_window_open: false,
    points_cost_per_transfer: 4,
  });
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
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
    if (user && leagueId) {
      loadWindows();
    }
  }, [user, leagueId]);

  useEffect(() => {
    if (selectedWindowId) {
      fetchSettings(selectedWindowId);
    }
  }, [selectedWindowId]);

  const loadWindows = async () => {
    try {
      const response = await fetchWithTokenRefresh(`/api/fantasy/transfer-windows?league_id=${leagueId}`);
      if (!response.ok) throw new Error('Failed to load windows');
      
      const data = await response.json();
      const windowsList = data.windows || [];
      setWindows(windowsList);
      
      // Auto-select first window if available
      if (windowsList.length > 0 && !selectedWindowId) {
        setSelectedWindowId(windowsList[0].window_id);
      }
    } catch (error) {
      console.error('Error loading windows:', error);
    } finally {
      setIsLoadingWindows(false);
    }
  };

  const createWindow = async () => {
    if (!newWindowName || !newOpensAt || !newClosesAt) {
      alert('Please fill in all fields');
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetchWithTokenRefresh(/api/fantasy/transfer-windows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          league_id: leagueId,
          window_name: newWindowName,
          opens_at: newOpensAt,
          closes_at: newClosesAt,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create window');
      }

      alert('Transfer window created successfully!');
      setNewWindowName('');
      setNewOpensAt('');
      setNewClosesAt('');
      loadWindows();
    } catch (error) {
      console.error('Error creating window:', error);
      alert(error instanceof Error ? error.message : 'Failed to create window');
    } finally {
      setIsCreating(false);
    }
  };

  const toggleWindow = async (windowId: string) => {
    try {
      const response = await fetchWithTokenRefresh(`/api/fantasy/transfer-windows/${windowId}/toggle`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to toggle window');
      }

      loadWindows();
    } catch (error) {
      console.error('Error toggling window:', error);
      alert(error instanceof Error ? error.message : 'Failed to toggle window');
    }
  };

  const fetchSettings = async (windowId: string) => {
    setIsLoadingSettings(true);
    try {
      const res = await fetchWithTokenRefresh(`/api/fantasy/transfers/settings?window_id=${windowId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          setSettings(data.settings);
        }
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setIsLoadingSettings(false);
    }
  };

  const saveSettings = async () => {
    if (!selectedWindowId) {
      alert('Please select a transfer window first');
      return;
    }

    setSaving(true);
    try {
      const res = await fetchWithTokenRefresh(/api/fantasy/transfers/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...settings, 
          window_id: selectedWindowId,
          fantasy_league_id: leagueId 
        }),
      });

      if (res.ok) {
        alert('Transfer settings saved successfully');
        fetchSettings(selectedWindowId);
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
    if (!selectedWindowId) {
      alert('Please select a transfer window first');
      return;
    }

    const newStatus = !settings.is_transfer_window_open;
    try {
      const res = await fetchWithTokenRefresh(/api/fantasy/transfers/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...settings,
          window_id: selectedWindowId,
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

  if (loading || isLoadingWindows || isLoadingSettings) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href={`/dashboard/committee/fantasy/${leagueId}`}
            className="inline-flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Fantasy Management
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl">
              <ArrowLeftRight className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Transfer Management</h1>
              <p className="text-gray-600">Manage transfer windows and settings</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-t-2xl shadow-lg border border-gray-200 border-b-0">
          <div className="flex">
            <button
              onClick={() => setActiveTab('windows')}
              className={`flex-1 px-6 py-4 text-center font-semibold transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'windows'
                  ? 'bg-gradient-to-r from-indigo-500 to-blue-600 text-white'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Calendar className="w-5 h-5" />
              Transfer Windows
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex-1 px-6 py-4 text-center font-semibold transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'settings'
                  ? 'bg-gradient-to-r from-cyan-500 to-teal-600 text-white'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Settings className="w-5 h-5" />
              Transfer Settings
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-b-2xl shadow-lg border border-gray-200 border-t-0 p-6">
          {activeTab === 'windows' ? (
            <div className="space-y-6">
              {/* Create New Window */}
              <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Create New Transfer Window
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Window Name
                    </label>
                    <input
                      type="text"
                      value={newWindowName}
                      onChange={(e) => setNewWindowName(e.target.value)}
                      placeholder="e.g., Week 1 Transfers"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Opens At
                    </label>
                    <input
                      type="datetime-local"
                      value={newOpensAt}
                      onChange={(e) => setNewOpensAt(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Closes At
                    </label>
                    <input
                      type="datetime-local"
                      value={newClosesAt}
                      onChange={(e) => setNewClosesAt(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <button
                  onClick={createWindow}
                  disabled={isCreating}
                  className="w-full px-6 py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isCreating ? 'Creating...' : 'Create Transfer Window'}
                </button>
              </div>

              {/* Existing Windows */}
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-4">Active & Upcoming Windows</h2>
                
                {windows.length === 0 ? (
                  <p className="text-center text-gray-500 py-12">No transfer windows created yet</p>
                ) : (
                  <div className="space-y-3">
                    {windows.map((window) => (
                      <div
                        key={window.window_id}
                        className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-200"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-bold text-gray-900">{window.window_name}</h3>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                              window.status === 'active' ? 'bg-green-100 text-green-800' :
                              window.status === 'upcoming' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {window.status.toUpperCase()}
                            </span>
                          </div>
                          <div className="text-sm text-gray-600">
                            <span>Opens: {new Date(window.opens_at).toLocaleString()}</span>
                            <span className="mx-2">•</span>
                            <span>Closes: {new Date(window.closes_at).toLocaleString()}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => toggleWindow(window.window_id)}
                          className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
                            window.is_active
                              ? 'bg-red-500 text-white hover:bg-red-600'
                              : 'bg-green-500 text-white hover:bg-green-600'
                          }`}
                        >
                          {window.is_active ? 'Close' : 'Open'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">How Transfer Windows Work:</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Create windows to define when teams can make transfers</li>
                  <li>• Only one window can be active at a time</li>
                  <li>• Teams can only swap players during active windows</li>
                  <li>• After draft closes, transfers are the only way to modify squads</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Window Selector */}
              <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Transfer Window *
                </label>
                <select
                  value={selectedWindowId}
                  onChange={(e) => setSelectedWindowId(e.target.value)}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 font-medium"
                >
                  <option value="">-- Select a window to configure --</option>
                  {windows.map((window) => (
                    <option key={window.window_id} value={window.window_id}>
                      {window.window_name} ({window.status.toUpperCase()}) - {new Date(window.opens_at).toLocaleDateString()} to {new Date(window.closes_at).toLocaleDateString()}
                    </option>
                  ))}
                </select>
                <p className="text-sm text-gray-500 mt-2">
                  Each transfer window has its own settings. Select a window to view or modify its configuration.
                </p>
              </div>

              {!selectedWindowId ? (
                <div className="text-center py-12 text-gray-500">
                  <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-medium">Please select a transfer window above</p>
                  <p className="text-sm">Settings are configured per transfer window</p>
                </div>
              ) : (
                <>
              {/* Transfer Window Status */}
              <div className="bg-gradient-to-r from-cyan-50 to-blue-50 rounded-xl p-6 border border-cyan-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Current Window Status</h2>
                    <p className="text-gray-600">
                      {settings.is_transfer_window_open
                        ? '✅ Transfer window is currently open'
                        : '🔒 Transfer window is currently closed'}
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
              <div>
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
                      Default Window Start Date
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
                      Default Window End Date
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
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
