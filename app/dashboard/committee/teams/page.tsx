'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';
import Link from 'next/link';
import Image from 'next/image';
import ContractInfo from '@/components/ContractInfo';

interface TeamData {
  team: {
    id: string;
    name: string;
    logoUrl: string | null;
    balance: number;
    // Dual currency (Season 16+)
    dollar_balance?: number;
    euro_balance?: number;
    dollar_spent?: number;
    euro_spent?: number;
    // Contract fields
    skipped_seasons?: number;
    penalty_amount?: number;
    last_played_season?: string;
    contract_id?: string;
    contract_start_season?: string;
    contract_end_season?: string;
    is_auto_registered?: boolean;
  };
  totalPlayers: number;
  totalValue: number;
  avgRating: number;
  positionBreakdown: { [key: string]: number };
}

export default function CommitteeTeamsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { isCommitteeAdmin, userSeasonId } = usePermissions();
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
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
    const fetchTeams = async () => {
      if (!userSeasonId) {
        setError('No season assigned');
        setLoadingTeams(false);
        return;
      }

      try {
        setLoadingTeams(true);
        const response = await fetchWithTokenRefresh(`/api/team/all?season_id=${userSeasonId}`);
        const data = await response.json();

        if (data.success && data.data?.teams) {
          console.log('✅ Fetched teams:', data.data.teams);
          setTeams(data.data.teams);
          setError(null);
        } else {
          setError(data.error || 'Failed to load teams');
        }
      } catch (err) {
        console.error('Error fetching teams:', err);
        setError('Failed to load teams');
      } finally {
        setLoadingTeams(false);
      }
    };

    if (isCommitteeAdmin && userSeasonId) {
      fetchTeams();
    }
  }, [isCommitteeAdmin, userSeasonId]);

  if (loading || loadingTeams) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading teams...</p>
        </div>
      </div>
    );
  }

  if (!user || !isCommitteeAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen py-4 sm:py-8 px-4">
      <div className="container mx-auto max-w-screen-2xl">
        {/* Teams Overview */}
        <div className="glass rounded-3xl p-4 sm:p-6 mb-8 shadow-lg">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <div className="hidden sm:block">
              <h2 className="text-xl font-bold text-gray-800">Teams Overview</h2>
            </div>
            <div className="flex space-x-2 w-full sm:w-auto">
              <Link
                href="/dashboard/committee"
                className="px-4 py-2.5 text-sm glass rounded-xl hover:bg-white/90 transition-all duration-300 flex items-center justify-center text-gray-800 sm:justify-start w-full sm:w-auto"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                </svg>
                Back to Dashboard
              </Link>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
              {error}
            </div>
          )}

          {/* Desktop Table (hidden on mobile) */}
          <div className="hidden md:block overflow-x-auto rounded-xl shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Team Name</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Balance</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Players</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Contract</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white/30">
                {teams.length > 0 ? (
                  teams.map((teamData) => (
                    <tr key={teamData.team.id} className="hover:bg-white/60 transition-colors">
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-8 w-8 flex-shrink-0 bg-[#0066FF]/10 rounded-md flex items-center justify-center text-[#0066FF] mr-3 overflow-hidden">
                            {teamData.team.logoUrl ? (
                              <Image src={teamData.team.logoUrl} alt={teamData.team.name} width={32} height={32} className="object-contain" />
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                              </svg>
                            )}
                          </div>
                          <div className="text-sm font-medium text-gray-800">{teamData.team.name}</div>
                        </div>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        {teamData.team.dollar_balance !== undefined || teamData.team.euro_balance !== undefined ? (
                          <div className="text-sm text-gray-700">
                            <div className="mb-1"><span className="font-semibold text-green-700">$</span> {teamData.team.dollar_balance?.toLocaleString?.() ?? '0'}</div>
                            <div><span className="font-semibold text-blue-700">€</span> {teamData.team.euro_balance?.toLocaleString?.() ?? '0'}</div>
                          </div>
                        ) : (
                          <div className="text-sm font-medium text-gray-700">
                            <span className="text-[#0066FF] font-semibold">£{teamData.team.balance.toLocaleString()}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-700 mb-1.5">{teamData.totalPlayers}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
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
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-green-100 text-green-800">
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                          </svg>
                          Registered
                        </span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm">
                        <div className="flex space-x-1">
                          <Link
                            href={`/dashboard/committee/teams/${teamData.team.id}`}
                            className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors duration-200"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center">
                      <div className="flex flex-col items-center">
                        <svg className="w-12 h-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <p className="text-gray-500 text-sm">No teams found for this season</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards (hidden on desktop) */}
          <div className="md:hidden space-y-4">
            {teams.length > 0 ? (
              teams.map((teamData) => (
                <div key={teamData.team.id} className="bg-white/30 backdrop-blur-sm rounded-xl shadow-sm p-4 border border-gray-100">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center">
                      <div className="h-10 w-10 flex-shrink-0 bg-[#0066FF]/10 rounded-md flex items-center justify-center text-[#0066FF] mr-3 overflow-hidden">
                        {teamData.team.logoUrl ? (
                          <Image src={teamData.team.logoUrl} alt={teamData.team.name} width={40} height={40} className="object-contain" />
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-gray-800">{teamData.team.name}</h3>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 mt-1">
                          Registered
                        </span>
                      </div>
                    </div>

                    <Link
                      href={`/dashboard/committee/teams/${teamData.team.id}`}
                      className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors duration-200"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </Link>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {teamData.team.dollar_balance !== undefined || teamData.team.euro_balance !== undefined ? (
                      <>
                        <div className="bg-white/50 rounded-lg p-2">
                          <p className="text-xs text-gray-500 mb-1">$ Balance</p>
                          <p className="text-sm font-semibold text-green-700">${teamData.team.dollar_balance?.toLocaleString?.() ?? '0'}</p>
                        </div>
                        <div className="bg-white/50 rounded-lg p-2">
                          <p className="text-xs text-gray-500 mb-1">€ Balance</p>
                          <p className="text-sm font-semibold text-blue-700">€{teamData.team.euro_balance?.toLocaleString?.() ?? '0'}</p>
                        </div>
                      </>
                    ) : (
                      <div className="bg-white/50 rounded-lg p-2">
                        <p className="text-xs text-gray-500 mb-1">Balance</p>
                        <p className="text-sm font-semibold text-[#0066FF]">£{teamData.team.balance.toLocaleString()}</p>
                      </div>
                    )}
                    <div className="bg-white/50 rounded-lg p-2">
                      <p className="text-xs text-gray-500 mb-1">Players</p>
                      <p className="text-sm font-semibold text-gray-800">{teamData.totalPlayers}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-white/30 backdrop-blur-sm rounded-xl shadow-sm p-6 text-center">
                <svg className="w-12 h-12 text-gray-400 mb-3 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p className="text-gray-500">No teams found for this season</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
