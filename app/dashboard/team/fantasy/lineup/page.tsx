'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Player {
  draft_id: string;
  real_player_id: string;
  player_name: string;
  position: string;
  total_points: number;
}

interface Lineup {
  id: string;
  matchday: number;
  lineup_player_ids: string[];
  captain_player_id: string | null;
  vice_captain_player_id: string | null;
  formation: string;
  is_locked: boolean;
}

export default function LineupManagementPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [fantasyTeamId, setFantasyTeamId] = useState<string>('');
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);
  const [captain, setCaptain] = useState<string | null>(null);
  const [viceCaptain, setViceCaptain] = useState<string | null>(null);
  const [currentMatchday, setCurrentMatchday] = useState<number>(1);
  const [lineup, setLineup] = useState<Lineup | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'team') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;

      try {
        // Get fantasy team and players
        const teamResponse = await fetch(`/api/fantasy/teams/my-team?user_id=${user.uid}`);
        
        if (teamResponse.status === 404) {
          setIsLoading(false);
          return;
        }

        if (!teamResponse.ok) {
          throw new Error('Failed to load fantasy team');
        }

        const teamData = await teamResponse.json();
        setFantasyTeamId(teamData.team.id);
        
        // Get drafted players with positions
        const playersWithPositions = await Promise.all(
          teamData.players.map(async (player: Player) => {
            try {
              const playerResponse = await fetch(`/api/fantasy/players/all`);
              const allPlayersData = await playerResponse.json();
              const playerDetails = allPlayersData.players.find(
                (p: any) => p.real_player_id === player.real_player_id
              );
              return {
                ...player,
                position: playerDetails?.position || 'Unknown',
              };
            } catch {
              return { ...player, position: 'Unknown' };
            }
          })
        );

        setAllPlayers(playersWithPositions);

        // Load existing lineup for current matchday
        const lineupResponse = await fetch(
          `/api/fantasy/lineups?fantasy_team_id=${teamData.team.id}&matchday=${currentMatchday}`
        );
        
        if (lineupResponse.ok) {
          const lineupData = await lineupResponse.json();
          if (lineupData.lineup) {
            setLineup(lineupData.lineup);
            setCaptain(lineupData.lineup.captain_player_id);
            setViceCaptain(lineupData.lineup.vice_captain_player_id);
            
            // Set selected players from lineup
            const lineupPlayers = playersWithPositions.filter((p: Player) =>
              lineupData.lineup.lineup_player_ids.includes(p.real_player_id)
            );
            setSelectedPlayers(lineupPlayers);
          }
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      loadData();
    }
  }, [user, currentMatchday]);

  const togglePlayerSelection = (player: Player) => {
    if (lineup?.is_locked) {
      setMessage({ type: 'error', text: 'Lineup is locked and cannot be modified' });
      return;
    }

    const isSelected = selectedPlayers.some(p => p.real_player_id === player.real_player_id);

    if (isSelected) {
      // Remove player
      setSelectedPlayers(selectedPlayers.filter(p => p.real_player_id !== player.real_player_id));
      
      // Clear captain/VC if removing them
      if (captain === player.real_player_id) setCaptain(null);
      if (viceCaptain === player.real_player_id) setViceCaptain(null);
    } else {
      // Add player (max 9)
      if (selectedPlayers.length >= 9) {
        setMessage({ type: 'error', text: 'Maximum 9 players allowed in lineup' });
        return;
      }
      setSelectedPlayers([...selectedPlayers, player]);
    }
  };

  const setCaptainRole = (playerId: string) => {
    if (!selectedPlayers.some(p => p.real_player_id === playerId)) {
      setMessage({ type: 'error', text: 'Player must be in lineup to be captain' });
      return;
    }
    
    if (captain === playerId) {
      setCaptain(null);
    } else {
      setCaptain(playerId);
      // Can't be both captain and VC
      if (viceCaptain === playerId) setViceCaptain(null);
    }
  };

  const setViceCaptainRole = (playerId: string) => {
    if (!selectedPlayers.some(p => p.real_player_id === playerId)) {
      setMessage({ type: 'error', text: 'Player must be in lineup to be vice-captain' });
      return;
    }
    
    if (viceCaptain === playerId) {
      setViceCaptain(null);
    } else {
      setViceCaptain(playerId);
      // Can't be both captain and VC
      if (captain === playerId) setCaptain(null);
    }
  };

  const saveLineup = async () => {
    if (selectedPlayers.length !== 9) {
      setMessage({ type: 'error', text: 'Please select exactly 9 players' });
      return;
    }

    // Validate formation (2 FWD, 3 MID, 3 DEF, 1 GK)
    const positions = selectedPlayers.reduce((acc, player) => {
      const pos = player.position.toUpperCase();
      if (pos.includes('FWD') || pos.includes('CF') || pos.includes('ST')) acc.FWD++;
      else if (pos.includes('MID') || pos.includes('MF')) acc.MID++;
      else if (pos.includes('DEF') || pos.includes('CB') || pos.includes('LB') || pos.includes('RB')) acc.DEF++;
      else if (pos.includes('GK')) acc.GK++;
      return acc;
    }, { FWD: 0, MID: 0, DEF: 0, GK: 0 });

    // For now, allow flexible formations - just need 1 GK
    if (positions.GK !== 1) {
      setMessage({ type: 'error', text: 'Lineup must have exactly 1 goalkeeper' });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/fantasy/lineups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fantasy_team_id: fantasyTeamId,
          matchday: currentMatchday,
          lineup_player_ids: selectedPlayers.map(p => p.real_player_id),
          captain_player_id: captain,
          vice_captain_player_id: viceCaptain,
          formation: '2-3-3-1',
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save lineup');
      }

      setMessage({ type: 'success', text: 'Lineup saved successfully!' });
    } catch (error) {
      console.error('Error saving lineup:', error);
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to save lineup'
      });
    } finally {
      setIsSaving(false);
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

  if (!user || !fantasyTeamId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">No Fantasy Team</h2>
          <p className="text-gray-600 mb-6">You don't have a fantasy team yet.</p>
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

  const availablePlayers = allPlayers.filter(
    p => !selectedPlayers.some(sp => sp.real_player_id === p.real_player_id)
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
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
          
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                Weekly Lineup
              </h1>
              <p className="text-gray-600 mt-2">Select 9 players and assign captain/vice-captain</p>
            </div>
            
            {/* Matchday Selector */}
            <div className="flex items-center gap-3">
              <label className="text-sm font-semibold text-gray-700">Matchday:</label>
              <input
                type="number"
                min="1"
                value={currentMatchday}
                onChange={(e) => setCurrentMatchday(parseInt(e.target.value) || 1)}
                className="w-20 px-3 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-xl ${
            message.type === 'success' 
              ? 'bg-green-50 border border-green-200 text-green-800' 
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            {message.text}
          </div>
        )}

        {/* Lineup Status */}
        {lineup?.is_locked && (
          <div className="mb-6 p-4 rounded-xl bg-yellow-50 border border-yellow-200">
            <p className="text-yellow-800 font-semibold flex items-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              Lineup is locked and cannot be modified
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Selected Lineup */}
          <div className="glass rounded-3xl p-6 border border-white/20">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center justify-between">
              <span>Your Lineup ({selectedPlayers.length}/9)</span>
              <button
                onClick={saveLineup}
                disabled={isSaving || selectedPlayers.length !== 9 || lineup?.is_locked}
                className="px-6 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-purple-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-base"
              >
                {isSaving ? 'Saving...' : 'Save Lineup'}
              </button>
            </h2>

            <div className="space-y-3">
              {selectedPlayers.map(player => (
                <div key={player.real_player_id} className="glass rounded-xl p-4 border border-white/10">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{player.player_name}</h3>
                        {captain === player.real_player_id && (
                          <span className="px-2 py-1 bg-yellow-400 text-yellow-900 text-xs font-bold rounded">C</span>
                        )}
                        {viceCaptain === player.real_player_id && (
                          <span className="px-2 py-1 bg-gray-400 text-gray-900 text-xs font-bold rounded">VC</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{player.position} • {player.total_points} pts</p>
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCaptainRole(player.real_player_id)}
                        disabled={lineup?.is_locked}
                        className="px-3 py-1 bg-yellow-100 hover:bg-yellow-200 text-yellow-900 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                      >
                        {captain === player.real_player_id ? 'Remove C' : 'Captain'}
                      </button>
                      <button
                        onClick={() => setViceCaptainRole(player.real_player_id)}
                        disabled={lineup?.is_locked}
                        className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                      >
                        {viceCaptain === player.real_player_id ? 'Remove VC' : 'VC'}
                      </button>
                      <button
                        onClick={() => togglePlayerSelection(player)}
                        disabled={lineup?.is_locked}
                        className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-900 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {selectedPlayers.length === 0 && (
                <p className="text-center text-gray-500 py-8">No players selected yet</p>
              )}
            </div>
          </div>

          {/* Available Players */}
          <div className="glass rounded-3xl p-6 border border-white/20">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Available Players</h2>

            <div className="space-y-3">
              {availablePlayers.map(player => (
                <div key={player.real_player_id} className="glass rounded-xl p-4 border border-white/10 hover:border-indigo-300 transition-all cursor-pointer"
                  onClick={() => togglePlayerSelection(player)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{player.player_name}</h3>
                      <p className="text-sm text-gray-600">{player.position} • {player.total_points} pts</p>
                    </div>
                    <button
                      disabled={lineup?.is_locked}
                      className="px-4 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-900 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                </div>
              ))}

              {availablePlayers.length === 0 && (
                <p className="text-center text-gray-500 py-8">All players are in your lineup</p>
              )}
            </div>
          </div>
        </div>

        {/* Formation Info */}
        <div className="mt-8 glass rounded-2xl p-6 border border-white/20">
          <h3 className="font-semibold text-gray-900 mb-3">📋 Lineup Requirements</h3>
          <ul className="text-sm text-gray-700 space-y-1">
            <li>• Select exactly 9 players from your drafted squad</li>
            <li>• Must include 1 goalkeeper</li>
            <li>• Assign a Captain (gets bonus points)</li>
            <li>• Assign a Vice-Captain (backup if captain doesn't play)</li>
            <li>• Lineups lock 1 hour before matchday starts</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
