'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';
import OptimizedImage from '@/components/OptimizedImage';

interface RealPlayer {
  player_id: string;
  player_name: string;
  display_name?: string;
  photo_url?: string;
  photo_position_x_circle?: number;
  photo_position_y_circle?: number;
  photo_scale_circle?: number;
  team: string;
  team_id: string;
  category: string;
  star_rating: number;
  base_value?: number;
  points: number;
  matches_played: number;
  goals_scored: number;
  assists: number;
}

interface PlayerPlan {
  id: string;
  player_id?: string;
  name: string;
  photo_url?: string;
  photo_position_x_circle?: number;
  photo_position_y_circle?: number;
  photo_scale_circle?: number;
  category?: string;
  initialStars: number;
  bidAmount: number;
  finalStars: number;
  salaryPerMatch: number;
  matches: number;
  totalSalary: number;
}

// Star upgrade matrix based on your specifications
const UPGRADE_MATRIX: Record<number, Record<number, number>> = {
  3: { 140: 4, 265: 5, 415: 6, 590: 7, 790: 8, 1040: 9, 1540: 10 },
  4: { 195: 5, 345: 6, 520: 7, 720: 8, 970: 9, 1470: 10 },
  5: { 250: 6, 425: 7, 625: 8, 875: 9, 1375: 10 },
  6: { 305: 7, 505: 8, 755: 9, 1255: 10 },
  7: { 360: 8, 610: 9, 1100: 10 },
  8: { 440: 9, 940: 10 },
  9: { 710: 10 }
};

const MIN_PLAYERS = 5;
const MAX_PLAYERS = 7;
const TOTAL_BUDGET = 1000;
const MIN_BID = 100;
const DEFAULT_MATCHES = 38;

// Points based on star rating
const STAR_RATING_POINTS: Record<number, number> = {
  3: 100,
  4: 120,
  5: 145,
  6: 175,
  7: 210,
  8: 250,
  9: 300,
  10: 375
};

// Calculate minimum bid based on star rating (base price to maintain that rating)
const getMinimumBidForStars = (stars: number): number => {
  const baseValues: Record<number, number> = {
    3: 100,  // Starting minimum
    4: 140,  // Minimum to stay at 4★
    5: 195,  // Minimum to stay at 5★
    6: 250,  // Minimum to stay at 6★
    7: 305,  // Minimum to stay at 7★
    8: 360,  // Minimum to stay at 8★
    9: 440,  // Minimum to stay at 9★
    10: 710  // Minimum to stay at 10★
  };
  return baseValues[stars] || 100;
};

// Generate photo transform style based on custom positioning (matching PlayerPhoto component)
const getPhotoStyle = (x?: number, y?: number, scale?: number) => {
  const posX = x ?? 50;
  const posY = y ?? 50;
  const scaleValue = scale ?? 1;
  
  return {
    objectPosition: `${posX}% ${posY}%`,
    transform: `scale(${scaleValue})`,
    transformOrigin: `${posX}% ${posY}%`,
  };
};

