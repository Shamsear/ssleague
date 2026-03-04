'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface TeamCarryover {
  team_id: string;
  team_name: string;
  current_balance: number;
  new_balance: number;
  current_football_budget?: number;
  current_real_player_budget?: number;
  current_player_count?: number;
  new_football_budget?: number;
  new_real_player_budget?: number;
  source_football_budget?: number;
  source_real_player_budget?: number;
  source_total_balance?: number;
  source_player_count?: number;
  player_count?: number;
  football_budget?: number;
  real_player_budget?: number;
}

interface PlayerCarryover {
  player_id: string;
  player_name: string;
  team_name: string;
  current_star_rating: number;
  new_star_rating: number;
  current_points: number;
  new_points: number;
  current_base_points?: number;
  new_base_points?: number;
  current_auction_value?: number;
  current_salary_per_match?: number;
  new_auction_value?: number;
  new_salary_per_match?: number;
  source_star_rating?: number;
  source_points?: number;
  source_base_points?: number;
  source_auction_value?: number;
  source_salary_per_match?: number;
  auction_value?: number;
  salary_per_match?: number;
  changes: string[];
}

export default function SeasonCarryoverPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [fromSeason, setFromSeason] = useState('SSPSLS16');
  const [toSeason, setToSeason] = useState('SSPSLS17');
  const [seasons, setSeasons] = useState<string[]>(['SSPSLS16', 'SSPSLS17']);
  
  const [teamCarryover, setTeamCarryover] = useState<TeamCarryover[]>([]);
  const [playerCarryover, setPlayerCarryover] = useState<PlayerCarryover[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      console.log('No user, redirecting to login');
      router.push('/login');
    }
    if (!authLoading && user) {
      console.log('User role:', user.role);
      if (user.role !== 'super_admin') {
        console.log('Not super_admin, redirecting to dashboard');
        router.push('/dashboard');
      }
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && user.role === 'super_admin') {
      fetchSeasons();
    }
  }, [user]);

  const fetchSeasons = async () => {
    try {
      const res = await fetch('/api/seasons');
      const data = await res.json();
      if (data.success && data.seasons) {
        setSeasons(data.seasons.map((s: any) => s.season_id));
      } else if (Array.isArray(data)) {
        // Fallback for old API format
        setSeasons(data.map((s: any) => s.season_id));
      }
    } catch (err) {
      console.error('Error fetching seasons:', err);
      // Keep default seasons if fetch fails
    }
  };

  const loadPreview = async () => {
    setLoading(true);
    setError(null);
    setPreviewLoaded(false);
    
    try {
      const res = await fetch(`/api/admin/season-carryover/preview?from=${fromSeason}&to=${toSeason}`);
      const data = await res.json();
      
      if (data.success) {
        setTeamCarryover(data.teams || []);
        setPlayerCarryover(data.players || []);
        setPreviewLoaded(true);
      } else {
        setError(data.error || 'Failed to load preview');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load preview');
    } finally {
      setLoading(false);
    }
  };

  const executeCarryover = async () => {
    if (!confirm(`Are you sure you want to carry over data from ${fromSeason} to ${toSeason}? This action cannot be undone.`)) {
      return;
    }
    
    setExecuting(true);
    setError(null);
    setSuccess(null);
    
    try {
      const res = await fetch('/api/admin/season-carryover/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: fromSeason, to: toSeason })
      });
      
      const data = await res.json();
      
      if (data.success) {
        setSuccess(`✅ Successfully carried over data! ${data.teamsUpdated} team_seasons, ${data.auctionTeamsCreated} auction teams, and ${data.playersUpdated} players updated.`);
        setPreviewLoaded(false);
      } else {
        setError(data.error || 'Failed to execute carryover');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to execute carryover');
    } finally {
      setExecuting(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
      </div>
    );
  }

  const totalTeams = teamCarryover.length;
  const totalPlayers = playerCarryover.length;
  const playersWithStarChanges = playerCarryover.filter(p => p.current_star_rating !== p.new_star_rating).length;
  const playersWithPointsReset = playerCarryover.filter(p => p.current_points > 0).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard/admin"
            className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-4 text-sm font-medium"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Admin
          </Link>
          
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            🔄 Season Data Carryover
          </h1>
          <p className="text-gray-600">
            Preview and execute data carryover from one season to another
          </p>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}
        
        {success && (
          <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 rounded-lg">
            <p className="text-green-800">{success}</p>
          </div>
        )}

        {/* Season Selection */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Select Seasons</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                From Season (Source)
              </label>
              <select
                value={fromSeason}
                onChange={(e) => {
                  setFromSeason(e.target.value);
                  setPreviewLoaded(false);
                }}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                {seasons.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                To Season (Target)
              </label>
              <select
                value={toSeason}
                onChange={(e) => {
                  setToSeason(e.target.value);
                  setPreviewLoaded(false);
                }}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                {seasons.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="mt-6 flex gap-3">
            <button
              onClick={loadPreview}
              disabled={loading || fromSeason === toSeason}
              className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Loading Preview...' : '🔍 Load Preview'}
            </button>
            
            {previewLoaded && (
              <button
                onClick={executeCarryover}
                disabled={executing}
                className="px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {executing ? 'Executing...' : '✅ Execute Carryover'}
              </button>
            )}
          </div>
          
          {fromSeason === toSeason && (
            <p className="mt-4 text-sm text-orange-600">
              ⚠️ Please select different seasons for source and target
            </p>
          )}
        </div>

        {/* Preview Summary */}
        {previewLoaded && (
          <>
            {/* What Will Be Updated Section */}
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl shadow-lg p-6 mb-6 border-2 border-blue-200">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span>📋</span> What Will Be Updated
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Firebase team_seasons */}
                <div className="bg-white rounded-lg p-4 shadow">
                  <h3 className="font-bold text-lg text-blue-600 mb-3">🔥 Firebase: team_seasons</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-2">
                      <span className="text-green-600 font-bold">✓</span>
                      <div>
                        <div className="font-semibold">Carried Over:</div>
                        <div className="text-gray-600">• football_budget</div>
                        <div className="text-gray-600">• real_player_budget</div>
                        <div className="text-gray-600">• team info & contracts</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 mt-3">
                      <span className="text-orange-600 font-bold">↻</span>
                      <div>
                        <div className="font-semibold">Reset to 0:</div>
                        <div className="text-gray-600">• football_spent</div>
                        <div className="text-gray-600">• real_player_spent</div>
                        <div className="text-gray-600">• players_count</div>
                        <div className="text-gray-600">• position_counts</div>
                        <div className="text-gray-600">• lineup_warnings</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Neon Auction DB */}
                <div className="bg-white rounded-lg p-4 shadow">
                  <h3 className="font-bold text-lg text-purple-600 mb-3">💾 Neon: teams (Auction DB)</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-2">
                      <span className="text-blue-600 font-bold">📝</span>
                      <div>
                        <div className="font-semibold">Source Season Update:</div>
                        <div className="text-gray-600">• Final football_budget</div>
                        <div className="text-gray-600">• Final football_spent</div>
                        <div className="text-gray-600">• Final player count</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 mt-3">
                      <span className="text-green-600 font-bold">+</span>
                      <div>
                        <div className="font-semibold">New Season Record:</div>
                        <div className="text-gray-600">• Carried over budget</div>
                        <div className="text-gray-600">• Reset spent = 0</div>
                        <div className="text-gray-600">• Reset count = 0</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Neon Tournament DB */}
                <div className="bg-white rounded-lg p-4 shadow">
                  <h3 className="font-bold text-lg text-green-600 mb-3">⚽ Neon: player_seasons</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-2">
                      <span className="text-green-600 font-bold">✓</span>
                      <div>
                        <div className="font-semibold">Carried Over:</div>
                        <div className="text-gray-600">• star_rating</div>
                        <div className="text-gray-600">• points</div>
                        <div className="text-gray-600">• auction_value</div>
                        <div className="text-gray-600">• salary_per_match</div>
                        <div className="text-gray-600">• base_points = points</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 mt-3">
                      <span className="text-orange-600 font-bold">↻</span>
                      <div>
                        <div className="font-semibold">Reset to 0:</div>
                        <div className="text-gray-600">• matches_played</div>
                        <div className="text-gray-600">• goals, assists</div>
                        <div className="text-gray-600">• wins, draws, losses</div>
                        <div className="text-gray-600">• clean_sheets, motm</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                <p className="text-sm text-yellow-800">
                  <strong>⚠️ Important:</strong> This operation cannot be undone. Please review all data carefully before executing.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
                <div className="text-sm font-medium opacity-90">Total Teams</div>
                <div className="text-3xl font-bold mt-2">{totalTeams}</div>
              </div>
              
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
                <div className="text-sm font-medium opacity-90">Total Players</div>
                <div className="text-3xl font-bold mt-2">{totalPlayers}</div>
              </div>
              
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg">
                <div className="text-sm font-medium opacity-90">Star Changes</div>
                <div className="text-3xl font-bold mt-2">{playersWithStarChanges}</div>
              </div>
              
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
                <div className="text-sm font-medium opacity-90">Points Carried Over</div>
                <div className="text-3xl font-bold mt-2">{playersWithPointsReset}</div>
              </div>
            </div>

            {/* Team Balances */}
            <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">💰 Team Balance Carryover</h2>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Team</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase" colSpan={2}>Football Budget</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase" colSpan={2}>Real Player Budget</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase" colSpan={2}>Total Balance</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Players</th>
                    </tr>
                    <tr className="bg-gray-100">
                      <th className="px-4 py-2 text-xs text-gray-600"></th>
                      <th className="px-4 py-2 text-xs text-gray-600">Before</th>
                      <th className="px-4 py-2 text-xs text-gray-600">After</th>
                      <th className="px-4 py-2 text-xs text-gray-600">Before</th>
                      <th className="px-4 py-2 text-xs text-gray-600">After</th>
                      <th className="px-4 py-2 text-xs text-gray-600">Before</th>
                      <th className="px-4 py-2 text-xs text-gray-600">After</th>
                      <th className="px-4 py-2 text-xs text-gray-600">Count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {teamCarryover.map((team, idx) => (
                      <tr key={team.team_id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900">{team.team_name}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600">
                          ₹{team.current_football_budget?.toLocaleString() || 0}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-blue-600 font-semibold">
                          ₹{team.new_football_budget?.toLocaleString() || 0}
                          {team.source_football_budget !== team.new_football_budget && (
                            <div className="text-xs text-gray-500">(from: ₹{team.source_football_budget?.toLocaleString()})</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600">
                          ₹{team.current_real_player_budget?.toLocaleString() || 0}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-purple-600 font-semibold">
                          ₹{team.new_real_player_budget?.toLocaleString() || 0}
                          {team.source_real_player_budget !== team.new_real_player_budget && (
                            <div className="text-xs text-gray-500">(from: ₹{team.source_real_player_budget?.toLocaleString()})</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600">₹{team.current_balance.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-right text-green-600 font-bold">
                          ₹{team.new_balance.toLocaleString()}
                          {team.source_total_balance !== team.new_balance && (
                            <div className="text-xs text-gray-500">(from: ₹{team.source_total_balance?.toLocaleString()})</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-center text-gray-600">
                          {team.current_player_count || 0} → {team.source_player_count || 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="mt-4 flex gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-gray-400 rounded"></span>
                  <span>Before (Source Season)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-green-600 rounded"></span>
                  <span>After (Target Season - Carried Over)</span>
                </div>
              </div>
            </div>

            {/* Player Changes */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">⭐ Player Stats Carryover</h2>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase" rowSpan={2}>Player</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase" rowSpan={2}>Team</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase" colSpan={2}>Stars</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase" colSpan={2}>Points</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase" colSpan={2}>Base Points</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase" colSpan={2}>Auction Value</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase" colSpan={2}>Salary/Match</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase" rowSpan={2}>Status</th>
                    </tr>
                    <tr className="bg-gray-100">
                      <th className="px-3 py-2 text-xs text-gray-600">Before</th>
                      <th className="px-3 py-2 text-xs text-gray-600">After</th>
                      <th className="px-3 py-2 text-xs text-gray-600">Before</th>
                      <th className="px-3 py-2 text-xs text-gray-600">After</th>
                      <th className="px-3 py-2 text-xs text-gray-600">Before</th>
                      <th className="px-3 py-2 text-xs text-gray-600">After</th>
                      <th className="px-3 py-2 text-xs text-gray-600">Before</th>
                      <th className="px-3 py-2 text-xs text-gray-600">After</th>
                      <th className="px-3 py-2 text-xs text-gray-600">Before</th>
                      <th className="px-3 py-2 text-xs text-gray-600">After</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {playerCarryover.map((player, idx) => (
                      <tr key={player.player_id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900">{player.player_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{player.team_name}</td>
                        <td className="px-3 py-3 text-center">
                          <span className="text-sm text-gray-600">
                            {'⭐'.repeat(player.current_star_rating)}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="text-sm font-semibold text-green-600">
                            {'⭐'.repeat(player.new_star_rating)}
                          </span>
                          {player.source_star_rating !== player.new_star_rating && (
                            <div className="text-xs text-gray-500">(from: {'⭐'.repeat(player.source_star_rating || 0)})</div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center text-sm text-gray-600">{player.current_points}</td>
                        <td className="px-3 py-3 text-center text-sm font-semibold text-green-600">
                          {player.new_points}
                          {player.source_points !== player.new_points && (
                            <div className="text-xs text-gray-500">(from: {player.source_points})</div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center text-sm text-gray-600">{player.current_base_points || 0}</td>
                        <td className="px-3 py-3 text-center text-sm font-semibold text-blue-600">
                          {player.new_base_points || 0}
                          {player.source_base_points !== player.new_base_points && (
                            <div className="text-xs text-gray-500">(= points: {player.source_points})</div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center text-sm text-gray-600">{player.current_auction_value || '-'}</td>
                        <td className="px-3 py-3 text-center text-sm font-semibold text-green-600">
                          {player.new_auction_value || '-'}
                          {player.source_auction_value && player.source_auction_value !== player.new_auction_value && (
                            <div className="text-xs text-gray-500">(from: {player.source_auction_value})</div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center text-sm text-gray-600">{player.current_salary_per_match || '-'}</td>
                        <td className="px-3 py-3 text-center text-sm font-semibold text-green-600">
                          {player.new_salary_per_match || '-'}
                          {player.source_salary_per_match && player.source_salary_per_match !== player.new_salary_per_match && (
                            <div className="text-xs text-gray-500">(from: {player.source_salary_per_match})</div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700">
                            ✓ Will Update
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="mt-4 flex gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-gray-400 rounded"></span>
                  <span className="text-gray-600">Before (Source Season)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-green-600 rounded"></span>
                  <span className="text-gray-600">After (Target Season - Carried Over)</span>
                </div>
              </div>
              
              <p className="mt-4 text-sm text-gray-600 text-center">
                Showing all {playerCarryover.length} players • Match stats (goals, assists, wins, etc.) will be reset to 0
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
