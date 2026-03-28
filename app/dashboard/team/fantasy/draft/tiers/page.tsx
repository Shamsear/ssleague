'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { fetchWithTokenRefresh } from '@/lib/firebase/fetchWithTokenRefresh';
import { ArrowLeft, Clock, DollarSign, AlertCircle, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';

// Custom scrollbar styles
const customScrollbarStyles = `
  .custom-scrollbar::-webkit-scrollbar {
    width: 8px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 4px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 4px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }
  
  @keyframes loading {
    0% { width: 0%; }
    100% { width: 100%; }
  }
`;


interface Player {
  real_player_id: string;
  player_name: string;
  position: string;
  real_team_name: string;
  total_points: number;
  games_played: number;
  avg_points_per_game: number;
}

interface Tier {
  tier_id: string;
  tier_number: number;
  tier_name: string;
  players: Player[];
  player_count: number;
  min_points: number;
  max_points: number;
  avg_points: number;
}

interface TierBid {
  tier_id: string;
  player_id?: string;
  bid_amount?: number;
  is_skip?: boolean;
}

interface ExistingBid {
  bid_id: string;
  tier_id: string;
  player_id: string;
  bid_amount: number;
  is_skip: boolean;
  status: string;
}

export default function DraftTierBiddingPage() {
  const router = useRouter();
  
  // State
  const [teamId, setTeamId] = useState<string>('');
  const [leagueId, setLeagueId] = useState<string>('');
  const [teamName, setTeamName] = useState<string>('');
  const [budget, setBudget] = useState<number>(100);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [activeTierNumber, setActiveTierNumber] = useState<number | null>(null);
  const [bids, setBids] = useState<Map<string, TierBid>>(new Map());
  const [expandedTiers, setExpandedTiers] = useState<Set<number>>(new Set([1]));
  const [deadline, setDeadline] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [success, setSuccess] = useState(false);

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');

      // Get team info from localStorage or URL params
      const storedTeamId = localStorage.getItem('fantasy_team_id');
      const storedLeagueId = localStorage.getItem('fantasy_league_id');
      
      if (!storedTeamId || !storedLeagueId) {
        setError('Team or league information not found');
        return;
      }

      setTeamId(storedTeamId);
      setLeagueId(storedLeagueId);

      // Fetch team details
      const teamRes = await fetchWithTokenRefresh(`/api/fantasy/teams/${storedTeamId}`);
      if (!teamRes.ok) throw new Error('Failed to fetch team');
      const teamData = await teamRes.json();
      setTeamName(teamData.team_name);
      setBudget(teamData.budget_remaining || 100);

      // Fetch league details for deadline and active tier
      const leagueRes = await fetchWithTokenRefresh(`/api/fantasy/leagues/${storedLeagueId}`);
      if (!leagueRes.ok) throw new Error('Failed to fetch league');
      const leagueData = await leagueRes.json();
      if (leagueData.draft_closes_at) {
        setDeadline(new Date(leagueData.draft_closes_at));
      }
      setActiveTierNumber(leagueData.current_active_tier);

      // Fetch tiers (only active tier if specified)
      let tiersUrl = `/api/fantasy/draft/tiers?league_id=${storedLeagueId}&draft_type=initial`;
      if (leagueData.current_active_tier) {
        tiersUrl += `&tier_number=${leagueData.current_active_tier}`;
      }
      
      const tiersRes = await fetchWithTokenRefresh(tiersUrl);
      if (!tiersRes.ok) throw new Error('Failed to fetch tiers');
      const tiersData = await tiersRes.json();
      setTiers(tiersData.tiers || []);

      // Fetch existing bids
      const bidsRes = await fetchWithTokenRefresh(
        `/api/fantasy/draft/my-bids?team_id=${storedTeamId}&league_id=${storedLeagueId}`
      );
      if (bidsRes.ok) {
        const bidsData = await bidsRes.json();
        const existingBids = new Map<string, TierBid>();
        (bidsData.bids || []).forEach((bid: ExistingBid) => {
          if (bid.status === 'pending') {
            existingBids.set(bid.tier_id, {
              tier_id: bid.tier_id,
              player_id: bid.player_id,
              bid_amount: bid.bid_amount,
              is_skip: bid.is_skip
            });
          }
        });
        setBids(existingBids);
      }

    } catch (err) {
      console.error('Error loading data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Calculate total bid amount
  const calculateTotalBids = useCallback(() => {
    let total = 0;
    bids.forEach(bid => {
      if (!bid.is_skip && bid.bid_amount) {
        total += bid.bid_amount;
      }
    });
    return total;
  }, [bids]);

  const totalBids = calculateTotalBids();
  const remainingBudget = budget - totalBids;
  const biddingCount = Array.from(bids.values()).filter(b => !b.is_skip).length;

  // Handle bid change
  const handleBidChange = (tierId: string, field: 'player_id' | 'bid_amount' | 'is_skip', value: any) => {
    setBids(prev => {
      const newBids = new Map(prev);
      const currentBid = newBids.get(tierId) || { tier_id: tierId };
      
      if (field === 'is_skip') {
        if (value) {
          // Skip tier
          newBids.set(tierId, { tier_id: tierId, is_skip: true });
        } else {
          // Uncheck skip
          newBids.set(tierId, { tier_id: tierId, is_skip: false });
        }
      } else {
        newBids.set(tierId, { ...currentBid, [field]: value, is_skip: false });
      }
      
      return newBids;
    });
  };

  // Toggle tier expansion
  const toggleTier = (tierNumber: number) => {
    setExpandedTiers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tierNumber)) {
        newSet.delete(tierNumber);
      } else {
        newSet.add(tierNumber);
      }
      return newSet;
    });
  };

  // Validate bids
  const validateBids = (): string | null => {
    if (totalBids > budget) {
      return `Total bids (€${totalBids}M) exceed your budget (€${budget}M)`;
    }

    // Only validate tiers that are shown (active tier)
    for (const tier of tiers) {
      const bid = bids.get(tier.tier_id);
      if (!bid) {
        return `Please select a player or skip for ${tier.tier_name}`;
      }
      if (!bid.is_skip) {
        if (!bid.player_id) {
          return `Please select a player for ${tier.tier_name}`;
        }
        if (!bid.bid_amount || bid.bid_amount <= 0) {
          return `Please enter a valid bid amount for ${tier.tier_name}`;
        }
      }
    }

    return null;
  };

  // Handle submit
  const handleSubmit = async () => {
    const validationError = validateBids();
    if (validationError) {
      setError(validationError);
      return;
    }

    setShowConfirmModal(true);
  };

  const confirmSubmit = async () => {
    try {
      setSubmitting(true);
      setError('');
      setShowConfirmModal(false);

      const bidsArray = Array.from(bids.values());

      const response = await fetchWithTokenRefresh('/api/fantasy/draft/submit-tier-bids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team_id: teamId,
          league_id: leagueId,
          bids: bidsArray
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit bids');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/dashboard/team/fantasy/my-team');
      }, 2000);

    } catch (err) {
      console.error('Error submitting bids:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit bids');
    } finally {
      setSubmitting(false);
    }
  };

  // Countdown timer
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  useEffect(() => {
    if (!deadline) return;

    const updateTimer = () => {
      const now = new Date();
      const diff = deadline.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining('Deadline passed');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (days > 0) {
        setTimeRemaining(`${days}d ${hours}h ${minutes}m`);
      } else if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
      } else {
        setTimeRemaining(`${minutes}m ${seconds}s`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-blue-600 mx-auto"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 bg-blue-600 rounded-full opacity-20 animate-ping"></div>
            </div>
          </div>
          <p className="mt-6 text-gray-700 font-medium text-lg">Loading draft tiers...</p>
          <p className="mt-2 text-gray-500 text-sm">Please wait while we fetch the data</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center">
        <div className="text-center animate-in zoom-in-95 fade-in duration-500">
          <div className="relative inline-block">
            <CheckCircle className="w-20 h-20 text-green-600 mx-auto mb-4 drop-shadow-lg" />
            <div className="absolute inset-0 bg-green-400 rounded-full blur-xl opacity-30 animate-pulse"></div>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Bids Submitted!</h2>
          <p className="text-gray-600 font-medium">Redirecting to your team...</p>
          <div className="mt-4 flex justify-center">
            <div className="w-48 h-1 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-green-500 to-emerald-500 animate-[loading_2s_ease-in-out]"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <style jsx global>{customScrollbarStyles}</style>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-gray-100 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                aria-label="Go back"
              >
                <ArrowLeft className="w-5 h-5 text-gray-700" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Draft Tier Bidding</h1>
                <p className="text-sm text-gray-600 font-medium">{teamName}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center space-x-2 text-gray-600 mb-1">
              <DollarSign className="w-4 h-4" />
              <span className="text-sm font-medium">Budget</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">€{budget}M</p>
          </div>
          
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="text-sm text-gray-600 mb-1 font-medium">Total Bids</div>
            <p className="text-2xl font-bold text-blue-600">€{totalBids}M</p>
          </div>
          
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="text-sm text-gray-600 mb-1 font-medium">Remaining</div>
            <p className={`text-2xl font-bold ${remainingBudget < 0 ? 'text-red-600' : 'text-green-600'}`}>
              €{remainingBudget}M
            </p>
          </div>
          
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="text-sm text-gray-600 mb-1 font-medium">Bidding On</div>
            <p className="text-2xl font-bold text-gray-900">{biddingCount}/{tiers.length}</p>
          </div>
          
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center space-x-2 text-gray-600 mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-sm font-medium">Deadline</span>
            </div>
            <p className="text-lg font-bold text-orange-600">{timeRemaining || 'N/A'}</p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 mb-6 flex items-start space-x-3 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900">Error</h3>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Active Tier Info or No Active Tier Message */}
        {activeTierNumber === null ? (
          <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border-2 border-yellow-300 rounded-xl p-6 mb-6 shadow-sm">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-yellow-900 mb-2 text-lg">No Active Tier</h3>
                <p className="text-sm text-yellow-800 mb-2">
                  The admin has not opened any tier for bidding yet. Please wait for the admin to activate a tier.
                </p>
                <p className="text-xs text-yellow-700 font-medium">
                  You will be notified when a tier becomes available for bidding.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 mb-6 shadow-sm">
            <h3 className="font-bold text-blue-900 mb-3 text-lg flex items-center">
              <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs mr-2">i</span>
              Tier {activeTierNumber} is Now Active
            </h3>
            <ul className="text-sm text-blue-800 space-y-2">
              <li className="flex items-start">
                <span className="text-blue-600 mr-2 font-bold">•</span>
                <span>Select one player from Tier {activeTierNumber} and enter your bid amount</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2 font-bold">•</span>
                <span>You can skip this tier if you don't want to bid</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2 font-bold">•</span>
                <span>Highest bidder wins each player (earliest bid wins ties)</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2 font-bold">•</span>
                <span>Your bid cannot exceed your remaining budget</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2 font-bold">•</span>
                <span>You can edit your bid until the admin processes this tier</span>
              </li>
            </ul>
          </div>
        )}

        {/* Tiers */}
        <div className="space-y-4">
          {tiers.length === 0 && activeTierNumber === null && (
            <div className="bg-white rounded-xl border-2 border-gray-200 p-8 text-center">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No Tiers Available</h3>
              <p className="text-sm text-gray-600">
                Please wait for the admin to open a tier for bidding.
              </p>
            </div>
          )}
          {tiers.map((tier) => {
            const bid = bids.get(tier.tier_id);
            const isExpanded = expandedTiers.has(tier.tier_number);
            const selectedPlayer = tier.players.find(p => p.real_player_id === bid?.player_id);

            return (
              <div key={tier.tier_id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-all duration-200">
                {/* Tier Header */}
                <div
                  className="p-5 cursor-pointer hover:bg-gradient-to-r hover:from-gray-50 hover:to-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
                  onClick={() => toggleTier(tier.tier_number)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleTier(tier.tier_number);
                    }
                  }}
                  aria-expanded={isExpanded}
                  aria-label={`Tier ${tier.tier_number} - ${tier.tier_name}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 flex-wrap gap-y-2">
                        <span className="text-2xl font-bold text-gray-900 tracking-tight">
                          Tier {tier.tier_number}
                        </span>
                        <span className="px-3 py-1 bg-gradient-to-r from-blue-100 to-blue-50 text-blue-800 rounded-full text-sm font-semibold shadow-sm">
                          {tier.tier_name}
                        </span>
                        {bid?.is_skip && (
                          <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                            Skipped
                          </span>
                        )}
                        {bid && !bid.is_skip && bid.player_id && (
                          <span className="px-3 py-1 bg-gradient-to-r from-green-100 to-emerald-50 text-green-800 rounded-full text-sm font-semibold shadow-sm">
                            Bid: €{bid.bid_amount}M
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-2 font-medium">
                        {tier.player_count} players • {tier.min_points}-{tier.max_points} pts (avg: {tier.avg_points})
                      </p>
                      {selectedPlayer && (
                        <p className="text-sm font-semibold text-gray-900 mt-2 bg-gray-50 inline-block px-3 py-1 rounded-lg">
                          Selected: {selectedPlayer.player_name} ({selectedPlayer.position})
                        </p>
                      )}
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-6 h-6 text-gray-500 transition-transform duration-200" />
                    ) : (
                      <ChevronDown className="w-6 h-6 text-gray-500 transition-transform duration-200" />
                    )}
                  </div>
                </div>

                {/* Tier Content */}
                {isExpanded && (
                  <div className="border-t border-gray-200 p-5 bg-gradient-to-br from-gray-50 to-white">
                    {/* Skip Option */}
                    <div className="mb-5">
                      <label className="flex items-center space-x-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={bid?.is_skip || false}
                          onChange={(e) => handleBidChange(tier.tier_id, 'is_skip', e.target.checked)}
                          className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200"
                        />
                        <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900 transition-colors">Skip this tier</span>
                      </label>
                    </div>

                    {!bid?.is_skip && (
                      <>
                        {/* Bid Amount */}
                        <div className="mb-5">
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Bid Amount (€M)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={bid?.bid_amount || ''}
                            onChange={(e) => handleBidChange(tier.tier_id, 'bid_amount', parseFloat(e.target.value) || 0)}
                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 font-medium text-gray-900 placeholder-gray-400"
                            placeholder="Enter bid amount"
                          />
                        </div>

                        {/* Player Selection */}
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-3">
                            Select Player
                          </label>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                            {tier.players.map((player) => (
                              <button
                                key={player.real_player_id}
                                onClick={() => handleBidChange(tier.tier_id, 'player_id', player.real_player_id)}
                                className={`p-4 rounded-xl border-2 text-left transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                                  bid?.player_id === player.real_player_id
                                    ? 'border-blue-600 bg-gradient-to-br from-blue-50 to-blue-100 shadow-md ring-2 ring-blue-500 ring-offset-2 scale-[1.02]'
                                    : 'border-gray-200 hover:border-blue-300 hover:shadow-md bg-white hover:scale-[1.01]'
                                }`}
                              >
                                <div className="font-semibold text-gray-900 mb-1">{player.player_name}</div>
                                <div className="text-sm text-gray-600 font-medium mb-2">{player.position} • {player.real_team_name}</div>
                                <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-2 py-1 inline-block">
                                  {player.total_points} pts • {player.games_played} games • {player.avg_points_per_game} avg
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Submit Button */}
        {tiers.length > 0 && (
          <div className="mt-8 flex justify-center">
            <button
              onClick={handleSubmit}
              disabled={submitting || remainingBudget < 0}
              className="px-10 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-bold text-lg hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none disabled:shadow-none focus:outline-none focus:ring-4 focus:ring-blue-300"
            >
              {submitting ? (
                <span className="flex items-center space-x-2">
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Submitting...</span>
                </span>
              ) : `Submit Bid for Tier ${activeTierNumber}`}
            </button>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl transform transition-all animate-in zoom-in-95 duration-200">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Confirm Bid Submission</h3>
            <div className="space-y-3 mb-6 bg-gray-50 rounded-xl p-4">
              <p className="text-sm text-gray-700">
                You are about to submit {activeTierNumber ? `your bid for Tier ${activeTierNumber}` : `bids for ${biddingCount} tier(s)`}
              </p>
              <p className="text-sm text-gray-700">
                Total bid amount: <span className="font-bold text-blue-600">€{totalBids}M</span>
              </p>
              <p className="text-sm text-gray-700">
                Budget remaining: <span className={`font-bold ${remainingBudget >= 0 ? 'text-green-600' : 'text-red-600'}`}>€{remainingBudget}M</span>
              </p>
            </div>
            <p className="text-sm text-orange-600 font-semibold mb-6 bg-orange-50 p-3 rounded-lg border border-orange-200">
              💡 You can edit your bid until the admin processes this tier.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-50 transition-all duration-200 font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
              >
                Cancel
              </button>
              <button
                onClick={confirmSubmit}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
