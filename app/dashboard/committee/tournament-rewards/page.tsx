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
  football_budget?: number;
  real_player_budget?: number;
  position_reward?: { ecoin: number; sscoin: number };
  completion_reward?: { ecoin: number; sscoin: number };
}

interface RewardStatus {
  distributed: boolean;
  date: string | null;
  teams_count: number;
  total_ecoin: number;
  total_sscoin: number;
  distributed_by: string | null;
}

interface RewardsStatus {
  position_rewards: RewardStatus;
  knockout_rewards: RewardStatus;
  completion_bonus: RewardStatus;
}

export default function TournamentRewardsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { isCommitteeAdmin, userSeasonId } = usePermissions();

  const [seasonId, setSeasonId] = useState<string>('');
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [teamStandings, setTeamStandings] = useState<TeamStats[]>([]);
  const [rewardsStatus, setRewardsStatus] = useState<RewardsStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDistributing, setIsDistributing] = useState(false);
  const [distributionLog, setDistributionLog] = useState<string[]>([]);
  const [whatsappMessages, setWhatsappMessages] = useState<{ summary: string; individual: string[] } | null>(null);

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

      if (!userSeasonId) {
        console.error('No season ID found');
        return;
      }

      setSeasonId(userSeasonId);

      const response = await fetchWithTokenRefresh(`/api/tournaments?season_id=${userSeasonId}`);
      const data = await response.json();

      if (data.success) {
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
      const response = await fetchWithTokenRefresh(`/api/tournaments/${tournamentId}/standings-with-budgets?season_id=${seasonId}`);
      const data = await response.json();

      if (data.success && data.standings) {
        setTeamStandings(data.standings);
      }
    } catch (error) {
      console.error('Error loading standings:', error);
    }
  };

  const loadRewardsStatus = async (tournamentId: string) => {
    try {
      const response = await fetchWithTokenRefresh(`/api/tournaments/${tournamentId}/rewards/status`);
      const data = await response.json();

      if (data.success) {
        setRewardsStatus(data.status);
      }
    } catch (error) {
      console.error('Error loading rewards status:', error);
    }
  };

  const handleTournamentSelect = async (tournament: Tournament) => {
    setSelectedTournament(tournament);
    setDistributionLog([]);
    await loadTournamentStandings(tournament.id);
    await loadRewardsStatus(tournament.id);
  };

  const distributeRewards = async (rewardType: 'position' | 'knockout' | 'completion') => {
    if (!selectedTournament || !seasonId || !user) return;

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
          reward_type: rewardType,
          distributed_by: user.uid,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setDistributionLog(data.log || ['Rewards distributed successfully!']);
        setWhatsappMessages(data.whatsapp_messages || null);
        await loadTournamentStandings(selectedTournament.id);
        await loadRewardsStatus(selectedTournament.id);
      } else {
        setDistributionLog([`Error: ${data.error}`]);
        setWhatsappMessages(null);
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

  const formatDate = (date: string | null) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
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
          <div key="tournament-selection" className="lg:col-span-1">
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
                      className={`w-full text-left p-4 rounded-lg border-2 transition-all ${selectedTournament?.id === tournament.id
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-indigo-300 bg-white'
                        }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-gray-900">{tournament.tournament_name}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tournament.status === 'active' ? 'bg-green-100 text-green-700' :
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
          <div key="rewards-distribution" className="lg:col-span-2">
            {!selectedTournament ? (
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-12 text-center">
                <div className="text-6xl mb-4">🏆</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Select a Tournament</h3>
                <p className="text-gray-600">Choose a tournament from the list to view standings and distribute rewards</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Rewards Status & Distribution */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-6">
                    {selectedTournament.tournament_name}
                  </h2>

                  {/* Rewards Status Grid */}
                  {rewardsStatus && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      {/* Position Rewards Status */}
                      <div key="position-status" className={`rounded-lg p-4 border-2 ${rewardsStatus.position_rewards.distributed
                        ? 'bg-green-50 border-green-200'
                        : 'bg-gray-50 border-gray-200'
                        }`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-gray-700">Position Rewards</span>
                          {rewardsStatus.position_rewards.distributed ? (
                            <span className="text-green-600 text-xl">✅</span>
                          ) : (
                            <span className="text-gray-400 text-xl">⚠️</span>
                          )}
                        </div>
                        {rewardsStatus.position_rewards.distributed ? (
                          <div>
                            <p className="text-xs text-gray-600 mb-1">
                              Distributed: {formatDate(rewardsStatus.position_rewards.date)}
                            </p>
                            <p className="text-xs text-gray-600">
                              {rewardsStatus.position_rewards.teams_count} teams •
                              {rewardsStatus.position_rewards.total_ecoin} ECoin
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500">Not yet distributed</p>
                        )}
                      </div>

                      {/* Knockout Rewards Status */}
                      <div key="knockout-status" className={`rounded-lg p-4 border-2 ${rewardsStatus.knockout_rewards.distributed
                        ? 'bg-green-50 border-green-200'
                        : 'bg-gray-50 border-gray-200'
                        }`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-gray-700">Knockout Rewards</span>
                          {rewardsStatus.knockout_rewards.distributed ? (
                            <span className="text-green-600 text-xl">✅</span>
                          ) : (
                            <span className="text-gray-400 text-xl">⚠️</span>
                          )}
                        </div>
                        {rewardsStatus.knockout_rewards.distributed ? (
                          <div>
                            <p className="text-xs text-gray-600 mb-1">
                              Distributed: {formatDate(rewardsStatus.knockout_rewards.date)}
                            </p>
                            <p className="text-xs text-gray-600">
                              {rewardsStatus.knockout_rewards.teams_count} teams •
                              {rewardsStatus.knockout_rewards.total_ecoin} ECoin
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500">Not yet distributed</p>
                        )}
                      </div>

                      {/* Completion Bonus Status */}
                      <div key="completion-status" className={`rounded-lg p-4 border-2 ${rewardsStatus.completion_bonus.distributed
                        ? 'bg-green-50 border-green-200'
                        : 'bg-gray-50 border-gray-200'
                        }`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-gray-700">Completion Bonus</span>
                          {rewardsStatus.completion_bonus.distributed ? (
                            <span className="text-green-600 text-xl">✅</span>
                          ) : (
                            <span className="text-gray-400 text-xl">⚠️</span>
                          )}
                        </div>
                        {rewardsStatus.completion_bonus.distributed ? (
                          <div>
                            <p className="text-xs text-gray-600 mb-1">
                              Distributed: {formatDate(rewardsStatus.completion_bonus.date)}
                            </p>
                            <p className="text-xs text-gray-600">
                              {rewardsStatus.completion_bonus.teams_count} teams •
                              {rewardsStatus.completion_bonus.total_ecoin} ECoin
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500">Not yet distributed</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Distribution Buttons */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button
                      key="position-button"
                      onClick={() => distributeRewards('position')}
                      disabled={isDistributing || teamStandings.length === 0 || rewardsStatus?.position_rewards.distributed}
                      className="px-6 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                    >
                      <span>💰</span>
                      <div className="text-left">
                        <div className="text-sm">Position</div>
                        <div className="text-xs opacity-80">
                          {rewardsStatus?.position_rewards.distributed ? 'Distributed' : 'Distribute'}
                        </div>
                      </div>
                    </button>

                    <button
                      key="knockout-button"
                      onClick={() => distributeRewards('knockout')}
                      disabled={isDistributing || teamStandings.length === 0 || rewardsStatus?.knockout_rewards.distributed}
                      className="px-6 py-4 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-lg hover:shadow-lg transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                    >
                      <span>🏆</span>
                      <div className="text-left">
                        <div className="text-sm">Knockout</div>
                        <div className="text-xs opacity-80">
                          {rewardsStatus?.knockout_rewards.distributed ? 'Distributed' : 'Distribute'}
                        </div>
                      </div>
                    </button>

                    <button
                      key="completion-button"
                      onClick={() => distributeRewards('completion')}
                      disabled={isDistributing || teamStandings.length === 0 || rewardsStatus?.completion_bonus.distributed}
                      className="px-6 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg hover:shadow-lg transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                    >
                      <span>🎁</span>
                      <div className="text-left">
                        <div className="text-sm">Completion</div>
                        <div className="text-xs opacity-80">
                          {rewardsStatus?.completion_bonus.distributed ? 'Distributed' : 'Distribute'}
                        </div>
                      </div>
                    </button>
                  </div>
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

                {/* WhatsApp Messages */}
                {whatsappMessages && (
                  <div className="bg-white rounded-xl shadow-lg border border-green-200 p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <span>📱 WhatsApp Messages</span>
                    </h3>

                    {/* Summary Message */}
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-gray-800">📊 Summary Message (All Teams)</h4>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(whatsappMessages.summary);
                            alert('Summary message copied to clipboard!');
                          }}
                          className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                        >
                          📋 Copy
                        </button>
                      </div>
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <pre className="text-sm whitespace-pre-wrap font-sans text-gray-800">
                          {whatsappMessages.summary}
                        </pre>
                      </div>
                    </div>

                    {/* Individual Messages */}
                    <div>
                      <h4 className="font-semibold text-gray-800 mb-3">👥 Individual Team Messages ({whatsappMessages.individual.length})</h4>
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {whatsappMessages.individual.map((message, index) => (
                          <div key={index} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                            <div className="flex items-start justify-between mb-2">
                              <span className="text-xs font-semibold text-gray-600">Message {index + 1}</span>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(message);
                                  alert(`Message ${index + 1} copied to clipboard!`);
                                }}
                                className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                              >
                                📋 Copy
                              </button>
                            </div>
                            <pre className="text-xs whitespace-pre-wrap font-sans text-gray-700">
                              {message}
                            </pre>
                          </div>
                        ))}
                      </div>
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
                            <th className="px-4 py-3 text-center text-xs font-semibold text-blue-600 uppercase">ECoin</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-green-600 uppercase">SSCoin</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-purple-600 uppercase">Pos Reward</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-orange-600 uppercase">Comp Reward</th>
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
                              <td className="px-4 py-3 text-sm text-blue-600 text-center font-medium">
                                {team.football_budget?.toLocaleString() || 0}
                              </td>
                              <td className="px-4 py-3 text-sm text-green-600 text-center font-medium">
                                {team.real_player_budget?.toLocaleString() || 0}
                              </td>
                              <td className="px-4 py-3 text-sm text-center">
                                {team.position_reward && (team.position_reward.ecoin > 0 || team.position_reward.sscoin > 0) ? (
                                  <div className="flex flex-col gap-1">
                                    {team.position_reward.ecoin > 0 && (
                                      <span className="text-blue-600 font-semibold">+{team.position_reward.ecoin}</span>
                                    )}
                                    {team.position_reward.sscoin > 0 && (
                                      <span className="text-green-600 font-semibold">+{team.position_reward.sscoin}</span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm text-center">
                                {team.completion_reward && (team.completion_reward.ecoin > 0 || team.completion_reward.sscoin > 0) ? (
                                  <div className="flex flex-col gap-1">
                                    {team.completion_reward.ecoin > 0 && (
                                      <span className="text-blue-600 font-semibold">+{team.completion_reward.ecoin}</span>
                                    )}
                                    {team.completion_reward.sscoin > 0 && (
                                      <span className="text-green-600 font-semibold">+{team.completion_reward.sscoin}</span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
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
            <li key="position-info">• <strong>Position Rewards:</strong> Distributed once based on final standings (cannot be re-distributed)</li>
            <li key="knockout-info">• <strong>Knockout Rewards:</strong> Distributed after knockout stages complete (cannot be re-distributed)</li>
            <li key="completion-info">• <strong>Completion Bonus:</strong> Given to ALL teams that completed the tournament (one-time only)</li>
            <li key="tracking-info">• <strong>Tracking:</strong> All distributions are tracked to prevent duplicates</li>
            <li key="status-info">• <strong>Status Indicators:</strong> Green checkmark (✅) means already distributed, Warning (⚠️) means pending</li>
            <li key="transaction-info">• All rewards are recorded in team transaction history with proper descriptions</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
