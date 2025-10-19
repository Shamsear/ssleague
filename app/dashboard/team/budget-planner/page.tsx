'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

type PlayerType = 'football' | 'real';

interface PlayerEstimate {
  id: string;
  position: string;
  category?: 'Legend' | 'Classic'; // For real players (SS Members)
  stars?: number; // For real players (3-10)
  estimatedCost: string;
  minCost: number;
  maxCost: number;
  avgCost: number;
}

interface BudgetData {
  footballBudget: number;
  footballSpent: number;
  realPlayerBudget: number;
  realPlayerSpent: number;
  matchesPerSeason: number;
  midSeasonMatches: number;
}

const FOOTBALL_POSITIONS = ['GK', 'CB', 'LB', 'RB', 'DMF', 'CMF', 'AMF', 'LMF', 'RMF', 'LWF', 'RWF', 'SS', 'CF'];
const REAL_PLAYER_CATEGORIES = ['Legend', 'Classic'];
const STAR_RATINGS = [3, 4, 5, 6, 7, 8, 9, 10];

export default function BudgetPlannerPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<PlayerType>('football');
  
  const [budgetData] = useState<BudgetData>({
    footballBudget: 10000,
    footballSpent: 0,
    realPlayerBudget: 5000,
    realPlayerSpent: 0,
    matchesPerSeason: 38,
    midSeasonMatches: 19,
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

  // Add new player estimate
  const addPlayerEstimate = (type: PlayerType) => {
    const newPlayer: PlayerEstimate = {
      id: Date.now().toString(),
      position: type === 'football' ? 'GK' : '',
      category: type === 'real' ? 'Legend' : undefined,
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

  if (loading) {
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
          ⚽ Football Players (€)
        </button>
        <button
          onClick={() => setActiveTab('real')}
          className={`flex-1 px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
            activeTab === 'real'
              ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg'
              : 'glass text-gray-600 hover:bg-gray-50'
          }`}
        >
          🎮 Real Players ($)
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
              <p className="text-3xl font-bold text-blue-600">€{budgetData.footballBudget.toLocaleString()}</p>
              <div className="mt-3 text-xs text-gray-500">Spent: €{budgetData.footballSpent.toLocaleString()}</div>
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
              <p className="text-3xl font-bold text-purple-600">€{currentTotals.total.toLocaleString()}</p>
              <div className="mt-3 text-xs text-gray-500">Range: €{currentTotals.min.toLocaleString()} - €{currentTotals.max.toLocaleString()}</div>
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
              <p className={`text-3xl font-bold ${budgetData.footballBudget - currentTotals.total >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                €{(budgetData.footballBudget - currentTotals.total).toLocaleString()}
              </p>
              <div className="mt-3 text-xs text-gray-500">For 25 player slots max</div>
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
              <p className="text-3xl font-bold text-green-600">${budgetData.realPlayerBudget.toLocaleString()}</p>
              <div className="mt-3 text-xs text-gray-500">Spent: ${budgetData.realPlayerSpent.toLocaleString()}</div>
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
              <p className="text-3xl font-bold text-purple-600">${currentTotals.total.toLocaleString()}</p>
              <div className="mt-3 text-xs text-gray-500">Range: ${currentTotals.min.toLocaleString()} - ${currentTotals.max.toLocaleString()}</div>
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
              <p className={`text-3xl font-bold ${budgetData.realPlayerBudget - currentTotals.total >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                ${(budgetData.realPlayerBudget - currentTotals.total).toLocaleString()}
              </p>
              <div className="mt-3 text-xs text-gray-500">Min 5, max 7 member slots</div>
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
                    <label className="text-xs text-gray-600 mb-1 block">Estimated Bid (€)</label>
                    <input
                      type="text"
                      value={player.estimatedCost}
                      onChange={(e) => updatePlayerEstimate(activeTab, player.id, 'estimatedCost', e.target.value)}
                      placeholder="e.g., 100-150 or 120"
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">Min bid: €100, increment +€10</p>
                  </div>

                  {/* Salary Calculation */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-3 border border-blue-200">
                    <label className="text-xs text-gray-600 mb-1 block">Half Season Salary</label>
                    <p className="text-lg font-bold text-blue-600">
                      €{player.avgCost > 0 ? calculateFootballPlayerSalary(player.avgCost).toFixed(2) : '0.00'}
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
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                  {/* Category */}
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">Category</label>
                    <select
                      value={player.category || 'Legend'}
                      onChange={(e) => updatePlayerEstimate(activeTab, player.id, 'category', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {REAL_PLAYER_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

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
                    <label className="text-xs text-gray-600 mb-1 block">Estimated Bid ($)</label>
                    <input
                      type="text"
                      value={player.estimatedCost}
                      onChange={(e) => updatePlayerEstimate(activeTab, player.id, 'estimatedCost', e.target.value)}
                      placeholder="e.g., 100-200 or 150"
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">Min bid: $100, increment +$10</p>
                  </div>

                  {/* Salary Calculation */}
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-3 border border-green-200">
                    <label className="text-xs text-gray-600 mb-1 block">Per Match Salary</label>
                    <p className="text-lg font-bold text-green-600">
                      ${player.avgCost > 0 && player.stars ? calculateRealPlayerSalary(player.avgCost, player.stars).toFixed(2) : '0.00'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Formula: (${player.avgCost.toFixed(0)} ÷ 100) × {player.stars || 5}☆ ÷ 10
                    </p>
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
                <li>• <strong>SS Players (Football):</strong> 25 player slots max, €100 min bid</li>
                <li>• <strong>SS Members (Real):</strong> 5-7 member slots, $100 min bid</li>
                <li>• <strong>Categories:</strong> Legend and Classic (for SS Members)</li>
                <li>• <strong>Contract:</strong> 2 seasons for both player types</li>
                <li>• <strong>Bid increment:</strong> +€10 or +$10 for each bid</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
