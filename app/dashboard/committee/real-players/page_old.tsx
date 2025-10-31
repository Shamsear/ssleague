'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { getSeasonById } from '@/lib/firebase/seasons';
import { Season } from '@/types/season';
import { useCachedTeams } from '@/hooks/useCachedData';
import { calculateRealPlayerSalary } from '@/lib/contracts';
import Link from 'next/link';

interface RealPlayer {
  id: string;
  playerName: string;
  teamId: string;
  auctionValue: number;
  starRating: number; // Read-only, set in Player Ratings page
  categoryName?: string; // Read-only, set in Player Ratings page
  salaryPerMatch: number;
  contractStartSeason: string;
  contractEndSeason: string;
}

export default function RealPlayersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { isCommitteeAdmin, userSeasonId } = usePermissions();
  const [currentSeason, setCurrentSeason] = useState<Season | null>(null);
  
  const { data: cachedTeams, isLoading: teamsLoading } = useCachedTeams();
  const [teamSeasons, setTeamSeasons] = useState<any[]>([]);
  const [loadingTeamSeasons, setLoadingTeamSeasons] = useState(true);
  
  const [players, setPlayers] = useState<RealPlayer[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && !isCommitteeAdmin) {
      router.push('/dashboard');
    }
  }, [user, loading, router, isCommitteeAdmin]);

  useEffect(() => {
    const fetchData = async () => {
      if (!userSeasonId) return;

      try {
        // Fetch season
        const season = await getSeasonById(userSeasonId);
        setCurrentSeason(season);
        
        // Fetch team_seasons to get budget data
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase/config');
        
        const teamSeasonsQuery = query(
          collection(db, 'team_seasons'),
          where('season_id', '==', userSeasonId),
          where('status', '==', 'registered')
        );
        
        const teamSeasonsSnapshot = await getDocs(teamSeasonsQuery);
        const teamSeasonsData = teamSeasonsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setTeamSeasons(teamSeasonsData);
        console.log(`Loaded ${teamSeasonsData.length} team seasons with budget data`);
      } catch (error) {
        console.error('Error fetching season:', error);
      } finally {
        setLoadingTeamSeasons(false);
      }
    };

    if (isCommitteeAdmin && userSeasonId) {
      fetchData();
    }
  }, [isCommitteeAdmin, userSeasonId]);

  // Load existing real players from season registrations
  useEffect(() => {
    const loadPlayers = async () => {
      if (!userSeasonId || !currentSeason) return;
      
      try {
        // Check if it's a modern season (16+) or historical
        const seasonNum = parseInt(userSeasonId.replace(/\D/g, '')) || 0;
        const isModernSeason = seasonNum >= 16;
        
        if (isModernSeason) {
          // For Season 16+: Fetch from Neon via API (player_seasons table)
          const response = await fetch(`/api/stats/players?seasonId=${userSeasonId}&limit=1000`);
          const result = await response.json();
          
          if (result.success && result.data && result.data.length > 0) {
            // Show all players who have star ratings and categories assigned
            // (star ratings are set in Player Ratings page)
            const realPlayersData = result.data.filter((p: any) => p.star_rating && p.star_rating > 0);
            
            const loadedPlayers: RealPlayer[] = realPlayersData.map((data: any) => {
              const auctionValue = data.auction_value || 100;
              const starRating = data.star_rating || 0;
              
              return {
                id: data.player_id || data.id,
                playerName: data.player_name || '',
                teamId: data.team_id || '',
                auctionValue: auctionValue,
                starRating: starRating,
                categoryName: data.category || '',
                salaryPerMatch: calculateRealPlayerSalary(auctionValue, starRating),
                contractStartSeason: data.contract_start_season || userSeasonId,
                contractEndSeason: data.contract_end_season || '',
              };
            });
            
            setPlayers(loadedPlayers);
            console.log(`Loaded ${loadedPlayers.length} real players from Neon (Season 16+)`);
          } else {
            console.log('No players found for this season in Neon');
            setPlayers([]);
          }
        } else {
          // For historical seasons (1-15): Use Firebase
          const { collection, query, where, getDocs } = await import('firebase/firestore');
          const { db } = await import('@/lib/firebase/config');
          
          const playersQuery = query(
            collection(db, 'realplayer'),
            where('season_id', '==', userSeasonId)
          );
          
          const playersSnapshot = await getDocs(playersQuery);
          
          if (playersSnapshot.empty) {
            console.log('No real players registered for this season');
            setPlayers([]);
            return;
          }
          
          const loadedPlayers: RealPlayer[] = playersSnapshot.docs.map(doc => {
            const data = doc.data();
            const auctionValue = data.auction_value || 100;
            const starRating = data.star_rating || 0;
            
            return {
              id: doc.id,
              playerName: data.player_name || data.name || '',
              teamId: data.team_id || '',
              auctionValue: auctionValue,
              starRating: starRating,
              categoryName: data.category_name || '',
              salaryPerMatch: data.salary_per_match || calculateRealPlayerSalary(auctionValue, starRating),
              contractStartSeason: data.contract_start_season || currentSeason.name,
              contractEndSeason: data.contract_end_season || '',
            };
          });
          
          setPlayers(loadedPlayers);
          console.log(`Loaded ${loadedPlayers.length} real players from Firebase (Historical)`);
        }
      } catch (error) {
        console.error('Error loading players:', error);
        setError('Failed to load real players');
      }
    };

    loadPlayers();
  }, [userSeasonId, currentSeason]);

  // Calculate contract seasons (current + next)
  const getContractSeasons = () => {
    if (!userSeasonId) return { start: '', end: '' };
    
    // Extract number from season ID (e.g., SSPSLS16 -> 16)
    const seasonNum = parseInt(userSeasonId.replace(/\D/g, ''));
    const seasonPrefix = userSeasonId.replace(/\d+$/, '');
    const nextSeasonNum = seasonNum + 1;
    
    return {
      start: userSeasonId,  // Use season ID (e.g., SSPSLS16) not name (e.g., Season 16)
      end: `${seasonPrefix}${nextSeasonNum}`  // e.g., SSPSLS17
    };
  };

  const updatePlayer = (id: string, field: keyof RealPlayer, value: any) => {
    setPlayers(players.map(p => {
      if (p.id !== id) return p;
      
      const updated = { ...p, [field]: value };
      
      // Recalculate salary if auction value changes
      if (field === 'auctionValue') {
        updated.salaryPerMatch = calculateRealPlayerSalary(
          updated.auctionValue,
          updated.starRating
        );
      }
      
      return updated;
    }));
  };

  const removePlayer = (id: string) => {
    setPlayers(players.filter(p => p.id !== id));
  };

  const handleBulkSave = async () => {
    // Validate all players
    const invalidPlayers = players.filter(p => !p.playerName || !p.teamId);
    if (invalidPlayers.length > 0) {
      setError(`Please fill team for all players (${invalidPlayers.length} incomplete)`);
      return;
    }

    if (currentSeason?.type !== 'multi') {
      setError('This feature is only available for multi-season type');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);

      // Refresh auth token to prevent expiration issues
      const { auth } = await import('@/lib/firebase/config');
      const currentUser = auth.currentUser;
      if (currentUser) {
        try {
          const freshToken = await currentUser.getIdToken(true); // force refresh
          // Update cookie with fresh token
          await fetch('/api/auth/set-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: freshToken }),
          });
        } catch (tokenErr) {
          console.error('Token refresh failed:', tokenErr);
          setError('Session expired. Please refresh the page and try again.');
          setSubmitting(false);
          return;
        }
      }

      // Get contract seasons
      const { start: startSeason, end: endSeason } = getContractSeasons();
      
      if (!startSeason || !endSeason) {
        setError('Unable to determine contract seasons');
        setSubmitting(false);
        return;
      }

      // Call API to save all players for both seasons
      const response = await fetch('/api/contracts/assign-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seasonId: userSeasonId,
          startSeason: startSeason,
          endSeason: endSeason,
          players: players.map(p => ({
            id: p.id, // Document ID from realplayer collection
            teamId: p.teamId,
            playerName: p.playerName,
            auctionValue: p.auctionValue,
            salaryPerMatch: p.salaryPerMatch,
          })),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save players');
      }

      setSuccess(`Successfully assigned ${players.length} SS Members to teams!`);
      
      // Refresh the page or reload data
      setTimeout(() => {
        router.refresh();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to save players');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || teamsLoading || loadingTeamSeasons) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !isCommitteeAdmin) {
    return null;
  }

  if (currentSeason?.type !== 'multi') {
    return (
      <div className="min-h-screen py-8 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="glass rounded-3xl p-8 text-center">
            <p className="text-amber-600">This feature is only available for multi-season types (Season 16+)</p>
          </div>
        </div>
      </div>
    );
  }

  const filteredPlayers = players.filter(p => 
    p.playerName.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Calculate live balances for each team using team_seasons data
  const teamBalances = teamSeasons.map(teamSeason => {
    // Extract team_id from document ID (format: teamId_seasonId)
    const teamId = teamSeason.team_id || teamSeason.id.split('_')[0];
    const teamPlayers = players.filter(p => p.teamId === teamId);
    const totalCost = teamPlayers.reduce((sum, p) => sum + p.auctionValue, 0);
    const originalBudget = teamSeason.currency_system === 'dual' 
      ? (teamSeason.real_player_budget || 0)
      : (teamSeason.budget || 0);
    const remainingBudget = originalBudget - totalCost;
    
    return {
      id: teamId,
      name: teamSeason.team_name || teamSeason.team_code || 'Unknown Team',
      originalBudget,
      totalCost,
      remainingBudget,
      playerCount: teamPlayers.length,
      currencySystem: teamSeason.currency_system,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="min-h-screen py-4 sm:py-8 px-4">
      <div className="container mx-auto max-w-7xl">
        {/* Page Header */}
        <div className="glass rounded-3xl p-6 mb-8 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold gradient-text mb-2">Manage SS Members</h1>
              <p className="text-gray-600 text-sm md:text-base">
                Assign SS Members to teams and set auction values
              </p>
            </div>
            <button
              onClick={() => router.back()}
              className="px-4 py-2 text-sm glass rounded-xl hover:bg-white/90 transition-all"
            >
              Back
            </button>
          </div>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="glass rounded-2xl p-4 mb-6 bg-green-50 border border-green-200">
            <p className="text-green-800 text-sm">{success}</p>
          </div>
        )}
        {error && (
          <div className="glass rounded-2xl p-4 mb-6 bg-red-50 border border-red-200">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Actions Bar */}
        <div className="glass rounded-2xl p-4 mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <div className="text-sm font-medium text-gray-700">
                {players.length} SS Member{players.length !== 1 ? 's' : ''} registered
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full sm:w-auto">
            <input
              type="text"
              placeholder="Search players..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent flex-1 sm:w-64"
            />
            
            <button
              onClick={handleBulkSave}
              disabled={submitting || players.length === 0}
              className="px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {submitting ? 'Saving...' : 'Save All'}
            </button>
          </div>
        </div>

        {/* Live Team Balance Tracker */}
        <div className="glass rounded-2xl overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 px-6 py-4 border-b border-purple-200">
            <h3 className="text-lg font-bold text-purple-900 flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Live Team Balances
            </h3>
            <p className="text-sm text-purple-700 mt-1">Real-time budget tracking as you assign players</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Team</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Original Budget</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Players</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Total Cost</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Remaining</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {teamBalances.map(balance => {
                  const currencySymbol = balance.currencySystem === 'dual' ? '$' : '£';
                  const isOverBudget = balance.remainingBudget < 0;
                  const isLowBudget = balance.remainingBudget < balance.originalBudget * 0.1 && balance.remainingBudget >= 0;
                  
                  return (
                    <tr key={balance.id} className={`hover:bg-gray-50 transition-colors ${
                      isOverBudget ? 'bg-red-50' : isLowBudget ? 'bg-yellow-50' : ''
                    }`}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{balance.name}</div>
                        {balance.currencySystem === 'dual' && (
                          <div className="text-xs text-gray-500">Dual Currency</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-600">
                        {currencySymbol}{balance.originalBudget.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-800 text-sm font-semibold">
                          {balance.playerCount}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-semibold text-orange-600">
                          {currencySymbol}{balance.totalCost.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-base font-bold ${
                          isOverBudget ? 'text-red-600' : 
                          isLowBudget ? 'text-yellow-600' : 
                          'text-green-600'
                        }`}>
                          {currencySymbol}{balance.remainingBudget.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isOverBudget ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                            Over Budget
                          </span>
                        ) : isLowBudget ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            Low Budget
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Good
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Players Table */}
        <div className="glass rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Player Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Star Rating</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Team</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Auction Value</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Salary/Match</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredPlayers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                      <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <p className="font-medium text-gray-800 mb-2">No SS Members Found</p>
                      <p className="text-sm text-gray-600">
                        Please assign star ratings and categories first in the{' '}
                        <Link href="/dashboard/committee/player-ratings" className="text-blue-600 underline font-semibold hover:text-blue-700">
                          Player Ratings
                        </Link>
                        {' '}page
                      </p>
                      <p className="text-xs text-gray-500 mt-2">Only players with assigned star ratings will appear here</p>
                    </td>
                  </tr>
                ) : (
                  filteredPlayers.map((player, index) => (
                    <tr key={player.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-600">{index + 1}</td>
                      
                      {/* Player Name */}
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">
                          {player.playerName || <span className="text-gray-400 italic">No name</span>}
                        </div>
                      </td>
                      
                      {/* Category (Read-only) */}
                      <td className="px-4 py-3">
                        {player.categoryName ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            {player.categoryName}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Not set</span>
                        )}
                      </td>
                      
                      {/* Star Rating (Read-only) */}
                      <td className="px-4 py-3">
                        {player.starRating > 0 ? (
                          <span className="text-sm font-medium text-amber-600">{player.starRating} ⭐</span>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Not assigned</span>
                        )}
                      </td>
                      
                      {/* Team */}
                      <td className="px-4 py-3">
                        <select
                          value={player.teamId}
                          onChange={(e) => updatePlayer(player.id, 'teamId', e.target.value)}
                          className="w-full px-2 py-1 rounded border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        >
                          <option value="">Select team</option>
                          {teamSeasons.map(teamSeason => {
                            // Extract team_id from document ID
                            const teamId = teamSeason.team_id || teamSeason.id.split('_')[0];
                            const teamName = teamSeason.team_name || teamSeason.team_code || 'Unknown';
                            
                            // Display balance based on currency system
                            const balanceDisplay = teamSeason.currency_system === 'dual'
                              ? `$${(teamSeason.real_player_budget || 0).toLocaleString()}`
                              : `£${(teamSeason.budget || 0).toLocaleString()}`;
                            
                            return (
                              <option key={teamSeason.id} value={teamId}>
                                {teamName} ({balanceDisplay})
                              </option>
                            );
                          })}
                        </select>
                      </td>
                      
                      {/* Auction Value */}
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={player.auctionValue}
                          onChange={(e) => updatePlayer(player.id, 'auctionValue', parseInt(e.target.value) || 0)}
                          min="100"
                          step="10"
                          className="w-24 px-2 py-1 rounded border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </td>
                      
                      {/* Salary */}
                      <td className="px-4 py-3">
                        <span className="text-sm font-semibold text-green-600">
                          ${player.salaryPerMatch.toFixed(2)}
                        </span>
                      </td>
                      
                      {/* Actions */}
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => removePlayer(player.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Remove player"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Contract Info Banner */}
        <div className="glass rounded-2xl p-5 mb-6 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200">
          <div className="flex items-center justify-center gap-8">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-100 p-3 rounded-full">
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-indigo-600 font-medium">2-Season Contract</p>
                <p className="text-2xl font-bold text-indigo-900">
                  {getContractSeasons().start} → {getContractSeasons().end}
                </p>
              </div>
            </div>
            <div className="h-12 w-px bg-indigo-300"></div>
            <div className="text-center">
              <p className="text-xs text-indigo-600 mb-1">All assignments will update</p>
              <p className="text-sm font-semibold text-indigo-900">Both Season Registrations</p>
            </div>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {/* Salary Formula */}
          <div className="glass rounded-2xl p-5 bg-gradient-to-br from-blue-50 to-indigo-50">
            <h3 className="font-semibold text-blue-900 mb-3">💰 Salary Calculation</h3>
            <div className="text-sm text-blue-800 space-y-2">
              <p className="font-mono bg-white/50 px-3 py-2 rounded">
                (Value ÷ 100) × Stars ÷ 10 = Salary/Match
              </p>
              <p className="text-xs">Example: $300 value, 10☆ → (300÷100)×10÷10 = $3.00 per match</p>
            </div>
          </div>

          {/* Quick Info */}
          <div className="glass rounded-2xl p-5 bg-gradient-to-br from-amber-50 to-orange-50">
            <h3 className="font-semibold text-amber-900 mb-3">📝 Quick Info</h3>
            <div className="text-sm text-amber-800 space-y-2">
              <p>• Min auction value: $100 (increment: +$10)</p>
              <p>• Contract: Automatic 2 seasons</p>
              <div className="mt-3 pt-3 border-t border-amber-200">
                <p className="text-xs font-semibold mb-1">⚠️ Before using this page:</p>
                <p className="text-xs text-amber-700 ml-2">
                  Set star ratings & categories in <Link href="/dashboard/committee/player-ratings" className="underline font-semibold">Player Ratings</Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
