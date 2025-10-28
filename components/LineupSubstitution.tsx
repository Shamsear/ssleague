'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface Player {
  player_id: string;
  name: string;
  category?: string;
}

interface LineupSubstitutionProps {
  lineupId: string;
  fixtureId: string;
  startingXI: string[];
  substitutes: string[];
  onSubstitutionSuccess?: () => void;
}

export default function LineupSubstitution({
  lineupId,
  fixtureId,
  startingXI,
  substitutes,
  onSubstitutionSuccess
}: LineupSubstitutionProps) {
  const { user } = useAuth();
  const [playerDetails, setPlayerDetails] = useState<Map<string, Player>>(new Map());
  const [selectedOut, setSelectedOut] = useState<string | null>(null);
  const [selectedIn, setSelectedIn] = useState<string | null>(null);
  const [substitutionHistory, setSubstitutionHistory] = useState<any[]>([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    fetchPlayerDetails();
    fetchSubstitutionHistory();
  }, [startingXI, substitutes]);

  const fetchPlayerDetails = async () => {
    try {
      setLoading(true);
      const allPlayerIds = [...startingXI, ...substitutes];
      
      // Fetch player details for all players in lineup
      const detailsMap = new Map<string, Player>();
      
      for (const playerId of allPlayerIds) {
        try {
          const response = await fetch(`/api/players/${playerId}`);
          const data = await response.json();
          if (data.success && data.player) {
            detailsMap.set(playerId, {
              player_id: playerId,
              name: data.player.name,
              category: data.player.category
            });
          }
        } catch (err) {
          console.error(`Error fetching player ${playerId}:`, err);
        }
      }
      
      setPlayerDetails(detailsMap);
    } catch (err) {
      console.error('Error fetching player details:', err);
      setError('Failed to load player information');
    } finally {
      setLoading(false);
    }
  };

  const fetchSubstitutionHistory = async () => {
    try {
      const response = await fetch(`/api/lineups/${lineupId}/substitutions`);
      const data = await response.json();
      
      if (data.success && data.substitutions) {
        setSubstitutionHistory(data.substitutions);
      }
    } catch (err) {
      console.error('Error fetching substitution history:', err);
    }
  };

  const handleSubstitute = () => {
    if (!selectedOut || !selectedIn) return;
    setShowConfirm(true);
  };

  const confirmSubstitution = async () => {
    if (!selectedOut || !selectedIn) return;

    try {
      setSubmitting(true);
      setError(null);

      const playerOut = playerDetails.get(selectedOut);
      const playerIn = playerDetails.get(selectedIn);

      const response = await fetch(`/api/lineups/${lineupId}/substitute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_out: selectedOut,
          player_out_name: playerOut?.name,
          player_in: selectedIn,
          player_in_name: playerIn?.name,
          made_by: user?.uid,
          made_by_name: user?.display_name || user?.email,
          notes: notes
        })
      });

      const data = await response.json();

      if (data.success) {
        setShowConfirm(false);
        setSelectedOut(null);
        setSelectedIn(null);
        setNotes('');
        fetchSubstitutionHistory();
        if (onSubstitutionSuccess) onSubstitutionSuccess();
      } else {
        setError(data.error || 'Failed to make substitution');
      }
    } catch (err) {
      console.error('Error making substitution:', err);
      setError('Failed to make substitution');
    } finally {
      setSubmitting(false);
    }
  };

  const getPlayerById = (playerId: string): Player | undefined => {
    return playerDetails.get(playerId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass rounded-xl p-4 border border-blue-200/50">
        <h3 className="text-lg font-bold text-gray-900 flex items-center">
          <span className="text-blue-600 mr-2">🔄</span>
          Make Substitution
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          Swap a starting player with a substitute during the match
        </p>
      </div>

      {/* Selection Interface */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Starting XI - Select Player to Remove */}
        <div className="glass rounded-xl p-4 border border-red-200/50">
          <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
            <span className="text-red-600 mr-2">⬇️</span>
            Player Coming OFF
          </h4>
          <div className="space-y-2">
            {startingXI.map((playerId) => {
              const player = getPlayerById(playerId);
              const isSelected = selectedOut === playerId;
              
              return player ? (
                <button
                  key={playerId}
                  onClick={() => setSelectedOut(playerId)}
                  className={`w-full text-left p-3 rounded-lg transition-all ${
                    isSelected
                      ? 'bg-red-100 border-2 border-red-500 shadow-md'
                      : 'bg-white/60 border border-gray-200 hover:bg-red-50 hover:border-red-300'
                  }`}
                >
                  <div className="font-medium text-sm">{player.name}</div>
                  {player.category && (
                    <div className="text-xs text-gray-500">{player.category}</div>
                  )}
                  {isSelected && (
                    <div className="text-xs text-red-600 font-medium mt-1">✓ Selected to come off</div>
                  )}
                </button>
              ) : null;
            })}
          </div>
        </div>

        {/* Substitutes - Select Player to Bring On */}
        <div className="glass rounded-xl p-4 border border-green-200/50">
          <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
            <span className="text-green-600 mr-2">⬆️</span>
            Player Coming ON
          </h4>
          <div className="space-y-2">
            {substitutes.map((playerId) => {
              const player = getPlayerById(playerId);
              const isSelected = selectedIn === playerId;
              
              return player ? (
                <button
                  key={playerId}
                  onClick={() => setSelectedIn(playerId)}
                  className={`w-full text-left p-3 rounded-lg transition-all ${
                    isSelected
                      ? 'bg-green-100 border-2 border-green-500 shadow-md'
                      : 'bg-white/60 border border-gray-200 hover:bg-green-50 hover:border-green-300'
                  }`}
                >
                  <div className="font-medium text-sm">{player.name}</div>
                  {player.category && (
                    <div className="text-xs text-gray-500">{player.category}</div>
                  )}
                  {isSelected && (
                    <div className="text-xs text-green-600 font-medium mt-1">✓ Selected to come on</div>
                  )}
                </button>
              ) : null;
            })}
          </div>
        </div>
      </div>

      {/* Substitution Summary */}
      {selectedOut && selectedIn && (
        <div className="glass rounded-xl p-4 border border-blue-300 bg-blue-50">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="text-center">
              <div className="font-bold text-gray-900">{getPlayerById(selectedOut)?.name}</div>
              <div className="text-xs text-gray-600">Coming OFF</div>
            </div>
            <div className="text-2xl">🔄</div>
            <div className="text-center">
              <div className="font-bold text-gray-900">{getPlayerById(selectedIn)?.name}</div>
              <div className="text-xs text-gray-600">Coming ON</div>
            </div>
          </div>

          {/* Optional Notes */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Tactical change, Injury, etc."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <button
            onClick={handleSubstitute}
            disabled={submitting}
            className="w-full px-6 py-3 rounded-lg font-medium bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
          >
            {submitting ? 'Processing...' : 'Confirm Substitution'}
          </button>
        </div>
      )}

      {/* Substitution History */}
      {substitutionHistory.length > 0 && (
        <div className="glass rounded-xl p-4 border border-gray-200/50">
          <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
            <span className="text-gray-600 mr-2">📋</span>
            Substitution History
          </h4>
          <div className="space-y-3">
            {substitutionHistory.map((sub, idx) => (
              <div key={idx} className="bg-white/60 rounded-lg p-3 border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm">
                    <span className="font-medium text-red-600">{sub.player_out_name}</span>
                    <span className="text-gray-500 mx-2">→</span>
                    <span className="font-medium text-green-600">{sub.player_in_name}</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(sub.made_at).toLocaleTimeString()}
                  </div>
                </div>
                {sub.notes && (
                  <div className="text-xs text-gray-600 italic">"{sub.notes}"</div>
                )}
                <div className="text-xs text-gray-500 mt-1">
                  By: {sub.made_by_name}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="glass rounded-2xl p-6 max-w-md w-full border border-white/20 shadow-2xl">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Confirm Substitution
            </h3>
            <div className="mb-6">
              <div className="flex items-center justify-center gap-4 mb-4">
                <div className="text-center">
                  <div className="font-bold text-red-600">{getPlayerById(selectedOut!)?.name}</div>
                  <div className="text-xs text-gray-600">OUT</div>
                </div>
                <div className="text-2xl">🔄</div>
                <div className="text-center">
                  <div className="font-bold text-green-600">{getPlayerById(selectedIn!)?.name}</div>
                  <div className="text-xs text-gray-600">IN</div>
                </div>
              </div>
              <p className="text-sm text-gray-600 text-center">
                This substitution will be recorded and cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={submitting}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmSubstitution}
                disabled={submitting}
                className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 font-medium transition-all disabled:opacity-50"
              >
                {submitting ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
