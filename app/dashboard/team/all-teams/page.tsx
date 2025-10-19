'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCachedTeamSeasons, useCachedSeasons } from '@/hooks/useCachedFirebase';
import ContractInfo from '@/components/ContractInfo';

interface Team {
  id: string;
  name: string;
  logoUrl?: string;
  balance: number;
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
  const [error, setError] = useState('');

  // Fetch user's team season to get seasonId (cached)
  const { data: userTeamSeasons, loading: userTeamLoading } = useCachedTeamSeasons(
    user?.role === 'team' ? { teamId: user.uid } : undefined
  );

  // Fetch all team seasons for the season (cached, only after we have seasonId)
  const { data: allTeamSeasons, loading: allTeamsLoading } = useCachedTeamSeasons(
    seasonId ? { seasonId } : undefined
  );

  // Fetch season details (cached)
  const { data: seasons, loading: seasonsLoading } = useCachedSeasons(
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

  // Extract seasonId from user's team season
  useEffect(() => {
    if (!user || userTeamLoading || !userTeamSeasons) return;

    const registeredSeason = userTeamSeasons.find(
      (ts: any) => ts.team_id === user.uid && ts.status === 'registered'
    );

    if (!registeredSeason) {
      setError('You are not registered for any season');
      return;
    }

    setSeasonId(registeredSeason.season_id);
  }, [user, userTeamSeasons, userTeamLoading]);

  // Set season name from cached season data
  useEffect(() => {
    if (!seasons || seasonsLoading) return;

    const season = Array.isArray(seasons) ? seasons[0] : seasons;
    if (season) {
      setSeasonName(season.name || 'Current Season');
    }
  }, [seasons, seasonsLoading]);

  // Process all team seasons into TeamStats
  useEffect(() => {
    if (!allTeamSeasons || allTeamsLoading || !seasonId) return;

    try {
      const teamsData: TeamStats[] = allTeamSeasons
        .filter((ts: any) => ts.status === 'registered')
        .map((teamSeasonData: any) => {
          const totalPlayers = teamSeasonData.players_count || 0;
          const avgRating = teamSeasonData.average_rating || 0;

          return {
            team: {
              id: teamSeasonData.team_id,
              name: teamSeasonData.team_name || 'Unknown Team',
              logoUrl: teamSeasonData.team_logo || undefined,
              balance: teamSeasonData.budget || 0,
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


  const isLoading = userTeamLoading || allTeamsLoading || seasonsLoading;

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
                    <div className="h-12 w-12 flex-shrink-0 bg-[#0066FF]/10 rounded-lg flex items-center justify-center mr-3 overflow-hidden">
                      {teamData.team.logoUrl ? (
                        <Image 
                          src={teamData.team.logoUrl} 
                          alt={teamData.team.name} 
                          width={48}
                          height={48}
                          className="object-contain"
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
                      {teamData.totalPlayers}/16
                    </span>
                    <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
                      <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      £{teamData.totalValue.toLocaleString()}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-purple-100 px-3 py-1 text-sm font-medium text-purple-800">
                      <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      £{teamData.team.balance.toLocaleString()} left
                    </span>
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
