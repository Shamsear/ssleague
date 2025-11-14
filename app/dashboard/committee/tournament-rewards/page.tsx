'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';
import { usePermissions } from '@/hooks/usePermissions';

interface Tournament {
  id: string;
  tournament_name: string;
  tournament_type: string;
  status: string;
  rewards: any;
  has_league_stage: boolean;
  has_group_stage: boolean;
  has_knockout_stage: boolean;
}

interface TeamStats {
  id: string;
  team_id: string;
  team_name: string;
  position: number;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
}

export default function TournamentRewardsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { isCommitteeAdmin, userSeasonId } = usePermissions();
  
  const [seasonId, setSeasonId] = useState<string>('');
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [teamStandings, setTeamStandings] = useState<TeamStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDistributing, setIsDistributing] = useState(false);
  const [distributionLog, setDistributionLog] = useState<string[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }
    if (!loading && user && !isCommitteeAdmin) {
      router.push('/dashboard');
    }
  }, [user, loading, router, isCommitteeAdmin]);

  useEffect(() => {
    if (user && userSeasonId) {
      loadData();
    }
  }, [user, userSeasonId]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      // Get active season from usePermissions hook
      if (!userSeasonId) {
        console.error('No season ID found');
        return;
      }
      
      setSeasonId(userSeasonId);
      
      // Load tournaments for this season
      const response = await fetchWithTokenRefresh(`/api/tournaments?season_id=${userSeasonId}`);
      const data = await response.json();
      
      if (data.success) {
        // Filter tournaments that have rewards configured
        const tournamentsWithRewards = data.tournaments.filter((t: Tournament) => 
          t.rewards && Object.keys(t.rewards).length > 0
        );
        setTournaments(tournamentsWithRewards);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTournamentStandings = async (tournamentId: string) => {
    try {
      const response = await fetchWithTokenRefresh(`/api/tournaments/${tournamentId}/standings`);
      const data = await response.json();
      
      if (data.success && data.standings) {
        setTeamStandings(data.standings);
      }
    } catch (error) {
      console.error('Error loading standings:', error);
    }
  };

  const handleTournamentSelect = async (tournament: Tournament) => {
    setSelectedTournament(tournament);
    setDistributionLog([]);
    await loadTournamentStandings(tournament.id);
  };

  const distributeRewards = async () => {
    if (!selectedTournament || !seasonId) return;
    
    setIsDistributing(true);
    setDistributionLog([]);
    
    try {
      const response = await fetchWithTokenRefresh('/api/tournaments/distribute-rewards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tournament_id: selectedTournament.id,
          season_id: seasonId,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setDistributionLog(data.log || ['Rewards distributed successfully!']);
        // Reload standings to show updated balances
        await loadTournamentStandings(selectedTournament.id);
      } else {
        setDistributionLog([`Error: ${data.error}`]);
      }
    } catch (error: any) {
      console.error('Error distributing rewards:', error);
      setDistributionLog([`Error: ${error.message}`]);
    } finally {
      setIsDistributing(false);
    }
  };

  const getRewardsSummary = (tournament: Tournament) => {
    if (!tournament.rewards) return 'No rewards configured';
    
    const parts: string[] = [];
    
    if (tournament.rewards.match_results) {
      parts.push('Match Rewards');
    }
    if (tournament.rewards.league_positions && tournament.rewards.league_positions.length > 0) {
      parts.push(`${tournament.rewards.league_positions.length} Position Rewards`);
    }
    if (tournament.rewards.knockout_stages && Object.keys(tournament.rewards.knockout_stages).length > 0) {
      parts.push('Knockout Rewards');
    }
    if (tournament.rewards.completion_bonus) {
      parts.push('Completion Bonus');
    }
    
    return parts.join(' • ') || 'Configured';
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard/committee"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-4xl font-bold text-gray-900">Tournament Rewards Distribution</h1>
            <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-semibold">
              Committee
            </span>
          </div>
          <p className="text-gray-600">Distribute end-of-tournament rewards based on standings and results</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Tournament Selection */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Select Tournament</h2>
              
              {tournaments.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="mb-2">No tournaments with rewards configured</p>
                  <Link
                    href="/dashboard/committee/team-management/tournament"
                    className="text-blue-600 hover:text-blue-700 text-sm"
                  >
                    Create Tournament →
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {tournaments.map((tournament) => (
                    <button
                      key={tournament.id}
                      onClick={() => handleTournamentSelect(tournament)}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                        selectedTournament?.id === tournament.id
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-200 hover:border-indigo-300 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-gray-900">{tournament.tournament_name}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          tournament.status === 'active' ? 'bg-green-100 text-green-700' :
                          tournament.status === 'completed' ? 'bg-gray-100 text-gray-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {tournament.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mb-2">
                        {tournament.tournament_type.toUpperCase()}
                      </p>
                      <p className="text-xs text-indigo-600 font-medium">
                        {getRewardsSummary(tournament)}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Rewards Distribution */}
          <div className="lg:col-span-2">
            {!selectedTournament ? (
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-12 text-center">
                <div className="text-6xl mb-4">🏆</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Select a Tournament</h3>
                <p className="text-gray-600">Choose a tournament from the list to view standings and distribute rewards</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Rewards Configuration Summary */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">
                    {selectedTournament.tournament_name}
                  </h2>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {selectedTournament.rewards.league_positions && selectedTournament.rewards.league_positions.length > 0 && (
                      <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                        <div className="text-xs text-purple-600 font-medium mb-1">League Positions</div>
                        <div className="text-2xl font-bold text-purple-700">
                          {selectedTournament.rewards.league_positions.length}
                        </div>
                      </div>
                    )}
                    
                    {selectedTournament.rewards.knockout_stages && Object.keys(selectedTournament.rewards.knockout_stages).length > 0 && (
                      <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                        <div className="text-xs text-orange-600 font-medium mb-1">Knockout Stages</div>
                        <div className="text-2xl font-bold text-orange-700">
                          {Object.keys(selectedTournament.rewards.knockout_stages).length}
                        </div>
                      </div>
                    )}
                    
                    {selectedTournament.rewards.completion_bonus && (
                      <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                        <div className="text-xs text-blue-600 font-medium mb-1">Completion Bonus</div>
                        <div className="text-lg font-bold text-blue-700">
                          {selectedTournament.rewards.completion_bonus.ecoin || 0} / {selectedTournament.rewards.completion_bonus.sscoin || 0}
                        </div>
                      </div>
                    )}
                    
                    {selectedTournament.rewards.match_results && (
                      <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                        <div className="text-xs text-green-600 font-medium mb-1">Match Rewards</div>
                        <div className="text-sm font-bold text-green-700">Auto-distributed</div>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={distributeRewards}
                    disabled={isDistributing || teamStandings.length === 0}
                    className="w-full px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                  >
                    {isDistributing ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        Distributing Rewards...
                      </>
                    ) : (
                      <>
                        <span>💰</span>
                        Distribute All Rewards
                      </>
                    )}
                  </button>
                </div>

                {/* Distribution Log */}
                {distributionLog.length > 0 && (
                  <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Distribution Log</h3>
                    <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
                      {distributionLog.map((log, index) => (
                        <div key={index} className="text-sm text-gray-700 mb-1 font-mono">
                          {log}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Team Standings */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Current Standings</h3>
                  
                  {teamStandings.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No standings available for this tournament
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Pos</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Team</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">P</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">W</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">D</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">L</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">GD</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Pts</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {teamStandings.map((team) => (
                            <tr key={team.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm font-bold text-gray-900">{team.position}</td>
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">{team.team_name}</td>
                              <td className="px-4 py-3 text-sm text-gray-600 text-center">
                                {team.wins + team.draws + team.losses}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600 text-center">{team.wins}</td>
                              <td className="px-4 py-3 text-sm text-gray-600 text-center">{team.draws}</td>
                              <td className="px-4 py-3 text-sm text-gray-600 text-center">{team.losses}</td>
                              <td className="px-4 py-3 text-sm text-gray-600 text-center">
                                {team.goal_difference > 0 ? '+' : ''}{team.goal_difference}
                              </td>
                              <td className="px-4 py-3 text-sm font-bold text-indigo-600 text-center">
                                {team.points}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">💡 How Rewards Distribution Works:</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• <strong>Match Rewards:</strong> Already distributed automatically after each match</li>
            <li>• <strong>League Position Rewards:</strong> Based on final standings (position in table)</li>
            <li>• <strong>Knockout Stage Rewards:</strong> For winners, runners-up, and losers at each knockout stage</li>
            <li>• <strong>Group Elimination Rewards:</strong> For teams eliminated in group stage (Group+Knockout format)</li>
            <li>• <strong>Completion Bonus:</strong> Given to ALL teams that completed the tournament</li>
            <li>• All rewards are recorded in team transaction history with proper descriptions</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
