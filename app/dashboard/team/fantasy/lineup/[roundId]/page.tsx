'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface Player {
  real_player_id: string;
  player_name: string;
  position: string;
  team_name: string;
  total_points: number;
  form_status?: string;
  form_multiplier?: number;
}

interface Lineup {
  starting_players: string[];
  captain_id: string;
  vice_captain_id: string;
  bench_players: string[];
}

export default function WeeklyLineupSelector() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const roundId = params.roundId as string;

  const [squad, setSquad] = useState<Player[]>([]);
  const [lineup, setLineup] = useState<Lineup>({
    starting_players: [],
    captain_id: '',
    vice_captain_id: '',
    bench_players: []
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [lockDeadline, setLockDeadline] = useState<Date | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [timeUntilLock, setTimeUntilLock] = useState('');

  useEffect(() => {
    loadSquadAndLineup();
  }, [roundId]);

  useEffect(() => {
    if (lockDeadline) {
      const interval = setInterval(updateCountdown, 1000);
      return () => clearInterval(interval);
    }
  }, [lockDeadline]);

  const loadSquadAndLineup = async () => {
    try {
      setLoading(true);
      setError('');

      // Get team ID from user
      const teamRes = await fetch('/api/fantasy/my-team');
      const teamData = await teamRes.json();
      
      if (!teamData.success) {
        throw new Error('Failed to load team');
      }

      const teamId = teamData.team.team_id;
      const leagueId = teamData.team.league_id;

      // Get squad
      const squadRes = await fetch(`/api/fantasy/squad?team_id=${teamId}`);
      const squadData = await squadRes.json();
      
      if (!squadData.success) {
        throw new Error('Failed to load squad');
      }

      setSquad(squadData.squad);

      // Get existing lineup if any
      const lineupRes = await fetch(
        `/api/fantasy/lineups?team_id=${teamId}&round_id=${roundId}`
      );
      const lineupData = await lineupRes.json();

      if (lineupData.success && lineupData.lineup) {
        setLineup({
          starting_players: lineupData.lineup.starting_players,
          captain_id: lineupData.lineup.captain_id,
          vice_captain_id: lineupData.lineup.vice_captain_id,
          bench_players: lineupData.lineup.bench_players
        });
        setIsLocked(lineupData.lineup.is_locked);
        setLockDeadline(new Date(lineupData.lineup.lock_deadline));
      } else {
        // Get round deadline
        const roundRes = await fetch(`/api/rounds/${roundId}`);
        const roundData = await roundRes.json();
        
        if (roundData.success) {
          setLockDeadline(new Date(roundData.round.start_time));
        }
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateCountdown = () => {
    if (!lockDeadline) return;

    const now = new Date();
    const diff = lockDeadline.getTime() - now.getTime();

    if (diff <= 0) {
      setTimeUntilLock('Deadline passed');
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    if (days > 0) {
      setTimeUntilLock(`${days}d ${hours}h ${minutes}m`);
    } else if (hours > 0) {
      setTimeUntilLock(`${hours}h ${minutes}m ${seconds}s`);
    } else {
      setTimeUntilLock(`${minutes}m ${seconds}s`);
    }
  };

  const togglePlayerInStarting = (playerId: string) => {
    if (isLocked) return;

    const isInStarting = lineup.starting_players.includes(playerId);
    const isInBench = lineup.bench_players.includes(playerId);

    if (isInStarting) {
      // Remove from starting
      setLineup(prev => ({
        ...prev,
        starting_players: prev.starting_players.filter(id => id !== playerId),
        captain_id: prev.captain_id === playerId ? '' : prev.captain_id,
        vice_captain_id: prev.vice_captain_id === playerId ? '' : prev.vice_captain_id
      }));
    } else if (isInBench) {
      // Move from bench to starting (if space)
      if (lineup.starting_players.length < 5) {
        setLineup(prev => ({
          ...prev,
          starting_players: [...prev.starting_players, playerId],
          bench_players: prev.bench_players.filter(id => id !== playerId)
        }));
      }
    } else {
      // Add to starting (if space)
      if (lineup.starting_players.length < 5) {
        setLineup(prev => ({
          ...prev,
          starting_players: [...prev.starting_players, playerId]
        }));
      }
    }
  };

  const togglePlayerInBench = (playerId: string) => {
    if (isLocked) return;

    const isInStarting = lineup.starting_players.includes(playerId);
    const isInBench = lineup.bench_players.includes(playerId);

    if (isInBench) {
      // Remove from bench
      setLineup(prev => ({
        ...prev,
        bench_players: prev.bench_players.filter(id => id !== playerId)
      }));
    } else if (isInStarting) {
      // Move from starting to bench (if space)
      if (lineup.bench_players.length < 2) {
        setLineup(prev => ({
          ...prev,
          starting_players: prev.starting_players.filter(id => id !== playerId),
          bench_players: [...prev.bench_players, playerId],
          captain_id: prev.captain_id === playerId ? '' : prev.captain_id,
          vice_captain_id: prev.vice_captain_id === playerId ? '' : prev.vice_captain_id
        }));
      }
    } else {
      // Add to bench (if space)
      if (lineup.bench_players.length < 2) {
        setLineup(prev => ({
          ...prev,
          bench_players: [...prev.bench_players, playerId]
        }));
      }
    }
  };

  const setCaptain = (playerId: string) => {
    if (isLocked) return;
    if (!lineup.starting_players.includes(playerId)) return;

    setLineup(prev => ({
      ...prev,
      captain_id: playerId,
      vice_captain_id: prev.vice_captain_id === playerId ? '' : prev.vice_captain_id
    }));
  };

  const setViceCaptain = (playerId: string) => {
    if (isLocked) return;
    if (!lineup.starting_players.includes(playerId)) return;
    if (lineup.captain_id === playerId) return;

    setLineup(prev => ({
      ...prev,
      vice_captain_id: playerId
    }));
  };

  const validateLineup = (): string[] => {
    const errors: string[] = [];

    if (lineup.starting_players.length !== 5) {
      errors.push('Must select exactly 5 starting players');
    }

    if (lineup.bench_players.length !== 2) {
      errors.push('Must select exactly 2 bench players');
    }

    if (!lineup.captain_id) {
      errors.push('Must select a captain');
    }

    if (!lineup.vice_captain_id) {
      errors.push('Must select a vice-captain');
    }

    return errors;
  };

  const saveLineup = async (lockLineup: boolean = false) => {
    const errors = validateLineup();
    if (errors.length > 0) {
      setError(errors.join('. '));
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const teamRes = await fetch('/api/fantasy/my-team');
      const teamData = await teamRes.json();
      const teamId = teamData.team.team_id;
      const leagueId = teamData.team.league_id;

      const roundRes = await fetch(`/api/rounds/${roundId}`);
      const roundData = await roundRes.json();
      const roundNumber = roundData.round.round_number;

      const response = await fetch('/api/fantasy/lineups/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team_id: teamId,
          league_id: leagueId,
          round_id: roundId,
          round_number: roundNumber,
          starting_players: lineup.starting_players,
          captain_id: lineup.captain_id,
          vice_captain_id: lineup.vice_captain_id,
          bench_players: lineup.bench_players,
          lock_deadline: lockDeadline?.toISOString()
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to save lineup');
      }

      setSuccess(lockLineup ? 'Lineup locked successfully!' : 'Lineup saved as draft');
      
      if (lockLineup) {
        setIsLocked(true);
        setTimeout(() => router.push('/dashboard/team/fantasy/my-team'), 2000);
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const getFormIcon = (formStatus?: string) => {
    switch (formStatus) {
      case 'fire': return '🔥';
      case 'hot': return '📈';
      case 'steady': return '➡️';
      case 'cold': return '📉';
      case 'frozen': return '❄️';
      default: return '';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading lineup...</p>
        </div>
      </div>
    );
  }

  const availablePlayers = squad.filter(
    p => !lineup.starting_players.includes(p.real_player_id) && 
         !lineup.bench_players.includes(p.real_player_id)
  );

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Weekly Lineup</h1>
        <p className="text-gray-600">Select your starting 5 and bench for this round</p>
      </div>

      {/* Lock Status & Countdown */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Lock Deadline</p>
            <p className="text-lg font-semibold text-gray-900">
              {lockDeadline?.toLocaleString()}
            </p>
          </div>
          <div className="text-right">
            {isLocked ? (
              <span className="inline-flex items-center px-4 py-2 bg-red-100 text-red-800 rounded-full font-semibold">
                🔒 Locked
              </span>
            ) : (
              <div>
                <p className="text-sm text-gray-600">Time Remaining</p>
                <p className="text-2xl font-bold text-blue-600">{timeUntilLock}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg mb-6">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Starting 5 */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Starting 5 ({lineup.starting_players.length}/5)
            </h2>
            <div className="space-y-3">
              {lineup.starting_players.map(playerId => {
                const player = squad.find(p => p.real_player_id === playerId);
                if (!player) return null;

                const isCaptain = lineup.captain_id === playerId;
                const isVC = lineup.vice_captain_id === playerId;

                return (
                  <div
                    key={playerId}
                    className={`border rounded-lg p-4 ${
                      isCaptain ? 'border-yellow-400 bg-yellow-50' :
                      isVC ? 'border-blue-400 bg-blue-50' :
                      'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">
                            {player.player_name}
                          </h3>
                          {getFormIcon(player.form_status)}
                        </div>
                        <p className="text-sm text-gray-600">
                          {player.position} • {player.team_name}
                        </p>
                        <p className="text-sm font-medium text-gray-700">
                          {player.total_points} pts
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {!isLocked && (
                          <>
                            <button
                              onClick={() => setCaptain(playerId)}
                              className={`px-3 py-1 rounded text-sm font-medium ${
                                isCaptain
                                  ? 'bg-yellow-500 text-white'
                                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                              }`}
                            >
                              C
                            </button>
                            <button
                              onClick={() => setViceCaptain(playerId)}
                              className={`px-3 py-1 rounded text-sm font-medium ${
                                isVC
                                  ? 'bg-blue-500 text-white'
                                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                              }`}
                            >
                              VC
                            </button>
                            <button
                              onClick={() => togglePlayerInStarting(playerId)}
                              className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                            >
                              Remove
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {lineup.starting_players.length === 0 && (
                <p className="text-gray-500 text-center py-8">
                  No starting players selected
                </p>
              )}
            </div>
          </div>

          {/* Bench */}
          <div className="bg-white rounded-lg shadow-md p-6 mt-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Bench ({lineup.bench_players.length}/2)
            </h2>
            <div className="space-y-3">
              {lineup.bench_players.map(playerId => {
                const player = squad.find(p => p.real_player_id === playerId);
                if (!player) return null;

                return (
                  <div
                    key={playerId}
                    className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">
                            {player.player_name}
                          </h3>
                          {getFormIcon(player.form_status)}
                        </div>
                        <p className="text-sm text-gray-600">
                          {player.position} • {player.team_name}
                        </p>
                        <p className="text-sm font-medium text-gray-700">
                          {player.total_points} pts
                        </p>
                      </div>
                      {!isLocked && (
                        <button
                          onClick={() => togglePlayerInBench(playerId)}
                          className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {lineup.bench_players.length === 0 && (
                <p className="text-gray-500 text-center py-8">
                  No bench players selected
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Available Players */}
        <div>
          <div className="bg-white rounded-lg shadow-md p-6 sticky top-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Available Players
            </h2>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {availablePlayers.map(player => (
                <div
                  key={player.real_player_id}
                  className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900 text-sm">
                      {player.player_name}
                    </h3>
                    {getFormIcon(player.form_status)}
                  </div>
                  <p className="text-xs text-gray-600 mb-2">
                    {player.position} • {player.team_name}
                  </p>
                  <p className="text-xs font-medium text-gray-700 mb-2">
                    {player.total_points} pts
                  </p>
                  {!isLocked && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => togglePlayerInStarting(player.real_player_id)}
                        disabled={lineup.starting_players.length >= 5}
                        className="flex-1 px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                      >
                        Start
                      </button>
                      <button
                        onClick={() => togglePlayerInBench(player.real_player_id)}
                        disabled={lineup.bench_players.length >= 2}
                        className="flex-1 px-2 py-1 bg-gray-500 text-white rounded text-xs hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                      >
                        Bench
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      {!isLocked && (
        <div className="mt-6 flex gap-4 justify-end">
          <button
            onClick={() => saveLineup(false)}
            disabled={saving}
            className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Draft'}
          </button>
          <button
            onClick={() => saveLineup(true)}
            disabled={saving || validateLineup().length > 0}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-semibold"
          >
            {saving ? 'Submitting...' : 'Submit & Lock'}
          </button>
        </div>
      )}
    </div>
  );
}
