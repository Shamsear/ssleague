'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import ContractInfo from '@/components/ContractInfo';
import { db } from '@/lib/firebase/config';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

interface TeamContractData {
  skipped_seasons?: number;
  penalty_amount?: number;
  last_played_season?: string;
  contract_id?: string;
  contract_start_season?: string;
  contract_end_season?: string;
  is_auto_registered?: boolean;
  team_name?: string;
  budget?: number;
  initial_budget?: number;
}

interface RealPlayerContract {
  player_id: string;
  name: string;
  contract_id: string;
  contract_start_season: string;
  contract_end_season: string;
  contract_length: number;
  is_auto_registered: boolean;
  season_id: string;
  category_name?: string;
  registration_date?: any;
  auction_value?: number;
  salary_per_match?: number;
  star_rating?: number;
  category?: string;
}

export default function TeamContractsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [teamContract, setTeamContract] = useState<TeamContractData | null>(null);
  const [realPlayerContracts, setRealPlayerContracts] = useState<RealPlayerContract[]>([]);
  const [groupedContracts, setGroupedContracts] = useState<Map<string, RealPlayerContract[]>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [seasonId, setSeasonId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'current' | 'future'>('all');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'team') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const fetchContracts = async () => {
      if (!user?.uid) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);

        console.log('User UID:', user.uid);

        // Query team_seasons by user_id (the Firebase Auth UID)
        const teamSeasonsSnapshot = await getDocs(
          query(
            collection(db, 'team_seasons'),
            where('user_id', '==', user.uid),
            where('status', '==', 'registered')
          )
        );

        if (teamSeasonsSnapshot.empty) {
          console.log('No registered season found for user:', user.uid);
          setIsLoading(false);
          return;
        }

        const teamSeasonDoc = teamSeasonsSnapshot.docs[0];
        const teamSeasonData = teamSeasonDoc.data();
        const teamId = teamSeasonData.team_id; // The actual team ID (e.g., SSPSLT0013)
        const currentSeasonId = teamSeasonData.season_id;
        
        console.log('Found team_season:', teamSeasonDoc.id);
        console.log('Team ID:', teamId, '- Season ID:', currentSeasonId);
        setSeasonId(currentSeasonId);

        // Set team contract data
        setTeamContract({
          skipped_seasons: teamSeasonData.skipped_seasons,
          penalty_amount: teamSeasonData.penalty_amount,
          last_played_season: teamSeasonData.last_played_season,
          contract_id: teamSeasonData.contract_id,
          contract_start_season: teamSeasonData.contract_start_season,
          contract_end_season: teamSeasonData.contract_end_season,
          is_auto_registered: teamSeasonData.is_auto_registered,
          team_name: teamSeasonData.team_name,
          budget: teamSeasonData.budget,
          initial_budget: teamSeasonData.initial_budget,
        });

        // Fetch real player contracts for current and next season
        const currentSeasonNumber = parseInt(currentSeasonId.replace(/\D/g, ''));
        const seasonPrefix = currentSeasonId.replace(/\d+$/, '');
        const nextSeasonId = `${seasonPrefix}${currentSeasonNumber + 1}`;

        const currentSeasonQuery = query(
          collection(db, 'realplayer'),
          where('team_id', '==', teamId),
          where('season_id', '==', currentSeasonId)
        );
        const nextSeasonQuery = query(
          collection(db, 'realplayer'),
          where('team_id', '==', teamId),
          where('season_id', '==', nextSeasonId)
        );

        const [currentSnapshot, nextSnapshot] = await Promise.all([
          getDocs(currentSeasonQuery),
          getDocs(nextSeasonQuery),
        ]);

        const allContracts: RealPlayerContract[] = [];

        // Process current season
        currentSnapshot.docs.forEach(doc => {
          const data = doc.data();
          console.log('Current season player doc:', doc.id, '- contract_id:', data.contract_id, '- team_id:', data.team_id);
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
              category_name: data.category_name,
              registration_date: data.registration_date,
              auction_value: data.auction_value,
              salary_per_match: data.salary_per_match,
              star_rating: data.star_rating,
              category: data.category,
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
              category_name: data.category_name,
              registration_date: data.registration_date,
              auction_value: data.auction_value,
              salary_per_match: data.salary_per_match,
              star_rating: data.star_rating,
              category: data.category,
            });
          }
        });

        console.log(`📋 Fetched ${allContracts.length} player contract entries`);

        // Group by contract_id
        const grouped = new Map<string, RealPlayerContract[]>();
        allContracts.forEach(contract => {
          const existing = grouped.get(contract.contract_id) || [];
          existing.push(contract);
          grouped.set(contract.contract_id, existing);
        });

        console.log(`📋 Grouped into ${grouped.size} unique player contracts`);

        setRealPlayerContracts(allContracts);
        setGroupedContracts(grouped);
      } catch (error) {
        console.error('Error fetching contracts:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (user?.role === 'team') {
      fetchContracts();
    }
  }, [user]);

  const filteredContracts = Array.from(groupedContracts.entries()).filter(([contractId, docs]) => {
    // Search filter
    const firstDoc = docs[0];
    if (searchTerm && !firstDoc.name.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !firstDoc.player_id.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }

    // Status filter
    if (statusFilter === 'current') {
      return docs.some(d => d.season_id === seasonId && !d.is_auto_registered);
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

  if (!user || user.role !== 'team') {
    return null;
  }

  return (
    <div className="min-h-screen py-4 sm:py-8 px-4">
      <div className="container mx-auto max-w-screen-xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold gradient-text">Contract Management</h1>
              <p className="text-gray-600 mt-1">View your team and player contracts</p>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors text-sm font-medium"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Team Contract Section */}
        {teamContract && (
          <div className="glass rounded-3xl p-6 mb-8 shadow-lg border border-gray-100/30">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-800 flex items-center">
                  <svg className="w-6 h-6 mr-2 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Team Contract Status
                </h2>
                <p className="text-sm text-gray-600 mt-1">Your team's 2-season contract information</p>
              </div>
            </div>

            <ContractInfo
              skippedSeasons={teamContract.skipped_seasons}
              penaltyAmount={teamContract.penalty_amount}
              lastPlayedSeason={teamContract.last_played_season}
              contractId={teamContract.contract_id}
              contractStartSeason={teamContract.contract_start_season}
              contractEndSeason={teamContract.contract_end_season}
              isAutoRegistered={teamContract.is_auto_registered}
            />

            {/* Budget Summary */}
            {(teamContract.budget !== undefined || teamContract.initial_budget !== undefined) && (
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="glass-card p-4 rounded-xl border border-gray-200/50">
                  <h3 className="text-sm font-medium text-gray-600 mb-1">Initial Budget</h3>
                  <p className="text-2xl font-bold text-[#0066FF]">€{teamContract.initial_budget?.toLocaleString() || '15,000'}</p>
                </div>
                <div className="glass-card p-4 rounded-xl border border-gray-200/50">
                  <h3 className="text-sm font-medium text-gray-600 mb-1">Current Budget</h3>
                  <p className="text-2xl font-bold text-green-600">€{teamContract.budget?.toLocaleString() || '0'}</p>
                </div>
                {teamContract.penalty_amount && teamContract.penalty_amount > 0 && (
                  <div className="glass-card p-4 rounded-xl border border-red-200/50 bg-red-50/50">
                    <h3 className="text-sm font-medium text-red-600 mb-1">Applied Penalty</h3>
                    <p className="text-2xl font-bold text-red-700">-€{teamContract.penalty_amount?.toLocaleString()}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Real Player Contracts Section */}
        <div className="glass rounded-3xl p-6 shadow-lg border border-gray-100/30">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-800 flex items-center">
                <svg className="w-6 h-6 mr-2 text-[#9580FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Real Player Contracts
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {groupedContracts.size} player contract{groupedContracts.size !== 1 ? 's' : ''} • 
                2-season commitments
              </p>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="mb-6 flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by player name or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0066FF] focus:border-transparent outline-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-[#0066FF] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter('current')}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  statusFilter === 'current'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setStatusFilter('future')}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  statusFilter === 'future'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Future
              </button>
            </div>
          </div>

          {/* Contracts Table */}
          {filteredContracts.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-20 h-20 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">No Player Contracts</h3>
              <p className="text-gray-500">You don't have any real player contracts yet.</p>
            </div>
          ) : (
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
                      Category
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Value
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white/60 divide-y divide-gray-200/50">
                  {filteredContracts.map(([contractId, docs]) => {
                    const firstDoc = docs[0];
                    const hasCurrentSeason = docs.some(d => d.season_id === seasonId);
                    const hasFutureSeason = docs.some(d => d.is_auto_registered);

                    return (
                      <tr key={contractId} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-6 py-4">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{firstDoc.name}</div>
                            <div className="text-sm text-gray-500">{firstDoc.player_id}</div>
                            {firstDoc.star_rating && (
                              <div className="text-xs text-yellow-600 mt-1">
                                {'★'.repeat(firstDoc.star_rating)}{'☆'.repeat(10 - firstDoc.star_rating)}
                              </div>
                            )}
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
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${
                            firstDoc.category === 'legend' 
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {firstDoc.category === 'legend' ? '⭐ Legend' : 'Classic'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm">
                            {firstDoc.auction_value && (
                              <div className="font-medium text-gray-900">${firstDoc.auction_value.toLocaleString()}</div>
                            )}
                            {firstDoc.salary_per_match && (
                              <div className="text-gray-500 text-xs">${firstDoc.salary_per_match}/match</div>
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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Contract Info Note */}
          {filteredContracts.length > 0 && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">About Player Contracts</p>
                  <p>All real player contracts are 2-season commitments. Players marked as "Active" are playing in the current season, while "Future (Auto)" players will be automatically registered for the next season.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
