'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';
import {
  ArrowLeftRight,
  Shield,
  DollarSign,
  X,
  Check,
  Filter,
  AlertCircle,
  Calendar,
} from 'lucide-react';

interface Player {
  real_player_id: string;
  player_name: string;
  position: string;
  team: string;
  star_rating: number;
  draft_price: number;
  category?: string;
}

interface Transfer {
  _id: string;
  player_out: Player;
  player_in: Player;
  timestamp: string;
  points_deducted: number;
}

interface TransferSettings {
  max_transfers_per_window: number;
  is_transfer_window_open: boolean;
  transfer_window_start?: string;
  transfer_window_end?: string;
  points_cost_per_transfer: number;
}



export default function TeamTransfersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Only players tab now - team affiliation is set during draft only
  const [mySquad, setMySquad] = useState<Player[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [settings, setSettings] = useState<TransferSettings | null>(null);
  const [selectedOut, setSelectedOut] = useState<string | null>(null);
  const [selectedIn, setSelectedIn] = useState<string | null>(null);
  const [filter, setFilter] = useState({ search: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [isTransferring, setIsTransferring] = useState(false);
  const [transfersUsed, setTransfersUsed] = useState(0);
  const [leagueId, setLeagueId] = useState<string>('');
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
      loadTransferData();
    }
  }, [user]);

  const loadTransferData = async () => {
    try {
      // Get my fantasy team
      const teamRes = await fetchWithTokenRefresh(`/api/fantasy/teams/my-team?user_id=${user!.uid}`);
      if (teamRes.status === 404) {
        setIsLoading(false);
        return;
      }
      const teamData = await teamRes.json();
      setMySquad(teamData.players || []);
      setLeagueId(teamData.team.fantasy_league_id);
      
      // Set captain and vice-captain from squad
      const captain = (teamData.players || []).find((p: any) => p.is_captain);
      const viceCaptain = (teamData.players || []).find((p: any) => p.is_vice_captain);
      if (captain) setCaptainId(captain.real_player_id);
      if (viceCaptain) setViceCaptainId(viceCaptain.real_player_id);

      // Get active transfer window
      const windowsRes = await fetchWithTokenRefresh(`/api/fantasy/transfer-windows?league_id=${teamData.team.fantasy_league_id}`
      );
      
      let activeWindow = null;
      if (windowsRes.ok) {
        const windowsData = await windowsRes.json();
        // Find the active window
        activeWindow = windowsData.windows?.find((w: any) => w.is_active);
      }

      // Get transfer settings for the active window
      if (activeWindow) {
        const settingsRes = await fetchWithTokenRefresh(`/api/fantasy/transfers/settings?window_id=${activeWindow.window_id}`
        );
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json();
          setSettings(settingsData.settings);
        }
      } else {
        // No active window - set settings to show window is closed
        setSettings({
          max_transfers_per_window: 0,
          is_transfer_window_open: false,
          points_cost_per_transfer: 0,
        });
      }

      // Get available players
      const playersRes = await fetchWithTokenRefresh(`/api/fantasy/players/available?league_id=${teamData.team.fantasy_league_id}`
      );
      if (playersRes.ok) {
        const playersData = await playersRes.json();
        setAvailablePlayers(playersData.available_players || []);
      }

      // Get transfer history
      const transfersRes = await fetchWithTokenRefresh(`/api/fantasy/transfers/history?user_id=${user!.uid}`
      );
      if (transfersRes.ok) {
        const transfersData = await transfersRes.json();
        setTransfers(transfersData.transfers || []);
        setTransfersUsed(transfersData.transfers_used || 0);
      }


    } catch (error) {
      console.error('Failed to load transfer data:', error);
    } finally {
      setIsLoading(false);
    }
  };





  const makeTransfer = async () => {
    if (!selectedOut || !selectedIn) {
      alert('Please select both players to swap');
      return;
    }

    setIsTransferring(true);
    try {
      // Find the players
      const squadPlayerToRelease = mySquad.find(p => p.real_player_id === selectedOut);
      const playerToAdd = availablePlayers.find(p => p.real_player_id === selectedIn);
      
      if (!squadPlayerToRelease || !playerToAdd) {
        alert('Invalid player selection');
        return;
      }
      
      const res = await fetchWithTokenRefresh('/api/fantasy/transfers/make-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user!.uid,
          player_out_id: squadPlayerToRelease.draft_id,
          player_in_id: selectedIn,
          player_in_name: playerToAdd.player_name,
          player_in_position: playerToAdd.position,
          player_in_team: playerToAdd.team,
          player_in_price: playerToAdd.draft_price,
        }),
      });

      if (res.ok) {
        alert('Transfer completed successfully!');
        setSelectedOut(null);
        setSelectedIn(null);
        await loadTransferData();
      } else {
        const error = await res.json();
        alert(error.error || 'Transfer failed');
      }
    } catch (error) {
      console.error('Failed to make transfer:', error);
      alert('Transfer failed');
    } finally {
      setIsTransferring(false);
    }
  };

  const saveCaptains = async () => {
    if (!user) return;

    if (!captainId) {
      alert('Please select a captain');
      return;
    }

    if (!viceCaptainId) {
      alert('Please select a vice-captain');
      return;
    }

    if (captainId === viceCaptainId) {
      alert('Captain and vice-captain must be different players');
      return;
    }

    setIsSavingCaptains(true);
    try {
      const res = await fetchWithTokenRefresh('/api/fantasy/squad/set-captain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.uid,
          captain_player_id: captainId,
          vice_captain_player_id: viceCaptainId,
        }),
      });

      if (res.ok) {
        alert('✅ Captain and Vice-Captain saved successfully!');
        await loadTransferData();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to save captain selection');
      }
    } catch (error) {
      console.error('Failed to save captains:', error);
      alert('Failed to save captain selection');
    } finally {
      setIsSavingCaptains(false);
    }
  };

  const playerOut = mySquad.find(p => p.real_player_id === selectedOut);
  const playerIn = availablePlayers.find(p => p.real_player_id === selectedIn);

  const filteredAvailable = availablePlayers.filter(player => {
    // Filter to same position if a player out is selected
    if (selectedOut) {
      const out = mySquad.find(p => p.real_player_id === selectedOut);
      if (out && player.position !== out.position) return false;
    }
    
    if (filter.search && !player.player_name.toLowerCase().includes(filter.search.toLowerCase()))
      return false;
    return true;
  });

  const remainingTransfers = settings
    ? settings.max_transfers_per_window - transfersUsed
    : 0;

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading transfers...</p>
        </div>
      </div>
    );
  }

  if (!user || mySquad.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-20 h-20 bg-gradient-to-br from-gray-300 to-gray-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <X className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">No Squad Yet</h2>
          <p className="text-gray-600 mb-6">
            You need to draft players first before making transfers.
          </p>
          <Link
            href="/dashboard/team/fantasy/draft"
            className="inline-block px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
          >
            Draft Players
          </Link>
        </div>
      </div>
    );
  }

  if (!settings?.is_transfer_window_open) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-20 h-20 bg-gradient-to-br from-red-300 to-red-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <X className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Transfer Window Closed</h2>
          <p className="text-gray-600 mb-6">Transfers are not currently available</p>
          {settings?.transfer_window_start && (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-4">
              <Calendar className="w-4 h-4" />
              <span>Next window: {new Date(settings.transfer_window_start).toLocaleString()}</span>
            </div>
          )}
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

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Transfers</h1>
              <p className="text-gray-600">Swap players to improve your squad</p>
            </div>

            <div className="text-right">
              <p className="text-sm text-gray-600">Remaining Transfers</p>
              <p className="text-3xl font-bold text-indigo-600">
                {remainingTransfers}/{settings.max_transfers_per_window}
              </p>
              {settings.points_cost_per_transfer > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  -{settings.points_cost_per_transfer} pts per transfer
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Player Transfers */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
              {/* Info Alert */}
              {settings.points_cost_per_transfer > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                    <div className="text-sm text-amber-800">
                      <p className="font-medium mb-1">Transfer Cost</p>
                      <p>
                        Each transfer will deduct {settings.points_cost_per_transfer} points from your total
                        score. Choose wisely!
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Transfer Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Player Out */}
          <div className="glass rounded-3xl shadow-xl backdrop-blur-md border border-white/20 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <X className="w-5 h-5 text-red-600" />
              Transfer Out
            </h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {mySquad.map(player => (
                <button
                  key={player.real_player_id}
                  onClick={() => setSelectedOut(player.real_player_id)}
                  className={`w-full text-left p-3 rounded-lg border transition ${
                    selectedOut === player.real_player_id
                      ? 'bg-red-50 border-red-500'
                      : 'bg-white hover:bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className="w-4 h-4 text-gray-600" />
                    <p className="font-medium text-gray-900 text-sm">{player.player_name}</p>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">
                      {player.position} • {player.team}
                    </span>
                    <span className="text-gray-600">${player.draft_price}M</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Transfer Summary */}
          <div className="glass rounded-3xl shadow-xl backdrop-blur-md border border-white/20 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 text-center">Transfer Summary</h3>
            <div className="space-y-4">
              {/* Player Out */}
              <div
                className={`p-4 rounded-lg border ${
                  playerOut
                    ? 'bg-red-50 border-red-200'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                {playerOut ? (
                  <>
                    <p className="text-xs text-gray-600 mb-2">OUT</p>
                    <p className="font-medium text-gray-900">{playerOut.player_name}</p>
                    <p className="text-xs text-gray-600">
                      {playerOut.position} • {playerOut.team}
                    </p>
                  </>
                ) : (
                  <p className="text-center text-gray-500 text-sm">Select player to remove</p>
                )}
              </div>

              <div className="flex justify-center">
                <ArrowLeftRight className="w-6 h-6 text-indigo-600" />
              </div>

              {/* Player In */}
              <div
                className={`p-4 rounded-lg border ${
                  playerIn
                    ? 'bg-green-50 border-green-200'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                {playerIn ? (
                  <>
                    <p className="text-xs text-gray-600 mb-2">IN</p>
                    <p className="font-medium text-gray-900">{playerIn.player_name}</p>
                    <p className="text-xs text-gray-600">
                      {playerIn.position} • {playerIn.team}
                    </p>
                  </>
                ) : (
                  <p className="text-center text-gray-500 text-sm">Select player to add</p>
                )}
              </div>

              <button
                onClick={makeTransfer}
                disabled={
                  !selectedOut || !selectedIn || remainingTransfers === 0 || isTransferring
                }
                className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {isTransferring ? 'Processing...' : 'Confirm Transfer'}
              </button>

              {remainingTransfers === 0 && (
                <p className="text-center text-sm text-red-600">No transfers remaining</p>
              )}
            </div>
          </div>

          {/* Player In */}
          <div className="glass rounded-3xl shadow-xl backdrop-blur-md border border-white/20 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Check className="w-5 h-5 text-green-600" />
              Transfer In
            </h3>

            {/* Filter */}
            <div className="mb-4">
              <input
                type="text"
                value={filter.search}
                onChange={e => setFilter({ ...filter, search: e.target.value })}
                placeholder="Search..."
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 text-sm focus:ring-2 focus:ring-indigo-500"
              />
              {selectedOut && (
                <p className="text-xs text-gray-500 mt-2">
                  Showing {mySquad.find(p => p.real_player_id === selectedOut)?.position} players only
                </p>
              )}
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredAvailable.map(player => (
                <button
                  key={player.real_player_id}
                  onClick={() => setSelectedIn(player.real_player_id)}
                  className={`w-full text-left p-3 rounded-lg border transition ${
                    selectedIn === player.real_player_id
                      ? 'bg-green-50 border-green-500'
                      : 'bg-white hover:bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className="w-4 h-4 text-gray-600" />
                    <p className="font-medium text-gray-900 text-sm">{player.player_name}</p>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">
                      {player.position} • {player.team}
                    </span>
                    <span className="text-green-600 font-bold">${player.draft_price}M</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Captain & Vice-Captain Selection */}
        <div className="glass rounded-3xl shadow-xl backdrop-blur-md border border-white/20 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">⭐ Captain & Vice-Captain</h3>
          <p className="text-sm text-gray-600 mb-4">
            Select your captain (2x points) and vice-captain (1.5x points) from your squad
          </p>
          
          <div className="space-y-2 mb-4">
            {mySquad.map(player => (
              <div
                key={player.real_player_id}
                className="p-3 bg-white rounded-lg border border-gray-200"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-1">
                    <Shield className="w-4 h-4 text-gray-600" />
                    <p className="font-medium text-gray-900 text-sm">{player.player_name}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-gray-600">
                    {player.position} • {player.team}
                  </span>
                  <span className="text-gray-600">${player.draft_price}M</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCaptainId(player.real_player_id)}
                    className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition ${
                      captainId === player.real_player_id
                        ? 'bg-yellow-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {captainId === player.real_player_id ? '⭐ Captain' : 'Captain'}
                  </button>
                  <button
                    onClick={() => setViceCaptainId(player.real_player_id)}
                    className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition ${
                      viceCaptainId === player.real_player_id
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {viceCaptainId === player.real_player_id ? '🥈 Vice' : 'Vice'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={saveCaptains}
            disabled={isSavingCaptains || !captainId || !viceCaptainId}
            className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSavingCaptains ? 'Saving...' : '💾 Save Captain & Vice-Captain'}
          </button>
        </div>

        {/* Transfer History */}
        <div className="glass rounded-3xl shadow-xl backdrop-blur-md border border-white/20 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Transfer History</h3>
          <div className="space-y-3">
            {transfers.map(transfer => (
              <div
                key={transfer._id}
                className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="flex items-center gap-2">
                    <X className="w-4 h-4 text-red-600" />
                    <span className="text-gray-900">{transfer.player_out.player_name}</span>
                  </div>
                  <ArrowLeftRight className="w-4 h-4 text-gray-400" />
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-600" />
                    <span className="text-gray-900">{transfer.player_in.player_name}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">
                    {new Date(transfer.timestamp).toLocaleDateString()}
                  </p>
                  {transfer.points_deducted > 0 && (
                    <p className="text-xs text-red-600">-{transfer.points_deducted} pts</p>
                  )}
                </div>
              </div>
            ))}

            {transfers.length === 0 && (
              <p className="text-center text-gray-500 py-8">No transfers yet</p>
            )}
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
