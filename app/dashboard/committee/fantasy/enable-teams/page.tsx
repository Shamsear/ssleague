'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, CheckCircle, XCircle, AlertCircle, RefreshCw, ToggleLeft, ToggleRight } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface TeamStatus {
  id: string;
  name: string;
  fantasy_participating: boolean;
  fantasy_joined_at: any;
}

interface StatusCheck {
  total_teams: number;
  fantasy_enabled_count: number;
  fantasy_disabled_count: number;
  teams_with_fantasy: TeamStatus[];
  teams_without_fantasy: TeamStatus[];
}

export default function EnableFantasyTeamsPage() {
  const { user, loading } = useAuth();
  const { userSeasonId } = usePermissions();
  const router = useRouter();

  const [status, setStatus] = useState<StatusCheck | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEnabling, setIsEnabling] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [togglingTeams, setTogglingTeams] = useState<Set<string>>(new Set());

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
    if (userSeasonId) {
      checkStatus();
    }
  }, [userSeasonId]);

  const checkStatus = async () => {
    if (!userSeasonId) return;

    setIsLoading(true);
    setResult(null);
    try {
      const res = await fetchWithTokenRefresh(`/api/fantasy/teams/enable-all?season_id=${userSeasonId}`);
      const data = await res.json();
      
      if (res.ok) {
        setStatus(data);
      } else {
        console.error('Failed to check status:', data.error);
      }
    } catch (error) {
      console.error('Failed to check status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const enableAll = async () => {
    if (!userSeasonId) return;

    if (!confirm('This will enable fantasy participation for ALL teams in this season. Continue?')) {
      return;
    }

    setIsEnabling(true);
    setResult(null);
    try {
      const res = await fetchWithTokenRefresh('/api/fantasy/teams/enable-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season_id: userSeasonId }),
      });

      const data = await res.json();
      
      if (res.ok) {
        setResult(data);
        checkStatus();
      } else {
        alert(data.error || 'Failed to enable teams');
      }
    } catch (error) {
      console.error('Failed to enable teams:', error);
      alert('Failed to enable teams');
    } finally {
      setIsEnabling(false);
    }
  };

  const toggleTeam = async (teamId: string, currentStatus: boolean) => {
    if (!userSeasonId) return;

    setTogglingTeams(prev => new Set(prev).add(teamId));
    try {
      const res = await fetchWithTokenRefresh('/api/fantasy/teams/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          team_id: teamId,
          league_id: userSeasonId.replace('SSPSLS', 'SSPSLFLS'), // Convert season ID to fantasy league ID
          enable: !currentStatus 
        }),
      });

      if (res.ok) {
        checkStatus();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to toggle team');
      }
    } catch (error) {
      console.error('Failed to toggle team:', error);
      alert('Failed to toggle team');
    } finally {
      setTogglingTeams(prev => {
        const newSet = new Set(prev);
        newSet.delete(teamId);
        return newSet;
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard/committee"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Committee Dashboard
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-blue-400 to-purple-500 rounded-xl">
              <Users className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Enable Fantasy Teams</h1>
              <p className="text-gray-600">Bulk enable fantasy participation for existing teams</p>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="glass rounded-3xl shadow-xl backdrop-blur-md border border-white/20 p-6 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-blue-600 mt-1" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">What does this do?</h3>
              <p className="text-gray-700 mb-3">
                This tool enables fantasy league participation for all teams registered in a season. 
                This is useful when creating a fantasy league for seasons where teams weren't asked 
                about fantasy participation during registration.
              </p>
              <p className="text-sm text-gray-600">
                <strong>Note:</strong> Teams can still be individually managed later through the fantasy league settings.
              </p>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="glass rounded-3xl shadow-xl backdrop-blur-md border border-white/20 p-12 mb-6">
            <div className="text-center">
              <RefreshCw className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-600">Loading team status...</p>
            </div>
          </div>
        )}

        {/* Status Display */}
        {status && (
          <div className="glass rounded-3xl shadow-xl backdrop-blur-md border border-white/20 p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Current Status</h2>
            
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-white/60 rounded-xl p-4">
                <p className="text-sm text-gray-600 mb-1">Total Teams</p>
                <p className="text-3xl font-bold text-gray-900">{status.total_teams}</p>
              </div>
              <div className="bg-green-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <p className="text-sm text-green-700">Fantasy Enabled</p>
                </div>
                <p className="text-3xl font-bold text-green-700">{status.fantasy_enabled_count}</p>
              </div>
              <div className="bg-red-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <XCircle className="w-4 h-4 text-red-600" />
                  <p className="text-sm text-red-700">Fantasy Disabled</p>
                </div>
                <p className="text-3xl font-bold text-red-700">{status.fantasy_disabled_count}</p>
              </div>
            </div>

            {/* All Teams List with Toggle */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">All Teams</h3>
              <div className="space-y-2">
                {/* Teams with Fantasy */}
                {status.teams_with_fantasy.map(team => (
                  <div key={team.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="font-medium text-gray-900">{team.name}</span>
                    </div>
                    <button
                      onClick={() => toggleTeam(team.id, team.fantasy_participating)}
                      disabled={togglingTeams.has(team.id)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 disabled:opacity-50 transition-colors"
                    >
                      {togglingTeams.has(team.id) ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <ToggleRight className="w-4 h-4 text-green-600" />
                      )}
                      Disable
                    </button>
                  </div>
                ))}
                
                {/* Teams without Fantasy */}
                {status.teams_without_fantasy.map(team => (
                  <div key={team.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex items-center gap-3">
                      <XCircle className="w-5 h-5 text-red-600" />
                      <span className="font-medium text-gray-900">{team.name}</span>
                    </div>
                    <button
                      onClick={() => toggleTeam(team.id, team.fantasy_participating)}
                      disabled={togglingTeams.has(team.id)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 disabled:opacity-50 transition-colors"
                    >
                      {togglingTeams.has(team.id) ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <ToggleLeft className="w-4 h-4 text-red-600" />
                      )}
                      Enable
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Enable Button */}
            {status.fantasy_disabled_count > 0 && (
              <button
                onClick={enableAll}
                disabled={isEnabling}
                className="w-full px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isEnabling ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Enabling...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Enable Fantasy for All {status.fantasy_disabled_count} Teams
                  </>
                )}
              </button>
            )}

            {status.fantasy_disabled_count === 0 && (
              <div className="text-center py-8">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <p className="text-lg font-semibold text-gray-900">All teams already have fantasy enabled!</p>
              </div>
            )}
          </div>
        )}

        {/* Result Display */}
        {result && (
          <div className="glass rounded-3xl shadow-xl backdrop-blur-md border border-white/20 p-6">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
              <div>
                <h2 className="text-xl font-bold text-gray-900">Success!</h2>
                <p className="text-gray-600">{result.message}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-50 rounded-xl p-4">
                <p className="text-sm text-green-700 mb-1">Newly Enabled</p>
                <p className="text-2xl font-bold text-green-700">{result.details.newly_enabled}</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-4">
                <p className="text-sm text-blue-700 mb-1">Already Enabled</p>
                <p className="text-2xl font-bold text-blue-700">{result.details.already_enabled}</p>
              </div>
            </div>

            {result.details.updated_teams.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Updated Teams:</p>
                <div className="bg-white/60 rounded-lg p-3 max-h-32 overflow-y-auto">
                  <ul className="text-sm text-gray-600 space-y-1">
                    {result.details.updated_teams.map((team: string) => (
                      <li key={team}>✅ {team}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
