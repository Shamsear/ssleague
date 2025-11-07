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
    }, [leagueId, selectedTeam]);

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
                {isConnected && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-green-100 border border-green-300 rounded-full">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-xs font-medium text-green-700">Live</span>
                  </div>
                )}
              </div>
              <p className="text-gray-600 mt-1">{league.name} - View team squads</p>
              {lastUpdated && (
                <p className="text-xs text-gray-500 mt-1">
                  Last updated: {lastUpdated.toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>
        </div>

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
      </div>
    </div>
  );
}
