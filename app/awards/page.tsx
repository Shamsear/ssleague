'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import InstagramEmbed from '@/components/InstagramEmbed';
import { useResolvedTeamData } from '@/hooks/useResolveTeamNames';

interface Award {
  id: string;
  award_type: string;
  tournament_id: string;
  season_id: string;
  round_number?: number;
  week_number?: number;
  player_id?: string;
  player_name?: string;
  team_id?: string;
  team_name?: string;
  performance_stats: any;
  selected_at: string;
  selected_by_name?: string;
  notes?: string;
  instagram_link?: string;
  instagram_post_url?: string;
}

interface PlayerAward {
  id: string;
  season_id: string;
  player_id: string;
  player_name: string;
  player_category?: string; // Player position: 'Attacker', 'Midfielder', 'Defender', 'Goalkeeper'
  team_id?: string;
  team_name?: string;
  award_category: string; // 'individual' or 'category'
  award_type: string; // e.g., 'Golden Boot', 'Best Attacker'
  award_position?: string; // 'Winner', 'Runner Up', 'Third Place'
  created_at: string;
  instagram_link?: string;
  instagram_post_url?: string;
}

interface Trophy {
  id: string;
  season_id: string;
  team_id: string;
  team_name: string;
  trophy_type: string; // 'league', 'runner_up', 'cup'
  trophy_name: string;
  trophy_position?: string; // e.g., 'Champion', 'Runner-up'
  position?: number; // League position
  awarded_at: string;
  instagram_link?: string;
  instagram_post_url?: string;
}


