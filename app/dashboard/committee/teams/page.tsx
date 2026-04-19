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
    dollar_balance?: number;
    euro_balance?: number;
    dollar_spent?: number;
    euro_spent?: number;
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
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'players' | 'balance'>('name');

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

  // Filter and sort teams
  const filteredTeams = teams
    .filter(team => 
      team.team.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.team.name.localeCompare(b.team.name);
        case 'players':
          return b.totalPlayers - a.totalPlayers;
        case 'balance':
          const aBalance = a.team.dollar_balance ?? a.team.balance;
          const bBalance = b.team.dollar_balance ?? b.team.balance;
          return bBalance - aBalance;
        default:
          return 0;
      }
    });

  const copyBalancesToWhatsApp = () => {
    try {
      let message = '💰 *TEAM BALANCES*\n\n';
      message += `📅 Season: ${userSeasonId}\n`;
      message += `──────────────────────────────\n\n`;

      // Sort teams by name for the copy
      const sortedTeams = [...filteredTeams].sort((a, b) => 
        a.team.name.localeCompare(b.team.name)
      );

      sortedTeams.forEach((teamData, index) => {
        const eCoin = teamData.team.euro_balance ?? teamData.team.balance ?? 0;
        const sSCoin = teamData.team.dollar_balance ?? 0;

        message += `${index + 1}. *${teamData.team.name}*\n`;
        message += `   🔵 eCoin: ${eCoin.toLocaleString()}\n`;
        message += `   🟣 SSCoin: ${sSCoin.toLocaleString()}\n\n`;
      });

      // Calculate totals
      const totalECoin = sortedTeams.reduce((sum, t) => 
        sum + (t.team.euro_balance ?? t.team.balance ?? 0), 0
      );
      const totalSSCoin = sortedTeams.reduce((sum, t) => 
        sum + (t.team.dollar_balance ?? 0), 0
      );

      message += `──────────────────────────────\n`;
      message += `*TOTALS*\n`;
      message += `🔵 eCoin: ${totalECoin.toLocaleString()}\n`;
      message += `🟣 SSCoin: ${totalSSCoin.toLocaleString()}\n\n`;
      message += `📊 ${sortedTeams.length} teams\n`;
      message += `🕐 ${new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}\n`;

      navigator.clipboard.writeText(message).then(() => {
        alert('✅ Team balances copied to clipboard!\nPaste in WhatsApp.');
      }).catch(err => {
        console.error('Failed to copy:', err);
        alert('❌ Failed to copy. Please try again.');
      });
    } catch (error) {
      console.error('Error generating WhatsApp message:', error);
      alert('❌ Error generating summary.');
    }
  };

  if (loading || loadingTeams) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#0066FF] mx-auto"></div>
          <p className="mt-6 text-gray-600 font-medium">Loading teams...</p>
        </div>
      </div>
    );
  }

  if (!user || !isCommitteeAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen py-6 px-4 sm:px-6 lg:px-8">
      <div className="container mx-auto max-w-screen-2xl">
        
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold gradient-text mb-3">
                Season Teams
              </h1>
              <p className="text-gray-600 text-lg">
                Manage and monitor all registered teams
              </p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={copyBalancesToWhatsApp}
                className="inline-flex items-center justify-center px-5 py-3 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                title="Copy all team balances to WhatsApp"
              >
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
                Copy Balances
              </button>
              
              <Link 
                href="/dashboard/committee" 
                className="inline-flex items-center justify-center px-5 py-3 bg-gradient-to-r from-[#0066FF] to-blue-600 hover:from-[#0052CC] hover:to-blue-700 text-white text-sm font-semibold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 glass rounded-2xl p-4 bg-red-50/50 border border-red-200/50 text-red-700 flex items-center animate-fade-in">
            <svg className="w-5 h-5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          <div className="glass rounded-2xl p-5 shadow-xl border border-white/30 hover:border-[#0066FF]/40 transition-all hover:-translate-y-1">
            <div className="flex items-center justify-between mb-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-[#0066FF] to-blue-600 shadow-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
            <div className="text-sm text-gray-600 mb-1">Total Teams</div>
            <div className="text-3xl font-bold gradient-text">{teams.length}</div>
          </div>

          <div className="glass rounded-2xl p-5 shadow-xl border border-white/30 hover:border-purple-500/40 transition-all hover:-translate-y-1">
            <div className="flex items-center justify-between mb-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
            <div className="text-sm text-gray-600 mb-1">Total Players</div>
            <div className="text-3xl font-bold text-purple-600">
              {teams.reduce((sum, team) => sum + team.totalPlayers, 0)}
            </div>
          </div>

          <div className="glass rounded-2xl p-5 shadow-xl border border-white/30 hover:border-amber-500/40 transition-all hover:-translate-y-1">
            <div className="flex items-center justify-between mb-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 shadow-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </div>
            </div>
            <div className="text-sm text-gray-600 mb-1">Avg Rating</div>
            <div className="text-3xl font-bold text-amber-600">
              {teams.length > 0 
                ? (teams.reduce((sum, team) => sum + team.avgRating, 0) / teams.length).toFixed(1)
                : '0.0'
              }
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="glass rounded-3xl p-6 shadow-xl border border-white/30 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <svg className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search teams..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 glass rounded-xl border border-white/20 focus:border-[#0066FF]/50 focus:outline-none focus:ring-2 focus:ring-[#0066FF]/20 transition-all"
              />
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setSortBy('name')}
                className={`px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                  sortBy === 'name'
                    ? 'bg-gradient-to-r from-[#0066FF] to-blue-600 text-white shadow-lg'
                    : 'glass hover:bg-white/50 text-gray-700'
                }`}
              >
                Name
              </button>
              <button
                onClick={() => setSortBy('players')}
                className={`px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                  sortBy === 'players'
                    ? 'bg-gradient-to-r from-[#0066FF] to-blue-600 text-white shadow-lg'
                    : 'glass hover:bg-white/50 text-gray-700'
                }`}
              >
                Players
              </button>
              <button
                onClick={() => setSortBy('balance')}
                className={`px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                  sortBy === 'balance'
                    ? 'bg-gradient-to-r from-[#0066FF] to-blue-600 text-white shadow-lg'
                    : 'glass hover:bg-white/50 text-gray-700'
                }`}
              >
                Balance
              </button>
            </div>
          </div>
          
          {searchQuery && (
            <div className="mt-4 text-sm text-gray-600">
              Found {filteredTeams.length} team{filteredTeams.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Teams Grid */}
        <div className="glass rounded-3xl p-6 shadow-xl border border-white/30">
          {filteredTeams.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredTeams.map((teamData) => (
                <div
                  key={teamData.team.id}
                  className="glass rounded-2xl p-5 border border-white/20 hover:border-[#0066FF]/40 transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
                >
                  {/* Team Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="h-14 w-14 flex-shrink-0 bg-gradient-to-br from-[#0066FF]/10 to-blue-500/10 rounded-xl flex items-center justify-center p-1.5 shadow-md">
                        {teamData.team.logoUrl ? (
                          <Image 
                            src={teamData.team.logoUrl} 
                            alt={teamData.team.name} 
                            width={56} 
                            height={56} 
                            className="object-contain w-full h-full" 
                          />
                        ) : (
                          <svg className="w-7 h-7 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-900 text-lg truncate">{teamData.team.name}</h3>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 mt-1">
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                          </svg>
                          Registered
                        </span>
                      </div>
                    </div>
                    
                    <Link
                      href={`/dashboard/committee/teams/${teamData.team.id}`}
                      className="p-2.5 rounded-xl bg-gradient-to-br from-[#0066FF] to-blue-600 text-white hover:from-[#0052CC] hover:to-blue-700 transition-all shadow-md hover:shadow-lg flex-shrink-0"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </Link>
                  </div>

                  {/* Stats Grid */}
                  <div className="space-y-2.5">
                    {teamData.team.dollar_balance !== undefined || teamData.team.euro_balance !== undefined ? (
                      <>
                        <div className="flex items-center justify-between text-sm glass rounded-lg p-2.5">
                          <span className="text-gray-700 font-medium flex items-center">
                            SSCoin Balance
                          </span>
                          <span className="font-bold text-green-700">
                            SSCoin {teamData.team.dollar_balance?.toLocaleString() ?? '0'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm glass rounded-lg p-2.5">
                          <span className="text-gray-700 font-medium flex items-center">
                            eCoin Balance
                          </span>
                          <span className="font-bold text-blue-700">
                            eCoin {teamData.team.euro_balance?.toLocaleString() ?? '0'}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-between text-sm glass rounded-lg p-2.5">
                        <span className="text-gray-700 font-medium">Balance</span>
                        <span className="font-bold text-[#0066FF]">
                          eCoin {teamData.team.balance.toLocaleString()}
                        </span>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between text-sm glass rounded-lg p-2.5">
                      <span className="text-gray-700 font-medium">Total Players</span>
                      <span className="font-bold text-gray-900">{teamData.totalPlayers}</span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm glass rounded-lg p-2.5">
                      <span className="text-gray-700 font-medium">Avg Rating</span>
                      <span className="font-bold text-amber-600">
                        ⭐ {teamData.avgRating.toFixed(1)}
                      </span>
                    </div>
                  </div>

                  {/* Contract Info */}
                  {(teamData.team.contract_id || teamData.team.skipped_seasons || teamData.team.penalty_amount) && (
                    <div className="mt-4 pt-4 border-t border-gray-200/50">
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
                  )}

                  {/* Position Breakdown */}
                  <div className="mt-4 pt-4 border-t border-gray-200/50">
                    <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                      <span className="font-semibold">Squad Composition</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(teamData.positionBreakdown)
                        .filter(([_, count]) => count > 0)
                        .map(([position, count]) => (
                          <span
                            key={position}
                            className="text-xs px-2.5 py-1 bg-gradient-to-r from-[#0066FF]/10 to-blue-500/10 text-[#0066FF] rounded-full font-semibold border border-[#0066FF]/20"
                          >
                            {position}: {count}
                          </span>
                        ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <svg className="w-20 h-20 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <h3 className="text-xl font-bold text-gray-600 mb-2">
                {searchQuery ? 'No teams found' : 'No teams registered'}
              </h3>
              <p className="text-gray-500">
                {searchQuery 
                  ? 'Try adjusting your search query'
                  : 'Teams will appear here once they register for the season'
                }
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
