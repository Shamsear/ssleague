'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Shield, DollarSign, Users, TrendingUp, Sparkles, Check, X, Filter, Crown, Star, Trash2 } from 'lucide-react';

interface Player {
  real_player_id: string;
  player_name: string;
  position: string;
  team: string;
  star_rating: number;
  draft_price: number;
  ownership_percentage?: number;
  category?: string;
  points?: number;
}

interface DraftedPlayer extends Player {
  drafted_at: string;
}

interface DraftSettings {
  budget: number;
  max_squad_size: number;
  is_active: boolean;
  status: 'pending' | 'active' | 'paused' | 'completed';
  draft_status?: 'pending' | 'active' | 'closed';
  draft_opens_at?: string;
  draft_closes_at?: string;
  is_draft_active?: boolean;
}

interface MyTeam {
  id: string;
  team_name: string;
  total_points: number;
  player_count: number;
  supported_team_id?: string;
  supported_team_name?: string;
}

interface RealTeam {
  team_id: string;
  team_name: string;
}

export default function TeamDraftPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [myTeam, setMyTeam] = useState<MyTeam | null>(null);
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [mySquad, setMySquad] = useState<DraftedPlayer[]>([]);
  const [draftSettings, setDraftSettings] = useState<DraftSettings | null>(null);
  const [realTeams, setRealTeams] = useState<RealTeam[]>([]);
  const [filter, setFilter] = useState({ position: 'all', team: 'all', search: '', stars: 'all' });
  const [isLoading, setIsLoading] = useState(true);
  const [isDrafting, setIsDrafting] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState<string | null>(null);
  const [isSelectingTeam, setIsSelectingTeam] = useState(false);
  const [captainId, setCaptainId] = useState<string | null>(null);
  const [viceCaptainId, setViceCaptainId] = useState<string | null>(null);
  const [isSavingCaptains, setIsSavingCaptains] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }
    if (!loading && user && user.role !== 'team') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      loadDraftData();
    }
  }, [user]);

  const loadDraftData = async () => {
    try {
      // Get my fantasy team
      const teamRes = await fetch(`/api/fantasy/teams/my-team?user_id=${user!.uid}`);
      if (teamRes.status === 404) {
        setIsLoading(false);
        return;
      }
      const teamData = await teamRes.json();
      setMyTeam(teamData.team);
      setMySquad(teamData.players || []);

      // Get draft settings and league info
      const settingsRes = await fetch(`/api/fantasy/draft/settings?league_id=${teamData.team.fantasy_league_id}`);
      let leagueSeasonId = null;
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        leagueSeasonId = settingsData.settings?.season_id;
        const draftStatus = settingsData.settings?.draft_status || 'pending';
        const isDraftActive = settingsData.settings?.is_draft_active || false;
        
        setDraftSettings({
          budget: settingsData.settings?.budget_per_team || 100,
          max_squad_size: settingsData.settings?.max_squad_size || 15,
          is_active: isDraftActive,
          status: isDraftActive ? 'active' : (draftStatus === 'pending' ? 'pending' : 'completed'),
          draft_status: draftStatus,
          draft_opens_at: settingsData.settings?.draft_opens_at,
          draft_closes_at: settingsData.settings?.draft_closes_at,
          is_draft_active: isDraftActive,
        });
      }

      // Get available players
      const playersRes = await fetch(`/api/fantasy/players/available?league_id=${teamData.team.fantasy_league_id}`);
      if (playersRes.ok) {
        const playersData = await playersRes.json();
        setAvailablePlayers(playersData.available_players || []);
      }

      // Get real teams for the fantasy league's season
      const teamsUrl = leagueSeasonId 
        ? `/api/teams/registered?season_id=${leagueSeasonId}`
        : '/api/teams/registered';
      const teamsRes = await fetch(teamsUrl);
      if (teamsRes.ok) {
        const teamsData = await teamsRes.json();
        setRealTeams(teamsData.teams || []);
      }
    } catch (error) {
      console.error('Failed to load draft data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const selectSupportedTeam = async (teamId: string, teamName: string) => {
    if (!myTeam) return;

    setIsSelectingTeam(true);
    try {
      const res = await fetch('/api/fantasy/teams/select-supported', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user!.uid,
          supported_team_id: teamId,
          supported_team_name: teamName,
        }),
      });

      if (res.ok) {
        setMyTeam({ ...myTeam, supported_team_id: teamId, supported_team_name: teamName });
        alert(`Now supporting ${teamName} for passive points!`);
      } else {
        let errorMessage = 'Failed to select team';
        try {
          const error = await res.json();
          errorMessage = error.error || errorMessage;
        } catch (e) {
          // Response body is empty or not JSON
        }
        alert(errorMessage);
      }
    } catch (error) {
      console.error('Failed to select team:', error);
      alert('Failed to select team');
    } finally {
      setIsSelectingTeam(false);
    }
  };

  const saveCaptains = async () => {
    if (!user) return;
    
    if (!captainId || !viceCaptainId) {
      alert('Please select both captain and vice-captain');
      return;
    }

    if (captainId === viceCaptainId) {
      alert('Captain and vice-captain must be different players');
      return;
    }
    
    setIsSavingCaptains(true);
    try {
      const response = await fetch('/api/fantasy/squad/set-captain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.uid,
          captain_player_id: captainId,
          vice_captain_player_id: viceCaptainId,
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to save captains';
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch (e) {
          // Response body is empty or not JSON
        }
        throw new Error(errorMessage);
      }

      alert('Captain and vice-captain saved successfully!');
      
      // Refresh squad data to show captain badges
      await loadDraftData();
    } catch (error) {
      console.error('Error saving captains:', error);
      alert(error instanceof Error ? error.message : 'Failed to save captains');
    } finally {
      setIsSavingCaptains(false);
    }
  };

  const draftPlayer = async (playerId: string) => {
    if (!myTeam || !draftSettings) return;

    const player = availablePlayers.find(p => p.real_player_id === playerId);
    if (!player) return;

    // Check budget
    const currentSpent = mySquad.reduce((sum, p) => sum + p.draft_price, 0);
    const remainingBudget = draftSettings.budget - currentSpent;
    
    if (player.draft_price > remainingBudget) {
      alert(`Not enough budget! You need $${player.draft_price}M but only have $${remainingBudget.toFixed(1)}M remaining.`);
      return;
    }

    // Check squad size
    if (mySquad.length >= draftSettings.max_squad_size) {
      alert(`Squad is full! Maximum ${draftSettings.max_squad_size} players allowed.`);
      return;
    }

    setIsDrafting(playerId);
    try {
      const res = await fetch('/api/fantasy/draft/player', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user!.uid,
          real_player_id: playerId,
          player_name: player.player_name,
          position: player.position,
          team_name: player.team,
          draft_price: player.draft_price,
        }),
      });

      if (res.ok) {
        await loadDraftData();
      } else {
        let errorMessage = 'Failed to draft player';
        try {
          const error = await res.json();
          errorMessage = error.error || errorMessage;
        } catch (e) {
          // Response body is empty or not JSON
        }
        alert(errorMessage);
      }
    } catch (error) {
      console.error('Failed to draft player:', error);
      alert('Failed to draft player');
    } finally {
      setIsDrafting(null);
    }
  };

  const removePlayer = async (playerId: string, playerName: string) => {
    if (!user) return;

    if (!confirm(`Remove ${playerName} from your squad?`)) {
      return;
    }

    setIsRemoving(playerId);
    try {
      const res = await fetch(
        `/api/fantasy/draft/player?user_id=${user.uid}&real_player_id=${playerId}`,
        { method: 'DELETE' }
      );

      if (res.ok) {
        await loadDraftData();
        const data = await res.json();
        alert(`${playerName} removed. Refunded $${data.refunded_amount}M`);
      } else {
        let errorMessage = 'Failed to remove player';
        try {
          const error = await res.json();
          errorMessage = error.error || error.message || errorMessage;
        } catch (e) {
          // Response body is empty or not JSON
        }
        alert(errorMessage);
      }
    } catch (error) {
      console.error('Failed to remove player:', error);
      alert('Failed to remove player');
    } finally {
      setIsRemoving(null);
    }
  };

  const remainingBudget = draftSettings
    ? draftSettings.budget - mySquad.reduce((sum, p) => sum + p.draft_price, 0)
    : 0;

  const filteredPlayers = availablePlayers.filter(player => {
    if (filter.position !== 'all' && player.position !== filter.position) return false;
    if (filter.team !== 'all' && player.team !== filter.team) return false;
    if (filter.stars !== 'all' && player.star_rating !== parseInt(filter.stars)) return false;
    if (filter.search && !player.player_name.toLowerCase().includes(filter.search.toLowerCase()))
      return false;
    return true;
  });

  const positions = [...new Set(availablePlayers.map(p => p.position))].sort();
  const teams = [...new Set(availablePlayers.map(p => p.team))].sort();
  const starRatings = [...new Set(availablePlayers.map(p => p.star_rating))].sort((a, b) => b - a);

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading draft...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  if (!myTeam) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-20 h-20 bg-gradient-to-br from-gray-300 to-gray-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <X className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">No Fantasy League Yet</h2>
          <p className="text-gray-600 mb-6">
            The committee hasn't created a fantasy league for this season yet.
          </p>
          <Link
            href="/dashboard/team/fantasy/my-team"
            className="inline-block px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
          >
            Back to My Team
          </Link>
        </div>
      </div>
    );
  }

  if (!draftSettings?.is_active) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-20 h-20 bg-gradient-to-br from-red-300 to-red-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <X className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Draft Not Active</h2>
          <p className="text-gray-600 mb-6">
            The draft is currently {draftSettings?.status || 'closed'}. Please wait for the committee to activate it.
          </p>
          <Link
            href="/dashboard/team/fantasy/my-team"
            className="inline-block px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
          >
            Back to My Team
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard/team/fantasy/my-team"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to My Team
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Fantasy Draft</h1>
          <p className="text-gray-600">Build your squad within budget</p>
        </div>

        {/* Draft Status Banner */}
        {draftSettings && draftSettings.draft_status !== 'active' && (
          <div className={`mb-6 p-4 rounded-xl border-2 ${
            draftSettings.draft_status === 'pending' 
              ? 'bg-yellow-50 border-yellow-300 text-yellow-800'
              : 'bg-red-50 border-red-300 text-red-800'
          }`}>
            <div className="flex items-center gap-3">
              {draftSettings.draft_status === 'pending' ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <X className="w-6 h-6" />
              )}
              <div className="flex-1">
                <p className="font-bold text-lg">
                  {draftSettings.draft_status === 'pending' ? 'Draft Not Started' : 'Draft Period Ended'}
                </p>
                <p className="text-sm mt-1">
                  {draftSettings.draft_status === 'pending'
                    ? 'The draft will open soon. Check back later to build your squad.'
                    : 'The draft period has ended. Use transfer windows to modify your squad.'}
                </p>
                {draftSettings.draft_opens_at && draftSettings.draft_status === 'pending' && (
                  <p className="text-xs mt-2 opacity-75">
                    Opens: {new Date(draftSettings.draft_opens_at).toLocaleString()}
                  </p>
                )}
                {draftSettings.draft_closes_at && draftSettings.draft_status === 'closed' && (
                  <p className="text-xs mt-2 opacity-75">
                    Closed: {new Date(draftSettings.draft_closes_at).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {draftSettings && draftSettings.draft_status === 'active' && draftSettings.draft_closes_at && (
          <div className="mb-6 p-4 rounded-xl bg-green-50 border-2 border-green-300 text-green-800">
            <div className="flex items-center gap-3">
              <Check className="w-6 h-6" />
              <div className="flex-1">
                <p className="font-bold text-lg">Draft is Open!</p>
                <p className="text-sm mt-1">
                  Build your squad before the draft closes.
                </p>
                <p className="text-xs mt-2 opacity-75">
                  Closes: {new Date(draftSettings.draft_closes_at).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Stats Header */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="glass rounded-3xl shadow-xl backdrop-blur-md border border-white/20 p-4">
            <div className="flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-green-400" />
              <div>
                <p className="text-sm text-gray-600">Remaining Budget</p>
                <p className="text-2xl font-bold text-gray-900">${remainingBudget.toFixed(1)}M</p>
              </div>
            </div>
          </div>

          <div className="glass rounded-3xl shadow-xl backdrop-blur-md border border-white/20 p-4">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-400" />
              <div>
                <p className="text-sm text-gray-600">Squad Size</p>
                <p className="text-2xl font-bold text-gray-900">
                  {mySquad.length}/{draftSettings.max_squad_size}
                </p>
              </div>
            </div>
          </div>

          <div className="glass rounded-3xl shadow-xl backdrop-blur-md border border-white/20 p-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-purple-400" />
              <div>
                <p className="text-sm text-gray-600">Total Spent</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${(draftSettings.budget - remainingBudget).toFixed(1)}M
                </p>
              </div>
            </div>
          </div>

          <div className="glass rounded-3xl shadow-xl backdrop-blur-md border border-white/20 p-4">
            <div className="flex items-center gap-3">
              <Shield className="w-8 h-8 text-indigo-400" />
              <div>
                <p className="text-sm text-gray-600">Available Players</p>
                <p className="text-2xl font-bold text-gray-900">{availablePlayers.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Supported Team Selection */}
        <div className="glass rounded-3xl shadow-xl backdrop-blur-md border border-white/20 p-6 mb-8">
          <h3 className="text-lg font-bold text-gray-900 mb-3">Select Your Supported Team (Passive Points)</h3>
          <p className="text-sm text-gray-600 mb-4">
            Choose a team to support and earn passive points when they win matches.
          </p>
          <div className="flex items-center gap-4">
            <select
              value={myTeam?.supported_team_id || ''}
              onChange={(e) => {
                const team = realTeams.find(t => t.team_id === e.target.value);
                if (team) selectSupportedTeam(team.team_id, team.team_name);
              }}
              disabled={isSelectingTeam}
              className="flex-1 px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              <option value="">Select a team...</option>
              {realTeams.map(team => (
                <option key={team.team_id} value={team.team_id}>
                  {team.team_name}
                </option>
              ))}
            </select>
            {myTeam?.supported_team_name && (
              <div className="px-4 py-3 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-xl">
                <p className="text-sm text-gray-600">Currently supporting:</p>
                <p className="font-bold text-gray-900">{myTeam.supported_team_name}</p>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Available Players */}
          <div className="lg:col-span-2">
            <div className="glass rounded-3xl shadow-xl backdrop-blur-md border border-white/20 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-gray-900">Available Players</h2>
                  <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-semibold">
                    {filteredPlayers.length}
                  </span>
                </div>
                <Filter className="w-5 h-5 text-gray-600" />
              </div>

              {/* Filters */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <select
                  value={filter.position}
                  onChange={e => setFilter({ ...filter, position: e.target.value })}
                  className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All Positions</option>
                  {positions.map(pos => (
                    <option key={pos} value={pos}>
                      {pos}
                    </option>
                  ))}
                </select>

                <select
                  value={filter.team}
                  onChange={e => setFilter({ ...filter, team: e.target.value })}
                  className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All Teams</option>
                  {teams.map(team => (
                    <option key={team} value={team}>
                      {team}
                    </option>
                  ))}
                </select>

                <select
                  value={filter.stars}
                  onChange={e => setFilter({ ...filter, stars: e.target.value })}
                  className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All Stars</option>
                  {starRatings.map(rating => (
                    <option key={rating} value={rating}>
                      {rating}★ Stars
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  value={filter.search}
                  onChange={e => setFilter({ ...filter, search: e.target.value })}
                  placeholder="Search..."
                  className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Players List */}
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {filteredPlayers.map(player => (
                  <div
                    key={player.real_player_id}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-white/60 hover:bg-white/80 rounded-lg border border-gray-200 transition"
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <Shield className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{player.player_name}</p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 mt-1">
                          <span className="truncate">{player.position}</span>
                          <span className="hidden sm:inline">•</span>
                          <span className="truncate">{player.team}</span>
                          {player.category && (
                            <>
                              <span className="hidden sm:inline">•</span>
                              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full whitespace-nowrap">
                                {player.category}
                              </span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-2">
                          <div className="flex items-center gap-1">
                            {[...Array(player.star_rating)].map((_, i) => (
                              <Sparkles key={i} className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                            ))}
                          </div>
                          <div className="flex items-center gap-1 text-green-600 font-bold">
                            <DollarSign className="w-4 h-4" />
                            {player.draft_price}M
                          </div>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => draftPlayer(player.real_player_id)}
                      disabled={
                        isDrafting === player.real_player_id || 
                        player.draft_price > remainingBudget ||
                        !draftSettings?.is_draft_active
                      }
                      className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition flex-shrink-0"
                      title={!draftSettings?.is_draft_active ? 'Draft is not active' : ''}
                    >
                      {isDrafting === player.real_player_id ? 'Drafting...' : 'Draft'}
                    </button>
                  </div>
                ))}

                {filteredPlayers.length === 0 && (
                  <div className="text-center py-12 text-gray-500">No players available</div>
                )}
              </div>
            </div>
          </div>

          {/* My Squad */}
          <div>
            <div className="glass rounded-3xl shadow-xl backdrop-blur-md border border-white/20 p-6 sticky top-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">My Squad</h2>

              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {mySquad.map(player => (
                  <div
                    key={player.real_player_id}
                    className="p-3 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 flex-1">
                        <Shield className="w-4 h-4 text-green-600" />
                        <p className="font-medium text-gray-900 text-sm">{player.player_name}</p>
                      </div>
                      <button
                        onClick={() => removePlayer(player.real_player_id, player.player_name)}
                        disabled={isRemoving === player.real_player_id || !draftSettings?.is_draft_active}
                        className="p-1.5 text-red-600 hover:bg-red-100 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
                        title={!draftSettings?.is_draft_active ? 'Draft is not active' : 'Remove player'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">
                        {player.position} • {player.team}
                      </span>
                      <span className="text-green-600 font-bold">${player.draft_price}M</span>
                    </div>
                  </div>
                ))}

                {mySquad.length === 0 && (
                  <div className="text-center py-12 text-gray-500 text-sm">No players drafted yet</div>
                )}
              </div>

            </div>
          </div>
        </div>

        {/* Captain Selection (shown when at least 1 player drafted) */}
        {mySquad.length > 0 && (
          <div className="mt-8 glass rounded-3xl shadow-xl backdrop-blur-md border border-white/20 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Select Captain & Vice-Captain</h2>
                <p className="text-sm text-gray-600">
                  Captain earns 2x points, Vice-Captain earns 1.5x points. You can change these selections anytime during the draft.
                </p>
              </div>
              <button
                onClick={saveCaptains}
                disabled={isSavingCaptains || !captainId || !viceCaptainId}
                className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
              >
                {isSavingCaptains ? 'Saving...' : 'Save Captains'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Captain Selection */}
              <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl p-6 border-2 border-yellow-300">
                <label className="block text-lg font-bold text-gray-900 mb-3">
                  <div className="flex items-center gap-2">
                    <Crown className="w-6 h-6 text-yellow-600" />
                    <span>Captain (2x Points)</span>
                  </div>
                </label>
                <select
                  value={captainId || ''}
                  onChange={(e) => setCaptainId(e.target.value)}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-xl text-gray-900 font-medium focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                >
                  <option value="">Select Captain...</option>
                  {mySquad.map((player) => (
                    <option 
                      key={player.real_player_id} 
                      value={player.real_player_id}
                      disabled={player.real_player_id === viceCaptainId}
                    >
                      {player.player_name} ({player.team}) - {player.position}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-600 mt-2">
                  Your captain will earn double points in every match
                </p>
              </div>

              {/* Vice-Captain Selection */}
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-6 border-2 border-blue-300">
                <label className="block text-lg font-bold text-gray-900 mb-3">
                  <div className="flex items-center gap-2">
                    <Star className="w-6 h-6 text-blue-600" />
                    <span>Vice-Captain (1.5x Points)</span>
                  </div>
                </label>
                <select
                  value={viceCaptainId || ''}
                  onChange={(e) => setViceCaptainId(e.target.value)}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-xl text-gray-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select Vice-Captain...</option>
                  {mySquad.map((player) => (
                    <option 
                      key={player.real_player_id} 
                      value={player.real_player_id}
                      disabled={player.real_player_id === captainId}
                    >
                      {player.player_name} ({player.team}) - {player.position}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-600 mt-2">
                  Your vice-captain will earn 1.5x points in every match
                </p>
              </div>
            </div>

            {(!captainId || !viceCaptainId) && (
              <div className="mt-4 p-4 bg-blue-50 border-2 border-blue-300 rounded-xl">
                <p className="text-sm text-blue-800 font-medium text-center">
                  💡 Select both captain and vice-captain from your squad above
                </p>
              </div>
            )}
            
            {captainId && viceCaptainId && (
              <div className="mt-4 p-4 bg-green-50 border-2 border-green-300 rounded-xl">
                <p className="text-sm text-green-800 font-medium text-center">
                  ✅ Captain and Vice-Captain selected! Click "Save Captains" to confirm.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
