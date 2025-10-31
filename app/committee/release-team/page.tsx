'use client';

import { useState, useEffect } from 'react';

interface Team {
  team_id: string;
  team: string;
  season_id: string;
}

interface Season {
  season_id: string;
  season_name: string;
}

interface PlayerToRelease {
  player_id: string;
  player_name: string;
  player_type: 'Real Player' | 'Football Player';
  position?: string;
  contract_original: string;
  contract_cut_to: string;
  action: string;
}

interface PreviewResult {
  success: boolean;
  mode: string;
  summary: {
    teamId: string;
    seasonId: string;
    totalPlayers: number;
    realPlayers: number;
    footballPlayers: number;
  };
  playersToRelease: PlayerToRelease[];
  message: string;
}

interface ExecuteResult {
  success: boolean;
  mode: string;
  summary: {
    teamId: string;
    seasonId: string;
    totalPlayers: number;
  };
  results: {
    realPlayersReleased: number;
    footballPlayersReleased: number;
    totalReleased: number;
    errors?: string[];
  };
  message: string;
}

export default function ReleaseTeamPage() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedSeason, setSelectedSeason] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [executeResult, setExecuteResult] = useState<ExecuteResult | null>(null);
  const [error, setError] = useState('');

  // Fetch seasons
  useEffect(() => {
    const fetchSeasons = async () => {
      try {
        const res = await fetch('/api/admin/seasons');
        const data = await res.json();
        if (data.success) {
          setSeasons(data.seasons);
          if (data.seasons.length > 0) {
            setSelectedSeason(data.seasons[0].season_id);
          }
        }
      } catch (err) {
        console.error('Failed to fetch seasons:', err);
      }
    };
    fetchSeasons();
  }, []);

  // Fetch teams when season changes
  useEffect(() => {
    if (!selectedSeason) return;
    
    const fetchTeams = async () => {
      try {
        const res = await fetch(`/api/admin/teams?seasonId=${selectedSeason}`);
        const data = await res.json();
        if (data.success) {
          setTeams(data.teams);
          if (data.teams.length > 0) {
            setSelectedTeam(data.teams[0].team_id);
          }
        }
      } catch (err) {
        console.error('Failed to fetch teams:', err);
      }
    };
    fetchTeams();
  }, [selectedSeason]);

  const handlePreview = async () => {
    if (!selectedTeam || !selectedSeason) {
      setError('Please select a team and season');
      return;
    }

    setLoading(true);
    setError('');
    setPreviewResult(null);
    setExecuteResult(null);

    try {
      const res = await fetch('/api/admin/release-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: selectedTeam,
          seasonId: selectedSeason,
          reason,
          action: 'preview'
        })
      });

      const data = await res.json();
      
      if (data.success) {
        setPreviewResult(data);
      } else {
        setError(data.error || 'Preview failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to preview release');
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!selectedTeam || !selectedSeason) {
      setError('Please select a team and season');
      return;
    }

    if (!confirm(`⚠️ Are you SURE you want to release ALL players from this team?\n\nThis will:\n- Release ${previewResult?.summary.totalPlayers} players (${previewResult?.summary.realPlayers} SS Members + ${previewResult?.summary.footballPlayers} Football Players)\n- Mark the team as withdrawn\n- Make all players available for next auction\n\nThis action is PERMANENT!`)) {
      return;
    }

    setLoading(true);
    setError('');
    setExecuteResult(null);

    try {
      const res = await fetch('/api/admin/release-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: selectedTeam,
          seasonId: selectedSeason,
          reason,
          action: 'execute'
        })
      });

      const data = await res.json();
      
      if (data.success) {
        setExecuteResult(data);
        setPreviewResult(null);
      } else {
        setError(data.error || 'Execution failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to execute release');
    } finally {
      setLoading(false);
    }
  };

  const selectedTeamName = teams.find(t => t.team_id === selectedTeam)?.team || 'Unknown Team';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 mb-6 border border-white/20">
          <h1 className="text-4xl font-bold text-white mb-2">🔓 Release Team Mid-Season</h1>
          <p className="text-blue-200">
            Force release ALL players when a team withdraws mid-season. Both SS Members and Football Players will become free agents.
          </p>
        </div>

        {/* Selection Form */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 mb-6 border border-white/20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Season Selection */}
            <div>
              <label className="block text-sm font-semibold text-blue-200 mb-2">Season</label>
              <select
                value={selectedSeason}
                onChange={(e) => setSelectedSeason(e.target.value)}
                className="w-full px-4 py-3 bg-slate-800/80 text-white rounded-lg border border-white/20 focus:border-blue-400 focus:outline-none"
              >
                {seasons.map(s => (
                  <option key={s.season_id} value={s.season_id}>
                    {s.season_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Team Selection */}
            <div>
              <label className="block text-sm font-semibold text-blue-200 mb-2">Team to Release</label>
              <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                className="w-full px-4 py-3 bg-slate-800/80 text-white rounded-lg border border-white/20 focus:border-blue-400 focus:outline-none"
              >
                {teams.map(t => (
                  <option key={t.team_id} value={t.team_id}>
                    {t.team}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Reason */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-blue-200 mb-2">Reason for Release (Optional)</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Team withdrew mid-season"
              className="w-full px-4 py-3 bg-slate-800/80 text-white rounded-lg border border-white/20 focus:border-blue-400 focus:outline-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              onClick={handlePreview}
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition-all"
            >
              {loading ? '⏳ Loading...' : '👁️ Preview Release'}
            </button>
            {previewResult && (
              <button
                onClick={handleExecute}
                disabled={loading}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition-all"
              >
                {loading ? '⏳ Executing...' : '🔓 Execute Release'}
              </button>
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 mb-6">
            <p className="text-red-200">❌ {error}</p>
          </div>
        )}

        {/* Preview Results */}
        {previewResult && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 mb-6 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-4">📋 Preview Results</h2>
            
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-lg p-4 border border-blue-400/30">
                <div className="text-blue-200 text-sm mb-1">Total Players</div>
                <div className="text-3xl font-bold text-white">{previewResult.summary.totalPlayers}</div>
              </div>
              <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 rounded-lg p-4 border border-green-400/30">
                <div className="text-green-200 text-sm mb-1">SS Members</div>
                <div className="text-3xl font-bold text-white">{previewResult.summary.realPlayers}</div>
              </div>
              <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 rounded-lg p-4 border border-purple-400/30">
                <div className="text-purple-200 text-sm mb-1">Football Players</div>
                <div className="text-3xl font-bold text-white">{previewResult.summary.footballPlayers}</div>
              </div>
            </div>

            {/* Players List */}
            {previewResult.playersToRelease.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Players to be Released:</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {previewResult.playersToRelease.map((player, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-800/60 rounded-lg p-4 border border-white/10 hover:border-white/30 transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-white font-semibold">{player.player_name}</span>
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                              player.player_type === 'Real Player'
                                ? 'bg-green-500/20 text-green-300 border border-green-400/30'
                                : 'bg-purple-500/20 text-purple-300 border border-purple-400/30'
                            }`}>
                              {player.player_type}
                            </span>
                            {player.position && (
                              <span className="text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                                {player.position}
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-300">
                            <span className="text-gray-400">Contract: </span>
                            <span className="line-through text-red-400">{player.contract_original}</span>
                            <span className="mx-2">→</span>
                            <span className="text-yellow-400">{player.contract_cut_to}</span>
                          </div>
                        </div>
                        <div className="text-xs px-3 py-1 bg-red-500/20 text-red-300 rounded-lg border border-red-400/30">
                          {player.action}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 p-4 bg-yellow-500/20 border border-yellow-400 rounded-lg">
              <p className="text-yellow-200">⚠️ {previewResult.message}</p>
            </div>
          </div>
        )}

        {/* Execute Results */}
        {executeResult && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-4">✅ Execution Complete</h2>
            
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 rounded-lg p-4 border border-green-400/30">
                <div className="text-green-200 text-sm mb-1">Total Released</div>
                <div className="text-3xl font-bold text-white">{executeResult.results.totalReleased}</div>
              </div>
              <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-lg p-4 border border-blue-400/30">
                <div className="text-blue-200 text-sm mb-1">SS Members</div>
                <div className="text-3xl font-bold text-white">{executeResult.results.realPlayersReleased}</div>
              </div>
              <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 rounded-lg p-4 border border-purple-400/30">
                <div className="text-purple-200 text-sm mb-1">Football Players</div>
                <div className="text-3xl font-bold text-white">{executeResult.results.footballPlayersReleased}</div>
              </div>
            </div>

            <div className="p-4 bg-green-500/20 border border-green-400 rounded-lg">
              <p className="text-green-200">{executeResult.message}</p>
              <p className="text-green-300 text-sm mt-2">
                Team <strong>{selectedTeamName}</strong> has been marked as withdrawn from season <strong>{selectedSeason}</strong>.
              </p>
            </div>

            {executeResult.results.errors && executeResult.results.errors.length > 0 && (
              <div className="mt-4 p-4 bg-red-500/20 border border-red-400 rounded-lg">
                <p className="text-red-200 font-semibold mb-2">⚠️ Some errors occurred:</p>
                <ul className="text-red-300 text-sm space-y-1">
                  {executeResult.results.errors.map((err, idx) => (
                    <li key={idx}>• {err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
