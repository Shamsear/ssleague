'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { db } from '@/lib/firebase/config';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import Link from 'next/link';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface Contract {
  player_id: string;
  name: string;
  contract_id: string;
  contract_start_season: string;
  contract_end_season: string;
  contract_length: number;
  is_auto_registered: boolean;
  season_id: string;
  team_id?: string;
  team_name?: string;
  category_id?: string;
  category_name?: string;
  registration_date?: any;
}

export default function ContractsPage() {
  const { user, loading } = useAuth();
  const { userSeasonId } = usePermissions();
  const router = useRouter();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [groupedContracts, setGroupedContracts] = useState<Map<string, Contract[]>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'current' | 'future'>('all');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'committee_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const fetchContracts = async () => {
      if (!userSeasonId) {
        setIsLoading(false);
        return;
      }

      try {
        // Calculate current and next season
        const currentSeasonNumber = parseInt(userSeasonId.replace(/\D/g, ''));
        const seasonPrefix = userSeasonId.replace(/\d+$/, '');
        const nextSeasonId = `${seasonPrefix}${currentSeasonNumber + 1}`;

        // Fetch contracts from Neon player_seasons API for both seasons
        const [currentResponse, nextResponse] = await Promise.all([
          fetchWithTokenRefresh(`/api/stats/players?seasonId=${userSeasonId}&limit=1000`),
          fetchWithTokenRefresh(`/api/stats/players?seasonId=${nextSeasonId}&limit=1000`),
        ]);

        const [currentResult, nextResult] = await Promise.all([
          currentResponse.json(),
          nextResponse.json(),
        ]);

        const allContracts: Contract[] = [];

        // Process current season players
        const currentPlayers = currentResult.success ? currentResult.data : [];
        currentPlayers.forEach((player: any) => {
          if (player.contract_id) {
            allContracts.push({
              player_id: player.player_id || '',
              name: player.player_name || '',
              contract_id: player.contract_id,
              contract_start_season: player.contract_start_season || '',
              contract_end_season: player.contract_end_season || '',
              contract_length: player.contract_length || 2,
              is_auto_registered: player.is_auto_registered || false,
              season_id: player.season_id,
              team_id: player.team_id,
              team_name: player.team_name,
              category_id: player.category_id,
              category_name: player.category_name,
              registration_date: player.registration_date,
            });
          }
        });

        // Process next season players
        const nextPlayers = nextResult.success ? nextResult.data : [];
        nextPlayers.forEach((player: any) => {
          if (player.contract_id) {
            allContracts.push({
              player_id: player.player_id || '',
              name: player.player_name || '',
              contract_id: player.contract_id,
              contract_start_season: player.contract_start_season || '',
              contract_end_season: player.contract_end_season || '',
              contract_length: player.contract_length || 2,
              is_auto_registered: player.is_auto_registered || false,
              season_id: player.season_id,
              team_id: player.team_id,
              team_name: player.team_name,
              category_id: player.category_id,
              category_name: player.category_name,
              registration_date: player.registration_date,
            });
          }
        });

        console.log(`📋 Fetched ${allContracts.length} contract entries`);

        // Group by contract_id
        const grouped = new Map<string, Contract[]>();
        allContracts.forEach(contract => {
          const existing = grouped.get(contract.contract_id) || [];
          existing.push(contract);
          grouped.set(contract.contract_id, existing);
        });

        console.log(`📋 Grouped into ${grouped.size} unique contracts`);

        setContracts(allContracts);
        setGroupedContracts(grouped);
      } catch (error) {
        console.error('Error fetching contracts:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (user?.role === 'committee_admin' && userSeasonId) {
      fetchContracts();
    }
  }, [user, userSeasonId]);

  const handleCancelContract = async (contractId: string, playerName: string) => {
    if (!confirm(`Are you sure you want to cancel the contract for ${playerName}? This will release the player and apply refund logic.`)) {
      return;
    }

    try {
      const contractDocs = groupedContracts.get(contractId);
      if (!contractDocs) return;

      const firstDoc = contractDocs[0];
      
      // Call the release API to properly handle the contract cancellation
      const response = await fetchWithTokenRefresh('/api/players/release', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          player_id: firstDoc.player_id,
          season_id: userSeasonId,
          released_by: user?.email || 'admin',
          released_by_name: user?.email || 'Admin'
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to cancel contract');
      }

      // After successful release, delete the contract season documents
      for (const doc of contractDocs) {
        const docId = `${doc.player_id}_${doc.season_id}`;
        try {
          await deleteDoc(doc(db, 'realplayer', docId));
        } catch (err) {
          console.warn(`Failed to delete contract doc ${docId}:`, err);
        }
      }

      alert(`Contract cancelled successfully. ${result.refund_amount > 0 ? `Refund: $${result.refund_amount}` : 'No refund applicable.'}`);
      window.location.reload();
    } catch (error) {
      console.error('Error cancelling contract:', error);
      alert(`Failed to cancel contract: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const filteredContracts = Array.from(groupedContracts.entries()).filter(([contractId, docs]) => {
    // Search filter
    const firstDoc = docs[0];
    if (searchTerm && !firstDoc.name.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !firstDoc.player_id.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }

    // Status filter
    if (statusFilter === 'current') {
      return docs.some(d => d.season_id === userSeasonId && !d.is_auto_registered);
    } else if (statusFilter === 'future') {
      return docs.some(d => d.is_auto_registered);
    }

    return true;
  });

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-lg text-gray-600 font-medium">Loading contracts...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'committee_admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-4 sm:py-8 px-4">
      <div className="container mx-auto max-w-screen-2xl">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Player Contracts</h1>
              <p className="text-gray-600 mt-2 text-sm sm:text-base">Manage 2-season player contracts</p>
            </div>
            <Link
              href="/dashboard/committee"
              className="inline-flex items-center px-4 sm:px-6 py-2.5 sm:py-3 glass rounded-xl border border-white/20 text-gray-700 hover:bg-white hover:shadow-lg transition-all text-sm font-medium whitespace-nowrap"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back
            </Link>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="glass rounded-2xl p-4 sm:p-5 bg-gradient-to-br from-blue-50 to-blue-100/50 shadow-lg border border-blue-200/30 hover:shadow-xl transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs sm:text-sm text-blue-900/70 font-medium mb-1">Total Contracts</p>
                <p className="text-2xl sm:text-3xl font-bold text-blue-900">{groupedContracts.size}</p>
              </div>
              <div className="p-2 sm:p-3 bg-blue-500/20 rounded-lg">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="glass rounded-2xl p-4 sm:p-5 bg-gradient-to-br from-green-50 to-green-100/50 shadow-lg border border-green-200/30 hover:shadow-xl transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs sm:text-sm text-green-900/70 font-medium mb-1">Current Season</p>
                <p className="text-2xl sm:text-3xl font-bold text-green-900">
                  {Array.from(groupedContracts.values()).filter(docs => docs.some(d => d.season_id === userSeasonId && !d.is_auto_registered)).length}
                </p>
              </div>
              <div className="p-2 sm:p-3 bg-green-500/20 rounded-lg">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="glass rounded-2xl p-4 sm:p-5 bg-gradient-to-br from-purple-50 to-purple-100/50 shadow-lg border border-purple-200/30 hover:shadow-xl transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs sm:text-sm text-purple-900/70 font-medium mb-1">Next Season (Auto)</p>
                <p className="text-2xl sm:text-3xl font-bold text-purple-900">
                  {Array.from(groupedContracts.values()).filter(docs => docs.some(d => d.is_auto_registered)).length}
                </p>
              </div>
              <div className="p-2 sm:p-3 bg-purple-500/20 rounded-lg">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
      </div>

        {/* Filters */}
        <div className="glass rounded-3xl p-4 sm:p-6 mb-6 shadow-lg border border-white/20">
          <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-4">🔍 Filter Contracts</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Search</label>
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name or player ID..."
                  className="w-full py-2.5 pl-10 pr-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0066FF] focus:border-transparent outline-none text-sm"
                />
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full py-2.5 px-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0066FF] focus:border-transparent outline-none text-sm"
              >
                <option value="all">All Contracts</option>
                <option value="current">Current Season</option>
                <option value="future">Next Season (Auto)</option>
              </select>
            </div>
        </div>
      </div>

        {/* Contracts Table */}
        <div className="glass rounded-3xl shadow-xl border border-white/20 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">
              📋 Contracts List <span className="text-sm font-normal text-gray-600">({filteredContracts.length} contracts)</span>
            </h3>
          </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Player
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contract Period
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Team / Category
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white/60 divide-y divide-gray-200/50">
              {filteredContracts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-gray-500 font-medium">No contracts found</p>
                      <p className="text-gray-400 text-sm mt-1">Try adjusting your filters</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredContracts.map(([contractId, docs]) => {
                  const firstDoc = docs[0];
                  const hasCurrentSeason = docs.some(d => d.season_id === userSeasonId);
                  const hasFutureSeason = docs.some(d => d.is_auto_registered);

                  return (
                    <tr key={contractId} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{firstDoc.name}</div>
                          <div className="text-sm text-gray-500">{firstDoc.player_id}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm">
                          <div className="font-medium text-gray-900">
                            S{firstDoc.contract_start_season?.replace(/\D/g, '')} - S{firstDoc.contract_end_season?.replace(/\D/g, '')}
                          </div>
                          <div className="text-gray-500 text-xs">2 Seasons</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm">
                          <div className="text-gray-900">{firstDoc.team_name || 'Not assigned'}</div>
                          {firstDoc.category_name && (
                            <div className="text-gray-500 text-xs">{firstDoc.category_name}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          {hasCurrentSeason && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              ✓ Active (Current)
                            </span>
                          )}
                          {hasFutureSeason && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              ⏱ Future (Auto)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => handleCancelContract(contractId, firstDoc.name)}
                          className="px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-xs font-medium transition-colors"
                        >
                          Cancel
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      </div>
    </div>
  );
}
