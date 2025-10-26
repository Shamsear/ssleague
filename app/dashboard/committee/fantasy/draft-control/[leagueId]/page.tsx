'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface DraftSettings {
  draft_status: 'pending' | 'active' | 'closed';
  draft_opens_at: string | null;
  draft_closes_at: string | null;
  budget_per_team: number;
  max_squad_size: number;
  league_name: string;
  season_name: string;
}

export default function DraftControlPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const leagueId = params.leagueId as string;

  const [settings, setSettings] = useState<DraftSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [draftStatus, setDraftStatus] = useState<'pending' | 'active' | 'closed'>('pending');
  const [opensAt, setOpensAt] = useState('');
  const [closesAt, setClosesAt] = useState('');

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
      const response = await fetch(`/api/fantasy/draft/settings?league_id=${leagueId}`);
      if (!response.ok) throw new Error('Failed to load settings');
      
      const data = await response.json();
      setSettings(data.settings);
      setDraftStatus(data.settings.draft_status || 'pending');
      setOpensAt(data.settings.draft_opens_at ? new Date(data.settings.draft_opens_at).toISOString().slice(0, 16) : '');
      setClosesAt(data.settings.draft_closes_at ? new Date(data.settings.draft_closes_at).toISOString().slice(0, 16) : '');
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateDraftStatus = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/fantasy/draft/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          league_id: leagueId,
          draft_status: draftStatus,
          draft_opens_at: opensAt || null,
          draft_closes_at: closesAt || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update draft status');
      }

      alert('Draft settings updated successfully!');
      loadSettings();
    } catch (error) {
      console.error('Error updating draft status:', error);
      alert(error instanceof Error ? error.message : 'Failed to update draft status');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user || !settings) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <Link
          href={`/dashboard/committee/fantasy/${leagueId}`}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors mb-6"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Fantasy Management
        </Link>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Draft Period Control</h1>
          <p className="text-gray-600 mb-6">{settings.league_name} - {settings.season_name}</p>

          <div className="space-y-6">
            {/* Current Status */}
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="font-semibold text-gray-900 mb-2">Current Status</h3>
              <div className="flex items-center gap-3">
                <span className={`px-4 py-2 rounded-lg font-bold ${
                  settings.draft_status === 'active' ? 'bg-green-100 text-green-800' :
                  settings.draft_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {settings.draft_status.toUpperCase()}
                </span>
                {settings.draft_opens_at && (
                  <span className="text-sm text-gray-600">
                    Opens: {new Date(settings.draft_opens_at).toLocaleString()}
                  </span>
                )}
                {settings.draft_closes_at && (
                  <span className="text-sm text-gray-600">
                    Closes: {new Date(settings.draft_closes_at).toLocaleString()}
                  </span>
                )}
              </div>
            </div>

            {/* Draft Status Control */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Draft Status
              </label>
              <div className="flex gap-3">
                <button
                  onClick={() => setDraftStatus('pending')}
                  className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                    draftStatus === 'pending'
                      ? 'bg-yellow-500 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Pending
                </button>
                <button
                  onClick={() => setDraftStatus('active')}
                  className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                    draftStatus === 'active'
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Active
                </button>
                <button
                  onClick={() => setDraftStatus('closed')}
                  className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                    draftStatus === 'closed'
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Closed
                </button>
              </div>
            </div>

            {/* Draft Period Dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Opens At (optional)
                </label>
                <input
                  type="datetime-local"
                  value={opensAt}
                  onChange={(e) => setOpensAt(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Closes At (optional)
                </label>
                <input
                  type="datetime-local"
                  value={closesAt}
                  onChange={(e) => setClosesAt(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Save Button */}
            <button
              onClick={updateDraftStatus}
              disabled={isSaving}
              className="w-full px-6 py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? 'Saving...' : 'Update Draft Settings'}
            </button>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2">Status Guide:</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li><strong>Pending:</strong> Draft hasn't started yet. Teams can view but not draft.</li>
                <li><strong>Active:</strong> Draft is open. Teams can draft players.</li>
                <li><strong>Closed:</strong> Draft period ended. Teams must use transfer windows.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
