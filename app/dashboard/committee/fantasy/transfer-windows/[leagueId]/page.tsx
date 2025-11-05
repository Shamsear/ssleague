'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface TransferWindow {
  window_id: string;
  window_name: string;
  opens_at: string;
  closes_at: string;
  is_active: boolean;
  status: 'upcoming' | 'active' | 'closed';
}

export default function TransferWindowsManagementPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const leagueId = params.leagueId as string;

  const [windows, setWindows] = useState<TransferWindow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  
  const [newWindowName, setNewWindowName] = useState('');
  const [newOpensAt, setNewOpensAt] = useState('');
  const [newClosesAt, setNewClosesAt] = useState('');

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

  const loadWindows = async () => {
    try {
      const response = await fetch(`/api/fantasy/transfer-windows?league_id=${leagueId}`);
      if (!response.ok) throw new Error('Failed to load windows');
      
      const data = await response.json();
      setWindows(data.windows || []);
    } catch (error) {
      console.error('Error loading windows:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const createWindow = async () => {
    if (!newWindowName || !newOpensAt || !newClosesAt) {
      alert('Please fill in all fields');
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch('/api/fantasy/transfer-windows', {
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
      const response = await fetch(`/api/fantasy/transfer-windows/${windowId}/toggle`, {
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

  if (loading || isLoading) {
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
        <Link
          href={`/dashboard/committee/fantasy/${leagueId}`}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors mb-6"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Fantasy Management
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 mb-8">Transfer Windows Management</h1>

        {/* Create New Window */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Create New Transfer Window</h2>
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
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Transfer Windows</h2>
          
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
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">How Transfer Windows Work:</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Create windows to define when teams can make transfers</li>
            <li>• Only one window can be active at a time</li>
            <li>• Teams can only swap players during active windows</li>
            <li>• After draft closes, transfers are the only way to modify squads</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
