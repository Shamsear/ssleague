'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { db } from '@/lib/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import Link from 'next/link';
import Image from 'next/image';
import ContractInfo from '@/components/ContractInfo';

interface TeamData {
  id: string;
  team_name: string;
  team_code: string;
  balance: number;
  initial_balance: number;
  total_spent: number;
  // Dual currency (Season 16+)
  dollar_balance?: number;
  euro_balance?: number;
  dollar_spent?: number;
  euro_spent?: number;
  logo: string | null;
  is_active: boolean;
  real_players_count: number;
  football_players_count: number;
  stats: {
    matches_played: number;
    matches_won: number;
    matches_drawn: number;
    matches_lost: number;
    goals_scored: number;
    goals_conceded: number;
    points: number;
  };
  season_id: string;
  // Contract fields
  skipped_seasons?: number;
  penalty_amount?: number;
  last_played_season?: string;
  contract_id?: string;
  contract_start_season?: string;
  contract_end_season?: string;
  is_auto_registered?: boolean;
}

export default function CommitteeTeamDetailsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const teamId = params?.id as string;
  const { isCommitteeAdmin, userSeasonId } = usePermissions();
  const [team, setTeam] = useState<TeamData | null>(null);
  const [loadingTeam, setLoadingTeam] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && !isCommitteeAdmin) {
      router.push('/dashboard');
    }
  }, [user, loading, router, isCommitteeAdmin]);

  useEffect(() => {
    const fetchTeam = async () => {
      if (!teamId || !userSeasonId) {
        setError('Team ID or Season ID not provided');
        setLoadingTeam(false);
        return;
      }

      try {
        setLoadingTeam(true);
        
        // Fetch user/team data
        const userDocRef = doc(db, 'users', teamId);
        const userDoc = await getDoc(userDocRef);
        
        if (!userDoc.exists()) {
          setError('Team not found');
          setLoadingTeam(false);
          return;
        }
        
        const userData = userDoc.data();
        
        // Fetch team_season data
        const teamSeasonId = `${teamId}_${userSeasonId}`;
        const teamSeasonRef = doc(db, 'team_seasons', teamSeasonId);
        const teamSeasonDoc = await getDoc(teamSeasonRef);
        
        if (!teamSeasonDoc.exists()) {
          setError('Team not registered for this season');
          setLoadingTeam(false);
          return;
        }
        
        const teamSeasonData = teamSeasonDoc.data();
        
        // Fetch player counts from the team API endpoint
        let footballPlayersCount = 0;
        let totalValue = 0;
        
        try {
          // Use the /api/team/all endpoint to get full team data including player counts
          const teamsResponse = await fetch(`/api/team/all?season_id=${userSeasonId}`);
          if (teamsResponse.ok) {
            const teamsData = await teamsResponse.json();
            if (teamsData.success && teamsData.data?.teams) {
              // Find this specific team in the response
              const thisTeam = teamsData.data.teams.find((t: any) => t.team.id === teamId);
              if (thisTeam) {
                footballPlayersCount = thisTeam.totalPlayers || 0;
                totalValue = thisTeam.totalValue || 0;
              }
            }
          }
        } catch (error) {
          console.error('Error fetching player counts:', error);
        }
        
        // Combine data
        const currentBalance = teamSeasonData.budget || userData.balance || 0;
        const initialBalance = teamSeasonData.initial_budget || 15000;
        
        const teamData: TeamData = {
          id: teamId,
          team_name: teamSeasonData.team_name || userData.teamName || 'Unknown Team',
          team_code: teamSeasonData.team_code || userData.teamCode || 'N/A',
          balance: currentBalance,
          initial_balance: initialBalance,
          total_spent: totalValue || (initialBalance - currentBalance),
          // Dual currency (Season 16+) - map from team_seasons fields
          dollar_balance: teamSeasonData.real_player_budget,
          euro_balance: teamSeasonData.football_budget,
          dollar_spent: teamSeasonData.real_player_spent,
          euro_spent: teamSeasonData.football_spent,
          logo: teamSeasonData.team_logo || userData.logoUrl || userData.logoURL || userData.logo_url || null,
          is_active: teamSeasonData.status === 'registered',
          real_players_count: 0, // Real players not implemented yet
          football_players_count: footballPlayersCount,
          stats: {
            matches_played: 0,
            matches_won: 0,
            matches_drawn: 0,
            matches_lost: 0,
            goals_scored: 0,
            goals_conceded: 0,
            points: 0,
          },
          season_id: userSeasonId,
          // Contract fields
          skipped_seasons: teamSeasonData.skipped_seasons,
          penalty_amount: teamSeasonData.penalty_amount,
          last_played_season: teamSeasonData.last_played_season,
          contract_id: teamSeasonData.contract_id,
          contract_start_season: teamSeasonData.contract_start_season,
          contract_end_season: teamSeasonData.contract_end_season,
          is_auto_registered: teamSeasonData.is_auto_registered,
        };
        
        setTeam(teamData);
        setError(null);
      } catch (err) {
        console.error('Error fetching team:', err);
        setError('Failed to load team details');
      } finally {
        setLoadingTeam(false);
      }
    };

    if (isCommitteeAdmin && teamId && userSeasonId) {
      fetchTeam();
    }
  }, [isCommitteeAdmin, teamId, userSeasonId]);

  if (loading || loadingTeam) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading team details...</p>
        </div>
      </div>
    );
  }

  if (!user || !isCommitteeAdmin) {
    return null;
  }

  if (error) {
    return (
      <div className="min-h-screen py-8 px-4">
        <div className="container mx-auto max-w-screen-xl">
          <div className="glass rounded-3xl p-6 shadow-lg">
            <div className="text-center">
              <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Error</h2>
              <p className="text-gray-600 mb-4">{error}</p>
              <Link
                href="/dashboard/committee/teams"
                className="inline-flex items-center px-4 py-2 bg-[#0066FF] text-white rounded-xl hover:bg-[#0052CC] transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Teams
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!team) {
    return null;
  }

  const totalPlayers = team.real_players_count + team.football_players_count;
  const avgPlayerValue = totalPlayers > 0 ? Math.floor(team.total_spent / totalPlayers) : 0;

  return (
    <div className="min-h-screen py-4 sm:py-8 px-4">
      <div className="container mx-auto max-w-screen-xl">
        {/* Back Button and Header */}
        <div className="mb-8 hidden sm:block">
          <Link href="/dashboard/committee/teams" className="inline-flex items-center text-blue-600 hover:text-blue-800">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Teams
          </Link>
          <h1 className="text-3xl font-bold mt-4 mb-2 gradient-text">{team.team_name}</h1>
          <p className="text-gray-600">Team Management</p>
        </div>

        {/* Team Details Card */}
        <div className="glass rounded-3xl p-6 mb-8 shadow-lg border border-gray-100/30">
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              {/* Current Logo Display */}
              <div className="flex-shrink-0">
                <label className="block text-sm font-medium text-gray-700 mb-3">Team Logo</label>
                <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-xl border-2 border-gray-200 overflow-hidden shadow-lg relative group">
                  {team.logo ? (
                    <Image
                      src={team.logo}
                      alt={`${team.team_name} logo`}
                      width={128}
                      height={128}
                      className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#0066FF]/10 to-[#0066FF]/20 flex items-center justify-center">
                      <svg className="w-12 h-12 sm:w-16 sm:h-16 text-[#0066FF]/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>

              {/* Team Info */}
              <div className="flex-1">
                <div className={`grid grid-cols-1 ${team.dollar_balance !== undefined || team.euro_balance !== undefined ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-6`}>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Team Name</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                        </svg>
                      </span>
                      <input
                        type="text"
                        value={team.team_name}
                        readOnly
                        className="pl-10 w-full py-2.5 bg-gray-100/60 border border-gray-200 rounded-xl outline-none shadow-sm text-gray-600"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Team Code</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                      </span>
                      <input
                        type="text"
                        value={team.team_code}
                        readOnly
                        className="pl-10 w-full py-2.5 bg-gray-100/60 border border-gray-200 rounded-xl outline-none shadow-sm text-gray-600"
                      />
                    </div>
                  </div>

                  {team.dollar_balance !== undefined || team.euro_balance !== undefined ? (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">$ Balance (Real Players)</label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400 text-green-600">
                            <span className="font-bold">$</span>
                          </span>
                          <input
                            type="number"
                            value={team.dollar_balance ?? 0}
                            onChange={(e) => setTeam({ ...team, dollar_balance: parseFloat(e.target.value) || 0 })}
                            className="pl-10 w-full py-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200 shadow-sm text-gray-600 font-semibold text-green-700"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">€ Balance (Football Players)</label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400 text-blue-600">
                            <span className="font-bold">€</span>
                          </span>
                          <input
                            type="number"
                            value={team.euro_balance ?? 0}
                            onChange={(e) => setTeam({ ...team, euro_balance: parseFloat(e.target.value) || 0 })}
                            className="pl-10 w-full py-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm text-gray-600 font-semibold text-blue-700"
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Current Balance</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </span>
                        <input
                          type="text"
                          value={`£${team.balance.toLocaleString()}`}
                          readOnly
                          className="pl-10 w-full py-2.5 bg-gray-100/60 border border-gray-200 rounded-xl outline-none shadow-sm text-gray-600 font-semibold text-[#0066FF]"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
                    <div className="flex items-center h-[42px]">
                      {team.is_active ? (
                        <span className="inline-flex items-center px-3 py-2 rounded-xl text-sm font-medium bg-green-100 text-green-800">
                          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                          </svg>
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-2 rounded-xl text-sm font-medium bg-gray-100 text-gray-800">
                          Inactive
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Financial Overview */}
        <div className="glass rounded-3xl p-6 mb-8 shadow-lg border border-gray-100/30">
          <h2 className="text-xl font-semibold mb-4 text-gray-800 flex items-center">
            <svg className="w-5 h-5 mr-2 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Financial Overview
          </h2>

          {/* Dual Currency Display (Season 16+) */}
          {(team.dollar_balance !== undefined || team.euro_balance !== undefined) ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="glass p-3 sm:p-5 rounded-xl bg-gradient-to-br from-green-50 to-white shadow-sm border border-green-200/50 hover:shadow-md transition-shadow">
                <h3 className="text-xs sm:text-sm font-medium text-gray-600 mb-1 flex items-center">
                  <span className="text-green-700 font-bold mr-1">$</span> Balance (Real)
                </h3>
                <p className="text-base sm:text-xl font-bold text-green-700">${team.dollar_balance?.toLocaleString?.() ?? '-'}</p>
              </div>
              <div className="glass p-3 sm:p-5 rounded-xl bg-gradient-to-br from-blue-50 to-white shadow-sm border border-blue-200/50 hover:shadow-md transition-shadow">
                <h3 className="text-xs sm:text-sm font-medium text-gray-600 mb-1 flex items-center">
                  <span className="text-blue-700 font-bold mr-1">€</span> Balance (Football)
                </h3>
                <p className="text-base sm:text-xl font-bold text-blue-700">€{team.euro_balance?.toLocaleString?.() ?? '-'}</p>
              </div>
              <div className="glass p-3 sm:p-5 rounded-xl bg-gradient-to-br from-red-50 to-white shadow-sm border border-red-200/50 hover:shadow-md transition-shadow">
                <h3 className="text-xs sm:text-sm font-medium text-gray-600 mb-1 flex items-center">
                  <span className="text-red-700 font-bold mr-1">$</span> Spent
                </h3>
                <p className="text-base sm:text-xl font-bold text-red-700">${team.dollar_spent?.toLocaleString?.() ?? '0'}</p>
              </div>
              <div className="glass p-3 sm:p-5 rounded-xl bg-gradient-to-br from-purple-50 to-white shadow-sm border border-purple-200/50 hover:shadow-md transition-shadow">
                <h3 className="text-xs sm:text-sm font-medium text-gray-600 mb-1 flex items-center">
                  <span className="text-purple-700 font-bold mr-1">€</span> Spent
                </h3>
                <p className="text-base sm:text-xl font-bold text-purple-700">€{team.euro_spent?.toLocaleString?.() ?? '0'}</p>
              </div>
            </div>
          ) : (
            // Legacy single currency display
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <div className="glass p-3 sm:p-5 rounded-xl bg-white/10 shadow-sm border border-gray-100/20 hover:shadow-md transition-shadow">
                <h3 className="text-xs sm:text-sm font-medium text-gray-500 mb-1">Current Balance</h3>
                <p className="text-base sm:text-xl font-bold text-[#0066FF]">£{team.balance.toLocaleString()}</p>
              </div>
              <div className="glass p-3 sm:p-5 rounded-xl bg-white/10 shadow-sm border border-gray-100/20 hover:shadow-md transition-shadow">
                <h3 className="text-xs sm:text-sm font-medium text-gray-500 mb-1">Initial Balance</h3>
                <p className="text-base sm:text-xl font-bold text-[#0066FF]">£{team.initial_balance.toLocaleString()}</p>
              </div>
              <div className="glass p-3 sm:p-5 rounded-xl bg-white/10 shadow-sm border border-gray-100/20 hover:shadow-md transition-shadow">
                <h3 className="text-xs sm:text-sm font-medium text-gray-500 mb-1">Total Spent</h3>
                <p className="text-base sm:text-xl font-bold text-red-500">£{team.total_spent.toLocaleString()}</p>
              </div>
              <div className="glass p-3 sm:p-5 rounded-xl bg-white/10 shadow-sm border border-gray-100/20 hover:shadow-md transition-shadow">
                <h3 className="text-xs sm:text-sm font-medium text-gray-500 mb-1">Avg. Player Value</h3>
                <p className="text-base sm:text-xl font-bold text-green-600">£{avgPlayerValue.toLocaleString()}</p>
              </div>
            </div>
          )}
        </div>

        {/* Contract Information */}
        <div className="glass rounded-3xl p-6 mb-8 shadow-lg border border-gray-100/30">
          <h2 className="text-xl font-semibold mb-4 text-gray-800 flex items-center">
            <svg className="w-5 h-5 mr-2 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Contract Information
          </h2>
          <ContractInfo
            skippedSeasons={team.skipped_seasons}
            penaltyAmount={team.penalty_amount}
            lastPlayedSeason={team.last_played_season}
            contractId={team.contract_id}
            contractStartSeason={team.contract_start_season}
            contractEndSeason={team.contract_end_season}
            isAutoRegistered={team.is_auto_registered}
          />
        </div>

        {/* Squad Overview */}
        <div className="glass rounded-3xl p-6 mb-8 shadow-lg border border-gray-100/30">
          <h2 className="text-xl font-semibold mb-4 text-gray-800 flex items-center">
            <svg className="w-5 h-5 mr-2 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Squad Overview
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <div className="glass p-3 sm:p-5 rounded-xl bg-white/10 shadow-sm border border-gray-100/20 hover:shadow-md transition-shadow">
              <h3 className="text-xs sm:text-sm font-medium text-gray-500 mb-1">Total Players</h3>
              <p className="text-base sm:text-xl font-bold text-[#0066FF]">{totalPlayers}</p>
            </div>
            <div className="glass p-3 sm:p-5 rounded-xl bg-white/10 shadow-sm border border-gray-100/20 hover:shadow-md transition-shadow">
              <h3 className="text-xs sm:text-sm font-medium text-gray-500 mb-1">Real Players</h3>
              <p className="text-base sm:text-xl font-bold text-[#0066FF]">{team.real_players_count}</p>
            </div>
            <div className="glass p-3 sm:p-5 rounded-xl bg-white/10 shadow-sm border border-gray-100/20 hover:shadow-md transition-shadow">
              <h3 className="text-xs sm:text-sm font-medium text-gray-500 mb-1">Football Players</h3>
              <p className="text-base sm:text-xl font-bold text-[#0066FF]">{team.football_players_count}</p>
            </div>
            <div className="glass p-3 sm:p-5 rounded-xl bg-white/10 shadow-sm border border-gray-100/20 hover:shadow-md transition-shadow">
              <h3 className="text-xs sm:text-sm font-medium text-gray-500 mb-1">Matches Played</h3>
              <p className="text-base sm:text-xl font-bold text-[#0066FF]">{team.stats.matches_played}</p>
            </div>
          </div>

          {/* Match Statistics */}
          <div className="mt-6">
            <h3 className="text-base font-semibold mb-4 text-gray-700 flex items-center">
              <svg className="w-4 h-4 mr-2 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Match Statistics
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
              <div className="glass p-3 sm:p-4 rounded-xl bg-white/10 shadow-sm border border-gray-100/20">
                <h4 className="text-xs sm:text-sm font-medium text-gray-500 mb-1">Won</h4>
                <p className="text-lg sm:text-2xl font-bold text-green-600">{team.stats.matches_won}</p>
              </div>
              <div className="glass p-3 sm:p-4 rounded-xl bg-white/10 shadow-sm border border-gray-100/20">
                <h4 className="text-xs sm:text-sm font-medium text-gray-500 mb-1">Drawn</h4>
                <p className="text-lg sm:text-2xl font-bold text-yellow-600">{team.stats.matches_drawn}</p>
              </div>
              <div className="glass p-3 sm:p-4 rounded-xl bg-white/10 shadow-sm border border-gray-100/20">
                <h4 className="text-xs sm:text-sm font-medium text-gray-500 mb-1">Lost</h4>
                <p className="text-lg sm:text-2xl font-bold text-red-600">{team.stats.matches_lost}</p>
              </div>
              <div className="glass p-3 sm:p-4 rounded-xl bg-white/10 shadow-sm border border-gray-100/20">
                <h4 className="text-xs sm:text-sm font-medium text-gray-500 mb-1">Goals</h4>
                <p className="text-lg sm:text-2xl font-bold text-[#0066FF]">{team.stats.goals_scored}</p>
              </div>
              <div className="glass p-3 sm:p-4 rounded-xl bg-white/10 shadow-sm border border-gray-100/20">
                <h4 className="text-xs sm:text-sm font-medium text-gray-500 mb-1">Points</h4>
                <p className="text-lg sm:text-2xl font-bold text-purple-600">{team.stats.points}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
