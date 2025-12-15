'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface Player {
  player_id: string;
  player_name: string;
  position: string;
  team: string;
  is_captain?: boolean;
  is_vice_captain?: boolean;
}

interface TeamLineup {
  team_id: string;
  team_name: string;
  owner_uid: string;
  total_points: number;
  draft_submitted: boolean;
  squad_size: number;
  starters_count: number;
  has_captain: boolean;
  has_vice_captain: boolean;
  lineup_complete: boolean;
  starters: Player[];
  substitutes: Player[];
  captain: Player | null;
  vice_captain: Player | null;
}

interface Summary {
  total_teams: number;
  teams_with_complete_lineup: number;
  teams_without_lineup: number;
  teams_missing_captain: number;
  teams_missing_vice_captain: number;
  teams_wrong_starters: number;
}

export default function FantasyLineupsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const leagueId = params?.leagueId as string;

  const [teams, setTeams] = useState<TeamLineup[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'complete' | 'incomplete'>('all');
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);

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
      loadLineups();
    }
  }, [user, leagueId]);

  const loadLineups = async () => {
    try {
      const response = await fetchWithTokenRefresh(`/api/admin/fantasy/lineups?league_id=${leagueId}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('API Error:', response.status, errorData);
        throw new Error(errorData.error || `Failed to load lineups (${response.status})`);
      }

      const data = await response.json();
      console.log('Lineups loaded:', data);
      setTeams(data.teams || []);
      setSummary(data.summary || null);
    } catch (error) {
      console.error('Error loading lineups:', error);
      alert(`Failed to load lineups: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading lineups...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const filteredTeams = teams.filter(team => {
    if (filter === 'complete') return team.lineup_complete;
    if (filter === 'incomplete') return !team.lineup_complete;
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href={`/dashboard/committee/fantasy/${leagueId}`}
            className="inline-flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Fantasy League
          </Link>

          <h1 className="text-3xl font-bold text-gray-900 mb-2">Team Lineups Overview</h1>
          <p className="text-gray-600">View all teams' starting lineups, captains, and vice-captains</p>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Teams</p>
                  <p className="text-3xl font-bold text-gray-900">{summary.total_teams}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Complete Lineups</p>
                  <p className="text-3xl font-bold text-green-600">{summary.teams_with_complete_lineup}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Incomplete Lineups</p>
                  <p className="text-3xl font-bold text-red-600">{summary.teams_without_lineup}</p>
                </div>
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setFilter('all')}
              className={`flex-1 px-6 py-3 text-sm font-semibold transition-colors ${
                filter === 'all'
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All Teams ({teams.length})
            </button>
            <button
              onClick={() => setFilter('complete')}
              className={`flex-1 px-6 py-3 text-sm font-semibold transition-colors ${
                filter === 'complete'
                  ? 'text-green-600 border-b-2 border-green-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Complete ({summary?.teams_with_complete_lineup || 0})
            </button>
            <button
              onClick={() => setFilter('incomplete')}
              className={`flex-1 px-6 py-3 text-sm font-semibold transition-colors ${
                filter === 'incomplete'
                  ? 'text-red-600 border-b-2 border-red-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Incomplete ({summary?.teams_without_lineup || 0})
            </button>
          </div>
        </div>

        {/* Teams List */}
        <div className="space-y-4">
          {filteredTeams.map(team => (
            <div
              key={team.team_id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
            >
              {/* Team Header */}
              <button
                onClick={() => setExpandedTeam(expandedTeam === team.team_id ? null : team.team_id)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white ${
                    team.lineup_complete ? 'bg-green-500' : 'bg-red-500'
                  }`}>
                    {team.lineup_complete ? '✓' : '✗'}
                  </div>
                  <div className="text-left">
                    <h3 className="text-lg font-bold text-gray-900">{team.team_name}</h3>
                    <p className="text-sm text-gray-600">
                      {team.starters_count}/5 starters • 
                      {team.has_captain ? ' ✓ Captain' : ' ✗ Captain'} • 
                      {team.has_vice_captain ? ' ✓ Vice-Captain' : ' ✗ Vice-Captain'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Total Points</p>
                    <p className="text-lg font-bold text-gray-900">{team.total_points}</p>
                  </div>
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${
                      expandedTeam === team.team_id ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* Expanded Team Details */}
              {expandedTeam === team.team_id && (
                <div className="border-t border-gray-200 p-6 bg-gray-50">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Starting 5 */}
                    <div>
                      <h4 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <span className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-sm">
                          {team.starters_count}
                        </span>
                        Starting 5
                      </h4>
                      {team.starters.length === 0 ? (
                        <p className="text-sm text-gray-500 italic">No starters selected</p>
                      ) : (
                        <div className="space-y-2">
                          {team.starters.map(player => (
                            <div
                              key={player.player_id}
                              className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200"
                            >
                              <div>
                                <p className="font-semibold text-gray-900">{player.player_name}</p>
                                <p className="text-xs text-gray-600">{player.position} • {player.team}</p>
                              </div>
                              <div className="flex gap-2">
                                {player.is_captain && (
                                  <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold rounded">
                                    👑 C
                                  </span>
                                )}
                                {player.is_vice_captain && (
                                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded">
                                    ⭐ VC
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Substitutes */}
                    <div>
                      <h4 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <span className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center text-white text-sm">
                          {team.substitutes.length}
                        </span>
                        Substitutes
                      </h4>
                      {team.substitutes.length === 0 ? (
                        <p className="text-sm text-gray-500 italic">No substitutes</p>
                      ) : (
                        <div className="space-y-2">
                          {team.substitutes.map(player => (
                            <div
                              key={player.player_id}
                              className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200"
                            >
                              <div>
                                <p className="font-semibold text-gray-900">{player.player_name}</p>
                                <p className="text-xs text-gray-600">{player.position} • {player.team}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Captain & Vice-Captain Summary */}
                  <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg p-4 border-2 border-yellow-300">
                      <p className="text-sm font-semibold text-gray-700 mb-1">👑 Captain (2x Points)</p>
                      {team.captain ? (
                        <p className="text-lg font-bold text-gray-900">{team.captain.player_name}</p>
                      ) : (
                        <p className="text-sm text-red-600 font-semibold">Not selected</p>
                      )}
                    </div>
                    <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-4 border-2 border-blue-300">
                      <p className="text-sm font-semibold text-gray-700 mb-1">⭐ Vice-Captain (1.5x Points)</p>
                      {team.vice_captain ? (
                        <p className="text-lg font-bold text-gray-900">{team.vice_captain.player_name}</p>
                      ) : (
                        <p className="text-sm text-red-600 font-semibold">Not selected</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {filteredTeams.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-200">
              <p className="text-gray-500">No teams found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