export default function RealPlayersPlannerPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  
  const [players, setPlayers] = useState<PlayerPlan[]>([]);
  const [availableRealPlayers, setAvailableRealPlayers] = useState<RealPlayer[]>([]);
  const [openDropdownIndex, setOpenDropdownIndex] = useState<number | null>(null);
  const [searchTerms, setSearchTerms] = useState<Record<number, string>>({});
  const [showUpgradeMatrix, setShowUpgradeMatrix] = useState(false);
  const [teamBudget, setTeamBudget] = useState(TOTAL_BUDGET);
  const [teamSpent, setTeamSpent] = useState(0);
  const [starRatingConfig, setStarRatingConfig] = useState<Record<number, number>>({});
  const [isLoadingBudget, setIsLoadingBudget] = useState(true);
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'team') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  // Fetch team's actual SSCoin budget and available real players
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      
      try {
        // Fetch budget
        const response = await fetchWithTokenRefresh('/api/team/dashboard');
        const data = await response.json();
        
        if (data.success && data.data) {
          const team = data.data.team || {};
          const seasonSettings = data.data.seasonSettings || {};
          
          setTeamBudget(seasonSettings.dollar_budget || TOTAL_BUDGET);
          setTeamSpent(team.real_player_spent || 0);
        }

        // Fetch active season
        const seasonResponse = await fetchWithTokenRefresh('/api/cached/firebase/seasons?isActive=true');
        if (seasonResponse.ok) {
          const seasonData = await seasonResponse.json();
          if (seasonData.success && seasonData.data.length > 0) {
            const season = seasonData.data[0];
            
            // Extract star rating config
            if (season.star_rating_config && Array.isArray(season.star_rating_config)) {
              const configMap: Record<number, number> = {};
              season.star_rating_config.forEach((config: any) => {
                if (config.star_rating && config.base_auction_value) {
                  configMap[config.star_rating] = config.base_auction_value;
                }
              });
              setStarRatingConfig(configMap);
              console.log('⭐ Star rating config loaded:', configMap);
            }
            
            // Fetch real players
            const playersResponse = await fetchWithTokenRefresh(`/api/stats/players?seasonId=${season.id}&limit=1000`);
            if (playersResponse.ok) {
              const playersData = await playersResponse.json();
              if (playersData.success) {
                const realPlayers = playersData.data?.filter((p: any) => p.star_rating && p.star_rating > 0) || [];
                
                // Fetch photo URLs
                const playerIds = realPlayers.map((p: any) => p.player_id).filter(Boolean);
                if (playerIds.length > 0) {
                  try {
                    const photosResponse = await fetchWithTokenRefresh('/api/real-players?' + new URLSearchParams({
                      playerIds: playerIds.join(',')
                    }));
                    
                    if (photosResponse.ok) {
                      const photosData = await photosResponse.json();
                      if (photosData.success && photosData.players) {
                        const photoMap = new Map(
                          photosData.players.map((p: any) => [
                            p.player_id, 
                            { 
                              photo_url: p.photo_url,
                              photo_position_x_circle: p.photo_position_x_circle,
                              photo_position_y_circle: p.photo_position_y_circle,
                              photo_scale_circle: p.photo_scale_circle
                            }
                          ])
                        );
                        
                        realPlayers.forEach((player: any) => {
                          const photoData = photoMap.get(player.player_id);
                          if (photoData) {
                            player.photo_url = photoData.photo_url;
                            player.photo_position_x_circle = photoData.photo_position_x_circle;
                            player.photo_position_y_circle = photoData.photo_position_y_circle;
                            player.photo_scale_circle = photoData.photo_scale_circle;
                          }
                        });
                      }
                    }
                  } catch (photoError) {
                    console.warn('Could not fetch player photos:', photoError);
                  }
                }
                
                setAvailableRealPlayers(realPlayers);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoadingBudget(false);
        setIsLoadingPlayers(false);
      }
    };
    
    fetchData();
  }, [user]);

  // Initialize with minimum 5 players
  useEffect(() => {
    if (players.length === 0) {
      const initialPlayers: PlayerPlan[] = Array.from({ length: MIN_PLAYERS }, (_, i) => 
        createEmptyPlayer(i)
      );
      setPlayers(initialPlayers);
    }
  }, []);

  const createEmptyPlayer = (index: number): PlayerPlan => ({
    id: `player-${Date.now()}-${index}`,
    name: 'Select a player...',
    initialStars: 3,
    bidAmount: 0,
    finalStars: 3,
    salaryPerMatch: 0,
    matches: 0,
    totalSalary: 0
  });

  const selectRealPlayer = (realPlayer: RealPlayer, index: number) => {
    console.log('🎯 selectRealPlayer called', { realPlayer: realPlayer.player_name, index });
    
    setPlayers(players.map((player, i) => {
      if (i !== index) return player;
      
      const initialStars = realPlayer.star_rating || 3;
      // Use base_auction_value from season config, fallback to player's base_value, then calculated
      const minimumBid = starRatingConfig[initialStars] || realPlayer.base_value || getMinimumBidForStars(initialStars);
      
      const updated = {
        ...player,
        player_id: realPlayer.player_id,
        name: realPlayer.display_name || realPlayer.player_name,
        photo_url: realPlayer.photo_url,
        photo_position_x_circle: realPlayer.photo_position_x_circle,
        photo_position_y_circle: realPlayer.photo_position_y_circle,
        photo_scale_circle: realPlayer.photo_scale_circle,
        category: realPlayer.category,
        initialStars: initialStars,
        bidAmount: minimumBid
      };
      
      // Recalculate with new star rating and bid amount
      updated.finalStars = calculateFinalStars(updated.initialStars, updated.bidAmount);
      updated.salaryPerMatch = calculateSalary(updated.bidAmount, updated.finalStars);
      updated.totalSalary = updated.salaryPerMatch * (updated.matches || 0);
      
      console.log('✅ Player updated', updated);
      return updated;
    }));
    
    console.log('🚪 Closing dropdown');
    setOpenDropdownIndex(null);
    setSearchTerms({ ...searchTerms, [index]: '' });
  };

  const toggleDropdown = (index: number) => {
    setOpenDropdownIndex(openDropdownIndex === index ? null : index);
    if (openDropdownIndex !== index) {
      setSearchTerms({ ...searchTerms, [index]: '' });
    }
  };

  const getFilteredPlayersForDropdown = (index: number) => {
    const searchTerm = searchTerms[index] || '';
    const searchLower = searchTerm.toLowerCase();
    
    return availableRealPlayers
      .filter(p => {
        return (
          p.player_name?.toLowerCase().includes(searchLower) ||
          p.display_name?.toLowerCase().includes(searchLower) ||
          p.team?.toLowerCase().includes(searchLower)
        );
      })
      .filter(p => !players.some(plan => plan.player_id === p.player_id));
  };

  const calculateFinalStars = (initialStars: number, bidAmount: number): number => {
    if (initialStars < 3 || initialStars > 9) return initialStars;
    if (initialStars === 10) return 10;
    
    const upgrades = UPGRADE_MATRIX[initialStars];
    if (!upgrades) return initialStars;
    
    // Find the highest upgrade the bid amount qualifies for
    const sortedThresholds = Object.keys(upgrades)
      .map(Number)
      .sort((a, b) => b - a); // Sort descending
    
    for (const threshold of sortedThresholds) {
      if (bidAmount >= threshold) {
        return upgrades[threshold];
      }
    }
    
    return initialStars;
  };

  const calculateSalary = (bidAmount: number, finalStars: number): number => {
    // Formula: (bidAmount ÷ 100) × finalStars ÷ 10
    return (bidAmount / 100) * finalStars / 10;
  };

  const updatePlayer = (id: string, field: keyof PlayerPlan, value: any) => {
    setPlayers(players.map(player => {
      if (player.id !== id) return player;
      
      const updated = { ...player, [field]: value };
      
      // Recalculate when initialStars, bidAmount, or matches changes
      if (field === 'initialStars' || field === 'bidAmount' || field === 'matches') {
        updated.finalStars = calculateFinalStars(updated.initialStars, updated.bidAmount);
        updated.salaryPerMatch = calculateSalary(updated.bidAmount, updated.finalStars);
        updated.totalSalary = updated.salaryPerMatch * (updated.matches || 0);
      }
      
      return updated;
    }));
  };

  const addPlayer = () => {
    if (players.length < MAX_PLAYERS) {
      setPlayers([...players, createEmptyPlayer(players.length)]);
    }
  };

  const removePlayer = (id: string) => {
    if (players.length > MIN_PLAYERS) {
      setPlayers(players.filter(p => p.id !== id));
    }
  };

  // Calculate totals
  const totalPlannedSpend = players.reduce((sum, p) => sum + p.bidAmount, 0);
  const totalSalaryPerMatch = players.reduce((sum, p) => sum + p.salaryPerMatch, 0);
  const totalSeasonSalary = players.reduce((sum, p) => sum + p.totalSalary, 0);
  const remainingBudget = teamBudget - teamSpent - totalPlannedSpend;

  const getNextUpgrade = (initialStars: number, currentBid: number): { amount: number; stars: number } | null => {
    if (initialStars >= 10) return null;
    
    const upgrades = UPGRADE_MATRIX[initialStars];
    if (!upgrades) return null;
    
    const sortedThresholds = Object.keys(upgrades)
      .map(Number)
      .sort((a, b) => a - b);
    
    for (const threshold of sortedThresholds) {
      if (currentBid < threshold) {
        return { amount: threshold, stars: upgrades[threshold] };
      }
    }
    
    return null;
  };

  // Generate bid increments with points preview
  const getBidIncrements = (initialStars: number, currentBid: number): Array<{ bid: number; stars: number; points: number; isUpgrade: boolean }> => {
    const increments: Array<{ bid: number; stars: number; points: number; isUpgrade: boolean }> = [];
    const upgrades = UPGRADE_MATRIX[initialStars];
    
    if (!upgrades) return increments;
    
    // Get all upgrade thresholds
    const thresholds = Object.keys(upgrades).map(Number).sort((a, b) => a - b);
    
    // Start from current bid or minimum, go up to highest upgrade + 20
    const minBid = starRatingConfig[initialStars] || getMinimumBidForStars(initialStars);
    const startBid = Math.max(currentBid, minBid);
    const maxThreshold = Math.max(...thresholds);
    const maxBid = maxThreshold + 20;
    
    // Generate increments in steps of 5
    for (let bid = startBid; bid <= maxBid && increments.length < 10; bid += 5) {
      const stars = calculateFinalStars(initialStars, bid);
      const points = STAR_RATING_POINTS[stars] || 100;
      const isUpgrade = stars > initialStars;
      
      // Check if this bid crosses an upgrade threshold
      const prevStars = bid >= 5 ? calculateFinalStars(initialStars, bid - 5) : initialStars;
      const justUpgraded = stars > prevStars;
      
      increments.push({ bid, stars, points, isUpgrade: justUpgraded });
    }
    
    return increments;
  };

  if (loading || isLoadingBudget || isLoadingPlayers) {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8 max-w-7xl">
        {/* Header */}
        <div className="glass rounded-2xl sm:rounded-3xl p-4 sm:p-5 lg:p-6 mb-4 sm:mb-6 shadow-lg border border-white/20">
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="flex items-start sm:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                <div className="bg-gradient-to-br from-green-400 to-emerald-600 p-2 sm:p-3 rounded-xl sm:rounded-2xl shadow-lg flex-shrink-0">
                  <svg className="w-6 h-6 sm:w-8 sm:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 truncate">Real Players Planner</h1>
                  <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">Select {MIN_PLAYERS}-{MAX_PLAYERS} players for auction</p>
                </div>
              </div>
              <Link 
                href="/dashboard" 
                className="px-3 py-2 bg-white/80 text-gray-700 rounded-lg sm:rounded-xl hover:bg-white shadow-sm transition-all text-xs sm:text-sm font-medium flex items-center gap-1.5 sm:gap-2 flex-shrink-0"
              >
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Budget Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4 mb-3 sm:mb-4">
          <div className="glass rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-5 hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100">
            <div className="text-xs sm:text-sm text-gray-600 mb-1">Budget</div>
            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-600 truncate">{teamBudget.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-0.5 sm:mt-1">Available</div>
          </div>

          <div className="glass rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-5 hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-100">
            <div className="text-xs sm:text-sm text-gray-600 mb-1">Planned</div>
            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-purple-600 truncate">{totalPlannedSpend.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-0.5 sm:mt-1">{players.length} player{players.length !== 1 ? 's' : ''}</div>
          </div>

          <div className={`glass rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-5 hover:shadow-lg transition-all duration-300 ${
            remainingBudget < 0 ? 'bg-gradient-to-br from-red-50 to-orange-50 border border-red-200' : 'bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200'
          }`}>
            <div className="text-xs sm:text-sm text-gray-600 mb-1">Remaining</div>
            <div className={`text-lg sm:text-xl lg:text-2xl font-bold truncate ${remainingBudget < 0 ? 'text-red-600' : 'text-green-600'}`}>
              {remainingBudget.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 mt-0.5 sm:mt-1 truncate">{teamSpent > 0 ? `${teamSpent} spent` : 'Not spent'}</div>
          </div>

          <div className="glass rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-5 hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-yellow-50 to-orange-50 border border-yellow-100">
            <div className="text-xs sm:text-sm text-gray-600 mb-1">Salary</div>
            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-orange-600 truncate">{totalSalaryPerMatch.toFixed(1)}</div>
            <div className="text-xs text-gray-500 mt-0.5 sm:mt-1 truncate">Per match</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-4 sm:mb-6">
          <button
            onClick={addPlayer}
            disabled={players.length >= MAX_PLAYERS}
            className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg sm:rounded-xl hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center font-medium text-sm sm:text-base"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            <span>Add Player</span>
            {players.length >= MAX_PLAYERS && <span className="ml-1 text-xs">(Max)</span>}
          </button>

          <button
            onClick={() => setShowUpgradeMatrix(!showUpgradeMatrix)}
            className="px-4 py-2.5 bg-white/80 text-gray-700 rounded-lg sm:rounded-xl hover:bg-white hover:shadow-md transition-all flex items-center justify-center font-medium text-sm sm:text-base border border-gray-200"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {showUpgradeMatrix ? 'Hide' : 'View'} Matrix
          </button>
        </div>

      {/* Upgrade Matrix */}
      {showUpgradeMatrix && (
        <div className="glass rounded-2xl p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Star Upgrade Matrix</h2>
          <p className="text-sm text-gray-600 mb-4">Bid amounts required to upgrade players to higher star ratings</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(UPGRADE_MATRIX).map(([initialStar, upgrades]) => (
              <div key={initialStar} className="bg-white/60 rounded-xl p-4 border border-gray-200">
                <h3 className="font-bold text-lg mb-2 text-blue-600">{initialStar}★ Initial</h3>
                <div className="space-y-1">
                  {Object.entries(upgrades).map(([amount, finalStar]) => (
                    <div key={amount} className="flex justify-between text-sm">
                      <span className="text-gray-600">SSCoin {amount}</span>
                      <span className="font-semibold text-green-600">→ {finalStar}★</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

        {/* Player Cards */}
        <div className="space-y-3 sm:space-y-4">
          {players.map((player, index) => {
            const nextUpgrade = getNextUpgrade(player.initialStars, player.bidAmount);
            
            return (
              <div 
                key={player.id} 
                className="glass rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-5 hover:shadow-lg transition-all duration-300 border border-white/20"
                style={{ position: 'relative', zIndex: openDropdownIndex === index ? 100 : 1 }}
              >
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <h3 className="text-base sm:text-lg font-bold text-gray-800 flex items-center gap-2">
                    <span className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center text-xs sm:text-sm font-bold">{index + 1}</span>
                    <span className="hidden sm:inline">Player</span>
                  </h3>
                  <button
                    onClick={() => removePlayer(player.id)}
                    disabled={players.length <= MIN_PLAYERS}
                    className="p-1.5 sm:p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed"
                    title={players.length <= MIN_PLAYERS ? `Minimum ${MIN_PLAYERS} players required` : 'Remove player'}
                  >
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                {/* Left Column - Input */}
                <div className="space-y-4">
                  <div className="relative" style={{ zIndex: openDropdownIndex === index ? 50 : 'auto' }}>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Player Selection</label>
                    <button
                      onClick={() => toggleDropdown(index)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:bg-gray-50 transition-colors text-left flex items-center gap-3"
                    >
                      {player.photo_url ? (
                        <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border-2 border-white/50 shadow-md relative">
                          <OptimizedImage
                            src={player.photo_url}
                            alt={player.name}
                            width={80}
                            height={80}
                            quality={85}
                            className="w-full h-full object-cover"
                            style={getPhotoStyle(player.photo_position_x_circle, player.photo_position_y_circle, player.photo_scale_circle)}
                            fallback={
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-purple-100">
                                <span className="text-sm font-bold text-blue-600">{player.name[0]}</span>
                              </div>
                            }
                          />
                        </div>
                      ) : player.player_id ? (
                        <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-purple-100 flex-shrink-0">
                          <span className="text-sm font-bold text-blue-600">{player.name[0]}</span>
                        </div>
                      ) : null}
                      <div className="flex-1 min-w-0">
                        <div className={`font-medium ${!player.player_id ? 'text-gray-500' : 'text-gray-900'}`}>
                          {player.name}
                        </div>
                        {player.category && (
                          <div className="text-xs text-gray-500">{player.category}</div>
                        )}
                      </div>
                      <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {/* Dropdown */}
                    {openDropdownIndex === index && (
                      <div className="absolute w-full mt-2 bg-white rounded-lg shadow-xl border border-gray-200 max-h-96 overflow-hidden flex flex-col" style={{ zIndex: 50 }}>
                        {/* Search */}
                        <div 
                          className="p-3 border-b border-gray-200"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            placeholder="Search players..."
                            value={searchTerms[index] || ''}
                            onChange={(e) => setSearchTerms({ ...searchTerms, [index]: e.target.value })}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            autoFocus
                          />
                        </div>
                        
                        {/* Player List */}
                        <div 
                          className="overflow-y-auto max-h-80"
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          {getFilteredPlayersForDropdown(index).length === 0 ? (
                            <div className="p-4 text-center text-gray-500 text-sm">
                              {searchTerms[index] ? 'No players found' : 'All players selected'}
                            </div>
                          ) : (
                            getFilteredPlayersForDropdown(index).map((realPlayer) => (
                              <button
                                key={realPlayer.player_id}
                                onMouseDown={(e) => {
                                  console.log('🖱️ MouseDown on player button', realPlayer.player_name);
                                  e.stopPropagation();
                                }}
                                onClick={(e) => {
                                  console.log('👆 Click on player button', realPlayer.player_name);
                                  e.stopPropagation();
                                  e.preventDefault();
                                  selectRealPlayer(realPlayer, index);
                                }}
                                className="w-full flex items-center gap-3 p-3 hover:bg-blue-50 transition-colors text-left border-b border-gray-100 last:border-b-0"
                              >
                                {/* Player Photo */}
                                <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 border-2 border-white/50 shadow-md relative">
                                  {realPlayer.photo_url ? (
                                    <OptimizedImage
                                      src={realPlayer.photo_url}
                                      alt={realPlayer.player_name}
                                      width={80}
                                      height={80}
                                      quality={85}
                                      className="w-full h-full object-cover"
                                      style={getPhotoStyle(realPlayer.photo_position_x_circle, realPlayer.photo_position_y_circle, realPlayer.photo_scale_circle)}
                                      fallback={
                                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-purple-100">
                                          <span className="text-lg font-bold text-blue-600">{realPlayer.player_name[0]}</span>
                                        </div>
                                      }
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-purple-100">
                                      <span className="text-lg font-bold text-blue-600">{realPlayer.player_name[0]}</span>
                                    </div>
                                  )}
                                </div>
                                
                                {/* Player Info */}
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold text-gray-900 text-sm truncate">
                                    {realPlayer.display_name || realPlayer.player_name}
                                  </div>
                                  <div className="text-xs text-gray-600 truncate">{realPlayer.team}</div>
                                  <div className="flex items-center gap-1.5 mt-1">
                                    {realPlayer.category && (
                                      <span className={`px-1.5 py-0.5 text-xs font-semibold rounded ${
                                        realPlayer.category.toLowerCase() === 'legend'
                                          ? 'bg-yellow-100 text-yellow-800'
                                          : 'bg-blue-100 text-blue-800'
                                      }`}>
                                        {realPlayer.category}
                                      </span>
                                    )}
                                    <span className="px-1.5 py-0.5 text-xs font-semibold rounded bg-purple-100 text-purple-800">
                                      {realPlayer.star_rating || 3}⭐
                                    </span>
                                  </div>
                                </div>
                                
                                {/* Stats */}
                                <div className="flex gap-2 text-xs flex-shrink-0">
                                  <div className="text-center">
                                    <div className="font-bold text-blue-600">{realPlayer.points || 0}</div>
                                    <div className="text-gray-500">Pts</div>
                                  </div>
                                  <div className="text-center">
                                    <div className="font-bold text-green-600">{realPlayer.goals_scored || 0}</div>
                                    <div className="text-gray-500">G</div>
                                  </div>
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Bid Amount (SSCoin)</label>
                    <input
                      type="number"
                      value={player.bidAmount || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        updatePlayer(player.id, 'bidAmount', value === '' ? 0 : Number(value));
                      }}
                      min={starRatingConfig[player.initialStars] || getMinimumBidForStars(player.initialStars)}
                      step={10}
                      placeholder="Enter bid amount"
                      className={`w-full px-3 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        player.player_id && player.bidAmount > 0 && player.bidAmount < (starRatingConfig[player.initialStars] || getMinimumBidForStars(player.initialStars))
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-300'
                      }`}
                      disabled={!player.player_id}
                    />
                    {player.player_id && player.bidAmount > 0 && player.bidAmount < (starRatingConfig[player.initialStars] || getMinimumBidForStars(player.initialStars)) ? (
                      <p className="text-xs text-red-600 font-medium mt-1 flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        Amount cannot be below minimum of ${starRatingConfig[player.initialStars] || getMinimumBidForStars(player.initialStars)}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-500 mt-1">
                        {player.player_id 
                          ? `Minimum for ${player.initialStars}★: SSCoin ${starRatingConfig[player.initialStars] || getMinimumBidForStars(player.initialStars)}`
                          : 'Select a player first'}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Matches</label>
                    <input
                      type="number"
                      value={player.matches || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        updatePlayer(player.id, 'matches', value === '' ? 0 : Number(value));
                      }}
                      min="0"
                      step="1"
                      placeholder="Enter matches"
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={!player.player_id}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {player.player_id ? 'Number of matches for salary calculation' : 'Select a player first'}
                    </p>
                  </div>
                </div>

                {/* Right Column - Calculations */}
                <div className="space-y-4">
                  {/* Star Upgrade Display */}
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border-2 border-purple-200">
                    <div className="text-sm font-medium text-gray-700 mb-2">⭐ Star Rating</div>
                    {player.finalStars > player.initialStars ? (
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-gray-600">{player.initialStars}★</span>
                        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                        <span className="text-2xl font-bold text-green-600">{player.finalStars}★</span>
                        <span className="ml-2 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                          Upgraded!
                        </span>
                      </div>
                    ) : (
                      <div className="text-2xl font-bold text-gray-600">{player.initialStars}★</div>
                    )}
                    {nextUpgrade && (
                      <p className="text-xs text-gray-600 mt-2">
                        💡 Next upgrade: SSCoin {nextUpgrade.amount} → {nextUpgrade.stars}★
                      </p>
                    )}
                  </div>

                  {/* Salary Display */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border-2 border-blue-200">
                    <div className="text-sm font-medium text-gray-700 mb-2">💰 Per Match Salary</div>
                    <div className="text-2xl font-bold text-blue-600">
                      SSCoin {player.salaryPerMatch.toFixed(2)}
                    </div>
                    <p className="text-xs text-gray-600 mt-2">
                      Formula: ({player.bidAmount} ÷ 100) × {player.finalStars}★ ÷ 10
                    </p>
                  </div>

                  {/* Season Total */}
                  <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-4 border-2 border-yellow-200">
                    <div className="text-sm font-medium text-gray-700 mb-2">📊 Total Salary ({player.matches || 0} matches)</div>
                    <div className="text-2xl font-bold text-orange-600">
                      SSCoin {player.totalSalary.toFixed(2)}
                    </div>
                  </div>

                  {/* Bid Increments with Points Preview */}
                  {player.player_id && player.bidAmount > 0 && (
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border-2 border-green-200">
                      <div className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                        <span>🎯 Bid Increments (+5)</span>
                        <span className="text-xs text-gray-500">(Stars & Points)</span>
                      </div>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {getBidIncrements(player.initialStars, player.bidAmount).map((increment, idx) => {
                          const isCurrentBid = increment.bid === player.bidAmount;
                          return (
                            <div 
                              key={idx}
                              className={`flex items-center justify-between text-xs py-1.5 px-2 rounded-lg ${
                                isCurrentBid 
                                  ? 'bg-blue-100 border border-blue-300 font-semibold' 
                                  : increment.isUpgrade
                                  ? 'bg-green-100 border border-green-300 font-semibold'
                                  : 'bg-white/50'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className={isCurrentBid ? 'text-blue-700' : 'text-gray-700'}>
                                  ${increment.bid}
                                </span>
                                {isCurrentBid && (
                                  <span className="text-xs px-1.5 py-0.5 bg-blue-200 text-blue-700 rounded">Current</span>
                                )}
                                {increment.isUpgrade && !isCurrentBid && (
                                  <span className="text-xs px-1.5 py-0.5 bg-green-200 text-green-700 rounded">⬆ Upgrade!</span>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                <span className={`font-semibold ${
                                  isCurrentBid ? 'text-blue-700' : increment.isUpgrade ? 'text-green-700' : 'text-gray-600'
                                }`}>
                                  {increment.stars}⭐
                                </span>
                                <span className={`font-bold ${
                                  isCurrentBid ? 'text-blue-700' : increment.isUpgrade ? 'text-green-700' : 'text-gray-700'
                                }`}>
                                  {increment.points} pts
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-xs text-gray-600 mt-2">
                        Current: {player.finalStars}⭐ = {STAR_RATING_POINTS[player.finalStars] || 100} points
                      </p>
                    </div>
                  )}
                </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Warning Messages */}
        {players.length < MIN_PLAYERS && (
          <div className="mt-4 sm:mt-6 glass rounded-xl sm:rounded-2xl p-3 sm:p-4 bg-yellow-50 border-2 border-yellow-300">
            <div className="flex items-start gap-2 sm:gap-3">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-yellow-800 font-medium text-sm sm:text-base">
                You need at least {MIN_PLAYERS} real players. Currently: {players.length}
              </p>
            </div>
          </div>
        )}

        {remainingBudget < 0 && (
          <div className="mt-4 sm:mt-6 glass rounded-xl sm:rounded-2xl p-3 sm:p-4 bg-red-50 border-2 border-red-300">
            <div className="flex items-start gap-2 sm:gap-3">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-800 font-medium text-sm sm:text-base">
                Warning: Budget exceeded by SSCoin {Math.abs(remainingBudget).toLocaleString()}!
              </p>
            </div>
          </div>
        )}

        {/* Info Panel */}
        <div className="mt-4 sm:mt-6 glass rounded-xl sm:rounded-2xl p-4 sm:p-5 lg:p-6 bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100">
          <h3 className="font-bold text-base sm:text-lg text-indigo-900 mb-3 flex items-center gap-2">
            📝 <span>Planning Tips</span>
          </h3>
          <ul className="space-y-2 text-xs sm:text-sm text-indigo-800">
            <li className="flex items-start gap-2">
              <span className="text-indigo-600 font-bold flex-shrink-0">•</span>
              <span>Must have <strong>{MIN_PLAYERS}-{MAX_PLAYERS} real players</strong> on your team</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-600 font-bold flex-shrink-0">•</span>
              <span>Strategic bidding can upgrade players to higher star ratings</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-600 font-bold flex-shrink-0">•</span>
              <span>Higher stars = higher per-match salaries, plan carefully</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-600 font-bold flex-shrink-0">•</span>
              <span>This is a planning tool - actual results may vary</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
