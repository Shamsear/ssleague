'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useModal } from '@/hooks/useModal';
import AlertModal from '@/components/modals/AlertModal';

interface FantasyTeam {
  id: string;
  team_name: string;
  owner_name: string;
  total_points: number;
  player_count: number;
  rank: number;
}

interface Player {
  draft_id: string;
  real_player_id: string;
  player_name: string;
  total_points: number;
  matches_played: number;
  average_points: number;
}

export default function FantasyTeamsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const leagueId = params?.leagueId as string;

  const [league, setLeague] = useState<any>(null);
  const [teams, setTeams] = useState<FantasyTeam[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<FantasyTeam | null>(null);
  const [teamPlayers, setTeamPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(false);

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
    const loadLeagueData = async () => {
      if (!leagueId) return;

      try {
        const response = await fetch(`/api/fantasy/leagues/${leagueId}`);
        if (!response.ok) throw new Error('Failed to load league');

        const data = await response.json();
        setLeague(data.league);
        setTeams(data.teams || []);
        
        // Auto-select first team
        if (data.teams && data.teams.length > 0) {
          loadTeamPlayers(data.teams[0]);
        }
      } catch (error) {
        console.error('Error loading league:', error);
        showAlert({
          type: 'error',
          title: 'Error',
          message: 'Failed to load fantasy league data',
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      loadLeagueData();
    }
  }, [user, leagueId]);

  const loadTeamPlayers = async (team: FantasyTeam) => {
    setSelectedTeam(team);
    setIsLoadingPlayers(true);

    try {
      const response = await fetch(`/api/fantasy/teams/${team.id}`);
      if (!response.ok) throw new Error('Failed to load team players');

      const data = await response.json();
      setTeamPlayers(data.players || []);
    } catch (error) {
      console.error('Error loading team players:', error);
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Failed to load team players',
      });
    } finally {
      setIsLoadingPlayers(false);
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

  if (!user || !league) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">
      <AlertModal {...alertState} onClose={closeAlert} />

      <div className="container mx-auto px-4 py-8 max-w-7xl">
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
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-xl">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Fantasy Teams</h1>
              <p className="text-gray-600 mt-1">{league.name} - Team Rosters</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Teams List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Teams ({teams.length})</h2>
              
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {teams.map((team) => (
                  <button
                    key={team.id}
                    onClick={() => loadTeamPlayers(team)}
                    className={`w-full text-left p-4 rounded-xl transition-all ${
                      selectedTeam?.id === team.id
                        ? 'bg-gradient-to-r from-indigo-500 to-blue-600 text-white shadow-lg'
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-900'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-semibold">{team.team_name}</p>
                        <p className={`text-sm ${selectedTeam?.id === team.id ? 'text-indigo-100' : 'text-gray-600'}`}>
                          {team.owner_name}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">{team.total_points}</p>
                        <p className={`text-xs ${selectedTeam?.id === team.id ? 'text-indigo-100' : 'text-gray-500'}`}>
                          {team.player_count} players
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Team Roster */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6">
              {selectedTeam ? (
                <>
                  <div className="mb-6 pb-4 border-b border-gray-200">
                    <h2 className="text-2xl font-bold text-gray-900">{selectedTeam.team_name}</h2>
                    <p className="text-gray-600">Owner: {selectedTeam.owner_name}</p>
                    <div className="flex gap-6 mt-3">
                      <div>
                        <p className="text-sm text-gray-500">Total Points</p>
                        <p className="text-2xl font-bold text-indigo-600">{selectedTeam.total_points}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Players</p>
                        <p className="text-2xl font-bold text-gray-900">{selectedTeam.player_count}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Rank</p>
                        <p className="text-2xl font-bold text-gray-900">#{selectedTeam.rank || '-'}</p>
                      </div>
                    </div>
                  </div>

                  {isLoadingPlayers ? (
                    <div className="text-center py-12">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto"></div>
                      <p className="mt-3 text-gray-600">Loading players...</p>
                    </div>
                  ) : teamPlayers.length === 0 ? (
                    <div className="text-center py-12">
                      <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                      </svg>
                      <p className="text-gray-500">No players drafted yet</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[600px] overflow-y-auto">
                      {teamPlayers.map((player, index) => (
                        <div
                          key={player.draft_id}
                          className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl hover:from-indigo-50 hover:to-blue-50 transition-all"
                        >
                          <div className="flex items-center gap-4 flex-1">
                            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900">{player.player_name}</p>
                              <p className="text-sm text-gray-600">
                                {player.matches_played} matches • {player.average_points} avg pts
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-bold text-indigo-600">{player.total_points}</p>
                            <p className="text-xs text-gray-500">total points</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <p className="text-gray-500">Select a team to view roster</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
