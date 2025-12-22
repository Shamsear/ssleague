'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';
import {
  ArrowLeftRight,
  DollarSign,
  X,
  Check,
  Filter,
  AlertCircle,
  Calendar,
  Users,
  TrendingUp,
  Star,
  Search,
} from 'lucide-react';

interface Player {
  squad_id?: string;
  real_player_id: string;
  player_name: string;
  position: string;
  real_team_name?: string;
  team?: string;
  team_id?: string;
  star_rating: number;
  purchase_price?: number;
  current_price?: number;
  draft_price?: number;
  total_points?: number;
  is_captain?: boolean;
  is_vice_captain?: boolean;
  is_available?: boolean;
}

interface TransferWindow {
  window_id: string;
  window_name: string;
  opens_at: string;
  closes_at: string;
  is_active: boolean;
  max_transfers_per_window: number;
  points_cost_per_transfer: number;
}

interface TeamInfo {
  team_id: string;
  team_name: string;
  budget_remaining: number;
  total_budget: number;
  squad_size: number;
  min_squad_size: number;
  max_squad_size: number;
  total_points: number;
}

export default function TeamTransfersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [mySquad, setMySquad] = useState<Player[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [teamInfo, setTeamInfo] = useState<TeamInfo | null>(null);
  const [transferWindow, setTransferWindow] = useState<TransferWindow | null>(null);
  const [transfersUsed, setTransfersUsed] = useState(0);
  
  const [selectedOut, setSelectedOut] = useState<Player | null>(null);
  const [selectedIn, setSelectedIn] = useState<Player | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [positionFilter, setPositionFilter] = useState<string>('all');
  const [teamFilter, setTeamFilter] = useState<string>('all');
  
  const [isLoading, setIsLoading] = useState(true);
  const [isTransferring, setIsTransferring] = useState(false);
  const [isUpdatingCaptain, setIsUpdatingCaptain] = useState(false);
  const [leagueId, setLeagueId] = useState<string>('');
  
  const [captainId, setCaptainId] = useState<string | null>(null);
  const [viceCaptainId, setViceCaptainId] = useState<string | null>(null);
  const [showCaptainModal, setShowCaptainModal] = useState(false);

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
      setIsLoading(true);

      // Get my fantasy team
      const teamRes = await fetchWithTokenRefresh(`/api/fantasy/teams/my-team?user_id=${user!.uid}`);
      if (teamRes.status === 404) {
        setIsLoading(false);
        return;
      }
      
      const teamData = await teamRes.json();
      const team = teamData.team;
      
      setLeagueId(team.fantasy_league_id);

      // Get full squad data from fantasy_squad table
      const squadRes = await fetchWithTokenRefresh(`/api/fantasy/squad?team_id=${team.id}`);
      let squad = [];
      
      if (squadRes.ok) {
        const squadData = await squadRes.json();
        squad = squadData.squad || [];
      } else {
        // Fallback to players from my-team
        squad = teamData.players || [];
      }
      
      setMySquad(squad);

      // Set current captain and vice-captain
      const captain = squad.find((p: Player) => p.is_captain);
      const viceCaptain = squad.find((p: Player) => p.is_vice_captain);
      if (captain) setCaptainId(captain.real_player_id);
      if (viceCaptain) setViceCaptainId(viceCaptain.real_player_id);

      // Get team info with budget
      const teamInfoRes = await fetchWithTokenRefresh(`/api/fantasy/teams/${team.id}`);
      if (teamInfoRes.ok) {
        const teamInfoData = await teamInfoRes.json();
        const teamDetails = teamInfoData.team;
        
        // Get league info for squad size limits
        const leagueRes = await fetchWithTokenRefresh(`/api/fantasy/leagues/${team.fantasy_league_id}`);
        let minSquadSize = 11;
        let maxSquadSize = 15;
        let totalBudget = 100;
        
        if (leagueRes.ok) {
          const leagueData = await leagueRes.json();
          const league = leagueData.league;
          minSquadSize = Number(league.min_squad_size || 11);
          maxSquadSize = Number(league.max_squad_size || 15);
          totalBudget = Number(league.budget_per_team || 100);
        }
        
        setTeamInfo({
          team_id: team.id,
          team_name: team.team_name,
          budget_remaining: Number(teamDetails.budget_remaining || 0),
          total_budget: totalBudget,
          squad_size: squad.length,
          min_squad_size: minSquadSize,
          max_squad_size: maxSquadSize,
          total_points: Number(teamDetails.total_points || 0),
        });
      }

      // Get active transfer window
      const windowRes = await fetchWithTokenRefresh(`/api/fantasy/transfer-windows?league_id=${team.fantasy_league_id}`);
      if (windowRes.ok) {
        const windowData = await windowRes.json();
        const activeWindow = (windowData.windows || []).find((w: TransferWindow) => w.is_active);
        
        if (activeWindow) {
          setTransferWindow(activeWindow);

          // Get transfers used in this window
          const transfersRes = await fetchWithTokenRefresh(`/api/fantasy/transfers/history?team_id=${team.id}&window_id=${activeWindow.window_id}`);
          if (transfersRes.ok) {
            const transfersData = await transfersRes.json();
            setTransfersUsed((transfersData.transfers || []).length);
          }
        }
      }

      // Get available players
      const playersRes = await fetchWithTokenRefresh(`/api/fantasy/players/available?league_id=${team.fantasy_league_id}`);
      if (playersRes.ok) {
        const playersData = await playersRes.json();
        setAvailablePlayers(playersData.available_players || []);
      }

    } catch (error) {
      console.error('Error loading transfer data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const executeTransfer = async () => {
    // Allow release-only if above minimum squad size
    const isReleaseOnly = selectedOut && !selectedIn;
    
    if (!selectedOut && !selectedIn) {
      alert('Please select at least one player (to release or sign)');
      return;
    }

    if (!transferWindow) {
      alert('No active transfer window');
      return;
    }

    setIsTransferring(true);

    try {
      const response = await fetchWithTokenRefresh('/api/fantasy/transfers/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user!.uid,
          player_out_id: selectedOut?.squad_id || null,
          player_in_id: selectedIn?.real_player_id || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error || 'Transfer failed';
        const details = data.details ? `\n\nDetails: ${data.details}` : '';
        const message = data.message ? `\n${data.message}` : '';
        alert(`❌ ${errorMsg}${message}${details}`);
        return;
      }

      // Build success message
      let message = '✅ Transfer completed!\n\n';
      
      if (data.transfer.player_out) {
        message += `Released: ${data.transfer.player_out.name} (+€${data.transfer.player_out.refund}M)\n`;
      }
      
      if (data.transfer.player_in) {
        message += `Signed: ${data.transfer.player_in.name} (-€${data.transfer.player_in.cost}M)\n`;
      }
      
      message += `\nNew Budget: €${data.transfer.new_budget}M\nTransfers Remaining: ${data.transfer.transfers_remaining}`;
      
      alert(message);

      // Reset selections and reload
      setSelectedOut(null);
      setSelectedIn(null);
      loadTransferData();

    } catch (error) {
      console.error('Transfer error:', error);
      alert(`Failed to execute transfer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsTransferring(false);
    }
  };

  const updateCaptains = async () => {
    if (!user) return;

    setIsUpdatingCaptain(true);

    try {
      const response = await fetchWithTokenRefresh('/api/fantasy/squad/set-captain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.uid,
          captain_player_id: captainId,
          vice_captain_player_id: viceCaptainId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(`❌ ${data.error || 'Failed to update captains'}`);
        return;
      }

      alert('✅ Captain and Vice-Captain updated successfully!');
      setShowCaptainModal(false);
      loadTransferData();

    } catch (error) {
      console.error('Captain update error:', error);
      alert(`Failed to update captains: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUpdatingCaptain(false);
    }
  };

  const calculateNewBudget = () => {
    if (!teamInfo) return 0;
    
    let budget = teamInfo.budget_remaining;
    
    if (selectedOut) {
      budget += (selectedOut.purchase_price || 0);
    }
    
    if (selectedIn) {
      budget -= (selectedIn.current_price || selectedIn.draft_price || 0);
    }
    
    return budget;
  };

  const canExecuteTransfer = () => {
    if (!transferWindow || !transferWindow.is_active) return false;
    if (!teamInfo) return false;
    
    // Must have at least one action (release or sign)
    if (!selectedOut && !selectedIn) return false;
    
    const transfersRemaining = transferWindow.max_transfers_per_window - transfersUsed;
    if (transfersRemaining <= 0) return false;
    
    // Release-only transfer
    if (selectedOut && !selectedIn) {
      // Can only release if above minimum squad size
      if (teamInfo.squad_size <= teamInfo.min_squad_size) return false;
      return true;
    }
    
    // Sign-only or swap transfer
    if (selectedIn) {
      const newBudget = calculateNewBudget();
      if (newBudget < 0) return false;
      
      // If not releasing anyone, check squad size
      if (!selectedOut && teamInfo.squad_size >= teamInfo.max_squad_size) return false;
    }
    
    return true;
  };

  // Filter available players
  const filteredPlayers = availablePlayers.filter(player => {
    if (searchTerm && !player.player_name.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (positionFilter !== 'all' && player.position !== positionFilter) {
      return false;
    }
    if (teamFilter !== 'all' && (player.real_team_name || player.team) !== teamFilter) {
      return false;
    }
    return true;
  });

  // Get unique positions and teams for filters
  const positions = Array.from(new Set(availablePlayers.map(p => p.position))).sort();
  const teams = Array.from(new Set(availablePlayers.map(p => p.real_team_name || p.team || 'Unknown'))).sort();

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading transfers...</p>
        </div>
      </div>
    );
  }

  if (!user || !teamInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Fantasy Team</h2>
          <p className="text-gray-600 mb-6">You need to register for the fantasy league first.</p>
          <Link
            href="/dashboard/team"
            className="inline-block px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (!transferWindow || !transferWindow.is_active) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 p-4">
        <div className="max-w-4xl mx-auto">
          <Link
            href="/dashboard/team/fantasy/my-team"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors mb-6"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to My Team
          </Link>

          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 text-center">
            <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Transfer Window Closed</h2>
            <p className="text-gray-600 mb-6">
              The transfer window is currently closed. Check back when the next window opens.
            </p>
            <Link
              href="/dashboard/team/fantasy/my-team"
              className="inline-block px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
            >
              View My Team
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const newBudget = calculateNewBudget();
  const transfersRemaining = transferWindow.max_transfers_per_window - transfersUsed;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/dashboard/team/fantasy/my-team"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to My Team
          </Link>

          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl">
              <ArrowLeftRight className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Player Transfers</h1>
              <p className="text-gray-600">{transferWindow.window_name}</p>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white rounded-xl shadow-lg p-4 border-l-4 border-indigo-500">
              <p className="text-sm text-gray-600 mb-1">Total Points</p>
              <p className="text-2xl font-bold text-indigo-600">{teamInfo.total_points}</p>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-4 border-l-4 border-green-500">
              <p className="text-sm text-gray-600 mb-1">Budget</p>
              <p className={`text-2xl font-bold ${teamInfo.budget_remaining < 0 ? 'text-red-600' : 'text-green-600'}`}>
                €{teamInfo.budget_remaining}M
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-4 border-l-4 border-blue-500">
              <p className="text-sm text-gray-600 mb-1">Squad Size</p>
              <p className="text-2xl font-bold text-blue-600">{teamInfo.squad_size}</p>
              <p className="text-xs text-gray-500 mt-1">{teamInfo.min_squad_size}-{teamInfo.max_squad_size} allowed</p>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-4 border-l-4 border-purple-500">
              <p className="text-sm text-gray-600 mb-1">Transfers Left</p>
              <p className="text-2xl font-bold text-purple-600">{transfersRemaining}</p>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-4 border-l-4 border-orange-500">
              <p className="text-sm text-gray-600 mb-1">Points Cost</p>
              <p className="text-2xl font-bold text-orange-600">{transferWindow.points_cost_per_transfer} pts</p>
            </div>
          </div>
        </div>

        {/* Captain Selection Button */}
        <div className="mb-6">
          <button
            onClick={() => setShowCaptainModal(true)}
            className="w-full md:w-auto px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold rounded-xl hover:from-yellow-600 hover:to-orange-600 transition-all shadow-lg flex items-center justify-center gap-2"
          >
            <Star className="w-5 h-5" />
            Change Captain & Vice-Captain
          </button>
        </div>

        {/* Captain Selection Modal */}
        {showCaptainModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-gradient-to-r from-yellow-500 to-orange-500 text-white p-6 rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Star className="w-6 h-6" />
                    Select Captain & Vice-Captain
                  </h2>
                  <button
                    onClick={() => setShowCaptainModal(false)}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <p className="text-white/90 mt-2 text-sm">
                  Captain earns 2x points • Vice-Captain earns 1.5x points
                </p>
              </div>

              <div className="p-6 space-y-6">
                {/* Captain Selection */}
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <span className="px-3 py-1 bg-yellow-400 text-yellow-900 rounded-full text-sm font-bold">C</span>
                    Captain (2x Points)
                  </h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {mySquad.map((player) => (
                      <button
                        key={`captain-${player.real_player_id}`}
                        onClick={() => setCaptainId(player.real_player_id)}
                        disabled={viceCaptainId === player.real_player_id}
                        className={`w-full text-left p-4 rounded-xl transition-all ${
                          captainId === player.real_player_id
                            ? 'bg-gradient-to-r from-yellow-400 to-orange-400 text-gray-900 shadow-lg'
                            : viceCaptainId === player.real_player_id
                            ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                            : 'bg-gray-50 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-bold">{player.player_name}</p>
                            <p className="text-sm opacity-80">
                              {player.position} • {player.real_team_name}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">{player.total_points || 0} pts</p>
                            {captainId === player.real_player_id && (
                              <Check className="w-5 h-5 ml-auto" />
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Vice-Captain Selection */}
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <span className="px-3 py-1 bg-blue-400 text-blue-900 rounded-full text-sm font-bold">VC</span>
                    Vice-Captain (1.5x Points)
                  </h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {mySquad.map((player) => (
                      <button
                        key={`vc-${player.real_player_id}`}
                        onClick={() => setViceCaptainId(player.real_player_id)}
                        disabled={captainId === player.real_player_id}
                        className={`w-full text-left p-4 rounded-xl transition-all ${
                          viceCaptainId === player.real_player_id
                            ? 'bg-gradient-to-r from-blue-400 to-indigo-400 text-white shadow-lg'
                            : captainId === player.real_player_id
                            ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                            : 'bg-gray-50 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className={`font-bold ${viceCaptainId === player.real_player_id ? 'text-white' : 'text-gray-900'}`}>
                              {player.player_name}
                            </p>
                            <p className={`text-sm ${viceCaptainId === player.real_player_id ? 'text-white/90' : 'text-gray-600'}`}>
                              {player.position} • {player.real_team_name}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={`font-bold ${viceCaptainId === player.real_player_id ? 'text-white' : 'text-gray-900'}`}>
                              {player.total_points || 0} pts
                            </p>
                            {viceCaptainId === player.real_player_id && (
                              <Check className="w-5 h-5 ml-auto" />
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4 border-t">
                  <button
                    onClick={() => setShowCaptainModal(false)}
                    className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={updateCaptains}
                    disabled={isUpdatingCaptain || !captainId || !viceCaptainId || captainId === viceCaptainId}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold rounded-xl hover:from-yellow-600 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    {isUpdatingCaptain ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <Check className="w-5 h-5" />
                        Confirm
                      </>
                    )}
                  </button>
                </div>

                {captainId === viceCaptainId && captainId && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800">
                      ❌ Captain and Vice-Captain must be different players
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Transfer Summary */}
        {(selectedOut || selectedIn) && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl shadow-xl border-2 border-blue-200 p-6 mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Transfer Summary</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {/* Player Out */}
              <div className="bg-white rounded-xl p-4">
                <p className="text-sm text-gray-600 mb-2">Releasing</p>
                {selectedOut ? (
                  <div>
                    <p className="font-bold text-gray-900">{selectedOut.player_name}</p>
                    <p className="text-sm text-gray-600">{selectedOut.position} • {selectedOut.real_team_name}</p>
                    <p className="text-green-600 font-semibold mt-2">+€{selectedOut.purchase_price}M</p>
                  </div>
                ) : (
                  <p className="text-gray-400 italic">No player selected</p>
                )}
              </div>

              {/* Arrow */}
              <div className="flex items-center justify-center">
                <ArrowLeftRight className="w-8 h-8 text-blue-600" />
              </div>

              {/* Player In */}
              <div className="bg-white rounded-xl p-4">
                <p className="text-sm text-gray-600 mb-2">Signing</p>
                {selectedIn ? (
                  <div>
                    <p className="font-bold text-gray-900">{selectedIn.player_name}</p>
                    <p className="text-sm text-gray-600">{selectedIn.position} • {selectedIn.real_team_name}</p>
                    <p className="text-red-600 font-semibold mt-2">-€{selectedIn.current_price || selectedIn.draft_price}M</p>
                  </div>
                ) : (
                  <p className="text-gray-400 italic">{selectedOut ? 'Release only' : 'No player selected'}</p>
                )}
              </div>
            </div>

            {/* Budget & Points Calculation */}
            <div className="bg-white rounded-xl p-4 space-y-4">
              {/* Budget Section */}
              <div>
                <h4 className="font-bold text-gray-900 mb-3">Budget Impact</h4>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600">Current Budget:</span>
                  <span className={`font-semibold ${teamInfo.budget_remaining < 0 ? 'text-red-600' : ''}`}>
                    €{teamInfo.budget_remaining}M
                  </span>
                </div>
                {selectedOut && (
                  <div className="flex items-center justify-between mb-2 text-green-600">
                    <span>+ Release {selectedOut.player_name}:</span>
                    <span className="font-semibold">+€{selectedOut.purchase_price}M</span>
                  </div>
                )}
                {selectedIn && (
                  <div className="flex items-center justify-between mb-2 text-red-600">
                    <span>- Sign {selectedIn.player_name}:</span>
                    <span className="font-semibold">-€{selectedIn.current_price || selectedIn.draft_price}M</span>
                  </div>
                )}
                <div className="border-t-2 border-gray-200 pt-2 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-900">New Budget:</span>
                    <span className={`text-2xl font-bold ${newBudget >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      €{newBudget}M
                    </span>
                  </div>
                </div>
              </div>

              {/* Points Section */}
              <div className="border-t-2 border-gray-200 pt-4">
                <h4 className="font-bold text-gray-900 mb-3">Points Impact</h4>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600">Current Total Points:</span>
                  <span className="font-semibold text-indigo-600">{teamInfo.total_points}</span>
                </div>
                {transferWindow.points_cost_per_transfer > 0 && (
                  <div className="flex items-center justify-between mb-2 text-red-600">
                    <span>- Transfer Cost:</span>
                    <span className="font-semibold">-{transferWindow.points_cost_per_transfer} pts</span>
                  </div>
                )}
                <div className="border-t-2 border-gray-200 pt-2 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-900">New Total Points:</span>
                    <span className="text-2xl font-bold text-indigo-600">
                      {teamInfo.total_points - (transferWindow.points_cost_per_transfer || 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Execute Button */}
            <button
              onClick={executeTransfer}
              disabled={!canExecuteTransfer() || isTransferring}
              className="w-full mt-4 px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg flex items-center justify-center gap-2"
            >
              {isTransferring ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  {selectedOut && !selectedIn ? 'Release Player' : selectedIn && !selectedOut ? 'Sign Player' : 'Execute Transfer'}
                </>
              )}
            </button>

            {!canExecuteTransfer() && (selectedOut || selectedIn) && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">
                  {selectedIn && newBudget < 0 && '❌ Insufficient budget'}
                  {transfersRemaining <= 0 && '❌ No transfers remaining'}
                  {selectedIn && !selectedOut && teamInfo.squad_size >= teamInfo.max_squad_size && '❌ Squad full - release a player first'}
                  {selectedOut && !selectedIn && teamInfo.squad_size <= teamInfo.min_squad_size && `❌ Cannot release - minimum squad size is ${teamInfo.min_squad_size}`}
                </p>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* My Squad */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5" />
              My Squad ({mySquad.length})
            </h2>

            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {mySquad.map((player) => (
                <button
                  key={player.squad_id}
                  onClick={() => setSelectedOut(selectedOut?.squad_id === player.squad_id ? null : player)}
                  className={`w-full text-left p-4 rounded-xl transition-all ${
                    selectedOut?.squad_id === player.squad_id
                      ? 'bg-gradient-to-r from-red-500 to-pink-600 text-white shadow-lg'
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className={`font-bold ${selectedOut?.squad_id === player.squad_id ? 'text-white' : 'text-gray-900'}`}>
                          {player.player_name}
                        </p>
                        {player.is_captain && <span className="text-xs px-2 py-0.5 bg-yellow-400 text-yellow-900 rounded-full font-bold">C</span>}
                        {player.is_vice_captain && <span className="text-xs px-2 py-0.5 bg-blue-400 text-blue-900 rounded-full font-bold">VC</span>}
                      </div>
                      <p className={`text-sm ${selectedOut?.squad_id === player.squad_id ? 'text-white/90' : 'text-gray-600'}`}>
                        {player.position || 'Unknown'} • {player.real_team_name || 'Unknown'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${selectedOut?.squad_id === player.squad_id ? 'text-white' : 'text-gray-900'}`}>
                        €{player.purchase_price || 0}M
                      </p>
                      <p className={`text-xs ${selectedOut?.squad_id === player.squad_id ? 'text-white/80' : 'text-gray-500'}`}>
                        {player.total_points || 0} pts
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Available Players */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Available Players ({filteredPlayers.length})
            </h2>

            {/* Filters */}
            <div className="mb-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search players..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <select
                  value={positionFilter}
                  onChange={(e) => setPositionFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Positions</option>
                  {positions.map(pos => (
                    <option key={pos} value={pos}>{pos}</option>
                  ))}
                </select>

                <select
                  value={teamFilter}
                  onChange={(e) => setTeamFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Teams</option>
                  {teams.map(team => (
                    <option key={team} value={team}>{team}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {filteredPlayers.map((player) => (
                <button
                  key={player.real_player_id}
                  onClick={() => setSelectedIn(selectedIn?.real_player_id === player.real_player_id ? null : player)}
                  className={`w-full text-left p-4 rounded-xl transition-all ${
                    selectedIn?.real_player_id === player.real_player_id
                      ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg'
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className={`font-bold ${selectedIn?.real_player_id === player.real_player_id ? 'text-white' : 'text-gray-900'}`}>
                          {player.player_name}
                        </p>
                        <div className="flex gap-0.5">
                          {Array.from({ length: player.star_rating || 0 }).map((_, i) => (
                            <Star key={`star-${player.real_player_id}-${i}`} className={`w-3 h-3 ${selectedIn?.real_player_id === player.real_player_id ? 'text-yellow-300 fill-yellow-300' : 'text-yellow-500 fill-yellow-500'}`} />
                          ))}
                        </div>
                      </div>
                      <p className={`text-sm ${selectedIn?.real_player_id === player.real_player_id ? 'text-white/90' : 'text-gray-600'}`}>
                        {player.position || 'Unknown'} • {player.real_team_name || player.team || 'Unknown'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${selectedIn?.real_player_id === player.real_player_id ? 'text-white' : 'text-gray-900'}`}>
                        €{player.current_price || player.draft_price || 0}M
                      </p>
                    </div>
                  </div>
                </button>
              ))}

              {filteredPlayers.length === 0 && (
                <div className="text-center py-12">
                  <Filter className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No players found</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
