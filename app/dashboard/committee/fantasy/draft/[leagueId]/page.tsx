'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useModal } from '@/hooks/useModal';
import AlertModal from '@/components/modals/AlertModal';
import { useWebSocket } from '@/hooks/useWebSocket';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface FantasyTeam {
  id: string;
  team_name: string;
  owner_name: string;
  player_count: number;
  draft_submitted: boolean;
}

interface DraftedPlayer {
  draft_id: string;
  real_player_id: string;
  player_name: string;
  star_rating: number;
  draft_price: number;
  total_points: number;
  matches_played: number;
}

interface TierResult {
  tier_id: string;
  tier_number: number;
  tier_name: string;
  player_count: number;
  min_points: number;
  max_points: number;
  avg_points: number;
  total_bids: number;
  won_bids: number;
  lost_bids: number;
  skipped_bids: number;
  results: Array<{
    bid_id: string;
    player_name: string;
    real_player_id: string;
    winning_team: string;
    team_id: string;
    owner_name: string;
    bid_amount: number;
    submitted_at: Date;
    processed_at: Date;
  }>;
  lost_bids: Array<{
    bid_id: string;
    player_name: string;
    team_name: string;
    team_id: string;
    bid_amount: number;
  }>;
  skipped_teams: Array<{
    team_name: string;
    team_id: string;
  }>;
}

