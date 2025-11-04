'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useDraftWebSocket } from '@/hooks/useDraftWebSocket';
import { useAutoCloseDraft } from '@/hooks/useAutoCloseDraft';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

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
  const [toast, setToast] = useState<{message: string, type: 'success' | 'info' | 'warning'} | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }
    if (!loading && user && user.role !== 'committee_admin' && user.role !== 'super_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  // Helper function to convert UTC timestamp to IST datetime-local format
  const formatForDatetimeLocal = useCallback((utcTimestamp: string | null): string => {
    if (!utcTimestamp) return '';
    
    const date = new Date(utcTimestamp);
    const istString = date.toLocaleString('en-CA', { 
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    const [datePart, timePart] = istString.split(', ');
    return `${datePart}T${timePart}`;
  }, []);

  // Define loadSettings with useCallback to make it stable
  const loadSettings = useCallback(async () => {
    try {
      const response = await fetchWithTokenRefresh(`/api/fantasy/draft/settings?league_id=${leagueId}`);
      if (!response.ok) throw new Error('Failed to load settings');
      
      const data = await response.json();
      setSettings(data.settings);
      setDraftStatus(data.settings.draft_status || 'pending');
      setOpensAt(formatForDatetimeLocal(data.settings.draft_opens_at));
      setClosesAt(formatForDatetimeLocal(data.settings.draft_closes_at));
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setIsLoading(false);
    }
  }, [leagueId, formatForDatetimeLocal]);

  useEffect(() => {
    if (user && leagueId) {
      loadSettings();
    }
  }, [user, leagueId, loadSettings]);

  // Auto-open/close draft based on time windows
  useAutoCloseDraft(
    leagueId,
    settings?.draft_opens_at || undefined,
    settings?.draft_closes_at || undefined
  );

  // WebSocket for real-time draft status updates
  const handleDraftStatusChange = useCallback((update: any) => {
    console.log('📡 Received draft status update:', update);
    console.log('✨ Updating UI without page refresh...');
    
    // Update the UI state directly without refetching
    if (update.draft_status) {
      setDraftStatus(update.draft_status);
      
      // Also update the settings state if it exists
      setSettings(prev => prev ? {
        ...prev,
        draft_status: update.draft_status
      } : null);
      
      // Show toast notification
      const statusMessages = {
        active: update.auto_opened ? '🔓 Draft automatically opened!' : '✅ Draft is now ACTIVE',
        closed: update.auto_closed ? '🔒 Draft automatically closed!' : '🚫 Draft is now CLOSED',
        pending: '⏳ Draft is now PENDING'
      };
      
      setToast({
        message: statusMessages[update.draft_status as keyof typeof statusMessages] || 'Draft status updated',
        type: update.draft_status === 'active' ? 'success' : 'info'
      });
      
      // Auto-hide toast after 5 seconds
      setTimeout(() => setToast(null), 5000);
      
      console.log(`🎉 Draft status changed to: ${update.draft_status.toUpperCase()}`);
    }
  }, []);

  useDraftWebSocket(
    leagueId,
    handleDraftStatusChange
  );

  // Helper function to convert IST datetime-local format to UTC ISO string
  const convertISTToUTC = (istDatetimeLocal: string | null): string | null => {
    if (!istDatetimeLocal) return null;
    
    console.log('🔵 Input datetime-local value:', istDatetimeLocal);
    
    // Parse the datetime-local value and treat it as IST
    // Format: "YYYY-MM-DDTHH:mm"
    const istTimeString = istDatetimeLocal + ':00+05:30'; // Append IST timezone
    const istDate = new Date(istTimeString);
    
    console.log('🟢 Parsed as IST:', istDate.toISOString());
    console.log('🟢 Display check:', new Date(istDate).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short'
    }));
    
    return istDate.toISOString();
  };

  const updateDraftStatus = async () => {
    setIsSaving(true);
    try {
      const response = await fetchWithTokenRefresh('/api/fantasy/draft/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          league_id: leagueId,
          draft_status: draftStatus,
          draft_opens_at: convertISTToUTC(opensAt),
          draft_closes_at: convertISTToUTC(closesAt),
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
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-5">
          <div className={`px-6 py-4 rounded-lg shadow-lg ${
            toast.type === 'success' ? 'bg-green-500 text-white' :
            toast.type === 'warning' ? 'bg-yellow-500 text-white' :
            'bg-blue-500 text-white'
          }`}>
            <div className="flex items-center gap-3">
              <span className="text-2xl">
                {toast.type === 'success' ? '✅' : '🔔'}
              </span>
              <span className="font-semibold">{toast.message}</span>
              <button 
                onClick={() => setToast(null)}
                className="ml-4 text-white/80 hover:text-white"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}
      
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
                    Opens: {new Date(settings.draft_opens_at).toLocaleString('en-IN', {
                      timeZone: 'Asia/Kolkata',
                      dateStyle: 'medium',
                      timeStyle: 'short'
                    })} IST
                  </span>
                )}
                {settings.draft_closes_at && (
                  <span className="text-sm text-gray-600">
                    Closes: {new Date(settings.draft_closes_at).toLocaleString('en-IN', {
                      timeZone: 'Asia/Kolkata',
                      dateStyle: 'medium',
                      timeStyle: 'short'
                    })} IST
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
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-700">Draft Period Timing</h3>
                <div className="flex items-center gap-2 text-xs text-gray-600 bg-blue-50 px-3 py-1 rounded-full">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium">Times are in IST (Indian Standard Time)</span>
                </div>
              </div>
              
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
                  <p className="text-xs text-gray-500 mt-1">When teams can start drafting</p>
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
                  <p className="text-xs text-gray-500 mt-1">Draft auto-closes at this time</p>
                </div>
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

            {/* Info Boxes */}
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">Status Guide:</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li><strong>Pending:</strong> Draft hasn't started yet. Teams can view but not draft.</li>
                  <li><strong>Active:</strong> Draft is open. Teams can draft players.</li>
                  <li><strong>Closed:</strong> Draft period ended. Teams must use transfer windows.</li>
                </ul>
              </div>
              
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="font-semibold text-amber-900 mb-2">⏰ Auto-Close Feature:</h4>
                <p className="text-sm text-amber-800">
                  When "Closes At" time is set, the draft will automatically close when the deadline passes (similar to lineup deadlines). 
                  Teams will see the countdown timer and won't be able to draft after the deadline.
                </p>
              </div>
              
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h4 className="font-semibold text-purple-900 mb-2">🌏 Timezone Information:</h4>
                <p className="text-sm text-purple-800">
                  All times are in <strong>IST (Indian Standard Time, UTC+5:30)</strong>. When setting deadlines:
                </p>
                <ul className="text-sm text-purple-800 mt-2 space-y-1 ml-4 list-disc">
                  <li>Your browser automatically uses your local timezone</li>
                  <li>The system converts and stores times correctly</li>
                  <li>Teams see deadlines in their local timezone</li>
                  <li>Auto-close happens based on server time (IST)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