export default function PublicAwardsPage() {
  const [awards, setAwards] = useState<Award[]>([]);
  const [playerAwards, setPlayerAwards] = useState<PlayerAward[]>([]);
  const [trophies, setTrophies] = useState<Trophy[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'awards' | 'trophies'>('awards');
  const [selectedSeason, setSelectedSeason] = useState<string>('all');
  
  // Resolve team names for player awards and trophies
  const displayPlayerAwards = useResolvedTeamData(playerAwards, 'team_id');
  const displayTrophies = useResolvedTeamData(trophies, 'team_id');

  // Fetch all data on mount
  useEffect(() => {
    async function fetchAllData() {
      setLoading(true);
      try {
        // Fetch all awards
        const [awardsResponse, playerAwardsResponse, trophiesResponse] = await Promise.all([
          fetch('/api/awards'),
          fetch('/api/player-awards'),
          fetch('/api/trophies')
        ]);

        const [awardsData, playerAwardsData, trophiesData] = await Promise.all([
          awardsResponse.json(),
          playerAwardsResponse.json(),
          trophiesResponse.json()
        ]);
        
        if (awardsData.success) {
          setAwards(awardsData.data || []);
        }

        if (playerAwardsData.success) {
          setPlayerAwards(playerAwardsData.awards || []);
        }

        if (trophiesData.success) {
          setTrophies(trophiesData.trophies || []);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchAllData();
  }, []);

  const getAwardIcon = (type: string) => {
    switch (type) {
      case 'POTD':
      case 'POTW':
      case 'POTS':
        return '⭐';
      case 'TOD':
      case 'TOW':
      case 'TOTS':
        return '🏆';
      default:
        return '🎖️';
    }
  };


  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Group awards by type for hall of fame
  const hallOfFame = Array.isArray(awards) ? awards.reduce((acc, award) => {
    const key = award.award_type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(award);
    return acc;
  }, {} as Record<string, Award[]>) : {};

  // Extract unique seasons from all data
  const getUniqueSeasons = () => {
    const safeAwards = Array.isArray(awards) ? awards : [];
    const safePlayerAwards = Array.isArray(displayPlayerAwards) ? displayPlayerAwards : [];
    const safeTrophies = Array.isArray(displayTrophies) ? displayTrophies : [];
    
    const allSeasons = new Set<string>();
    [...safeAwards, ...safePlayerAwards, ...safeTrophies].forEach(item => {
      if (item.season_id) allSeasons.add(item.season_id);
    });
    
    return Array.from(allSeasons).sort();
  };

  // Get filtered data based on active tab and selected season
  const getFilteredData = () => {
    const safeAwards = Array.isArray(awards) ? awards : [];
    const safePlayerAwards = Array.isArray(displayPlayerAwards) ? displayPlayerAwards : [];
    const safeTrophies = Array.isArray(displayTrophies) ? displayTrophies : [];
    
    // Apply season filter
    const filterBySeason = (items: any[]) => {
      if (selectedSeason === 'all') return items;
      return items.filter(item => item.season_id === selectedSeason);
    };
    
    // Combine awards and player awards as they're both award types
    const allAwards = [...filterBySeason(safeAwards), ...filterBySeason(safePlayerAwards)];

    switch (activeTab) {
      case 'awards':
        return { items: allAwards, type: 'awards' };
      case 'trophies':
        return { items: filterBySeason(safeTrophies), type: 'trophies' };
      default:
        return { items: allAwards, type: 'awards' };
    }
  };

  const uniqueSeasons = getUniqueSeasons();

  const filteredData = getFilteredData();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 py-4 sm:py-8 px-3 sm:px-4 lg:px-6">
      <div className="container mx-auto max-w-[1600px]">
        {/* Header */}
        <header className="mb-6 sm:mb-8 text-center lg:text-left">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 bg-clip-text text-transparent mb-2 sm:mb-3 leading-tight">
            🏆 Awards Hall of Fame
          </h1>
          <p className="text-gray-600 text-sm sm:text-base lg:text-lg max-w-3xl mx-auto lg:mx-0">
            Celebrating excellence in performance - Players and Teams of distinction
          </p>
          {/* Quick Stats Bar */}
          <div className="mt-4 sm:mt-6 flex flex-wrap gap-2 sm:gap-3 justify-center lg:justify-start">
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-white/80 backdrop-blur-sm rounded-full border border-gray-200 shadow-sm">
              <span className="text-lg sm:text-xl">⭐</span>
              <span className="text-xs sm:text-sm font-semibold text-gray-900">{(Array.isArray(awards) ? awards.length : 0) + (Array.isArray(displayPlayerAwards) ? displayPlayerAwards.length : 0)} Awards</span>
            </div>
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-white/80 backdrop-blur-sm rounded-full border border-gray-200 shadow-sm">
              <span className="text-lg sm:text-xl">🏆</span>
              <span className="text-xs sm:text-sm font-semibold text-gray-900">{Array.isArray(displayTrophies) ? displayTrophies.length : 0} Trophies</span>
            </div>
          </div>
        </header>

        {/* Season Filter - Prominent */}
        {uniqueSeasons.length > 0 && (
          <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-xl sm:rounded-2xl p-[2px] mb-4 sm:mb-6 shadow-xl">
            <div className="bg-white/95 backdrop-blur-xl rounded-[10px] sm:rounded-[14px] p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-gray-900">Filter by Season</h3>
                    <p className="text-xs sm:text-sm text-gray-600">View awards from specific seasons</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <select
                    id="season-filter"
                    value={selectedSeason}
                    onChange={(e) => setSelectedSeason(e.target.value)}
                    className="flex-1 sm:flex-initial min-w-[200px] px-4 sm:px-6 py-3 sm:py-3.5 rounded-xl text-sm sm:text-base font-bold bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 text-gray-900 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all cursor-pointer hover:border-blue-400 hover:shadow-lg appearance-none bg-no-repeat bg-right pr-10" 
                    style={{ backgroundImage: "url('data:image/svg+xml;charset=UTF-8,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27currentColor%27 stroke-width=%272%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3e%3cpolyline points=%276 9 12 15 18 9%27%3e%3c/polyline%3e%3c/svg%3e')", backgroundSize: "1.5em 1.5em", backgroundPosition: "right 0.5rem center" }}
                  >
                    <option value="all">🌟 All Seasons</option>
                    {uniqueSeasons.map((season) => (
                      <option key={season} value={season}>
                        📅 {season}
                      </option>
                    ))}
                  </select>
                  {selectedSeason !== 'all' && (
                    <button
                      onClick={() => setSelectedSeason('all')}
                      className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm transition-all flex items-center gap-1.5 whitespace-nowrap"
                      title="Clear filter"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span className="hidden sm:inline">Clear</span>
                    </button>
                  )}
                </div>
              </div>
              {selectedSeason !== 'all' && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
                    <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <span className="font-medium">Showing {filteredData.items.length} {activeTab === 'awards' ? 'awards' : 'trophies'} from season <span className="font-bold text-gray-900">{selectedSeason}</span></span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tabs - Mobile Optimized */}
        <div className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-xl sm:rounded-2xl p-2 sm:p-3 shadow-lg mb-4 sm:mb-6 sticky top-2 sm:top-4 z-10">
          <div className="flex gap-1.5 sm:gap-2">
            <button
              onClick={() => setActiveTab('awards')}
              className={`flex-1 sm:flex-initial sm:px-8 lg:px-10 py-2.5 sm:py-3 rounded-lg text-sm sm:text-base lg:text-lg font-bold transition-all whitespace-nowrap ${
                activeTab === 'awards'
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md scale-105'
                  : 'bg-white/60 text-gray-700 hover:bg-white hover:shadow-sm'
              }`}
              suppressHydrationWarning
            >
              ⭐ Awards ({(Array.isArray(awards) ? awards.length : 0) + (Array.isArray(playerAwards) ? playerAwards.length : 0)})
            </button>
            <button
              onClick={() => setActiveTab('trophies')}
              className={`flex-1 sm:flex-initial sm:px-8 lg:px-10 py-2.5 sm:py-3 rounded-lg text-sm sm:text-base lg:text-lg font-bold transition-all whitespace-nowrap ${
                activeTab === 'trophies'
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md scale-105'
                  : 'bg-white/60 text-gray-700 hover:bg-white hover:shadow-sm'
              }`}
              suppressHydrationWarning
            >
              🏆 Trophies ({Array.isArray(trophies) ? trophies.length : 0})
            </button>
          </div>
        </div>


        {/* Loading State - Skeleton */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white/70 backdrop-blur-xl border border-white/40 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-lg animate-pulse">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-200 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-4 sm:h-5 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
                <div className="bg-gray-100 rounded-xl p-4 mb-4">
                  <div className="h-6 sm:h-7 bg-gray-200 rounded w-2/3 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
                <div className="h-3 bg-gray-200 rounded w-1/3"></div>
              </div>
            ))}
          </div>
        )}

        {/* Content Grid - Responsive */}
        {!loading && filteredData.items.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5 mb-8 sm:mb-12">
            {/* Team Awards (from awards table) */}
            {activeTab === 'awards' && Array.isArray(awards) && awards.map((award) => {
              const Wrapper = award.instagram_post_url ? 'a' : 'div';
              return (
              <Wrapper
                {...(award.instagram_post_url ? { href: award.instagram_post_url, target: '_blank', rel: 'noopener noreferrer' } : {})}
                key={award.id}
                className="group bg-white/70 backdrop-blur-xl border-2 border-white/40 rounded-xl sm:rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 hover:border-yellow-300"
              >
                {/* Instagram Image - Top */}
                {award.instagram_link && (
                  <div className="relative w-full overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200">
                    <InstagramEmbed 
                      postUrl={award.instagram_link} 
                      instagramPostUrl={award.instagram_post_url ? '' : undefined}
                      className="" 
                    />
                  </div>
                )}

                {/* Card Content */}
                <div key={`award-content-${award.id}`} className="p-4 sm:p-6">
                  {/* Award Header */}
                  <div className="flex items-start gap-2 sm:gap-3 mb-3 sm:mb-4">
                  <div className="text-3xl sm:text-4xl flex-shrink-0">{getAwardIcon(award.award_type)}</div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 text-sm sm:text-base lg:text-lg leading-tight mb-1 truncate">
                      {award.award_type}
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {award.round_number && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 text-[10px] sm:text-xs font-medium">
                          Round {award.round_number}
                        </span>
                      )}
                      {award.week_number && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 text-[10px] sm:text-xs font-medium">
                          Week {award.week_number}
                        </span>
                      )}
                      {!award.round_number && !award.week_number && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-green-100 text-green-700 text-[10px] sm:text-xs font-medium">
                          Season Award
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Winner Info */}
                <div className="bg-gradient-to-br from-yellow-50 via-orange-50 to-amber-50 border border-yellow-200/50 rounded-lg sm:rounded-xl p-3 sm:p-4 mb-3 sm:mb-4 group-hover:shadow-md transition-shadow">
                  <div className="font-bold text-lg sm:text-xl lg:text-2xl text-gray-900 mb-1 break-words">
                    {award.player_name || award.team_name}
                  </div>
                  {award.team_name && award.player_name && (
                    <div className="text-xs sm:text-sm text-gray-600 font-medium">{award.team_name}</div>
                  )}
                </div>

                {/* Performance Stats */}
                {award.performance_stats && (
                  <div className="space-y-1.5 sm:space-y-2 mb-3 sm:mb-4 bg-gray-50/50 rounded-lg p-2.5 sm:p-3">
                    <div className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Performance</div>
                    {Object.entries(
                      typeof award.performance_stats === 'string'
                        ? JSON.parse(award.performance_stats)
                        : award.performance_stats
                    ).map(([key, value]) => (
                      <div key={key} className="flex justify-between items-center text-xs sm:text-sm">
                        <span className="text-gray-600 capitalize font-medium">
                          {key.replace(/_/g, ' ')}
                        </span>
                        <span className="font-bold text-gray-900 bg-white px-2 py-0.5 rounded">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Bottom Info */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-gray-500 pt-2 border-t border-gray-200">
                    <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {formatDate(award.selected_at)}
                  </div>
                  <div className="text-[10px] sm:text-xs text-gray-500">
                    <span className="font-medium">Season:</span> {award.season_id}
                  </div>
                </div>

                  {/* Notes */}
                  {award.notes && (
                    <div className="mt-3 p-2.5 sm:p-3 bg-blue-50/50 border-l-2 border-blue-400 rounded text-[10px] sm:text-xs text-gray-700">
                      <span className="font-semibold">Note:</span> {award.notes}
                    </div>
                  )}
                </div>
              </Wrapper>
              );})}

            {/* Player Awards (from player_awards table) */}
            {activeTab === 'awards' && Array.isArray(playerAwards) && playerAwards.map((award) => {
              // Determine award position styling
              const isWinner = award.award_position?.toLowerCase().includes('winner');
              const isRunnerUp = award.award_position?.toLowerCase().includes('runner');
              const isThird = award.award_position?.toLowerCase().includes('third');
              const Wrapper = award.instagram_post_url ? 'a' : 'div';
              
              return (
              <Wrapper
                {...(award.instagram_post_url ? { href: award.instagram_post_url, target: '_blank', rel: 'noopener noreferrer' } : {})}
                key={`player-${award.id}`}
                className={`group bg-white/70 backdrop-blur-xl border-2 rounded-xl sm:rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 ${
                  isWinner ? 'border-yellow-400 hover:border-yellow-500 bg-gradient-to-br from-yellow-50/30 to-white/70' :
                  isRunnerUp ? 'border-gray-300 hover:border-gray-400 bg-gradient-to-br from-gray-50/30 to-white/70' :
                  isThird ? 'border-orange-300 hover:border-orange-400 bg-gradient-to-br from-orange-50/30 to-white/70' :
                  'border-white/40 hover:border-blue-300'
                }`}
              >
                {/* Instagram Image - Top */}
                {award.instagram_link && (
                  <div key={`player-instagram-${award.id}`} className="relative w-full overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200">
                    <InstagramEmbed 
                      postUrl={award.instagram_link} 
                      instagramPostUrl={award.instagram_post_url ? '' : undefined}
                      className="" 
                    />
                  </div>
                )}

                {/* Card Content */}
                <div key={`player-award-content-${award.id}`} className="p-4 sm:p-6">
                  {/* Award Header */}
                  <div className="flex items-start gap-2 sm:gap-3 mb-3 sm:mb-4">
                  <div className="relative">
                    <div className="text-3xl sm:text-4xl flex-shrink-0">⭐</div>
                    {isWinner && <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-pulse"></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 text-sm sm:text-base lg:text-lg leading-tight mb-1">
                      {award.award_type}
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-medium ${
                        award.award_category === 'individual' 
                          ? 'bg-purple-100 text-purple-700' 
                          : 'bg-indigo-100 text-indigo-700'
                      }`}>
                        {award.award_category === 'individual' ? 'Individual' : 'Category'}
                      </span>
                      {award.award_position && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-bold ${
                          isWinner ? 'bg-yellow-100 text-yellow-800' :
                          isRunnerUp ? 'bg-gray-200 text-gray-700' :
                          isThird ? 'bg-orange-100 text-orange-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {award.award_position}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Player Info */}
                <div className={`border rounded-lg sm:rounded-xl p-3 sm:p-4 mb-3 sm:mb-4 group-hover:shadow-md transition-shadow ${
                  isWinner ? 'bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50 border-yellow-200/50' :
                  isRunnerUp ? 'bg-gradient-to-br from-gray-50 via-slate-50 to-gray-50 border-gray-200/50' :
                  isThird ? 'bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 border-orange-200/50' :
                  'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200/50'
                }`}>
                  <div className="font-bold text-lg sm:text-xl lg:text-2xl text-gray-900 mb-1 break-words">
                    {award.player_name}
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    {award.team_name && (
                      <div className="text-xs sm:text-sm text-gray-600 font-medium">
                        {award.team_name}
                      </div>
                    )}
                    {award.player_category && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-white/60 text-[10px] sm:text-xs text-blue-700 font-semibold">
                        {award.player_category}
                      </span>
                    )}
                  </div>
                </div>

                  {/* Bottom Info */}
                  <div className="space-y-1.5 pt-2 border-t border-gray-200">
                    <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-gray-500">
                      <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="font-medium">Season:</span> {award.season_id}
                    </div>
                  </div>
                </div>
              </Wrapper>
              );
            })}

            {/* Trophies */}
            {activeTab === 'trophies' && Array.isArray(trophies) && trophies.map((trophy) => {
              // Only show gold for actual champions (1st place)
              const isChampion = trophy.position === 1 || trophy.trophy_position?.toLowerCase().includes('champion') || trophy.trophy_position?.toLowerCase().includes('1st');
              const isRunnerUp = trophy.position === 2 || trophy.trophy_position?.toLowerCase().includes('runner') || trophy.trophy_position?.toLowerCase().includes('2nd');
              const isThird = trophy.position === 3 || trophy.trophy_position?.toLowerCase().includes('third') || trophy.trophy_position?.toLowerCase().includes('3rd');
              const Wrapper = trophy.instagram_post_url ? 'a' : 'div';
              
              return (
              <Wrapper
                {...(trophy.instagram_post_url ? { href: trophy.instagram_post_url, target: '_blank', rel: 'noopener noreferrer' } : {})}
                key={`trophy-${trophy.id}`}
                className={`group bg-white/70 backdrop-blur-xl border-2 rounded-xl sm:rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 ${
                  isChampion ? 'border-yellow-400 hover:border-yellow-500 bg-gradient-to-br from-yellow-50/40 to-white/70' :
                  isRunnerUp ? 'border-gray-300 hover:border-gray-400 bg-gradient-to-br from-gray-50/40 to-white/70' :
                  isThird ? 'border-orange-300 hover:border-orange-400 bg-gradient-to-br from-orange-50/30 to-white/70' :
                  'border-blue-300 hover:border-blue-400'
                }`}
              >
                {/* Instagram Image - Top */}
                {trophy.instagram_link && (
                  <div key={`trophy-img-${trophy.id}`} className="relative w-full overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200">
                    <InstagramEmbed 
                      postUrl={trophy.instagram_link} 
                      instagramPostUrl={trophy.instagram_post_url ? '' : undefined}
                      className="" 
                    />
                  </div>
                )}

                {/* Card Content */}
                <div key={`trophy-content-${trophy.id}`} className="p-4 sm:p-6">
                  {/* Trophy Header */}
                  <div className="flex items-start gap-2 sm:gap-3 mb-3 sm:mb-4">
                  <div className="relative">
                    <div className="text-3xl sm:text-4xl flex-shrink-0">🏆</div>
                    {isChampion && <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-pulse"></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 text-sm sm:text-base lg:text-lg leading-tight mb-1">
                      {trophy.trophy_name}
                    </h3>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-medium capitalize ${
                      trophy.trophy_type === 'league' ? 'bg-yellow-100 text-yellow-800' :
                      trophy.trophy_type === 'runner_up' ? 'bg-gray-200 text-gray-700' :
                      trophy.trophy_type === 'cup' ? 'bg-orange-100 text-orange-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {trophy.trophy_type.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                {/* Team Info */}
                <div className={`border rounded-lg sm:rounded-xl p-3 sm:p-4 mb-3 sm:mb-4 group-hover:shadow-md transition-shadow ${
                  isChampion ? 'bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50 border-yellow-200/60' :
                  isRunnerUp ? 'bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100 border-gray-200/60' :
                  isThird ? 'bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 border-orange-200/60' :
                  'bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-50 border-blue-200/60'
                }`}>
                  <div className="font-bold text-lg sm:text-xl lg:text-2xl text-gray-900 mb-2 break-words">
                    {trophy.team_name}
                  </div>
                  <div className="space-y-1.5">
                    {trophy.trophy_position && (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/70 border border-orange-200">
                        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <span className="text-xs sm:text-sm font-bold text-orange-700">
                          {trophy.trophy_position}
                        </span>
                      </div>
                    )}
                    {trophy.position && (
                      <div className="text-xs sm:text-sm text-gray-600 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <span className="font-semibold">League Position: #{trophy.position}</span>
                      </div>
                    )}
                  </div>
                </div>

                  {/* Bottom Info */}
                  <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-gray-500 pt-2 border-t border-gray-200">
                    <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-medium">Season:</span> {trophy.season_id}
                  </div>
                </div>
              </Wrapper>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredData.items.length === 0 && (
          <div className="bg-white/70 backdrop-blur-xl border-2 border-white/40 rounded-xl sm:rounded-2xl p-8 sm:p-12 text-center shadow-lg">
            <div className="text-5xl sm:text-6xl mb-4 animate-bounce">🏆</div>
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">No Awards Yet</h3>
            <p className="text-sm sm:text-base text-gray-600 max-w-md mx-auto">
              Awards will appear here once they are selected. Check back later!
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
