'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface FantasyTeam {
  id: string;
  team_name: string;
  total_points: number;
  rank: number;
  player_count: number;
  supported_team_id?: string;
  supported_team_name?: string;
  supported_team_logo?: string;
  passive_points?: number;
}

interface Player {
  draft_id: string;
  real_player_id: string;
  player_name: string;
  draft_order: number;
  total_points: number;
  matches_played: number;
  average_points: number;
  is_captain?: boolean;
  is_vice_captain?: boolean;
}

interface PlayerMatchStats {
  match_id: string;
  round_number: number;
  opponent: string;
  goals_scored: number;
  goals_conceded: number;
  clean_sheet: boolean;
  motm: boolean;
  total_points: number;
}

interface RoundPoints {
  round: number;
  points: number;
}

interface OtherTeam {
  id: string;
  team_name: string;
  owner_name: string;
  total_points: number;
  player_count: number;
  rank: number;
}

export default function MyFantasyTeamPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [fantasyTeam, setFantasyTeam] = useState<FantasyTeam | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [recentRounds, setRecentRounds] = useState<RoundPoints[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [leagueId, setLeagueId] = useState<string>('');
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [playerMatchStats, setPlayerMatchStats] = useState<Record<string, PlayerMatchStats[]>>({});
  const [otherTeams, setOtherTeams] = useState<OtherTeam[]>([]);
  const [showOtherTeams, setShowOtherTeams] = useState(false);
  const [loadingPlayerStats, setLoadingPlayerStats] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'team') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const [canRegister, setCanRegister] = useState(false);
  const [registrationInfo, setRegistrationInfo] = useState<any>(null);
  const [isRegistering, setIsRegistering] = useState(false);

  useEffect(() => {
    const loadFantasyTeam = async () => {
      if (!user) return;

      try {
        // First, get the current season and fantasy league
        const response = await fetchWithTokenRefresh(`/api/fantasy/teams/my-team?user_id=${user.uid}`);
        
        if (response.status === 404) {
          const errorData = await response.json();
          setCanRegister(errorData.can_register || false);
          setRegistrationInfo(errorData.registration_info || null);
          setIsLoading(false);
          return;
        }

        if (!response.ok) {
          throw new Error('Failed to load fantasy team');
        }

        const data = await response.json();
        setFantasyTeam(data.team);
        setPlayers(data.players);
        setRecentRounds(data.recent_rounds || []);
        setLeagueId(data.team.fantasy_league_id);

        // Load other teams
        if (data.team.fantasy_league_id) {
          loadOtherTeams(data.team.fantasy_league_id, data.team.id);
        }
      } catch (error) {
        console.error('Error loading fantasy team:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      loadFantasyTeam();
    }
  }, [user]);

  const loadOtherTeams = async (leagueId: string, myTeamId: string) => {
    try {
      const response = await fetchWithTokenRefresh(`/api/fantasy/leaderboard/${leagueId}`);
      if (!response.ok) return;

      const data = await response.json();
      const others = data.leaderboard.filter((team: OtherTeam) => team.id !== myTeamId);
      setOtherTeams(others);
    } catch (error) {
      console.error('Error loading other teams:', error);
    }
  };

  const loadPlayerMatchStats = async (playerId: string) => {
    if (playerMatchStats[playerId]) {
      // Already loaded
      setExpandedPlayer(expandedPlayer === playerId ? null : playerId);
      return;
    }

    setLoadingPlayerStats({ ...loadingPlayerStats, [playerId]: true });

    try {
      const response = await fetchWithTokenRefresh(`/api/fantasy/players/${playerId}/matches?league_id=${leagueId}`);
      if (!response.ok) {
        const errorData = await response.text();
        console.error('API Error:', response.status, errorData);
        throw new Error(`Failed to load player stats: ${response.status}`);
      }

      const data = await response.json();
      
      // Map API response to frontend format
      const mappedStats = (data.match_history || []).map((match: any) => ({
        match_id: match.fixture_id,
        round_number: match.round_number,
        opponent: match.opponent || 'Unknown',
        goals_scored: match.goals_scored || 0,
        goals_conceded: match.goals_conceded || 0,
        clean_sheet: match.is_clean_sheet || false,
        motm: match.is_motm || false,
        total_points: match.total_points || 0,
      }));
      
      setPlayerMatchStats({ ...playerMatchStats, [playerId]: mappedStats });
      setExpandedPlayer(playerId);
    } catch (error) {
      console.error('Error loading player stats:', error);
    } finally {
      setLoadingPlayerStats({ ...loadingPlayerStats, [playerId]: false });
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

  const handleRegister = async () => {
    if (!user || !canRegister) return;

    setIsRegistering(true);
    try {
      const response = await fetchWithTokenRefresh('/api/fantasy/teams/my-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.uid,
          league_id: registrationInfo?.league_id
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to register');
      }

      const data = await response.json();
      // Reload the page to show the newly created team
      window.location.reload();
    } catch (error) {
      console.error('Error registering for fantasy:', error);
      alert(error instanceof Error ? error.message : 'Failed to register for fantasy league');
    } finally {
      setIsRegistering(false);
    }
  };

  if (!user) return null;

  if (!fantasyTeam) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-20 h-20 bg-gradient-to-br from-gray-300 to-gray-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            {canRegister ? 'Join Fantasy League' : 'No Fantasy League Yet'}
          </h2>
          <p className="text-gray-600 mb-6">
            {canRegister 
              ? `Register for the fantasy league and start building your dream team!`
              : 'The committee hasn\'t created a fantasy league for this season yet.'}
          </p>
          {canRegister ? (
            <div className="space-y-3">
              <button
                onClick={handleRegister}
                disabled={isRegistering}
                className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRegistering ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Registering...
                  </span>
                ) : (
                  '🎮 Register for Fantasy League'
                )}
              </button>
              <Link
                href="/dashboard/team"
                className="inline-block w-full px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-300 transition-colors"
              >
                Back to Dashboard
              </Link>
            </div>
          ) : (
            <Link
              href="/dashboard/team"
              className="inline-block px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
            >
              Back to Dashboard
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard/team"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </Link>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {fantasyTeam.supported_team_logo ? (
                <img 
                  src={fantasyTeam.supported_team_logo} 
                  alt={`${fantasyTeam.team_name} logo`}
                  className="w-16 h-16 rounded-2xl object-cover shadow-xl"
                />
              ) : (
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-xl">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              )}
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{fantasyTeam.team_name}</h1>
                <p className="text-gray-600 mt-1">Your Fantasy Squad</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href={`/dashboard/team/fantasy/draft`}
                className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all shadow-lg"
              >
                ➕ Draft Players & Set Captain
              </Link>
              
              <Link
                href={`/dashboard/team/fantasy/transfers`}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-bold rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all shadow-lg"
              >
                🔄 Transfers
              </Link>
              
              <Link
                href={`/dashboard/team/fantasy/all-teams`}
                className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg"
              >
                👥 All Teams
              </Link>
              
              <Link
                href={`/dashboard/team/fantasy/leaderboard`}
                className="px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold rounded-xl hover:from-yellow-600 hover:to-orange-600 transition-all shadow-lg"
              >
                🏆 Leaderboard
              </Link>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-purple-500">
            <p className="text-sm text-gray-600 mb-1">League Rank</p>
            <p className="text-3xl font-bold text-purple-600">
              {fantasyTeam.rank && fantasyTeam.rank < 999 ? `#${fantasyTeam.rank}` : 'Unranked'}
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
            <p className="text-sm text-gray-600 mb-1">Total Points</p>
            <p className="text-3xl font-bold text-blue-600">{fantasyTeam.total_points}</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
            <p className="text-sm text-gray-600 mb-1">Players</p>
            <p className="text-3xl font-bold text-green-600">{fantasyTeam.player_count}</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-orange-500">
            <p className="text-sm text-gray-600 mb-1">Avg Per Player</p>
            <p className="text-3xl font-bold text-orange-600">
              {fantasyTeam.player_count > 0 ? Math.round((fantasyTeam.total_points / fantasyTeam.player_count) * 10) / 10 : 0}
            </p>
          </div>
        </div>

        {/* Supported Team */}
        {fantasyTeam.supported_team_name && (
          <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-2xl shadow-xl border border-green-200 p-6 mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {fantasyTeam.supported_team_logo ? (
                  <img 
                    src={fantasyTeam.supported_team_logo} 
                    alt={`${fantasyTeam.supported_team_name} logo`}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold text-2xl">
                    {fantasyTeam.supported_team_name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">Supported Team</h3>
                  <p className="text-2xl font-bold text-green-600">{fantasyTeam.supported_team_name}</p>
                  <p className="text-sm text-gray-600 mt-1">Earning passive points from team wins</p>
                </div>
              </div>
              {fantasyTeam.passive_points !== undefined && (
                <div className="text-right">
                  <p className="text-sm text-gray-600">Passive Points</p>
                  <p className="text-3xl font-bold text-blue-600">{fantasyTeam.passive_points}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recent Performance */}
        {recentRounds.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Player Performance</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {recentRounds.map((round) => (
                <div key={round.round} className="text-center p-4 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl">
                  <p className="text-sm text-gray-600 mb-1">Round {round.round}</p>
                  <p className="text-2xl font-bold text-indigo-600">{round.points}</p>
                  <p className="text-xs text-gray-500">pts</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Captain & Vice-Captain Info (Display Only) */}
        {players.some(p => p.is_captain || p.is_vice_captain) && (
          <div className="bg-gradient-to-r from-yellow-50 to-blue-50 rounded-2xl shadow-xl border border-yellow-200 p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Captain & Vice-Captain</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {players.find(p => p.is_captain) && (
                <div className="flex items-center gap-3 p-4 bg-white/60 rounded-xl border border-yellow-300">
                  <span className="text-3xl">👑</span>
                  <div>
                    <p className="text-sm text-gray-600">Captain (2x Points)</p>
                    <p className="font-bold text-gray-900">
                      {players.find(p => p.is_captain)?.player_name}
                    </p>
                  </div>
                </div>
              )}
              {players.find(p => p.is_vice_captain) && (
                <div className="flex items-center gap-3 p-4 bg-white/60 rounded-xl border border-blue-300">
                  <span className="text-3xl">⭐</span>
                  <div>
                    <p className="text-sm text-gray-600">Vice-Captain (1.5x Points)</p>
                    <p className="font-bold text-gray-900">
                      {players.find(p => p.is_vice_captain)?.player_name}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Players List */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">My Players</h2>
            <Link
              href="/dashboard/team/fantasy/all-teams"
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              View Detailed Stats →
            </Link>
          </div>
          
          {players.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No players drafted yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {players.map((player, index) => (
                <div key={player.draft_id} className="border border-gray-200 rounded-xl overflow-hidden">
                  {/* Player Summary */}
                  <button
                    onClick={() => loadPlayerMatchStats(player.real_player_id)}
                    className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-white hover:from-indigo-50 hover:to-purple-50 transition-all"
                  >
                    <div className="flex items-center gap-4 mb-2 sm:mb-0">
                      <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                        {index + 1}
                      </div>
                      <div className="text-left">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-gray-900">{player.player_name}</p>
                          {player.is_captain && (
                            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-bold rounded-full border border-yellow-300">
                              👑 C
                            </span>
                          )}
                          {player.is_vice_captain && (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-bold rounded-full border border-blue-300">
                              ⭐ VC
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">Draft Pick #{player.draft_order}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-center">
                        <p className="text-gray-600">Total Points</p>
                        <p className="text-lg font-bold text-indigo-600">{player.total_points}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-gray-600">Matches</p>
                        <p className="text-lg font-bold text-gray-900">{player.matches_played}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-gray-600">Avg</p>
                        <p className="text-lg font-bold text-green-600">{player.average_points}</p>
                      </div>
                      <svg
                        className={`w-5 h-5 text-gray-400 transition-transform ${expandedPlayer === player.real_player_id ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {/* Expanded Player Details */}
                  {expandedPlayer === player.real_player_id && (
                    <div className="border-t border-gray-200 bg-white p-4">
                      {loadingPlayerStats[player.real_player_id] ? (
                        <div className="text-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                          <p className="mt-2 text-sm text-gray-600">Loading match stats...</p>
                        </div>
                      ) : playerMatchStats[player.real_player_id]?.length > 0 ? (
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-3">Match-by-Match Performance</h4>
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {playerMatchStats[player.real_player_id].map((match, idx) => (
                              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                                <div className="flex-1">
                                  <p className="font-semibold text-gray-900">Round {match.round_number}</p>
                                  <p className="text-gray-600 text-xs">vs {match.opponent}</p>
                                </div>
                                <div className="flex gap-4 text-xs">
                                  {match.goals_scored > 0 && (
                                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded">⚽ {match.goals_scored}</span>
                                  )}
                                  {match.clean_sheet && (
                                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">🛡️ CS</span>
                                  )}
                                  {match.motm && (
                                    <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded">⭐ MOTM</span>
                                  )}
                                  {match.goals_conceded > 0 && (
                                    <span className="px-2 py-1 bg-red-100 text-red-800 rounded">🥅 -{match.goals_conceded}</span>
                                  )}
                                </div>
                                <div className="text-right ml-4">
                                  <p className="text-lg font-bold text-indigo-600">{match.total_points}</p>
                                  <p className="text-xs text-gray-500">pts</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-center text-gray-500 py-4">No match stats available yet</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Other Teams Section */}
        <div className="mt-8 bg-white rounded-2xl shadow-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">League Teams</h2>
            <button
              onClick={() => setShowOtherTeams(!showOtherTeams)}
              className="px-4 py-2 bg-indigo-100 text-indigo-700 font-semibold rounded-lg hover:bg-indigo-200 transition-colors"
            >
              {showOtherTeams ? 'Hide Teams' : `Show All Teams (${otherTeams.length})`}
            </button>
          </div>

          {showOtherTeams && (
            <div className="space-y-3 mt-4">
              {otherTeams.map((team) => (
                <div
                  key={team.id}
                  className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                      team.rank === 1 ? 'bg-yellow-400 text-yellow-900' :
                      team.rank === 2 ? 'bg-gray-300 text-gray-700' :
                      team.rank === 3 ? 'bg-orange-400 text-orange-900' :
                      'bg-gray-200 text-gray-600'
                    }`}>
                      #{team.rank}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{team.team_name}</p>
                      <p className="text-sm text-gray-600">{team.owner_name}</p>
                    </div>
                  </div>
                  <div className="flex gap-6 text-sm">
                    <div className="text-center">
                      <p className="text-gray-600">Points</p>
                      <p className="text-lg font-bold text-indigo-600">{team.total_points}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-600">Players</p>
                      <p className="text-lg font-bold text-gray-900">{team.player_count}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