export default function DraftResultsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const leagueId = params?.leagueId as string;

  const [league, setLeague] = useState<any>(null);
  const [fantasyTeams, setFantasyTeams] = useState<FantasyTeam[]>([]);
  const [teamPlayers, setTeamPlayers] = useState<Record<string, DraftedPlayer[]>>({});
  const [teamDetails, setTeamDetails] = useState<Record<string, any>>({});
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [starPricing, setStarPricing] = useState<Record<number, number>>({});
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<'by-team' | 'by-tier'>('by-tier');
  const [tierResults, setTierResults] = useState<TierResult[]>([]);
  const [selectedTier, setSelectedTier] = useState<number | null>(null);

  const { alertState, showAlert, closeAlert } = useModal();

  // Firebase Realtime Database listener for live updates
  const { isConnected } = useWebSocket({
    channel: `fantasy/leagues/${leagueId}`,
    enabled: !!leagueId && !!user,
    onMessage: useCallback((message: any) => {
      console.log('[Draft Results] Firebase update:', message);
      
      // Reload data when draft updates occur
      if (message.type === 'draft_update' || 
          message.type === 'team_update' ||
          message.type === 'player_drafted' ||
          message.type === 'draft_submitted') {
        loadData();
      }
    }, []),
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }
    if (!loading && user && user.role !== 'committee_admin' && user.role !== 'super_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const loadData = useCallback(async () => {
      if (!leagueId) return;

      try {
        // Get league details and teams
        const leagueResponse = await fetchWithTokenRefresh(`/api/fantasy/leagues/${leagueId}`);
        if (!leagueResponse.ok) throw new Error('League not found');
        
        const leagueData = await leagueResponse.json();
        setLeague(leagueData.league);
        setFantasyTeams(leagueData.teams);

        // Get tier-by-tier results
        const tierResultsResponse = await fetchWithTokenRefresh(`/api/fantasy/draft/tier-results?league_id=${leagueId}`);
        if (tierResultsResponse.ok) {
          const tierData = await tierResultsResponse.json();
          setTierResults(tierData.tiers || []);
          if (tierData.tiers && tierData.tiers.length > 0 && selectedTier === null) {
            setSelectedTier(tierData.tiers[0].tier_number);
          }
        }

        // Get star rating pricing
        const pricingResponse = await fetchWithTokenRefresh(`/api/fantasy/pricing/${leagueId}`);
        if (pricingResponse.ok) {
          const pricingData = await pricingResponse.json();
          const priceMap: Record<number, number> = {};
          pricingData.pricing.forEach((p: any) => {
            priceMap[p.stars] = p.price;
          });
          setStarPricing(priceMap);
        }

        // Get drafted players for all teams
        const draftedResponse = await fetchWithTokenRefresh(`/api/fantasy/players/drafted?league_id=${leagueId}`);
        if (draftedResponse.ok) {
          const draftedData = await draftedResponse.json();
          const playersByTeam: Record<string, DraftedPlayer[]> = {};
          
          draftedData.drafted_players.forEach((player: any) => {
            if (!playersByTeam[player.fantasy_team_id]) {
              playersByTeam[player.fantasy_team_id] = [];
            }
            playersByTeam[player.fantasy_team_id].push(player);
          });
          
          setTeamPlayers(playersByTeam);
          
          // Get team details (passive team, captain, VC) for all teams
          const detailsMap: Record<string, any> = {};
          await Promise.all(
            leagueData.teams.map(async (team: any) => {
              try {
                const detailsResponse = await fetchWithTokenRefresh(`/api/fantasy/teams/${team.id}`);
                if (detailsResponse.ok) {
                  const details = await detailsResponse.json();
                  detailsMap[team.id] = details;
                }
              } catch (err) {
                console.error(`Failed to load details for team ${team.id}`);
              }
            })
          );
          setTeamDetails(detailsMap);
          
          // Auto-select first team if not already selected
          if (!selectedTeam && leagueData.teams.length > 0) {
            setSelectedTeam(leagueData.teams[0].id);
          }
        }
        
        setLastUpdated(new Date());
      } catch (error) {
        console.error('Error loading data:', error);
        showAlert({
          type: 'error',
          title: 'Error',
          message: 'Failed to load fantasy league data',
        });
      } finally {
        setIsLoading(false);
      }
    }, [leagueId, selectedTeam, selectedTier]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, loadData]);

  const currentTeamPlayers = teamPlayers[selectedTeam] || [];
  const selectedTeamData = fantasyTeams.find(t => t.id === selectedTeam);
  const currentTeamDetails = teamDetails[selectedTeam];
  
  const totalSpent = currentTeamPlayers.reduce((sum, p) => sum + (p.draft_price || 0), 0);
  const totalPoints = currentTeamPlayers.reduce((sum, p) => sum + p.total_points, 0);
  
  const captain = currentTeamDetails?.players?.find((p: any) => p.is_captain);
  const viceCaptain = currentTeamDetails?.players?.find((p: any) => p.is_vice_captain);
  const passiveTeam = currentTeamDetails?.team?.supported_team_name;

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !league) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">
      <AlertModal {...alertState} onClose={closeAlert} />

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <Link
            href={`/dashboard/committee/fantasy/${leagueId}`}
            className="inline-flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to League Dashboard
          </Link>

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-xl">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-gray-900">Draft Results</h1>
                <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-semibold rounded-full">
                  NEW MODEL
                </span>
                {isConnected && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-green-100 border border-green-300 rounded-full">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-xs font-medium text-green-700">Live</span>
                  </div>
                )}
              </div>
              <p className="text-gray-600 mt-1">{league.name} - Tier-by-tier blind bid results</p>
              {lastUpdated && (
                <p className="text-xs text-gray-500 mt-1">
                  Last updated: {lastUpdated.toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>

          {/* View Mode Toggle */}
          <div className="mt-6 flex gap-2">
            <button
              onClick={() => setViewMode('by-tier')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                viewMode === 'by-tier'
                  ? 'bg-indigo-600 text-white shadow-lg'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              View by Tier
            </button>
            <button
              onClick={() => setViewMode('by-team')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                viewMode === 'by-team'
                  ? 'bg-indigo-600 text-white shadow-lg'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              View by Team
            </button>
          </div>
        </div>

        {/* By Tier View */}
        {viewMode === 'by-tier' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Tier Selector */}
            <div>
              <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 sticky top-4">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Draft Tiers</h2>
                
                {tierResults.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-sm">No tiers generated yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tierResults.map((tier) => (
                      <button
                        key={tier.tier_id}
                        onClick={() => setSelectedTier(tier.tier_number)}
                        className={`w-full text-left p-4 rounded-xl transition-all ${
                          selectedTier === tier.tier_number
                            ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg'
                            : 'bg-gray-50 hover:bg-gray-100 text-gray-900'
                        }`}
                      >
                        <div className="font-semibold">Tier {tier.tier_number}: {tier.tier_name}</div>
                        <div className={`text-sm mt-1 ${
                          selectedTier === tier.tier_number ? 'text-purple-100' : 'text-gray-600'
                        }`}>
                          {tier.won_bids} players drafted
                        </div>
                        <div className={`text-xs mt-1 ${
                          selectedTier === tier.tier_number ? 'text-purple-200' : 'text-gray-500'
                        }`}>
                          {tier.min_points}-{tier.max_points} pts
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Tier Results */}
            <div className="lg:col-span-3">
              {selectedTier !== null && tierResults.length > 0 && (
                (() => {
                  const tier = tierResults.find(t => t.tier_number === selectedTier);
                  if (!tier) return null;

                  return (
                    <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6">
                      <div className="mb-6 pb-4 border-b border-gray-200">
                        <h2 className="text-2xl font-bold text-gray-900">
                          Tier {tier.tier_number}: {tier.tier_name}
                        </h2>
                        <div className="flex gap-6 mt-3">
                          <div>
                            <p className="text-sm text-gray-500">Players Drafted</p>
                            <p className="text-2xl font-bold text-indigo-600">{tier.won_bids}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Total Bids</p>
                            <p className="text-2xl font-bold text-purple-600">{tier.total_bids}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Points Range</p>
                            <p className="text-2xl font-bold text-green-600">
                              {tier.min_points}-{tier.max_points}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Avg Points</p>
                            <p className="text-2xl font-bold text-amber-600">{tier.avg_points.toFixed(1)}</p>
                          </div>
                        </div>
                      </div>

                      {tier.results.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                          <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                          <p className="font-medium">No players drafted from this tier</p>
                          <p className="text-sm">All teams skipped this tier</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-gray-50 border-b-2 border-gray-200">
                              <tr>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Player</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Winning Team</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Owner</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Bid Amount</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {tier.results.map((result) => (
                                <tr key={result.bid_id} className="hover:bg-gray-50">
                                  <td className="px-4 py-3">
                                    <p className="font-medium text-gray-900">{result.player_name}</p>
                                  </td>
                                  <td className="px-4 py-3">
                                    <p className="font-medium text-indigo-600">{result.winning_team}</p>
                                  </td>
                                  <td className="px-4 py-3 text-gray-700">{result.owner_name}</td>
                                  <td className="px-4 py-3">
                                    <span className="font-medium text-green-600">₹{result.bid_amount.toFixed(1)}</span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                                      Won
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Lost Bids Section */}
                      {tier.lost_bids.length > 0 && (
                        <div className="mt-6 pt-6 border-t border-gray-200">
                          <h3 className="text-lg font-semibold text-gray-900 mb-3">
                            Unsuccessful Bids ({tier.lost_bids.length})
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {tier.lost_bids.map((bid) => (
                              <div key={bid.bid_id} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                <p className="font-medium text-gray-900">{bid.player_name}</p>
                                <p className="text-sm text-gray-600">
                                  {bid.team_name} - ₹{bid.bid_amount.toFixed(1)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Skipped Teams Section */}
                      {tier.skipped_teams.length > 0 && (
                        <div className="mt-6 pt-6 border-t border-gray-200">
                          <h3 className="text-lg font-semibold text-gray-900 mb-3">
                            Teams That Skipped ({tier.skipped_teams.length})
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            {tier.skipped_teams.map((team) => (
                              <span
                                key={team.team_id}
                                className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full"
                              >
                                {team.team_name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        )}

        {/* By Team View */}
        {viewMode === 'by-team' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Team Selector */}
          <div>
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 sticky top-4">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Teams</h2>
              
              <div className="space-y-2">
                {fantasyTeams.map((team) => {
                  const players = teamPlayers[team.id] || [];
                  const spent = players.reduce((sum, p) => sum + (p.draft_price || 0), 0);
                  
                  return (
                    <button
                      key={team.id}
                      onClick={() => setSelectedTeam(team.id)}
                      className={`w-full text-left p-4 rounded-xl transition-all relative ${
                        selectedTeam === team.id
                          ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg'
                          : 'bg-gray-50 hover:bg-gray-100 text-gray-900'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-semibold">{team.team_name}</div>
                        {team.draft_submitted && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            selectedTeam === team.id 
                              ? 'bg-green-400 text-green-900' 
                              : 'bg-green-100 text-green-700'
                          }`}>
                            ✓ Submitted
                          </span>
                        )}
                      </div>
                      <div className={`text-sm mt-1 ${
                        selectedTeam === team.id ? 'text-blue-100' : 'text-gray-600'
                      }`}>
                        {players.length} players • {spent.toFixed(1)} credits
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Team Squad */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6">
              {selectedTeamData && (
                <>
                  <div className="mb-6 pb-4 border-b border-gray-200">
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-2xl font-bold text-gray-900">{selectedTeamData.team_name}</h2>
                      {selectedTeamData.draft_submitted ? (
                        <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-semibold rounded-full flex items-center gap-1">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Draft Submitted
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-amber-100 text-amber-700 text-sm font-semibold rounded-full flex items-center gap-1">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                          Not Submitted
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600">Owner: {selectedTeamData.owner_name}</p>
                    
                    {/* Captain, VC, and Passive Team */}
                    {(captain || viceCaptain || passiveTeam) && (
                      <div className="flex flex-wrap gap-3 mt-3 mb-3">
                        {captain && (
                          <div className="px-3 py-1 bg-yellow-100 border border-yellow-300 rounded-lg text-sm">
                            <span className="font-bold text-yellow-700">👑 Captain:</span>
                            <span className="text-gray-900 ml-1">{captain.player_name}</span>
                          </div>
                        )}
                        {viceCaptain && (
                          <div className="px-3 py-1 bg-blue-100 border border-blue-300 rounded-lg text-sm">
                            <span className="font-bold text-blue-700">⭐ Vice-Captain:</span>
                            <span className="text-gray-900 ml-1">{viceCaptain.player_name}</span>
                          </div>
                        )}
                        {passiveTeam && (
                          <div className="px-3 py-1 bg-green-100 border border-green-300 rounded-lg text-sm">
                            <span className="font-bold text-green-700">🏟️ Passive Team:</span>
                            <span className="text-gray-900 ml-1">{passiveTeam}</span>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="flex gap-6 mt-3">
                      <div>
                        <p className="text-sm text-gray-500">Squad Size</p>
                        <p className="text-2xl font-bold text-indigo-600">{currentTeamPlayers.length}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Total Spent</p>
                        <p className="text-2xl font-bold text-green-600">{totalSpent.toFixed(1)} credits</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Total Points</p>
                        <p className="text-2xl font-bold text-purple-600">{totalPoints}</p>
                      </div>
                    </div>
                  </div>

                  {currentTeamPlayers.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      <p className="font-medium">No players drafted yet</p>
                      <p className="text-sm">This team hasn't drafted any players</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b-2 border-gray-200">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Player</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Rating</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Draft Price</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Matches</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Points</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {currentTeamPlayers.map((player, idx) => (
                            <tr key={player.draft_id} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <p className="font-medium text-gray-900">{player.player_name}</p>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1">
                                  <span className="text-yellow-500">★</span>
                                  <span className="font-medium">{player.star_rating}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className="font-medium text-green-600">{player.draft_price?.toFixed(1) || 0} credits</span>
                              </td>
                              <td className="px-4 py-3 text-gray-700">{player.matches_played}</td>
                              <td className="px-4 py-3">
                                <span className="font-bold text-purple-600">{player.total_points}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
