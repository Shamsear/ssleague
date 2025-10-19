'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';

interface RealPlayer {
  id: string;
  player_id: string;
  name: string;
  category_name?: string;
  star_rating?: number;
}

interface LineupPlayer {
  player_id: string;
  player_name: string;
  position: number;
}

interface FixtureLineupProps {
  fixtureId: string;
  teamId: string;
  seasonId: string;
  isHomeTeam: boolean;
  phase: 'home_fixture' | 'fixture_entry' | 'result_entry' | 'closed';
  existingLineup?: {
    players: LineupPlayer[];
  } | null;
  canEdit: boolean;
  onSave?: () => void;
}

export default function FixtureLineup({
  fixtureId,
  teamId,
  seasonId,
  isHomeTeam,
  phase,
  existingLineup,
  canEdit,
  onSave,
}: FixtureLineupProps) {
  const [availablePlayers, setAvailablePlayers] = useState<RealPlayer[]>([]);
  const [lineup, setLineup] = useState<(LineupPlayer | null)[]>([null, null, null, null, null, null]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch available real players
  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        const q = query(
          collection(db, 'realplayer'),
          where('team_id', '==', teamId),
          where('season_id', '==', seasonId)
        );

        const snapshot = await getDocs(q);
        const players = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as RealPlayer));

        setAvailablePlayers(players);

        // Load existing lineup if available
        if (existingLineup?.players) {
          const loadedLineup: (LineupPlayer | null)[] = [null, null, null, null, null, null];
          existingLineup.players.forEach(player => {
            if (player.position >= 1 && player.position <= 6) {
              loadedLineup[player.position - 1] = player;
            }
          });
          setLineup(loadedLineup);
        }
      } catch (err) {
        console.error('Error fetching players:', err);
        setError('Failed to load players');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlayers();
  }, [teamId, seasonId, existingLineup]);

  const handlePlayerSelect = (position: number, player: RealPlayer | null) => {
    const newLineup = [...lineup];
    
    if (player) {
      // Remove this player from other positions
      for (let i = 0; i < newLineup.length; i++) {
        if (newLineup[i]?.player_id === player.player_id) {
          newLineup[i] = null;
        }
      }
      
      newLineup[position] = {
        player_id: player.player_id,
        player_name: player.name,
        position: position + 1,
      };
    } else {
      newLineup[position] = null;
    }
    
    setLineup(newLineup);
  };


  const handleSave = async () => {
    setError(null);
    
    // Validate lineup
    const filledSlots = lineup.filter(p => p !== null);
    if (filledSlots.length !== 6) {
      setError('Please select all 6 players');
      return;
    }
    
    setIsSaving(true);
    
    try {
      const response = await fetch(`/api/fixtures/${fixtureId}/lineup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          players: lineup.filter(p => p !== null),
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save lineup');
      }
      
      alert('Lineup saved successfully!');
      if (onSave) onSave();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const getAvailablePlayersForSlot = (currentPosition: number) => {
    const selectedPlayerIds = lineup
      .filter((p, idx) => p !== null && idx !== currentPosition)
      .map(p => p!.player_id);
    
    return availablePlayers.filter(p => !selectedPlayerIds.includes(p.player_id));
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-sm text-gray-500 mt-2">Loading players...</p>
      </div>
    );
  }

  if (availablePlayers.length < 6) {
    return (
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
        <p className="text-sm text-orange-800">
          You need at least 6 registered real players to set a lineup. Currently: {availablePlayers.length}
        </p>
      </div>
    );
  }

  const isLocked = !canEdit || phase === 'closed';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">
          {isHomeTeam ? 'Home' : 'Away'} Team Lineup
        </h3>
        {isLocked && (
          <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full">
            🔒 Locked
          </span>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Lineup Slots */}
      <div className="space-y-2">
        {lineup.map((player, idx) => (
          <div
            key={idx}
            className="flex items-center gap-3 p-3 rounded-lg border-2 bg-white border-gray-200"
          >
            <div className="font-bold text-gray-500 w-8">#{idx + 1}</div>
            
            {isLocked ? (
              // Display only mode
              <div className="flex-1">
                {player ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-gray-900">{player.player_name}</span>
                    </div>
                  </div>
                ) : (
                  <span className="text-gray-400 italic">Empty slot</span>
                )}
              </div>
            ) : (
              // Edit mode
              <>
                <select
                  value={player?.player_id || ''}
                  onChange={(e) => {
                    const selectedPlayer = availablePlayers.find(
                      p => p.player_id === e.target.value
                    );
                    handlePlayerSelect(idx, selectedPlayer || null);
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select player...</option>
                  {player && (
                    <option value={player.player_id}>{player.player_name}</option>
                  )}
                  {getAvailablePlayersForSlot(idx).map(p => (
                    <option key={p.player_id} value={p.player_id}>
                      {p.name} {p.star_rating && `(⭐${p.star_rating})`}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Save Button */}
      {!isLocked && (
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full px-4 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Saving...' : 'Save Lineup'}
        </button>
      )}

      {/* Info */}
      <div className="text-xs text-gray-500 space-y-1">
        <p>• Select 6 players from your registered real players</p>
        <p>• All 6 players will participate in the match</p>
        <p>• Lineup locks after matchups are created</p>
      </div>
    </div>
  );
}
