'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';
import { ArrowLeft, DollarSign, AlertCircle, CheckCircle, TrendingUp, Users } from 'lucide-react';

interface Player {
  real_player_id: string;
  player_name: string;
  position: string;
  real_team_name: string;
  purchase_price: number;
}

interface Team {
  team_id: string;
  team_name: string;
  budget: number;
}

interface TradeValue {
  team_a_value: number;
  team_b_value: number;
  difference: number;
  fairness_percentage: number;
}

export default function ProposeTradePagePage() {
  const router = useRouter();
  
  // State
  const [myTeamId, setMyTeamId] = useState<string>('');
  const [leagueId, setLeagueId] = useState<string>('');
  const [myTeamName, setMyTeamName] = useState<string>('');
  const [myBudget, setMyBudget] = useState<number>(0);
  const [myPlayers, setMyPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  
  // Trade state
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [theirPlayers, setTheirPlayers] = useState<Player[]>([]);
  const [tradeType, setTradeType] = useState<'sale' | 'swap'>('swap');
  const [mySelectedPlayers, setMySelectedPlayers] = useState<Set<string>>(new Set());
  const [theirSelectedPlayers, setTheirSelectedPlayers] = useState<Set<string>>(new Set());
  const [myCash, setMyCash] = useState<number>(0);
  const [theirCash, setTheirCash] = useState<number>(0);
  const [expiryHours, setExpiryHours] = useState<number>(48);
  
  // UI state
  const [tradeValue, setTradeValue] = useState<TradeValue | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedTeamId) {
      loadTheirPlayers();
    }
  }, [selectedTeamId]);

  useEffect(() => {
    calculateTradeValue();
  }, [mySelectedPlayers, theirSelectedPlayers, myCash, theirCash]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');

      const storedTeamId = localStorage.getItem('fantasy_team_id');
      const storedLeagueId = localStorage.getItem('fantasy_league_id');
      
      if (!storedTeamId || !storedLeagueId) {
        setError('Team or league information not found');
        return;
      }

      setMyTeamId(storedTeamId);
      setLeagueId(storedLeagueId);

      // Fetch my team details
      const teamRes = await fetchWithTokenRefresh(`/api/fantasy/my-team?team_id=${storedTeamId}`);
      if (!teamRes.ok) throw new Error('Failed to fetch team');
      const teamData = await teamRes.json();
      setMyTeamName(teamData.team_name);
      setMyBudget(teamData.budget || 0);
      setMyPlayers(teamData.squad || []);

      // Fetch all teams in league
      const teamsRes = await fetchWithTokenRefresh(`/api/fantasy/leagues/${storedLeagueId}/teams`);
      if (!teamsRes.ok) throw new Error('Failed to fetch teams');
      const teamsData = await teamsRes.json();
      setTeams(teamsData.teams.filter((t: Team) => t.team_id !== storedTeamId));

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadTheirPlayers = async () => {
    try {
      const res = await fetchWithTokenRefresh(`/api/fantasy/my-team?team_id=${selectedTeamId}`);
      if (!res.ok) throw new Error('Failed to fetch team squad');
      const data = await res.json();
      setTheirPlayers(data.squad || []);
      setSelectedTeam(teams.find(t => t.team_id === selectedTeamId) || null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const calculateTradeValue = async () => {
    if (mySelectedPlayers.size === 0 && theirSelectedPlayers.size === 0) {
      setTradeValue(null);
      return;
    }

    try {
      const params = new URLSearchParams({
        league_id: leagueId,
        team_a_id: myTeamId,
        team_b_id: selectedTeamId,
        trade_type: tradeType,
        team_a_players: Array.from(mySelectedPlayers).join(','),
        team_b_players: Array.from(theirSelectedPlayers).join(','),
        team_a_cash: myCash.toString(),
        team_b_cash: theirCash.toString()
      });

      const res = await fetchWithTokenRefresh(`/api/fantasy/trades/propose?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.trade_value) {
        setTradeValue(data.trade_value);
      }
    } catch (err) {
      // Silently fail for preview
    }
  };

  const toggleMyPlayer = (playerId: string) => {
    const newSet = new Set(mySelectedPlayers);
    if (newSet.has(playerId)) {
      newSet.delete(playerId);
    } else {
      newSet.add(playerId);
    }
    setMySelectedPlayers(newSet);
  };

  const toggleTheirPlayer = (playerId: string) => {
    const newSet = new Set(theirSelectedPlayers);
    if (newSet.has(playerId)) {
      newSet.delete(playerId);
    } else {
      newSet.add(playerId);
    }
    setTheirSelectedPlayers(newSet);
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError('');

      const res = await fetchWithTokenRefresh('/api/fantasy/trades/propose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          league_id: leagueId,
          team_a_id: myTeamId,
          team_b_id: selectedTeamId,
          trade_type: tradeType,
          team_a_players: Array.from(mySelectedPlayers),
          team_b_players: Array.from(theirSelectedPlayers),
          team_a_cash: myCash,
          team_b_cash: theirCash,
          expires_in_hours: expiryHours
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to propose trade');
      }

      setSuccess(true);
      setTimeout(() => router.push('/dashboard/team/fantasy/trades'), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
      setShowPreview(false);
    }
  };

  const canSubmit = () => {
    if (!selectedTeamId) return false;
    if (tradeType === 'swap') {
      return mySelectedPlayers.size > 0 && theirSelectedPlayers.size > 0;
    } else {
      return (mySelectedPlayers.size > 0 || theirSelectedPlayers.size > 0) &&
             (myCash > 0 || theirCash > 0);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Trade Proposed!</h2>
          <p className="text-gray-600">Your trade proposal has been sent successfully.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Propose Trade</h1>
          <p className="text-gray-600 mt-2">Select a team and players to trade</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start">
            <AlertCircle className="w-5 h-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Team Selector */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Team to Trade With
          </label>
          <select
            value={selectedTeamId}
            onChange={(e) => setSelectedTeamId(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Choose a team...</option>
            {teams.map(team => (
              <option key={team.team_id} value={team.team_id}>
                {team.team_name}
              </option>
            ))}
          </select>
        </div>

        {selectedTeamId && (
          <>
            {/* Trade Type */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Trade Type
              </label>
              <div className="flex gap-4">
                <button
                  onClick={() => setTradeType('swap')}
                  className={`flex-1 py-3 px-4 rounded-lg border-2 transition-colors ${
                    tradeType === 'swap'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <Users className="w-5 h-5 mx-auto mb-1" />
                  <div className="font-medium">Player Swap</div>
                  <div className="text-xs text-gray-600">Exchange players</div>
                </button>
                <button
                  onClick={() => setTradeType('sale')}
                  className={`flex-1 py-3 px-4 rounded-lg border-2 transition-colors ${
                    tradeType === 'sale'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <DollarSign className="w-5 h-5 mx-auto mb-1" />
                  <div className="font-medium">Sale</div>
                  <div className="text-xs text-gray-600">Cash only</div>
                </button>
              </div>
            </div>

            {/* Players Selection */}
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              {/* My Players */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Your Players ({mySelectedPlayers.size} selected)
                </h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {myPlayers.map(player => (
                    <button
                      key={player.real_player_id}
                      onClick={() => toggleMyPlayer(player.real_player_id)}
                      className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                        mySelectedPlayers.has(player.real_player_id)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-medium text-gray-900">{player.player_name}</div>
                      <div className="text-sm text-gray-600">
                        {player.position} • {player.real_team_name} • ${player.purchase_price}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Their Players */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  {selectedTeam?.team_name} Players ({theirSelectedPlayers.size} selected)
                </h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {theirPlayers.map(player => (
                    <button
                      key={player.real_player_id}
                      onClick={() => toggleTheirPlayer(player.real_player_id)}
                      className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                        theirSelectedPlayers.has(player.real_player_id)
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-medium text-gray-900">{player.player_name}</div>
                      <div className="text-sm text-gray-600">
                        {player.position} • {player.real_team_name} • ${player.purchase_price}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Cash Adjustment */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Cash Adjustment</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    You Give Cash (Budget: ${myBudget})
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={myBudget}
                    value={myCash}
                    onChange={(e) => setMyCash(Number(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    They Give Cash (Budget: ${selectedTeam?.budget || 0})
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={theirCash}
                    onChange={(e) => setTheirCash(Number(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Trade Value */}
            {tradeValue && (
              <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Trade Value</h3>
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                </div>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">${tradeValue.team_a_value}</div>
                    <div className="text-sm text-gray-600">Your Value</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">${tradeValue.difference}</div>
                    <div className="text-sm text-gray-600">Difference</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">${tradeValue.team_b_value}</div>
                    <div className="text-sm text-gray-600">Their Value</div>
                  </div>
                </div>
                <div className="bg-gray-100 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Fairness</span>
                    <span className="text-sm font-bold text-gray-900">
                      {tradeValue.fairness_percentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-300 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        tradeValue.fairness_percentage >= 90 ? 'bg-green-500' :
                        tradeValue.fairness_percentage >= 70 ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${tradeValue.fairness_percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Expiry */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Trade Expires In
              </label>
              <select
                value={expiryHours}
                onChange={(e) => setExpiryHours(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value={24}>24 hours</option>
                <option value={48}>48 hours (2 days)</option>
                <option value={72}>72 hours (3 days)</option>
                <option value={168}>168 hours (7 days)</option>
              </select>
            </div>

            {/* Submit */}
            <div className="flex gap-4">
              <button
                onClick={() => router.back()}
                className="flex-1 py-3 px-6 border-2 border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowPreview(true)}
                disabled={!canSubmit()}
                className="flex-1 py-3 px-6 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Review Trade
              </button>
            </div>
          </>
        )}

        {/* Preview Modal */}
        {showPreview && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Review Trade</h2>
                
                <div className="space-y-4 mb-6">
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">You Give:</h3>
                    <ul className="list-disc list-inside text-gray-700">
                      {Array.from(mySelectedPlayers).map(id => {
                        const player = myPlayers.find(p => p.real_player_id === id);
                        return player && <li key={id}>{player.player_name}</li>;
                      })}
                      {myCash > 0 && <li>${myCash} cash</li>}
                    </ul>
                  </div>
                  
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">You Receive:</h3>
                    <ul className="list-disc list-inside text-gray-700">
                      {Array.from(theirSelectedPlayers).map(id => {
                        const player = theirPlayers.find(p => p.real_player_id === id);
                        return player && <li key={id}>{player.player_name}</li>;
                      })}
                      {theirCash > 0 && <li>${theirCash} cash</li>}
                    </ul>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => setShowPreview(false)}
                    disabled={submitting}
                    className="flex-1 py-3 px-6 border-2 border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex-1 py-3 px-6 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Proposing...' : 'Confirm Trade'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
