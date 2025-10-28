'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface Player {
  player_id: string;
  name: string;
  category: string;
  is_active: boolean;
}

interface LineupSubmissionProps {
  fixtureId: string;
  teamId: string;
  seasonId: string;
  onSubmitSuccess?: () => void;
  existingLineup?: {
    starting_xi: string[];
    substitutes: string[];
    is_locked: boolean;
  } | null;
  isOpponentSelection?: boolean;
  opponentTeamName?: string;
}

export default function LineupSubmission({
  fixtureId,
  teamId,
  seasonId,
  onSubmitSuccess,
  existingLineup,
  isOpponentSelection = false,
  opponentTeamName
}: LineupSubmissionProps) {
  const { user } = useAuth();
  const [roster, setRoster] = useState<Player[]>([]);
  const [startingXI, setStartingXI] = useState<string[]>([]);
  const [substitutes, setSubstitutes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isEditable, setIsEditable] = useState(true);
  const [deadlineInfo, setDeadlineInfo] = useState<any>(null);

  useEffect(() => {
    fetchRoster();
    checkEditability();
    if (existingLineup) {
      setStartingXI(existingLineup.starting_xi);
      setSubstitutes(existingLineup.substitutes);
    }
  }, [fixtureId, teamId, seasonId]);

  const fetchRoster = async () => {
    try {
      setLoading(true);
      // Fetch team roster with player details
      const response = await fetch(`/api/team/${teamId}/roster?season_id=${seasonId}`);
      const data = await response.json();
      
      if (data.success && data.players) {
        setRoster(data.players.filter((p: Player) => p.is_active));
      }
    } catch (err) {
      console.error('Error fetching roster:', err);
      setError('Failed to load team roster');
    } finally {
      setLoading(false);
    }
  };

  const checkEditability = async () => {
    try {
      const response = await fetch(`/api/fixtures/${fixtureId}/editable`);
      const data = await response.json();
      setIsEditable(data.editable);
      setDeadlineInfo(data);
    } catch (err) {
      console.error('Error checking editability:', err);
    }
  };

  const validateLineup = () => {
    const errors: string[] = [];

    if (startingXI.length !== 5) {
      errors.push('Must select exactly 5 starting players');
    }

    if (substitutes.length !== 2) {
      errors.push('Must select exactly 2 substitute players');
    }

    // Check for duplicates
    const allSelected = [...startingXI, ...substitutes];
    const uniqueSelected = new Set(allSelected);
    if (allSelected.length !== uniqueSelected.size) {
      errors.push('Cannot select the same player multiple times');
    }

    // Check classic players
    const classicCount = startingXI.filter(playerId => {
      const player = roster.find(p => p.player_id === playerId);
      return player?.category?.toLowerCase().includes('classic');
    }).length;

    if (classicCount < 2) {
      errors.push('Must have at least 2 classic category players in starting XI');
    }

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handlePlayerToggle = (playerId: string, isStarter: boolean) => {
    if (!isEditable) return;

    if (isStarter) {
      // Toggle starting XI
      if (startingXI.includes(playerId)) {
        setStartingXI(startingXI.filter(id => id !== playerId));
      } else if (startingXI.length < 5) {
        setStartingXI([...startingXI, playerId]);
      }
    } else {
      // Toggle substitutes
      if (substitutes.includes(playerId)) {
        setSubstitutes(substitutes.filter(id => id !== playerId));
      } else if (substitutes.length < 2) {
        setSubstitutes([...substitutes, playerId]);
      }
    }
  };

  const handleSubmit = async () => {
    if (!validateLineup()) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const response = await fetch('/api/lineups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fixture_id: fixtureId,
          team_id: teamId,
          starting_xi: startingXI,
          substitutes: substitutes,
          submitted_by: user?.uid,
          submitted_by_name: user?.display_name || user?.email,
          selected_by_opponent: isOpponentSelection
        })
      });

      const data = await response.json();

      if (data.success) {
        if (onSubmitSuccess) onSubmitSuccess();
      } else {
        setError(data.error || 'Failed to submit lineup');
      }
    } catch (err) {
      console.error('Error submitting lineup:', err);
      setError('Failed to submit lineup');
    } finally {
      setSubmitting(false);
    }
  };

  const getPlayerById = (playerId: string) => {
    return roster.find(p => p.player_id === playerId);
  };

  const isPlayerSelected = (playerId: string) => {
    return startingXI.includes(playerId) || substitutes.includes(playerId);
  };

  const classicCount = startingXI.filter(playerId => {
    const player = getPlayerById(playerId);
    return player?.category?.toLowerCase().includes('classic');
  }).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Status */}
      <div className={`glass rounded-xl p-4 border ${isOpponentSelection ? 'border-yellow-300/50 bg-yellow-50/50' : 'border-blue-200/50'}`}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-bold text-gray-900">
            {isOpponentSelection ? `Selecting Lineup for ${opponentTeamName}` : 'Lineup Submission'}
          </h3>
          {existingLineup?.is_locked && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
              🔒 Locked
            </span>
          )}
          {!isEditable && !existingLineup?.is_locked && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
              ⏰ Deadline Passed
            </span>
          )}
        </div>
        
        {deadlineInfo && isEditable && (
          <p className="text-sm text-gray-600">
            Can edit until: {new Date(deadlineInfo.deadline).toLocaleString()}
          </p>
        )}
      </div>

      {/* Validation Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className={`glass rounded-lg p-4 border ${startingXI.length === 5 ? 'border-green-300 bg-green-50' : 'border-gray-200'}`}>
          <div className="text-2xl font-bold text-center">{startingXI.length}/5</div>
          <div className="text-xs text-center text-gray-600">Starting XI</div>
        </div>
        <div className={`glass rounded-lg p-4 border ${substitutes.length === 2 ? 'border-green-300 bg-green-50' : 'border-gray-200'}`}>
          <div className="text-2xl font-bold text-center">{substitutes.length}/2</div>
          <div className="text-xs text-center text-gray-600">Substitutes</div>
        </div>
        <div className={`glass rounded-lg p-4 border ${classicCount >= 2 ? 'border-green-300 bg-green-50' : 'border-orange-300 bg-orange-50'}`}>
          <div className="text-2xl font-bold text-center">{classicCount}/2</div>
          <div className="text-xs text-center text-gray-600">Classic Players</div>
        </div>
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-red-800 mb-2">⚠️ Validation Errors:</h4>
          <ul className="list-disc list-inside space-y-1">
            {validationErrors.map((err, idx) => (
              <li key={idx} className="text-sm text-red-700">{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Selected Players Display */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Starting XI */}
        <div className="glass rounded-xl p-4 border border-green-200/50">
          <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
            <span className="text-green-600 mr-2">⭐</span>
            Starting XI ({startingXI.length}/5)
          </h4>
          <div className="space-y-2">
            {startingXI.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No players selected</p>
            ) : (
              startingXI.map((playerId, idx) => {
                const player = getPlayerById(playerId);
                return player ? (
                  <div key={playerId} className="flex items-center justify-between bg-white/60 rounded-lg p-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">#{idx + 1}</span>
                      <div>
                        <div className="font-medium text-sm">{player.name}</div>
                        <div className="text-xs text-gray-500">{player.category}</div>
                      </div>
                    </div>
                    {isEditable && (
                      <button
                        onClick={() => handlePlayerToggle(playerId, true)}
                        className="text-red-600 hover:text-red-700 text-sm"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ) : null;
              })
            )}
          </div>
        </div>

        {/* Substitutes */}
        <div className="glass rounded-xl p-4 border border-blue-200/50">
          <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
            <span className="text-blue-600 mr-2">🔄</span>
            Substitutes ({substitutes.length}/2)
          </h4>
          <div className="space-y-2">
            {substitutes.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No substitutes selected</p>
            ) : (
              substitutes.map((playerId, idx) => {
                const player = getPlayerById(playerId);
                return player ? (
                  <div key={playerId} className="flex items-center justify-between bg-white/60 rounded-lg p-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">#{idx + 1}</span>
                      <div>
                        <div className="font-medium text-sm">{player.name}</div>
                        <div className="text-xs text-gray-500">{player.category}</div>
                      </div>
                    </div>
                    {isEditable && (
                      <button
                        onClick={() => handlePlayerToggle(playerId, false)}
                        className="text-red-600 hover:text-red-700 text-sm"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ) : null;
              })
            )}
          </div>
        </div>
      </div>

      {/* Available Players */}
      {isEditable && (
        <div className="glass rounded-xl p-4 border border-gray-200/50">
          <h4 className="font-semibold text-gray-900 mb-3">Available Players</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {roster.filter(p => !isPlayerSelected(p.player_id)).map(player => (
              <div key={player.player_id} className="flex items-center justify-between bg-white/60 rounded-lg p-3">
                <div>
                  <div className="font-medium text-sm">{player.name}</div>
                  <div className="text-xs text-gray-500">{player.category}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePlayerToggle(player.player_id, true)}
                    disabled={startingXI.length >= 5}
                    className="px-3 py-1 text-xs rounded-md bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Start
                  </button>
                  <button
                    onClick={() => handlePlayerToggle(player.player_id, false)}
                    disabled={substitutes.length >= 2}
                    className="px-3 py-1 text-xs rounded-md bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Sub
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Submit Button */}
      {isEditable && (
        <div className="flex justify-end gap-3">
          <button
            onClick={handleSubmit}
            disabled={submitting || validationErrors.length > 0}
            className="px-6 py-3 rounded-lg font-medium bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {submitting ? 'Submitting...' : existingLineup ? 'Update Lineup' : 'Submit Lineup'}
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
