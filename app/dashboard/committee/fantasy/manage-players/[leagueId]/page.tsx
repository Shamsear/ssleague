'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useModal } from '@/hooks/useModal';
import AlertModal from '@/components/modals/AlertModal';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface FantasyTeam {
  id: string;
  team_name: string;
  owner_name: string;
  player_count: number;
}

interface DraftedPlayer {
  draft_id: string;
  real_player_id: string;
  player_name: string;
  fantasy_team_id: string;
  team_name: string;
  draft_order: number;
  total_points: number;
}

interface AvailablePlayer {
  real_player_id: string;
  player_name: string;
  star_rating: number;
  points: number;
  category: string;
}

export default function ManagePlayersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const leagueId = params?.leagueId as string;

  const [league, setLeague] = useState<any>(null);
  const [fantasyTeams, setFantasyTeams] = useState<FantasyTeam[]>([]);
  const [draftedPlayers, setDraftedPlayers] = useState<DraftedPlayer[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<AvailablePlayer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeAction, setActiveAction] = useState<'add' | 'transfer' | 'swap' | 'remove' | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<DraftedPlayer | AvailablePlayer | null>(null);
  const [targetTeam, setTargetTeam] = useState<string>('');
  const [swapPlayer, setSwapPlayer] = useState<DraftedPlayer | null>(null);

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
    const loadData = async () => {
      if (!leagueId) return;

      try {
        const leagueResponse = await fetchWithTokenRefresh(`/api/fantasy/leagues/${leagueId}`);
        if (!leagueResponse.ok) throw new Error('League not found');
        
        const leagueData = await leagueResponse.json();
        setLeague(leagueData.league);
        setFantasyTeams(leagueData.teams);

        await loadDraftedPlayers();

        const playersResponse = await fetchWithTokenRefresh(`/api/fantasy/players/available?league_id=${leagueId}`);
        if (playersResponse.ok) {
          const playersData = await playersResponse.json();
          setAvailablePlayers(playersData.available_players);
        }
      } catch (error) {
        console.error('Error loading data:', error);
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
      loadData();
    }
  }, [user, leagueId]);

  const loadDraftedPlayers = async () => {
    try {
      const response = await fetchWithTokenRefresh(`/api/fantasy/players/drafted?league_id=${leagueId}`);
      if (response.ok) {
        const data = await response.json();
        setDraftedPlayers(data.drafted_players || []);
      }
    } catch (error) {
      console.error('Error loading drafted players:', error);
    }
  };

  const handleAddPlayer = async () => {
    if (!selectedPlayer || !targetTeam) {
      showAlert({
        type: 'warning',
        title: 'Missing Information',
        message: 'Please select a player and target team',
      });
      return;
    }

    try {
      const response = await fetchWithTokenRefresh('/api/fantasy/players/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          league_id: leagueId,
          player_id: (selectedPlayer as AvailablePlayer).real_player_id,
          team_id: targetTeam,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      showAlert({
        type: 'success',
        title: 'Success',
        message: 'Player added successfully',
      });

      await loadDraftedPlayers();
      resetForm();
    } catch (error) {
      showAlert({
        type: 'error',
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to add player',
      });
    }
  };

  const handleTransferPlayer = async () => {
    if (!selectedPlayer || !targetTeam) {
      showAlert({
        type: 'warning',
        title: 'Missing Information',
        message: 'Please select a player and target team',
      });
      return;
    }

    const player = selectedPlayer as DraftedPlayer;

    try {
      const response = await fetchWithTokenRefresh('/api/fantasy/players/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'transfer',
          league_id: leagueId,
          draft_id: player.draft_id,
          from_team_id: player.fantasy_team_id,
          to_team_id: targetTeam,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      showAlert({
        type: 'success',
        title: 'Success',
        message: `${player.player_name} transferred successfully`,
      });

      await loadDraftedPlayers();
      resetForm();
    } catch (error) {
      showAlert({
        type: 'error',
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to transfer player',
      });
    }
  };

  const handleSwapPlayers = async () => {
    if (!selectedPlayer || !swapPlayer) {
      showAlert({
        type: 'warning',
        title: 'Missing Information',
        message: 'Please select two players to swap',
      });
      return;
    }

    const player1 = selectedPlayer as DraftedPlayer;
    const player2 = swapPlayer;

    try {
      const response = await fetchWithTokenRefresh('/api/fantasy/players/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'swap',
          league_id: leagueId,
          draft_id_1: player1.draft_id,
          draft_id_2: player2.draft_id,
          team_id_1: player1.fantasy_team_id,
          team_id_2: player2.fantasy_team_id,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      showAlert({
        type: 'success',
        title: 'Success',
        message: `${player1.player_name} and ${player2.player_name} swapped successfully`,
      });

      await loadDraftedPlayers();
      resetForm();
    } catch (error) {
      showAlert({
        type: 'error',
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to swap players',
      });
    }
  };

  const handleRemovePlayer = async (draftId: string, playerName: string) => {
    if (!confirm(`Are you sure you want to remove ${playerName} from their team?`)) {
      return;
    }

    try {
      const response = await fetchWithTokenRefresh('/api/fantasy/players/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remove',
          league_id: leagueId,
          draft_id: draftId,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      showAlert({
        type: 'success',
        title: 'Success',
        message: `${playerName} removed successfully`,
      });

      await loadDraftedPlayers();
    } catch (error) {
      showAlert({
        type: 'error',
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to remove player',
      });
    }
  };

  const resetForm = () => {
    setActiveAction(null);
    setSelectedPlayer(null);
    setTargetTeam('');
    setSwapPlayer(null);
  };

  const filteredDrafted = draftedPlayers.filter(p =>
    p.player_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.team_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
            <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center shadow-xl">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Manage Players</h1>
              <p className="text-gray-600 mt-1">{league.name} - Transfer, Swap, Add & Remove</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <button
            onClick={() => { resetForm(); setActiveAction('add'); }}
            className={`p-4 rounded-xl font-semibold transition-all ${
              activeAction === 'add'
                ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:shadow-md'
            }`}
          >
            ➕ Add Player
          </button>
          <button
            onClick={() => { resetForm(); setActiveAction('transfer'); }}
            className={`p-4 rounded-xl font-semibold transition-all ${
              activeAction === 'transfer'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:shadow-md'
            }`}
          >
            🔄 Transfer Player
          </button>
          <button
            onClick={() => { resetForm(); setActiveAction('swap'); }}
            className={`p-4 rounded-xl font-semibold transition-all ${
              activeAction === 'swap'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:shadow-md'
            }`}
          >
            🔀 Swap Players
          </button>
          <button
            onClick={() => { resetForm(); setActiveAction('remove'); }}
            className={`p-4 rounded-xl font-semibold transition-all ${
              activeAction === 'remove'
                ? 'bg-gradient-to-r from-red-600 to-orange-600 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:shadow-md'
            }`}
          >
            ❌ Remove Player
          </button>
        </div>

        {activeAction && (
          <div className="bg-white rounded-2xl shadow-xl border-2 border-indigo-300 p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {activeAction === 'add' && '➕ Add Player to Team'}
              {activeAction === 'transfer' && '🔄 Transfer Player'}
              {activeAction === 'swap' && '🔀 Swap Players Between Teams'}
              {activeAction === 'remove' && '❌ Remove Player from Team'}
            </h2>

            {activeAction === 'add' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Select Available Player</label>
                  <select
                    value={selectedPlayer ? (selectedPlayer as AvailablePlayer).real_player_id : ''}
                    onChange={(e) => {
                      const player = availablePlayers.find(p => p.real_player_id === e.target.value);
                      setSelectedPlayer(player || null);
                    }}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg"
                  >
                    <option value="">-- Select Player --</option>
                    {availablePlayers.map(p => (
                      <option key={p.real_player_id} value={p.real_player_id}>
                        {p.player_name} ({p.star_rating}★ - {p.category})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Select Team</label>
                  <select
                    value={targetTeam}
                    onChange={(e) => setTargetTeam(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg"
                  >
                    <option value="">-- Select Team --</option>
                    {fantasyTeams.map(t => (
                      <option key={t.id} value={t.id}>{t.team_name}</option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleAddPlayer}
                  className="w-full px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-xl hover:from-green-700 hover:to-emerald-700"
                >
                  ✓ Add Player
                </button>
              </div>
            )}

            {activeAction === 'transfer' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Select Player to Transfer</label>
                  <select
                    value={selectedPlayer ? (selectedPlayer as DraftedPlayer).draft_id : ''}
                    onChange={(e) => {
                      const player = draftedPlayers.find(p => p.draft_id === e.target.value);
                      setSelectedPlayer(player || null);
                    }}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg"
                  >
                    <option value="">-- Select Player --</option>
                    {draftedPlayers.map(p => (
                      <option key={p.draft_id} value={p.draft_id}>
                        {p.player_name} (from {p.team_name})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Transfer To Team</label>
                  <select
                    value={targetTeam}
                    onChange={(e) => setTargetTeam(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg"
                  >
                    <option value="">-- Select Team --</option>
                    {fantasyTeams
                      .filter(t => t.id !== (selectedPlayer as DraftedPlayer)?.fantasy_team_id)
                      .map(t => (
                        <option key={t.id} value={t.id}>{t.team_name}</option>
                      ))}
                  </select>
                </div>

                <button
                  onClick={handleTransferPlayer}
                  className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700"
                >
                  ✓ Transfer Player
                </button>
              </div>
            )}

            {activeAction === 'swap' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Select First Player</label>
                  <select
                    value={selectedPlayer ? (selectedPlayer as DraftedPlayer).draft_id : ''}
                    onChange={(e) => {
                      const player = draftedPlayers.find(p => p.draft_id === e.target.value);
                      setSelectedPlayer(player || null);
                    }}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg"
                  >
                    <option value="">-- Select Player --</option>
                    {draftedPlayers.map(p => (
                      <option key={p.draft_id} value={p.draft_id}>
                        {p.player_name} ({p.team_name})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Select Second Player</label>
                  <select
                    value={swapPlayer?.draft_id || ''}
                    onChange={(e) => {
                      const player = draftedPlayers.find(p => p.draft_id === e.target.value);
                      setSwapPlayer(player || null);
                    }}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg"
                  >
                    <option value="">-- Select Player --</option>
                    {draftedPlayers
                      .filter(p => p.draft_id !== (selectedPlayer as DraftedPlayer)?.draft_id)
                      .map(p => (
                        <option key={p.draft_id} value={p.draft_id}>
                          {p.player_name} ({p.team_name})
                        </option>
                      ))}
                  </select>
                </div>

                <button
                  onClick={handleSwapPlayers}
                  className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl hover:from-purple-700 hover:to-pink-700"
                >
                  ✓ Swap Players
                </button>
              </div>
            )}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              {activeAction === 'remove' ? 'Drafted Players - Click to Remove' : 'All Drafted Players'}
            </h2>
            <input
              type="text"
              placeholder="Search players..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {filteredDrafted.map((player) => (
              <div
                key={player.draft_id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{player.player_name}</p>
                  <p className="text-sm text-gray-600">{player.team_name} • {player.total_points} pts</p>
                </div>
                {activeAction === 'remove' && (
                  <button
                    onClick={() => handleRemovePlayer(player.draft_id, player.player_name)}
                    className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
                  >
                    🗑️ Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
