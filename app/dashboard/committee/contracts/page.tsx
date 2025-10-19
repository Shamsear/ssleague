'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { db } from '@/lib/firebase/config';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import Link from 'next/link';

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
        // Fetch all realplayer documents for current and next season
        const currentSeasonNumber = parseInt(userSeasonId.replace(/\D/g, ''));
        const seasonPrefix = userSeasonId.replace(/\d+$/, '');
        const nextSeasonId = `${seasonPrefix}${currentSeasonNumber + 1}`;

        const currentSeasonQuery = query(
          collection(db, 'realplayer'),
          where('season_id', '==', userSeasonId)
        );
        const nextSeasonQuery = query(
          collection(db, 'realplayer'),
          where('season_id', '==', nextSeasonId)
        );

        const [currentSnapshot, nextSnapshot] = await Promise.all([
          getDocs(currentSeasonQuery),
          getDocs(nextSeasonQuery),
        ]);

        const allContracts: Contract[] = [];

        // Process current season
        currentSnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.contract_id) {
            allContracts.push({
              player_id: data.player_id || '',
              name: data.name || data.player_name || '',
              contract_id: data.contract_id,
              contract_start_season: data.contract_start_season || '',
              contract_end_season: data.contract_end_season || '',
              contract_length: data.contract_length || 2,
              is_auto_registered: data.is_auto_registered || false,
              season_id: data.season_id,
              team_id: data.team_id,
              team_name: data.team_name,
              category_id: data.category_id,
              category_name: data.category_name,
              registration_date: data.registration_date,
            });
          }
        });

        // Process next season
        nextSnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.contract_id) {
            allContracts.push({
              player_id: data.player_id || '',
              name: data.name || data.player_name || '',
              contract_id: data.contract_id,
              contract_start_season: data.contract_start_season || '',
              contract_end_season: data.contract_end_season || '',
              contract_length: data.contract_length || 2,
              is_auto_registered: data.is_auto_registered || false,
              season_id: data.season_id,
              team_id: data.team_id,
              team_name: data.team_name,
              category_id: data.category_id,
              category_name: data.category_name,
              registration_date: data.registration_date,
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
    if (!confirm(`Are you sure you want to cancel the contract for ${playerName}? This will remove both season registrations.`)) {
      return;
    }

    try {
      const contractDocs = groupedContracts.get(contractId);
      if (!contractDocs) return;

      // Delete all documents associated with this contract
      for (const doc of contractDocs) {
        const docId = `${doc.player_id}_${doc.season_id}`;
        await deleteDoc(doc(db, 'realplayer', docId));
      }

      alert('Contract cancelled successfully');
      window.location.reload();
    } catch (error) {
      console.error('Error cancelling contract:', error);
      alert('Failed to cancel contract');
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading contracts...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'committee_admin') {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold gradient-text">Player Contracts</h1>
          <p className="text-gray-500 mt-1">Manage 2-season player contracts</p>
          <Link
            href="/dashboard/committee"
            className="inline-flex items-center mt-2 text-[#0066FF] hover:text-[#0052CC]"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 backdrop-blur-md rounded-xl p-4 border border-blue-200/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Total Contracts</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{groupedContracts.size}</p>
            </div>
            <div className="p-3 bg-blue-500/20 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 backdrop-blur-md rounded-xl p-4 border border-green-200/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Current Season</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {Array.from(groupedContracts.values()).filter(docs => docs.some(d => d.season_id === userSeasonId && !d.is_auto_registered)).length}
              </p>
            </div>
            <div className="p-3 bg-green-500/20 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 backdrop-blur-md rounded-xl p-4 border border-purple-200/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Next Season (Auto)</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {Array.from(groupedContracts.values()).filter(docs => docs.some(d => d.is_auto_registered)).length}
              </p>
            </div>
            <div className="p-3 bg-purple-500/20 rounded-lg">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl p-6 mb-6 border border-gray-100/20">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Filter Contracts</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or player ID..."
              className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
            >
              <option value="all">All Contracts</option>
              <option value="current">Current Season</option>
              <option value="future">Next Season (Auto)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Contracts Table */}
      <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl overflow-hidden border border-gray-100/20">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">
            Contracts List ({filteredContracts.length})
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
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No contracts found
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
                          className="text-red-600 hover:text-red-800 font-medium"
                        >
                          Cancel Contract
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
  );
}
