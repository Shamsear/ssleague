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
  const [savingDraft, setSavingDraft] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isEditable, setIsEditable] = useState(true);
  const [deadlineInfo, setDeadlineInfo] = useState<any>(null);
  const [squadSize, setSquadSize] = useState<number>(5); // Default to 5
  const [maxSubstitutes, setMaxSubstitutes] = useState<number>(2); // Default to 2
  const [enableCategoryRequirements, setEnableCategoryRequirements] = useState<boolean>(true); // Default to enabled
  const [categoryRequirements, setCategoryRequirements] = useState<Record<string, number>>({});
  const [tournamentId, setTournamentId] = useState<string>('');

  useEffect(() => {
    fetchFixtureTournamentId();
    fetchRoster();
    checkEditability();
  }, [fixtureId, teamId, seasonId]);

  // Separate useEffect for loading existing lineup
  useEffect(() => {
    if (existingLineup) {
      console.log('📋 Loading existing lineup:', {
        starting_xi: existingLineup.starting_xi,
        substitutes: existingLineup.substitutes,
        starting_xi_length: existingLineup.starting_xi?.length,
        substitutes_length: existingLineup.substitutes?.length
      });
      setStartingXI(existingLineup.starting_xi || []);
      setSubstitutes(existingLineup.substitutes || []);
      console.log('✅ State updated with existing lineup');
    }
  }, [existingLineup]);

  // Debug log when state changes
  useEffect(() => {
    console.log('🔍 Current state:', {
      startingXI,
      substitutes,
      startingXI_length: startingXI?.length,
      substitutes_length: substitutes?.length
    });
  }, [startingXI, substitutes]);

  const fetchFixtureTournamentId = async () => {
    try {
      const response = await fetch(`/api/fixtures/${fixtureId}`);
      const data = await response.json();
      if (data.fixture && data.fixture.tournament_id) {
        setTournamentId(data.fixture.tournament_id);
        await fetchTournamentSettings(data.fixture.tournament_id);
      }
    } catch (err) {
      console.error('Error fetching fixture tournament ID:', err);
    }
  };

  const fetchTournamentSettings = async (tournamentIdParam: string) => {
    try {
      const response = await fetch(`/api/tournament-settings?tournament_id=${tournamentIdParam}`);
      const data = await response.json();
      if (data.settings) {
        if (data.settings.squad_size) {
          setSquadSize(data.settings.squad_size);
          // For lineup system: squad_size is starting XI, substitutes are always 2
          setMaxSubstitutes(2);
        }
        // Fetch category requirements settings
        setEnableCategoryRequirements(data.settings.enable_category_requirements ?? true);
        setCategoryRequirements(data.settings.lineup_category_requirements || {});
      }
    } catch (err) {
      console.error('Error fetching tournament settings:', err);
      // Keep defaults if fetch fails
    }
  };

  const fetchRoster = async () => {
    try {
      setLoading(true);
      console.log('🔍 LineupSubmission - Fetching roster for:', { teamId, seasonId });
      // Fetch team roster with player details
      const response = await fetch(`/api/team/${teamId}/roster?season_id=${seasonId}`);
      const data = await response.json();
      
      console.log('🔍 LineupSubmission - Roster API response:', data);
      
      if (data.success && data.players) {
        const activePlayers = data.players.filter((p: Player) => p.is_active);
        console.log('🔍 LineupSubmission - Active players:', activePlayers.length, activePlayers.map(p => p.name));
        setRoster(activePlayers);
        
        // Auto-select and auto-submit for teams with exactly 5 players (no choice needed)
        if (activePlayers.length === 5 && !existingLineup) {
          const allPlayerIds = activePlayers.map(p => p.player_id);
          setStartingXI(allPlayerIds);
          setSubstitutes([]);
          
          console.log('✅ Team has exactly 5 players - Auto-submitting lineup');
          // Auto-submit after a short delay to ensure state is set
          setTimeout(() => {
            autoSubmitLineup(allPlayerIds, []);
          }, 500);
        }
      }
    } catch (err) {
      console.error('Error fetching roster:', err);
      setError('Failed to load team roster');
    } finally {
      setLoading(false);
    }
  };

  const autoSubmitLineup = async (startingPlayers: string[], substitutePlayers: string[]) => {
    try {
      console.log('🤖 Auto-submitting lineup for team with 5 players');
      
      const payload = {
        fixture_id: fixtureId,
        team_id: teamId,
        starting_xi: startingPlayers,
        substitutes: substitutePlayers,
        submitted_by: user?.uid,
        submitted_by_name: user?.display_name || user?.email || 'Auto-submit',
        selected_by_opponent: isOpponentSelection,
        is_draft: false
      };

      const response = await fetch('/api/lineups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ Auto-submit successful');
        if (onSubmitSuccess) {
          onSubmitSuccess();
        }
      } else {
        console.error('❌ Auto-submit failed:', data.error);
        setError(`Auto-submit failed: ${data.error}`);
      }
    } catch (err) {
      console.error('Error auto-submitting lineup:', err);
      setError('Failed to auto-submit lineup');
    }
  };

  const checkEditability = async () => {
    try {
      const response = await fetch(`/api/fixtures/${fixtureId}/editable?team_id=${teamId}`);
      const data = await response.json();
      setIsEditable(data.editable);
      setDeadlineInfo(data);
    } catch (err) {
      console.error('Error checking editability:', err);
    }
  };

  const validateLineup = () => {
    const errors: string[] = [];

    if (startingXI.length !== squadSize) {
      errors.push(`Must select exactly ${squadSize} starting players`);
    }

    // Substitutes are optional (0 to 2)
    if (substitutes.length > maxSubstitutes) {
      errors.push(`Cannot select more than ${maxSubstitutes} substitute players`);
    }

    // Check for duplicates
    const allSelected = [...startingXI, ...substitutes];
    const uniqueSelected = new Set(allSelected);
    if (allSelected.length !== uniqueSelected.size) {
      errors.push('Cannot select the same player multiple times');
    }

    // Only validate category requirements if enabled
    if (enableCategoryRequirements && Object.keys(categoryRequirements).length > 0) {
      // Check each category requirement
      for (const [categoryId, minCount] of Object.entries(categoryRequirements)) {
        const count = startingXI.filter(playerId => {
          const player = roster.find(p => p.player_id === playerId);
          return player?.category === categoryId || player?.category?.toLowerCase().includes(categoryId.replace('cat_', ''));
        }).length;

        if (count < minCount) {
          const categoryName = categoryId.replace('cat_', '').replace('_', ' ');
          errors.push(`Must have at least ${minCount} ${categoryName} category player(s) in starting XI (currently ${count})`);
        }
      }
    }

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handlePlayerToggle = (playerId: string, isStarter: boolean) => {
    if (!isEditable) return;

    if (isStarter) {
      // Toggle starting XI
      const currentStartingXI = startingXI || [];
      if (currentStartingXI.includes(playerId)) {
        setStartingXI(currentStartingXI.filter(id => id !== playerId));
      } else if (currentStartingXI.length < squadSize) {
        setStartingXI([...currentStartingXI, playerId]);
      }
    } else {
      // Toggle substitutes
      const currentSubstitutes = substitutes || [];
      if (currentSubstitutes.includes(playerId)) {
        setSubstitutes(currentSubstitutes.filter(id => id !== playerId));
      } else if (currentSubstitutes.length < maxSubstitutes) {
        setSubstitutes([...currentSubstitutes, playerId]);
      }
    }
  };

  const handleAutoSelect = () => {
    if (!isEditable || roster.length === 0) return;

    // Auto-select logic:
    // 1. If exactly 5 players: all as starters, no subs
    // 2. If 6-7 players: first 5 as starters, rest as subs
    // 3. Prioritize by category if requirements exist, otherwise by order

    const availablePlayers = [...roster];
    let selectedStarters: string[] = [];
    let selectedSubs: string[] = [];

    if (availablePlayers.length === 5) {
      // All 5 as starters
      selectedStarters = availablePlayers.map(p => p.player_id);
      selectedSubs = [];
    } else if (availablePlayers.length > 5) {
      // Try to meet category requirements if enabled
      if (enableCategoryRequirements && Object.keys(categoryRequirements).length > 0) {
        // Group players by category
        const playersByCategory: Record<string, Player[]> = {};
        availablePlayers.forEach(player => {
          const cat = player.category || 'unknown';
          if (!playersByCategory[cat]) {
            playersByCategory[cat] = [];
          }
          playersByCategory[cat].push(player);
        });

        // First, fill required categories
        for (const [catId, minCount] of Object.entries(categoryRequirements)) {
          const catPlayers = playersByCategory[catId] || [];
          const toAdd = Math.min(minCount, catPlayers.length);
          for (let i = 0; i < toAdd && selectedStarters.length < squadSize; i++) {
            selectedStarters.push(catPlayers[i].player_id);
          }
        }

        // Fill remaining spots with any available players
        for (const player of availablePlayers) {
          if (selectedStarters.length >= squadSize) break;
          if (!selectedStarters.includes(player.player_id)) {
            selectedStarters.push(player.player_id);
          }
        }
      } else {
        // No category requirements - just take first 5
        selectedStarters = availablePlayers.slice(0, squadSize).map(p => p.player_id);
      }

      // Remaining players as substitutes (max 2)
      const remaining = availablePlayers.filter(p => !selectedStarters.includes(p.player_id));
      selectedSubs = remaining.slice(0, maxSubstitutes).map(p => p.player_id);
    }

    setStartingXI(selectedStarters);
    setSubstitutes(selectedSubs);
  };

  const handleClearSelection = () => {
    if (!isEditable) return;
    setStartingXI([]);
    setSubstitutes([]);
  };

  const handleSubmit = async (isDraft: boolean = false) => {
    if (!isDraft && !validateLineup()) {
      console.error('❌ Frontend validation failed:', validationErrors);
      return;
    }

    try {
      if (isDraft) {
        setSavingDraft(true);
      } else {
        setSubmitting(true);
      }
      setError(null);

      const payload = {
        fixture_id: fixtureId,
        team_id: teamId,
        starting_xi: startingXI,
        substitutes: substitutes,
        submitted_by: user?.uid,
        submitted_by_name: user?.display_name || user?.email,
        selected_by_opponent: isOpponentSelection,
        is_draft: isDraft
      };

      console.log('📤 Submitting lineup:', payload);

      const response = await fetch('/api/lineups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      console.log('📥 Response status:', response.status);
      const data = await response.json();
      console.log('📥 Response data:', data);

      if (data.success) {
        if (!isDraft && onSubmitSuccess) {
          onSubmitSuccess();
        } else if (isDraft) {
          // Show success message for draft save
          alert('Draft saved successfully!');
        }
      } else {
        // Show detailed validation errors if available
        if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
          setError(`${data.error}: ${data.errors.join(', ')}`);
        } else {
          setError(data.error || `Failed to ${isDraft ? 'save draft' : 'submit lineup'}`);
        }
        console.error('Lineup submission error:', data);
      }
    } catch (err) {
      console.error('Error submitting lineup:', err);
      setError(`Failed to ${isDraft ? 'save draft' : 'submit lineup'}`);
    } finally {
      if (isDraft) {
        setSavingDraft(false);
      } else {
        setSubmitting(false);
      }
    }
  };

  const getPlayerById = (playerId: string) => {
    return roster.find(p => p.player_id === playerId);
  };

  const isPlayerSelected = (playerId: string) => {
    return (startingXI || []).includes(playerId) || (substitutes || []).includes(playerId);
  };

  const classicCount = (startingXI || []).filter(playerId => {
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
    <div className="space-y-4">
      {/* Header with Status */}
      <div className={`rounded-xl p-4 border ${isOpponentSelection ? 'border-yellow-300 bg-yellow-50' : 'border-blue-200 bg-blue-50/30'}`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h3 className="text-base sm:text-lg font-bold text-gray-900">
            {isOpponentSelection ? `Selecting Lineup for ${opponentTeamName}` : 'Lineup Submission'}
          </h3>
          <div className="flex gap-2">
            {existingLineup?.is_locked && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                🔒 Locked
              </span>
            )}
            {!isEditable && !existingLineup?.is_locked && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                ⏰ Deadline Passed
              </span>
            )}
          </div>
        </div>
        
        {deadlineInfo && isEditable && (
          <div className="mt-2 space-y-1">
            {deadlineInfo.roundStart && (
              <p className="text-xs sm:text-sm text-gray-600">
                📅 Round starts: {new Date(deadlineInfo.roundStart).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
              </p>
            )}
            {deadlineInfo.deadline && (
              <p className="text-xs sm:text-sm font-semibold text-blue-700">
                ⏰ Lineup locks: {new Date(deadlineInfo.deadline).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} (1 hour grace period)
              </p>
            )}
          </div>
        )}
      </div>

      {/* Auto-selection info */}
      {roster.length === 5 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs sm:text-sm text-blue-800">
            ℹ️ Your team has exactly 5 players. All players have been automatically selected as starters.
          </p>
        </div>
      )}
      {roster.length > 5 && isEditable && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
          <p className="text-xs sm:text-sm text-purple-800">
            💡 <strong>Tip:</strong> Use the "Auto-Select Lineup" button below to quickly fill your lineup with the first {squadSize} players as starters and remaining as substitutes.
          </p>
        </div>
      )}

      {/* Category Requirements Info */}
      {!enableCategoryRequirements && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-xs sm:text-sm text-green-800 flex items-center gap-2">
            <span className="text-lg">✅</span>
            <span><strong>No Category Restrictions:</strong> You can select any players for your lineup without category requirements.</span>
          </p>
        </div>
      )}

      {/* Validation Summary */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className={`rounded-lg p-3 sm:p-4 border ${(startingXI?.length || 0) === squadSize ? 'border-green-400 bg-green-50' : 'border-gray-300 bg-white'}`}>
          <div className="text-xl sm:text-2xl font-bold text-center">{startingXI?.length || 0}/{squadSize}</div>
          <div className="text-[10px] sm:text-xs text-center text-gray-600 mt-1">Starting</div>
        </div>
        <div className={`rounded-lg p-3 sm:p-4 border ${(substitutes?.length || 0) <= maxSubstitutes ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-white'}`}>
          <div className="text-xl sm:text-2xl font-bold text-center">{substitutes?.length || 0}/{maxSubstitutes}</div>
          <div className="text-[10px] sm:text-xs text-center text-gray-600 mt-1">Subs</div>
        </div>
        {enableCategoryRequirements && Object.keys(categoryRequirements).length > 0 ? (
          <div className="rounded-lg p-3 sm:p-4 border border-purple-400 bg-purple-50">
            <div className="text-xs sm:text-sm text-center text-gray-700">
              <div className="font-semibold mb-1">Category Requirements</div>
              {Object.entries(categoryRequirements).map(([catId, minCount]) => {
                const catName = catId.replace('cat_', '').replace('_', ' ');
                const count = startingXI.filter(playerId => {
                  const player = getPlayerById(playerId);
                  return player?.category === catId || player?.category?.toLowerCase().includes(catId.replace('cat_', ''));
                }).length;
                const isValid = count >= minCount;
                return (
                  <div key={catId} className={`text-[10px] sm:text-xs ${isValid ? 'text-green-600' : 'text-orange-600'} font-medium`}>
                    {catName}: {count}/{minCount} {isValid ? '✓' : '✗'}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-lg p-3 sm:p-4 border border-gray-300 bg-gray-50">
            <div className="text-xl sm:text-2xl font-bold text-center text-gray-400">—</div>
            <div className="text-[10px] sm:text-xs text-center text-gray-500 mt-1">No Restrictions</div>
          </div>
        )}
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-lg p-3">
          <h4 className="text-xs sm:text-sm font-semibold text-red-800 mb-2">⚠️ Issues:</h4>
          <ul className="space-y-1">
            {validationErrors.map((err, idx) => (
              <li key={idx} className="text-xs sm:text-sm text-red-700 flex items-start gap-2">
                <span className="text-red-500 mt-0.5">•</span>
                <span>{err}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Selected Players Display */}
      <div className="space-y-4">
        {/* Starting XI */}
        <div className="rounded-xl p-3 sm:p-4 border-2 border-green-200 bg-gradient-to-br from-green-50 to-white">
          <h4 className="text-sm sm:text-base font-bold text-gray-900 mb-3 flex items-center">
            <span className="text-green-600 mr-2 text-lg">⭐</span>
            Starting XI ({startingXI?.length || 0}/{squadSize})
          </h4>
          <div className="space-y-2">
            {(!startingXI || startingXI.length === 0) ? (
              <p className="text-xs sm:text-sm text-gray-500 text-center py-6">No players selected</p>
            ) : (
              (startingXI || []).map((playerId, idx) => {
                const player = getPlayerById(playerId);
                return player ? (
                  <div key={playerId} className="flex items-center justify-between bg-white rounded-lg p-2.5 sm:p-3 shadow-sm border border-green-100">
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                      <span className="flex-shrink-0 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-green-600 text-white flex items-center justify-center text-xs sm:text-sm font-bold">{idx + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-xs sm:text-sm text-gray-900 truncate">{player.name}</div>
                        <div className="text-[10px] sm:text-xs text-gray-500">{player.category}</div>
                      </div>
                    </div>
                    {isEditable && roster.length > 5 && (
                      <button
                        onClick={() => handlePlayerToggle(playerId, true)}
                        className="flex-shrink-0 ml-2 px-2 sm:px-3 py-1 text-xs rounded-md bg-red-50 text-red-600 hover:bg-red-100 font-medium"
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
        <div className="rounded-xl p-3 sm:p-4 border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white">
          <h4 className="text-sm sm:text-base font-bold text-gray-900 mb-3 flex items-center">
            <span className="text-blue-600 mr-2 text-lg">🔄</span>
            Substitutes ({substitutes?.length || 0}/{maxSubstitutes})
          </h4>
          <div className="space-y-2">
            {(!substitutes || substitutes.length === 0) ? (
              <p className="text-xs sm:text-sm text-gray-500 text-center py-6">No substitutes selected</p>
            ) : (
              (substitutes || []).map((playerId, idx) => {
                const player = getPlayerById(playerId);
                return player ? (
                  <div key={playerId} className="flex items-center justify-between bg-white rounded-lg p-2.5 sm:p-3 shadow-sm border border-blue-100">
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                      <span className="flex-shrink-0 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs sm:text-sm font-bold">S{idx + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-xs sm:text-sm text-gray-900 truncate">{player.name}</div>
                        <div className="text-[10px] sm:text-xs text-gray-500">{player.category}</div>
                      </div>
                    </div>
                    {isEditable && (
                      <button
                        onClick={() => handlePlayerToggle(playerId, false)}
                        className="flex-shrink-0 ml-2 px-2 sm:px-3 py-1 text-xs rounded-md bg-red-50 text-red-600 hover:bg-red-100 font-medium"
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

      {/* Quick Actions */}
      {isEditable && roster.length > 0 && (
        <div className="flex gap-2 sm:gap-3">
          <button
            onClick={handleAutoSelect}
            className="flex-1 py-2.5 sm:py-3 rounded-lg text-xs sm:text-sm font-bold bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
          >
            <span className="text-base sm:text-lg">⚡</span>
            <span>Auto-Select Lineup</span>
          </button>
          <button
            onClick={handleClearSelection}
            disabled={(startingXI?.length || 0) === 0 && (substitutes?.length || 0) === 0}
            className="px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg text-xs sm:text-sm font-bold bg-gradient-to-r from-gray-400 to-gray-500 text-white hover:from-gray-500 hover:to-gray-600 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-md disabled:shadow-none flex items-center justify-center gap-2"
          >
            <span className="text-base sm:text-lg">🗑️</span>
            <span>Clear</span>
          </button>
        </div>
      )}

      {/* Available Players */}
      {isEditable && roster.length > 5 && (
        <div className="rounded-xl p-3 sm:p-4 border-2 border-gray-200 bg-white">
          <h4 className="text-sm sm:text-base font-bold text-gray-900 mb-3">📋 Available Players</h4>
          <div className="space-y-2">
            {roster.filter(p => !isPlayerSelected(p.player_id)).map(player => (
              <div key={player.player_id} className="flex items-center justify-between bg-gray-50 rounded-lg p-2.5 sm:p-3 border border-gray-200">
                <div className="flex-1 min-w-0 mr-2">
                  <div className="font-semibold text-xs sm:text-sm text-gray-900 truncate">{player.name}</div>
                  <div className="text-[10px] sm:text-xs text-gray-500">{player.category}</div>
                </div>
                <div className="flex gap-1.5 sm:gap-2 flex-shrink-0">
                  <button
                    onClick={() => handlePlayerToggle(player.player_id, true)}
                    disabled={(startingXI?.length || 0) >= squadSize}
                    className="px-2 sm:px-3 py-1.5 text-xs font-medium rounded-md bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    ⭐ Start
                  </button>
                  <button
                    onClick={() => handlePlayerToggle(player.player_id, false)}
                    disabled={(substitutes?.length || 0) >= maxSubstitutes}
                    className="px-2 sm:px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    🔄 Sub
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Submit Button */}
      {isEditable && (
        <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 p-3 sm:p-4 -mx-3 sm:-mx-4 -mb-3 sm:-mb-4 rounded-b-xl">
          <div className="flex gap-2 sm:gap-3">
            <button
              onClick={() => handleSubmit(true)}
              disabled={savingDraft || submitting || (startingXI?.length || 0) === 0}
              className="flex-1 py-3 sm:py-3.5 rounded-lg text-sm sm:text-base font-bold bg-gradient-to-r from-gray-400 to-gray-500 text-white hover:from-gray-500 hover:to-gray-600 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-md disabled:shadow-none"
            >
              {savingDraft ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </span>
              ) : (
                <span>💾 Save Draft</span>
              )}
            </button>
            <button
              onClick={() => handleSubmit(false)}
              disabled={submitting || savingDraft || validationErrors.length > 0}
              className="flex-1 py-3 sm:py-3.5 rounded-lg text-sm sm:text-base font-bold bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all shadow-lg disabled:shadow-none"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Submitting...
                </span>
              ) : (
                <span>✅ {existingLineup ? 'Update Lineup' : 'Submit Lineup'}</span>
              )}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-300 rounded-lg p-3 text-xs sm:text-sm text-red-700">
          <span className="font-semibold">Error:</span> {error}
        </div>
      )}
    </div>
  );
}
