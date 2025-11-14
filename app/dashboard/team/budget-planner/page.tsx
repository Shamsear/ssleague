'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

type PlayerType = 'football' | 'real';

interface PlayerEstimate {
  id: string;
  position: string;
  stars?: number; // For real players (3-10)
  estimatedCost: string;
  minCost: number;
  maxCost: number;
  avgCost: number;
  customMatches?: string; // Custom match count for salary calculation
}

interface BudgetData {
  footballBudget: number;
  footballSpent: number;
  realPlayerBudget: number;
  realPlayerSpent: number;
  matchesPerSeason: number;
  midSeasonMatches: number;
  minRealPlayers: number;
  maxRealPlayers: number;
  maxFootballPlayers: number;
}

const FOOTBALL_POSITIONS = ['GK', 'CB', 'LB', 'RB', 'DMF', 'CMF', 'AMF', 'LMF', 'RMF', 'LWF', 'RWF', 'SS', 'CF'];
const STAR_RATINGS = [3, 4, 5, 6, 7, 8, 9, 10];
const MATCH_MILESTONES = [1, 5, 10, 15, 20, 25, 30, 38]; // Match milestones for salary calculation

export default function BudgetPlannerPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<PlayerType>('football');
  const [isLoadingBudget, setIsLoadingBudget] = useState(true);
  
  const [budgetData, setBudgetData] = useState<BudgetData>({
    footballBudget: 10000,
    footballSpent: 0,
    realPlayerBudget: 1000,
    realPlayerSpent: 0,
    matchesPerSeason: 38,
    midSeasonMatches: 19,
    minRealPlayers: 5,
    maxRealPlayers: 7,
    maxFootballPlayers: 25,
  });

  const [footballPlayers, setFootballPlayers] = useState<PlayerEstimate[]>([]);
  const [realPlayers, setRealPlayers] = useState<PlayerEstimate[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'team') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  // Fetch team's actual budget from team_seasons
  useEffect(() => {
    const fetchBudget = async () => {
      if (!user) return;
      
      try {
        setIsLoadingBudget(true);
        const response = await fetchWithTokenRefresh('/api/team/dashboard');
        const data = await response.json();
        
        if (data.success && data.data) {
          // Use season settings for initial budgets, team_seasons for spent amounts
          const seasonSettings = data.data.seasonSettings || {};
          const team = data.data.team || {};
          
          setBudgetData({
            footballBudget: seasonSettings.euro_budget || 10000,
            footballSpent: team.football_spent || 0,
            realPlayerBudget: seasonSettings.dollar_budget || 1000,
            realPlayerSpent: team.real_player_spent || 0,
            matchesPerSeason: 38,
            midSeasonMatches: 19,
            minRealPlayers: seasonSettings.min_real_players || 5,
            maxRealPlayers: seasonSettings.max_real_players || 7,
            maxFootballPlayers: seasonSettings.max_football_players || 25,
          });
        }
      } catch (error) {
        console.error('Error fetching budget:', error);
        // Keep default values on error
      } finally {
        setIsLoadingBudget(false);
      }
    };
    
    fetchBudget();
  }, [user]);

  // Add new player estimate
  const addPlayerEstimate = (type: PlayerType) => {
    const newPlayer: PlayerEstimate = {
      id: Date.now().toString(),
      position: type === 'football' ? 'GK' : '',
      stars: type === 'real' ? 5 : undefined,
      estimatedCost: '',
      minCost: 0,
      maxCost: 0,
      avgCost: 0,
    };
    if (type === 'football') {
      setFootballPlayers([...footballPlayers, newPlayer]);
    } else {
      setRealPlayers([...realPlayers, newPlayer]);
    }
  };

  // Update player estimate
  const updatePlayerEstimate = (type: PlayerType, id: string, field: keyof PlayerEstimate, value: string) => {
    const updatePlayer = (player: PlayerEstimate) => {
      if (player.id !== id) return player;
      
      const updated = { ...player, [field]: value };
      
      // Parse cost range if estimatedCost is updated
      if (field === 'estimatedCost' && value) {
        const match = value.match(/(\d+)\s*-\s*(\d+)/);
        if (match) {
          const min = parseInt(match[1]);
          const max = parseInt(match[2]);
          updated.minCost = min;
          updated.maxCost = max;
          updated.avgCost = (min + max) / 2;
        } else {
          const single = parseInt(value);
          if (!isNaN(single)) {
            updated.minCost = single;
            updated.maxCost = single;
            updated.avgCost = single;
          }
        }
      }
      
      return updated;
    };

    if (type === 'football') {
      setFootballPlayers(footballPlayers.map(updatePlayer));
    } else {
      setRealPlayers(realPlayers.map(updatePlayer));
    }
  };

  // Remove player estimate
  const removePlayerEstimate = (type: PlayerType, id: string) => {
    if (type === 'football') {
      setFootballPlayers(footballPlayers.filter(p => p.id !== id));
    } else {
      setRealPlayers(realPlayers.filter(p => p.id !== id));
    }
  };

  // Calculate salary for real players (SS Members)
  // Formula: (value ÷ 100) × stars ÷ 10 = salary per match
  const calculateRealPlayerSalary = (value: number, stars: number): number => {
    return ((value / 100) * stars) / 10;
  };

  // Calculate salary for football players (SS Players)
  // Formula: 10% of bid amount for half season
  const calculateFootballPlayerSalary = (value: number): number => {
    return value * 0.1;
  };

  // Calculate totals
  const calculateTotals = (players: PlayerEstimate[]) => {
    const total = players.reduce((sum, p) => sum + p.avgCost, 0);
    const min = players.reduce((sum, p) => sum + p.minCost, 0);
    const max = players.reduce((sum, p) => sum + p.maxCost, 0);
    return { total, min, max };
  };

  const footballTotals = calculateTotals(footballPlayers);
  const realPlayerTotals = calculateTotals(realPlayers);

  if (loading || isLoadingBudget) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'team') {
    return null;
  }

  const currentPlayers = activeTab === 'football' ? footballPlayers : realPlayers;
  const currentTotals = activeTab === 'football' ? footballTotals : realPlayerTotals;

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
      {/* Header */}
      <div className="glass rounded-3xl p-4 sm:p-6 mb-6 hover:shadow-lg transition-all duration-300">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center">
            <div className="bg-gradient-to-br from-green-400 to-emerald-600 p-3 rounded-full mr-4 shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-dark">Budget Planner</h1>
              <p className="text-gray-600 mt-1">Estimate player costs and calculate salaries</p>
            </div>
          </div>
          <Link 
            href="/dashboard" 
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors text-sm font-medium flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Dashboard
          </Link>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('football')}
          className={`flex-1 px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
            activeTab === 'football'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
              : 'glass text-gray-600 hover:bg-gray-50'
          }`}
        >
          ⚽ Virtual Players (eCoin)
        </button>
        <button
          onClick={() => setActiveTab('real')}
          className={`flex-1 px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
            activeTab === 'real'
              ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg'
              : 'glass text-gray-600 hover:bg-gray-50'
          }`}
        >
          🎮 Real Players (SSCoin)
        </button>
      </div>

      {/* Budget Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {activeTab === 'football' ? (
          <>
            {/* Football Budget Card */}
            <div className="glass rounded-2xl p-6 hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-blue-50 to-indigo-50">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-blue-100 p-3 rounded-full">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-xs text-blue-600 font-medium px-2 py-1 bg-blue-100 rounded-full">Total Budget</span>
              </div>
              <h3 className="text-sm text-gray-600 mb-1">Available Budget</h3>
              <p className="text-3xl font-bold text-blue-600">{budgetData.footballBudget.toLocaleString()} eCoin</p>
              <div className="mt-3 text-xs text-gray-500">Spent: {budgetData.footballSpent.toLocaleString()} eCoin</div>
            </div>

            {/* Estimated Total */}
            <div className="glass rounded-2xl p-6 hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-purple-50 to-pink-50">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-purple-100 p-3 rounded-full">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <span className="text-xs text-purple-600 font-medium px-2 py-1 bg-purple-100 rounded-full">Estimated</span>
              </div>
              <h3 className="text-sm text-gray-600 mb-1">Planned Spending</h3>
              <p className="text-3xl font-bold text-purple-600">{currentTotals.total.toLocaleString()} eCoin</p>
              <div className="mt-3 text-xs text-gray-500">Range: {currentTotals.min.toLocaleString()} - {currentTotals.max.toLocaleString()} eCoin</div>
            </div>

            {/* Remaining Budget */}
            <div className="glass rounded-2xl p-6 hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-green-50 to-emerald-50">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-green-100 p-3 rounded-full">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-xs text-green-600 font-medium px-2 py-1 bg-green-100 rounded-full">Remaining</span>
              </div>
              <h3 className="text-sm text-gray-600 mb-1">After Estimates</h3>
              <p className={`text-3xl font-bold ${
                budgetData.footballBudget - currentTotals.total >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {(budgetData.footballBudget - currentTotals.total).toLocaleString()} eCoin
              </p>
              <div className="mt-3 text-xs text-gray-500">For {budgetData.maxFootballPlayers} player slots max</div>
            </div>
          </>
        ) : (
          <>
            {/* Real Player Budget Card */}
            <div className="glass rounded-2xl p-6 hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-green-50 to-emerald-50">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-green-100 p-3 rounded-full">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-xs text-green-600 font-medium px-2 py-1 bg-green-100 rounded-full">Total Budget</span>
              </div>
              <h3 className="text-sm text-gray-600 mb-1">Available Budget</h3>
              <p className="text-3xl font-bold text-green-600">{budgetData.realPlayerBudget.toLocaleString()} SSCoin</p>
              <div className="mt-3 text-xs text-gray-500">Spent: {budgetData.realPlayerSpent.toLocaleString()} SSCoin</div>
            </div>

            {/* Estimated Total */}
            <div className="glass rounded-2xl p-6 hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-purple-50 to-pink-50">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-purple-100 p-3 rounded-full">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <span className="text-xs text-purple-600 font-medium px-2 py-1 bg-purple-100 rounded-full">Estimated</span>
              </div>
              <h3 className="text-sm text-gray-600 mb-1">Planned Spending</h3>
              <p className="text-3xl font-bold text-purple-600">{currentTotals.total.toLocaleString()} SSCoin</p>
              <div className="mt-3 text-xs text-gray-500">Range: {currentTotals.min.toLocaleString()} - {currentTotals.max.toLocaleString()} SSCoin</div>
            </div>

            {/* Remaining Budget */}
            <div className="glass rounded-2xl p-6 hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-blue-50 to-indigo-50">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-blue-100 p-3 rounded-full">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-xs text-blue-600 font-medium px-2 py-1 bg-blue-100 rounded-full">Remaining</span>
              </div>
              <h3 className="text-sm text-gray-600 mb-1">After Estimates</h3>
              <p className={`text-3xl font-bold ${
                budgetData.realPlayerBudget - currentTotals.total >= 0 ? 'text-blue-600' : 'text-red-600'
              }`}>
                {(budgetData.realPlayerBudget - currentTotals.total).toLocaleString()} SSCoin
              </p>
              <div className="mt-3 text-xs text-gray-500">Min {budgetData.minRealPlayers}, max {budgetData.maxRealPlayers} member slots</div>
            </div>
          </>
        )}
      </div>

      {/* Player Estimation Section */}
      <div className="glass rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">
            {activeTab === 'football' ? '⚽ Football Player Estimates' : '🎮 Real Player Estimates'}
          </h2>
          <button
            onClick={() => addPlayerEstimate(activeTab)}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-all duration-300 flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Add Player
          </button>
        </div>

        {/* Player List */}
        <div className="space-y-4">
          {currentPlayers.map((player) => (
            <div key={player.id} className="glass rounded-xl p-4 hover:shadow-md transition-all duration-300">
              {activeTab === 'football' ? (
                /* Football Players (SS Players) */
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                  {/* Position */}
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">Position</label>
                    <select
                      value={player.position}
                      onChange={(e) => updatePlayerEstimate(activeTab, player.id, 'position', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {FOOTBALL_POSITIONS.map(pos => (
                        <option key={pos} value={pos}>{pos}</option>
                      ))}
                    </select>
                  </div>

                  {/* Estimated Cost */}
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">Estimated Bid (eCoin)</label>
                    <input
                      type="text"
                      value={player.estimatedCost}
                      onChange={(e) => updatePlayerEstimate(activeTab, player.id, 'estimatedCost', e.target.value)}
                      placeholder="e.g., 100-150 or 120"
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">Min bid: eCoin 100, increment +eCoin 10</p>
                  </div>

                  {/* Salary Calculation */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-3 border border-blue-200">
                    <label className="text-xs text-gray-600 mb-1 block">Half Season Salary</label>
                    <p className="text-lg font-bold text-blue-600">
                      eCoin {player.avgCost > 0 ? calculateFootballPlayerSalary(player.avgCost).toFixed(2) : '0.00'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">10% of bid amount</p>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end">
                    <button
                      onClick={() => removePlayerEstimate(activeTab, player.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all duration-300"
                      title="Remove player"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ) : (
                /* Real Players (SS Members) */
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                    {/* Star Rating */}
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">Star Rating</label>
                      <select
                        value={player.stars || 5}
                        onChange={(e) => updatePlayerEstimate(activeTab, player.id, 'stars', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {STAR_RATINGS.map(star => (
                          <option key={star} value={star}>{star}☆</option>
                        ))}
                      </select>
                    </div>

                    {/* Estimated Cost */}
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">Estimated Bid (SSCoin)</label>
                      <input
                        type="text"
                        value={player.estimatedCost}
                        onChange={(e) => updatePlayerEstimate(activeTab, player.id, 'estimatedCost', e.target.value)}
                        placeholder="e.g., 100-200 or 150"
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 mt-1">Min bid: SSCoin 100, increment +SSCoin 10</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-end justify-end">
                      <button
                        onClick={() => removePlayerEstimate(activeTab, player.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all duration-300"
                        title="Remove player"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Salary Calculation */}
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-5 border-2 border-green-200 shadow-sm">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Per Match Salary */}
                      <div className="bg-white/60 rounded-lg p-4 border border-green-100">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="bg-green-100 p-1.5 rounded-lg">
                            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <label className="text-xs font-semibold text-gray-700">Per Match Salary</label>
                        </div>
                        <p className="text-3xl font-bold text-green-600 mb-2">
                          SSCoin {player.avgCost > 0 && player.stars ? calculateRealPlayerSalary(player.avgCost, player.stars).toFixed(2) : '0.00'}
                        </p>
                        <div className="bg-gray-50 rounded px-2 py-1.5 border border-gray-200">
                          <p className="text-xs text-gray-600">
                            <span className="font-medium">Formula:</span> (SSCoin {player.avgCost.toFixed(0)} ÷ 100) × {player.stars || 5}☆ ÷ 10
                          </p>
                        </div>
                      </div>

                      {/* Custom Matches Calculator */}
                      <div className="bg-white/60 rounded-lg p-4 border border-green-100">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="bg-blue-100 p-1.5 rounded-lg">
                            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <label className="text-xs font-semibold text-gray-700">Custom Calculator</label>
                        </div>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="relative flex-1">
                            <input
                              type="number"
                              min="1"
                              max="38"
                              value={player.customMatches || ''}
                              onChange={(e) => updatePlayerEstimate(activeTab, player.id, 'customMatches', e.target.value)}
                              placeholder="0"
                              className="w-full px-3 py-2 text-center text-lg font-semibold rounded-lg border-2 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 font-medium pointer-events-none">
                              matches
                            </span>
                          </div>
                        </div>
                        {player.customMatches && parseInt(player.customMatches) > 0 && player.avgCost > 0 && player.stars ? (
                          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg px-3 py-2 border border-blue-200">
                            <p className="text-xs text-gray-600 mb-1">Total Salary</p>
                            <p className="text-2xl font-bold text-blue-600">
                              SSCoin {(calculateRealPlayerSalary(player.avgCost, player.stars) * parseInt(player.customMatches)).toFixed(2)}
                            </p>
                          </div>
                        ) : (
                          <div className="bg-gray-50 rounded-lg px-3 py-2 border border-gray-200 text-center">
                            <p className="text-xs text-gray-500">Enter matches to calculate</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {currentPlayers.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="font-medium">No players added yet</p>
              <p className="text-sm mt-2">Click "Add Player" to start planning your budget</p>
            </div>
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Budget Tips */}
        <div className="glass rounded-2xl p-6 bg-gradient-to-br from-yellow-50 to-orange-50">
          <div className="flex items-start">
            <div className="bg-yellow-100 p-2 rounded-full mr-3">
              <svg className="w-5 h-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-yellow-800 mb-2">Pro Budget Tips</h3>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• Enter cost estimates as ranges (e.g., "100-200") or single values</li>
                <li>• <strong>Football (SS Players):</strong> Salary = 10% of bid (half season)</li>
                <li>• <strong>Real (SS Members):</strong> Salary = (bid ÷ 100) × stars ÷ 10 per match</li>
                <li>• Keep some budget reserve for unexpected opportunities</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Salary Info */}
        <div className="glass rounded-2xl p-6 bg-gradient-to-br from-blue-50 to-indigo-50">
          <div className="flex items-start">
            <div className="bg-blue-100 p-2 rounded-full mr-3">
              <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-blue-800 mb-2">Slot & Contract Info</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• <strong>SS Players (Football):</strong> 25 player slots max, eCoin 100 min bid</li>
                <li>• <strong>SS Members (Real):</strong> 5-7 member slots, SSCoin 100 min bid</li>
                <li>• <strong>Contract:</strong> 2 seasons for both player types</li>
                <li>• <strong>Bid increment:</strong> +eCoin 10 or +SSCoin 10 for each bid</li>
                <li>• <strong>Season length:</strong> 38 matches (19 per half)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
