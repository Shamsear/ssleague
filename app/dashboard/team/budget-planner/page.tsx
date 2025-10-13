'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const POSITIONS = ['GK', 'CB', 'LB', 'RB', 'DMF', 'CMF', 'AMF', 'LMF', 'RMF', 'LWF', 'RWF', 'SS', 'CF'];

interface BudgetData {
  currentBalance: number;
  safeSpending: number;
  maxBid: number;
  startingBalance: number;
  totalSpent: number;
  remainingRounds: number;
  avgPerRound: number;
  completedRoundsCount: number;
  maxRounds: number;
}

interface SpendingLimits {
  [position: string]: number;
}

interface PositionPriorities {
  [position: string]: 'none' | 'low' | 'medium' | 'high';
}

interface PositionSpending {
  [position: string]: number;
}

interface PositionAverages {
  [position: string]: number;
}

export default function BudgetPlannerPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [budgetData] = useState<BudgetData>({
    currentBalance: 15000,
    safeSpending: 12000,
    maxBid: 9600,
    startingBalance: 15000,
    totalSpent: 0,
    remainingRounds: 10,
    avgPerRound: 1500,
    completedRoundsCount: 0,
    maxRounds: 10,
  });
  const [spendingLimits, setSpendingLimits] = useState<SpendingLimits>({});
  const [positionPriorities, setPositionPriorities] = useState<PositionPriorities>({});
  const [spendingByPosition] = useState<PositionSpending>({
    GK: 0, CB: 0, LB: 0, RB: 0, DMF: 0, CMF: 0, AMF: 0,
    LMF: 0, RMF: 0, LWF: 0, RWF: 0, SS: 0, CF: 0
  });
  const [positionAverages] = useState<PositionAverages>({
    GK: 500, CB: 450, LB: 400, RB: 400, DMF: 550, CMF: 600, AMF: 650,
    LMF: 500, RMF: 500, LWF: 700, RWF: 700, SS: 750, CF: 800
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'team') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const savedLimits = localStorage.getItem('budgetLimits');
    if (savedLimits) {
      setSpendingLimits(JSON.parse(savedLimits));
    } else {
      // Initialize with market averages
      const initialLimits: SpendingLimits = {};
      POSITIONS.forEach(pos => {
        initialLimits[pos] = positionAverages[pos];
      });
      setSpendingLimits(initialLimits);
    }

    const savedPriorities = localStorage.getItem('positionPriorities');
    if (savedPriorities) {
      setPositionPriorities(JSON.parse(savedPriorities));
    }
  }, [positionAverages]);

  const updateSpendingLimit = (position: string, value: number) => {
    const newLimits = { ...spendingLimits, [position]: value };
    setSpendingLimits(newLimits);
    localStorage.setItem('budgetLimits', JSON.stringify(newLimits));
    showNotification(`Spending limit updated for ${position}`, 'success');
  };

  const updatePositionPriority = (position: string, priority: 'none' | 'low' | 'medium' | 'high') => {
    const newPriorities = { ...positionPriorities, [position]: priority };
    setPositionPriorities(newPriorities);
    localStorage.setItem('positionPriorities', JSON.stringify(newPriorities));
    
    if (priority !== 'none') {
      showNotification(`${position} set to ${priority} priority`, 'success');
    } else {
      showNotification(`Priority removed for ${position}`, 'info');
    }
  };

  const resetSpendingLimits = () => {
    if (confirm('Reset all spending limits to market averages?')) {
      const resetLimits: SpendingLimits = {};
      POSITIONS.forEach(pos => {
        resetLimits[pos] = positionAverages[pos];
      });
      setSpendingLimits(resetLimits);
      localStorage.setItem('budgetLimits', JSON.stringify(resetLimits));
      showNotification('Spending limits reset to defaults', 'info');
    }
  };

  const resetAllPriorities = () => {
    if (confirm('Reset all position priorities?')) {
      setPositionPriorities({});
      localStorage.removeItem('positionPriorities');
      showNotification('All priorities reset', 'info');
    }
  };

  const showNotification = (message: string, type: 'success' | 'error' | 'info') => {
    const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg text-white transition-all duration-300 z-50 ${bgColor}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'medium':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'low':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default:
        return 'hidden';
    }
  };

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

  const budgetUsagePercent = ((budgetData.startingBalance - budgetData.currentBalance) / budgetData.startingBalance * 100);
  const roundsProgressPercent = budgetData.maxRounds > 0 ? (budgetData.completedRoundsCount / budgetData.maxRounds * 100) : 0;

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
      {/* Header - Hidden on mobile, shown on desktop */}
      <div className="glass rounded-3xl p-4 sm:p-6 mb-6 hover:shadow-lg transition-all duration-300 hidden sm:block">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center">
            <div className="bg-gradient-to-br from-green-400 to-emerald-600 p-3 rounded-full mr-4 shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-dark">Budget Planner</h1>
              <p className="text-gray-600 mt-1">Advanced budget management and bidding strategy</p>
            </div>
          </div>
          <div className="flex gap-2">
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
      </div>

      {/* Budget Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Current Balance Card */}
        <div className="glass rounded-2xl p-6 hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-blue-50 to-indigo-50">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-blue-100 p-3 rounded-full">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-xs text-blue-600 font-medium px-2 py-1 bg-blue-100 rounded-full">Current</span>
          </div>
          <h3 className="text-sm text-gray-600 mb-1">Available Balance</h3>
          <p className="text-3xl font-bold text-blue-600">£{budgetData.currentBalance.toLocaleString()}</p>
          <div className="mt-3 text-xs text-gray-500">Ready for bidding</div>
        </div>

        {/* Safe Spending Card */}
        <div className="glass rounded-2xl p-6 hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-green-50 to-emerald-50">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-green-100 p-3 rounded-full">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="text-xs text-green-600 font-medium px-2 py-1 bg-green-100 rounded-full">Safe</span>
          </div>
          <h3 className="text-sm text-gray-600 mb-1">Safe to Spend</h3>
          <p className="text-3xl font-bold text-green-600">£{budgetData.safeSpending.toLocaleString()}</p>
          <div className="mt-3 text-xs text-gray-500">Keeping reserve for {budgetData.remainingRounds} rounds</div>
        </div>

        {/* Max Recommended Bid Card */}
        <div className="glass rounded-2xl p-6 hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-purple-50 to-pink-50">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-purple-100 p-3 rounded-full">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <span className="text-xs text-purple-600 font-medium px-2 py-1 bg-purple-100 rounded-full">Max</span>
          </div>
          <h3 className="text-sm text-gray-600 mb-1">Max Recommended Bid</h3>
          <p className="text-3xl font-bold text-purple-600">£{budgetData.maxBid.toLocaleString()}</p>
          <div className="mt-3 text-xs text-gray-500">80% of safe spending</div>
        </div>
      </div>

      {/* Spending Limits by Position */}
      <div className="glass rounded-3xl p-6 mb-8 hover:shadow-lg transition-all duration-300">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-dark flex items-center">
            <svg className="w-6 h-6 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Spending Limits by Position
          </h2>
          <div className="flex gap-2">
            <button onClick={resetAllPriorities} className="text-sm text-gray-500 hover:text-red-600 transition-colors">
              Reset priorities
            </button>
            <button onClick={resetSpendingLimits} className="text-sm text-gray-500 hover:text-primary transition-colors">
              Reset limits
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {POSITIONS.map((position) => (
            <div key={position} className="bg-white/50 rounded-xl p-4 hover:bg-white/70 transition-all duration-300">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                  <span className="inline-block w-10 h-10 rounded-lg bg-primary/10 text-primary text-sm flex items-center justify-center font-bold mr-3">
                    {position}
                  </span>
                  <div>
                    <h4 className="font-medium text-gray-800">{position} Position</h4>
                    <p className="text-xs text-gray-500">Current: 0 players</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-600">Max bid amount:</span>
                  <input 
                    type="number" 
                    className="w-24 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                    value={spendingLimits[position] || positionAverages[position]}
                    onChange={(e) => updateSpendingLimit(position, parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-600">Market avg:</span>
                  <span className="text-sm font-medium text-gray-700">£{positionAverages[position]?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-600">Your spending:</span>
                  <span className={`text-sm font-medium ${spendingByPosition[position] > positionAverages[position] ? 'text-red-600' : 'text-green-600'}`}>
                    £{spendingByPosition[position]?.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Manual Priority Selection */}
              <div className="mt-3">
                <label className="text-xs text-gray-600 mb-1 block">Priority Level:</label>
                <select 
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg focus:ring-primary focus:border-primary priority-selector"
                  value={positionPriorities[position] || 'none'}
                  onChange={(e) => updatePositionPriority(position, e.target.value as any)}
                >
                  <option value="none">No Priority</option>
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                </select>
              </div>
              
              {/* Priority Indicator Display */}
              {positionPriorities[position] && positionPriorities[position] !== 'none' && (
                <div className={`mt-2 px-2 py-1 text-xs rounded-lg text-center border shadow-sm ${getPriorityColor(positionPriorities[position])}`}>
                  <div className="flex items-center justify-center">
                    {positionPriorities[position] === 'high' && (
                      <svg className="w-3 h-3 mr-1 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    )}
                    {(positionPriorities[position] === 'medium' || positionPriorities[position] === 'low') && (
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    )}
                    <span className="font-semibold">{positionPriorities[position].toUpperCase()} PRIORITY</span>
                  </div>
                  <div className="text-xs mt-1">
                    {positionPriorities[position] === 'high' && 'Focus budget here'}
                    {positionPriorities[position] === 'medium' && 'Balanced approach'}
                    {positionPriorities[position] === 'low' && 'Consider later'}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Budget Tracking & Round Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Round-by-Round Budget Tracking */}
        <div className="glass rounded-3xl p-6 hover:shadow-lg transition-all duration-300">
          <h3 className="text-lg font-bold text-dark mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Budget Tracking
          </h3>

          <div className="space-y-3">
            <div className="bg-white/50 rounded-xl p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">Rounds Progress</span>
                <span className="text-sm text-gray-600">{budgetData.completedRoundsCount}/{budgetData.maxRounds}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-primary to-accent h-2 rounded-full transition-all duration-500" 
                  style={{ width: `${roundsProgressPercent}%` }}
                ></div>
              </div>
            </div>

            <div className="bg-white/50 rounded-xl p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">Budget Usage</span>
                <span className="text-sm text-gray-600">{(budgetData.startingBalance - budgetData.currentBalance).toLocaleString()}/15,000</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-green-400 to-emerald-600 h-2 rounded-full transition-all duration-500" 
                  style={{ width: `${budgetUsagePercent}%` }}
                ></div>
              </div>
            </div>

            {budgetData.remainingRounds > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <h4 className="text-sm font-medium text-blue-800 mb-2">Recommended Strategy</h4>
                <ul className="text-xs text-blue-700 space-y-1">
                  <li>• Average per round: £{budgetData.avgPerRound.toLocaleString()}</li>
                  <li>• Keep £100 minimum per round</li>
                  <li>• Focus on high-priority positions first</li>
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Position Needs Analysis */}
        <div className="glass rounded-3xl p-6 hover:shadow-lg transition-all duration-300">
          <h3 className="text-lg font-bold text-dark mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Position Needs & Recommendations
          </h3>

          <div className="space-y-3">
            <div className="text-center py-8 text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm">Your team composition looks good!</p>
              <p className="text-xs mt-1">Consider depth players for key positions</p>
            </div>
          </div>
        </div>
      </div>

      {/* Budget Tips */}
      <div className="glass rounded-3xl p-6 bg-gradient-to-br from-yellow-50 to-orange-50">
        <div className="flex items-start">
          <div className="bg-yellow-100 p-2 rounded-full mr-3">
            <svg className="w-5 h-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-yellow-800 mb-2">Pro Budget Tips</h3>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>• Save more budget for positions with higher competition</li>
              <li>• Consider player ratings vs. cost for better value</li>
              <li>• Keep some reserve for unexpected tiebreaker situations</li>
              <li>• Monitor other teams spending patterns in recent rounds</li>
              <li>• Prioritize key positions early while budget is higher</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
