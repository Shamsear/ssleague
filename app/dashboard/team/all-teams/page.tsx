'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCachedTeamSeasons, useCachedSeasons } from '@/hooks/useCachedFirebase';
import ContractInfo from '@/components/ContractInfo';
import type { Season } from '@/types/season';

interface Team {
  id: string;
  name: string;
  logoUrl?: string;
  balance: number;
  // Dual currency fields
  currencySystem?: string;
  footballBudget?: number;
  realPlayerBudget?: number;
  footballSpent?: number;
  realPlayerSpent?: number;
  // Contract fields
  skipped_seasons?: number;
  penalty_amount?: number;
  last_played_season?: string;
  contract_id?: string;
  contract_start_season?: string;
  contract_end_season?: string;
  is_auto_registered?: boolean;
}

interface TeamStats {
  team: Team;
  totalPlayers: number;
  footballPlayersCount: number;
  realPlayersCount: number;
  totalValue: number;
  avgRating: number;
  positionBreakdown: { [key: string]: number };
}

const POSITIONS = ['GK', 'CB', 'LB', 'RB', 'DMF', 'CMF', 'AMF', 'LMF', 'RMF', 'LWF', 'RWF', 'SS', 'CF'];

export default function AllTeamsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [teams, setTeams] = useState<TeamStats[]>([]);
  const [seasonName, setSeasonName] = useState('');
  const [seasonId, setSeasonId] = useState<string | null>(null);
  const [maxPlayers, setMaxPlayers] = useState(25); // Default to 25
  const [seasonType, setSeasonType] = useState<'single' | 'multi'>('single');
  const [error, setError] = useState('');

  // Fetch all team seasons for the season (cached, only after we have seasonId)
  const { data: allTeamSeasons, loading: allTeamsLoading } = useCachedTeamSeasons(
    seasonId ? { seasonId } : undefined
  );

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'team') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  // Get active season (same approach as team-leaderboard)
  useEffect(() => {
    const fetchActiveSeason = async () => {
      if (!user || user.role !== 'team') return;

      try {
        const { collection, query, getDocs } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase/config');
        
        // Get all seasons
        const seasonsQuery = query(collection(db, 'seasons'));
        const seasonsSnapshot = await getDocs(seasonsQuery);
        const nonCompletedSeasonIds: string[] = [];
        const seasonsMap = new Map<string, { name: string; maxPlayers: number }>();
        
        seasonsSnapshot.forEach((doc) => {
          const data = doc.data() as Season;
          seasonsMap.set(doc.id, {
            name: data.name || `Season ${data.season_number || 'Unknown'}`,
            maxPlayers: data.max_football_players || 25
          });
          
          // Include seasons that are NOT completed
          if (data.status !== 'completed') {
            nonCompletedSeasonIds.push(doc.id);
          }
        });
        
        // Store the season type for the target season
        const getSeasonType = (sid: string): 'single' | 'multi' => {
          const season = seasonsSnapshot.docs.find(doc => doc.id === sid);
          return (season?.data() as Season)?.type || 'single';
        };

        // Get active season
        let targetSeasonId = null;
        if (nonCompletedSeasonIds.length > 0) {
          targetSeasonId = nonCompletedSeasonIds[0];
          const seasonData = seasonsMap.get(targetSeasonId);
          setSeasonName(seasonData?.name || 'Current Season');
          setMaxPlayers(seasonData?.maxPlayers || 25);
          setSeasonType(getSeasonType(targetSeasonId));
        } else if (seasonsSnapshot.size > 0) {
          // Fallback: use the first active season
          const firstActiveSeason = seasonsSnapshot.docs.find(doc => doc.data().isActive === true);
          if (firstActiveSeason) {
            targetSeasonId = firstActiveSeason.id;
            const seasonData = seasonsMap.get(targetSeasonId);
            setSeasonName(seasonData?.name || 'Current Season');
            setMaxPlayers(seasonData?.maxPlayers || 25);
            setSeasonType(getSeasonType(targetSeasonId));
          } else {
            const firstSeason = seasonsSnapshot.docs[0];
            targetSeasonId = firstSeason.id;
            const seasonData = seasonsMap.get(targetSeasonId);
            setSeasonName(seasonData?.name || 'Season');
            setMaxPlayers(seasonData?.maxPlayers || 25);
            setSeasonType(getSeasonType(targetSeasonId));
          }
        }

        if (!targetSeasonId) {
          setError('No active season found');
          return;
        }

        setSeasonId(targetSeasonId);
      } catch (error) {
        console.error('Error fetching active season:', error);
        setError('Failed to load active season');
      }
    };

    fetchActiveSeason();
  }, [user]);

  // Process all team seasons into TeamStats
  useEffect(() => {
    if (!allTeamSeasons || allTeamsLoading || !seasonId) return;

    try {
      const teamsData: TeamStats[] = allTeamSeasons
        .filter((ts: any) => 
          ts.status === 'registered' && 
          !ts.is_auto_registered // Exclude auto-registered teams (next season entries)
        )
        .map((teamSeasonData: any) => {
          const footballPlayersCount = teamSeasonData.football_players_count || 0;
          const realPlayersCount = teamSeasonData.real_players_count || 0;
          const totalPlayers = footballPlayersCount + realPlayersCount;
          const avgRating = teamSeasonData.average_rating || 0;

          return {
            team: {
              id: teamSeasonData.team_id,
              name: teamSeasonData.team_name || 'Unknown Team',
              logoUrl: teamSeasonData.team_logo || undefined,
              balance: teamSeasonData.budget || 0,
              // Dual currency fields
              currencySystem: teamSeasonData.currency_system || 'single',
              footballBudget: teamSeasonData.football_budget || 0,
              realPlayerBudget: teamSeasonData.real_player_budget || 0,
              footballSpent: teamSeasonData.football_spent || 0,
              realPlayerSpent: teamSeasonData.real_player_spent || 0,
              // Contract fields
              skipped_seasons: teamSeasonData.skipped_seasons,
              penalty_amount: teamSeasonData.penalty_amount,
              last_played_season: teamSeasonData.last_played_season,
              contract_id: teamSeasonData.contract_id,
              contract_start_season: teamSeasonData.contract_start_season,
              contract_end_season: teamSeasonData.contract_end_season,
              is_auto_registered: teamSeasonData.is_auto_registered,
            },
            totalPlayers,
            footballPlayersCount,
            realPlayersCount,
            totalValue: teamSeasonData.total_spent || 0,
            avgRating: Math.round(avgRating * 10) / 10,
            positionBreakdown: teamSeasonData.position_counts || {},
          };
        });

      // Sort teams by total value (descending)
      teamsData.sort((a, b) => b.totalValue - a.totalValue);

      setTeams(teamsData);
    } catch (err) {
      console.error('Error processing teams:', err);
      setError('An error occurred while loading teams');
    }
  }, [allTeamSeasons, allTeamsLoading, seasonId]);

  const getPositionColor = (position: string) => {
    const colors: { [key: string]: string } = {
      GK: 'bg-yellow-100 text-yellow-800',
      CB: 'bg-red-100 text-red-800',
      LB: 'bg-orange-100 text-orange-800',
      RB: 'bg-orange-100 text-orange-800',
      DMF: 'bg-blue-100 text-blue-800',
      CMF: 'bg-sky-100 text-sky-800',
      AMF: 'bg-cyan-100 text-cyan-800',
      LMF: 'bg-teal-100 text-teal-800',
      RMF: 'bg-teal-100 text-teal-800',
      LWF: 'bg-green-100 text-green-800',
      RWF: 'bg-green-100 text-green-800',
      SS: 'bg-purple-100 text-purple-800',
      CF: 'bg-pink-100 text-pink-800',
    };
    return colors[position] || 'bg-gray-100 text-gray-800';
  };


  const isLoading = allTeamsLoading;

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading teams...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'team') {
    return null;
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="glass rounded-3xl p-8 max-w-2xl mx-auto text-center">
          <div className="text-red-600 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-dark mb-2">Error Loading Teams</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Link href="/dashboard" className="text-[#0066FF] hover:underline">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="glass rounded-3xl p-6 sm:p-8 max-w-7xl mx-auto hover:shadow-lg transition-all duration-300">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-dark">All Teams</h1>
            <p className="text-sm text-gray-600 mt-1">
              Season: <span className="font-semibold text-[#0066FF]">{seasonName}</span>
            </p>
          </div>
          <Link 
            href="/dashboard" 
            className="flex items-center text-gray-600 hover:text-[#0066FF] transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back to Dashboard</span>
          </Link>
        </div>

        {/* Teams Count Badge */}
        <div className="mb-6">
          <div className="inline-flex items-center bg-blue-50 rounded-lg px-4 py-2">
            <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span className="text-blue-800 font-medium">
              {teams.length} Team{teams.length !== 1 ? 's' : ''} Registered
            </span>
          </div>
        </div>

        {teams.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams.map((teamData) => (
              <div 
                key={teamData.team.id} 
                className="glass rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02] bg-white/60"
              >
                <div className="p-6">
                  {/* Team Header */}
                  <div className="flex items-center mb-4">
                    <div className="h-14 w-14 flex-shrink-0 bg-[#0066FF]/10 rounded-lg flex items-center justify-center mr-3 p-1.5">
                      {teamData.team.logoUrl ? (
                        <Image 
                          src={teamData.team.logoUrl} 
                          alt={teamData.team.name} 
                          width={56}
                          height={56}
                          className="object-contain w-full h-full"
                        />
                      ) : (
                        <svg className="w-6 h-6 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      )}
                    </div>
                    <h2 className="text-xl font-bold text-dark">{teamData.team.name}</h2>
                  </div>

                  {/* Team Stats */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
                      <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      ⚽ {teamData.footballPlayersCount}/{maxPlayers}
                    </span>
                    
                    {seasonType === 'multi' && teamData.realPlayersCount > 0 && (
                      <span className="inline-flex items-center rounded-full bg-purple-100 px-3 py-1 text-sm font-medium text-purple-800">
                        <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        👤 {teamData.realPlayersCount}
                      </span>
                    )}
                    
                    {seasonType === 'multi' || teamData.team.currencySystem === 'dual' ? (
                      <>
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
                          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          eCoin Spent: {(teamData.team.footballSpent || 0).toLocaleString()}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
                          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          SSCoin Spent: {(teamData.team.realPlayerSpent || 0).toLocaleString()}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-indigo-100 px-3 py-1 text-sm font-medium text-indigo-800">
                          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          eCoin Left: {(teamData.team.footballBudget || 0).toLocaleString()}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-purple-100 px-3 py-1 text-sm font-medium text-purple-800">
                          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          SSCoin Left: {(teamData.team.realPlayerBudget || 0).toLocaleString()}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
                          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Spent: {teamData.totalValue.toLocaleString()}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-purple-100 px-3 py-1 text-sm font-medium text-purple-800">
                          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          Left: {teamData.team.balance.toLocaleString()}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Average Rating */}
                  {teamData.avgRating > 0 && (
                    <div className="mb-4 p-3 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Avg. Rating</span>
                        <span className="text-2xl font-bold text-orange-600">
                          {teamData.avgRating.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Contract Information */}
                  <div className="mb-4">
                    <ContractInfo
                      skippedSeasons={teamData.team.skipped_seasons}
                      penaltyAmount={teamData.team.penalty_amount}
                      lastPlayedSeason={teamData.team.last_played_season}
                      contractId={teamData.team.contract_id}
                      contractStartSeason={teamData.team.contract_start_season}
                      contractEndSeason={teamData.team.contract_end_season}
                      isAutoRegistered={teamData.team.is_auto_registered}
                      compact
                    />
                  </div>

                  {/* Squad Composition */}
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Squad Composition</h3>
                    <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-6 gap-1">
                      {POSITIONS.slice(0, 12).map((position) => {
                        const count = teamData.positionBreakdown[position] || 0;
                        return (
                          <div key={position} className="text-center">
                            <div 
                              className={`rounded-lg p-1.5 ${getPositionColor(position)} ${
                                count === 0 ? 'opacity-40' : ''
                              }`}
                            >
                              <div className="text-xs font-bold">{position}</div>
                              <div className="text-sm font-bold">{count}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* CF position - full width */}
                    {POSITIONS.slice(12).map((position) => {
                      const count = teamData.positionBreakdown[position] || 0;
                      return (
                        <div key={position} className="mt-1">
                          <div 
                            className={`rounded-lg p-1.5 text-center ${getPositionColor(position)} ${
                              count === 0 ? 'opacity-40' : ''
                            }`}
                          >
                            <span className="text-xs font-bold mr-2">{position}</span>
                            <span className="text-sm font-bold">{count}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* View Squad Button */}
                  <div className="mt-4">
                    <Link
                      href={`/dashboard/team/squad/${teamData.team.id}`}
                      className="block w-full py-2 px-4 bg-[#0066FF] text-white rounded-lg text-center font-medium hover:bg-[#0052CC] transition-colors"
                    >
                      View Squad
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* No Teams Message */
          <div className="text-center py-12">
            <svg className="w-20 h-20 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Teams Found</h3>
            <p className="text-gray-500">No teams are registered for this season yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
