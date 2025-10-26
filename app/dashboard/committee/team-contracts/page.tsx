'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useModal } from '@/hooks/useModal';
import AlertModal from '@/components/modals/AlertModal';
import ConfirmModal from '@/components/modals/ConfirmModal';
import { usePermissions } from '@/hooks/usePermissions';
import ContractInfo from '@/components/ContractInfo';
import { db } from '@/lib/firebase/config';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';

interface TeamContract {
  team_id: string;
  team_name: string;
  team_code?: string;
  season_id: string;
  // Contract fields
  skipped_seasons?: number;
  penalty_amount?: number;
  last_played_season?: string;
  contract_id?: string;
  contract_start_season?: string;
  contract_end_season?: string;
  is_auto_registered?: boolean;
  // Budget fields
  budget?: number;
  initial_budget?: number;
  football_budget?: number;
  real_player_budget?: number;
  status?: string;
}

export default function TeamContractsManagementPage() {
  const { user, loading } = useAuth();
  const { userSeasonId } = usePermissions();
  const router = useRouter();
  const [teamContracts, setTeamContracts] = useState<TeamContract[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [contractFilter, setContractFilter] = useState<'all' | 'active' | 'auto' | 'penalty'>('all');
  const [selectedTeam, setSelectedTeam] = useState<TeamContract | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // Modal system
  const {
    alertState,
    showAlert,
    closeAlert,
    confirmState,
    showConfirm,
    closeConfirm,
    handleConfirm,
  } = useModal();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'committee_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const fetchTeamContracts = async () => {
      if (!userSeasonId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);

        // Fetch all team_seasons for current and next season
        const currentSeasonNumber = parseInt(userSeasonId.replace(/\D/g, ''));
        const seasonPrefix = userSeasonId.replace(/\d+$/, '');
        const nextSeasonId = `${seasonPrefix}${currentSeasonNumber + 1}`;

        const currentSeasonQuery = query(
          collection(db, 'team_seasons'),
          where('season_id', '==', userSeasonId),
          where('status', '==', 'registered')
        );
        const nextSeasonQuery = query(
          collection(db, 'team_seasons'),
          where('season_id', '==', nextSeasonId),
          where('status', '==', 'registered')
        );

        const [currentSnapshot, nextSnapshot] = await Promise.all([
          getDocs(currentSeasonQuery),
          getDocs(nextSeasonQuery),
        ]);

        const teamContractsMap = new Map<string, TeamContract>();

        // Process current season
        currentSnapshot.docs.forEach(doc => {
          const data = doc.data();
          const teamId = data.team_id;
          
          if (!teamContractsMap.has(teamId)) {
            teamContractsMap.set(teamId, {
              team_id: teamId,
              team_name: data.team_name || 'Unknown Team',
              team_code: data.team_code,
              season_id: data.season_id,
              skipped_seasons: data.skipped_seasons,
              penalty_amount: data.penalty_amount,
              last_played_season: data.last_played_season,
              contract_id: data.contract_id,
              contract_start_season: data.contract_start_season,
              contract_end_season: data.contract_end_season,
              is_auto_registered: data.is_auto_registered,
              budget: data.budget,
              initial_budget: data.initial_budget,
              football_budget: data.football_budget,
              real_player_budget: data.real_player_budget,
              status: data.status,
            });
          }
        });

        // Process next season to mark auto-registered teams
        nextSnapshot.docs.forEach(doc => {
          const data = doc.data();
          const teamId = data.team_id;
          
          const existing = teamContractsMap.get(teamId);
          if (existing && data.is_auto_registered) {
            existing.is_auto_registered = true;
          } else if (!teamContractsMap.has(teamId) && data.is_auto_registered) {
            // Team only in next season (auto-registered)
            teamContractsMap.set(teamId, {
              team_id: teamId,
              team_name: data.team_name || 'Unknown Team',
              team_code: data.team_code,
              season_id: data.season_id,
              skipped_seasons: data.skipped_seasons,
              penalty_amount: data.penalty_amount,
              last_played_season: data.last_played_season,
              contract_id: data.contract_id,
              contract_start_season: data.contract_start_season,
              contract_end_season: data.contract_end_season,
              is_auto_registered: true,
              budget: data.budget,
              initial_budget: data.initial_budget,
              football_budget: data.football_budget,
              real_player_budget: data.real_player_budget,
              status: data.status,
            });
          }
        });

        const allTeamContracts = Array.from(teamContractsMap.values());
        console.log(`📋 Fetched ${allTeamContracts.length} team contracts`);

        setTeamContracts(allTeamContracts);
      } catch (error) {
        console.error('Error fetching team contracts:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (user?.role === 'committee_admin' && userSeasonId) {
      fetchTeamContracts();
    }
  }, [user, userSeasonId]);

  const handleEditContract = (team: TeamContract) => {
    setSelectedTeam(team);
    setShowEditModal(true);
  };

  const handleSaveContract = async () => {
    if (!selectedTeam || !userSeasonId) return;

    try {
      const teamSeasonId = `${selectedTeam.team_id}_${userSeasonId}`;
      const teamSeasonRef = doc(db, 'team_seasons', teamSeasonId);

      await updateDoc(teamSeasonRef, {
        skipped_seasons: selectedTeam.skipped_seasons || 0,
        penalty_amount: selectedTeam.penalty_amount || 0,
        last_played_season: selectedTeam.last_played_season || null,
        contract_id: selectedTeam.contract_id || null,
        contract_start_season: selectedTeam.contract_start_season || null,
        contract_end_season: selectedTeam.contract_end_season || null,
        is_auto_registered: selectedTeam.is_auto_registered || false,
      });

      showAlert({
        type: 'success',
        title: 'Success',
        message: 'Team contract updated successfully'
      });
      setShowEditModal(false);
      window.location.reload();
    } catch (error) {
      console.error('Error updating team contract:', error);
      showAlert({
        type: 'error',
        title: 'Update Failed',
        message: 'Failed to update team contract'
      });
    }
  };

  const handleClearPenalty = async (team: TeamContract) => {
    const confirmed = await showConfirm({
      type: 'warning',
      title: 'Clear Penalty',
      message: `Clear penalty for ${team.team_name}? This will reset skipped seasons and penalty amount.`,
      confirmText: 'Clear Penalty',
      cancelText: 'Cancel'
    });
    
    if (!confirmed) {
      return;
    }

    try {
      const teamSeasonId = `${team.team_id}_${userSeasonId}`;
      const teamSeasonRef = doc(db, 'team_seasons', teamSeasonId);

      await updateDoc(teamSeasonRef, {
        skipped_seasons: 0,
        penalty_amount: 0,
      });

      showAlert({
        type: 'success',
        title: 'Success',
        message: 'Penalty cleared successfully'
      });
      window.location.reload();
    } catch (error) {
      console.error('Error clearing penalty:', error);
      showAlert({
        type: 'error',
        title: 'Clear Failed',
        message: 'Failed to clear penalty'
      });
    }
  };

  const filteredTeams = teamContracts.filter(team => {
    // Search filter
    if (searchTerm && !team.team_name.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !team.team_code?.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }

    // Contract filter
    if (contractFilter === 'active' && !team.contract_id) {
      return false;
    }
    if (contractFilter === 'auto' && !team.is_auto_registered) {
      return false;
    }
    if (contractFilter === 'penalty' && (!team.penalty_amount || team.penalty_amount === 0)) {
      return false;
    }

    return true;
  });

  // Statistics
  const stats = {
    total: teamContracts.length,
    withContracts: teamContracts.filter(t => t.contract_id).length,
    autoRegistered: teamContracts.filter(t => t.is_auto_registered).length,
    withPenalties: teamContracts.filter(t => t.penalty_amount && t.penalty_amount > 0).length,
    totalPenalties: teamContracts.reduce((sum, t) => sum + (t.penalty_amount || 0), 0),
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading team contracts...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'committee_admin') {
    return null;
  }

  return (
    <div className="min-h-screen py-4 sm:py-8 px-4">
      <div className="container mx-auto max-w-screen-xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold gradient-text">Team Contract Management</h1>
              <p className="text-gray-600 mt-1">Manage 2-season team contracts and penalties</p>
            </div>
            <Link
              href="/dashboard/committee"
              className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors text-sm font-medium"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 backdrop-blur-md rounded-xl p-4 border border-blue-200/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Total Teams</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
              </div>
              <div className="p-3 bg-blue-500/20 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 backdrop-blur-md rounded-xl p-4 border border-green-200/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Active Contracts</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.withContracts}</p>
              </div>
              <div className="p-3 bg-green-500/20 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 backdrop-blur-md rounded-xl p-4 border border-purple-200/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Auto-Registered</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.autoRegistered}</p>
              </div>
              <div className="p-3 bg-purple-500/20 rounded-lg">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-500/10 to-red-600/5 backdrop-blur-md rounded-xl p-4 border border-red-200/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">With Penalties</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.withPenalties}</p>
              </div>
              <div className="p-3 bg-red-500/20 rounded-lg">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 backdrop-blur-md rounded-xl p-4 border border-orange-200/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Total Penalties</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">€{stats.totalPenalties.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-orange-500/20 rounded-lg">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="glass rounded-3xl p-6 mb-6 shadow-lg border border-gray-100/30">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Filter Teams</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by team name or code..."
                className="w-full py-2 px-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0066FF] focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Contract Status</label>
              <select
                value={contractFilter}
                onChange={(e) => setContractFilter(e.target.value as any)}
                className="w-full py-2 px-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0066FF] focus:border-transparent outline-none"
              >
                <option value="all">All Teams</option>
                <option value="active">With Active Contracts</option>
                <option value="auto">Auto-Registered</option>
                <option value="penalty">With Penalties</option>
              </select>
            </div>
          </div>
        </div>

        {/* Teams Table */}
        <div className="glass rounded-3xl shadow-lg border border-gray-100/30 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">
              Team Contracts ({filteredTeams.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Team
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contract Info
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Budget
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Penalty
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white/60 divide-y divide-gray-200/50">
                {filteredTeams.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      No teams found
                    </td>
                  </tr>
                ) : (
                  filteredTeams.map((team) => (
                    <tr key={team.team_id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{team.team_name}</div>
                          <div className="text-sm text-gray-500">{team.team_code || team.team_id}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <ContractInfo
                          skippedSeasons={team.skipped_seasons}
                          penaltyAmount={team.penalty_amount}
                          lastPlayedSeason={team.last_played_season}
                          contractId={team.contract_id}
                          contractStartSeason={team.contract_start_season}
                          contractEndSeason={team.contract_end_season}
                          isAutoRegistered={team.is_auto_registered}
                          compact
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm">
                          {team.football_budget !== undefined || team.real_player_budget !== undefined ? (
                            <>
                              <div className="font-medium text-blue-700">€{team.football_budget?.toLocaleString() || '0'}</div>
                              <div className="text-gray-500 text-xs">${team.real_player_budget?.toLocaleString() || '0'}</div>
                            </>
                          ) : (
                            <div className="font-medium text-gray-900">€{team.budget?.toLocaleString() || '0'}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {team.penalty_amount && team.penalty_amount > 0 ? (
                          <div className="text-sm">
                            <div className="font-medium text-red-700">-€{team.penalty_amount.toLocaleString()}</div>
                            <div className="text-gray-500 text-xs">{team.skipped_seasons} season{team.skipped_seasons !== 1 ? 's' : ''}</div>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">No penalty</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditContract(team)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            Edit
                          </button>
                          {team.penalty_amount && team.penalty_amount > 0 && (
                            <button
                              onClick={() => handleClearPenalty(team)}
                              className="text-green-600 hover:text-green-800 text-sm font-medium"
                            >
                              Clear Penalty
                            </button>
                          )}
                          <Link
                            href={`/dashboard/committee/teams/${team.team_id}`}
                            className="text-gray-600 hover:text-gray-800 text-sm font-medium"
                          >
                            View Details
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Edit Modal */}
        {showEditModal && selectedTeam && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900">Edit Team Contract</h3>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Team: {selectedTeam.team_name}</h4>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contract ID</label>
                  <input
                    type="text"
                    value={selectedTeam.contract_id || ''}
                    onChange={(e) => setSelectedTeam({ ...selectedTeam, contract_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0066FF] focus:border-transparent"
                    placeholder="e.g., TEAM_S15_S16_001"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Season</label>
                    <input
                      type="text"
                      value={selectedTeam.contract_start_season || ''}
                      onChange={(e) => setSelectedTeam({ ...selectedTeam, contract_start_season: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0066FF] focus:border-transparent"
                      placeholder="e.g., Season15"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Season</label>
                    <input
                      type="text"
                      value={selectedTeam.contract_end_season || ''}
                      onChange={(e) => setSelectedTeam({ ...selectedTeam, contract_end_season: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0066FF] focus:border-transparent"
                      placeholder="e.g., Season16"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Skipped Seasons</label>
                    <input
                      type="number"
                      value={selectedTeam.skipped_seasons || 0}
                      onChange={(e) => setSelectedTeam({ ...selectedTeam, skipped_seasons: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0066FF] focus:border-transparent"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Penalty Amount (€)</label>
                    <input
                      type="number"
                      value={selectedTeam.penalty_amount || 0}
                      onChange={(e) => setSelectedTeam({ ...selectedTeam, penalty_amount: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0066FF] focus:border-transparent"
                      min="0"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Played Season</label>
                  <input
                    type="text"
                    value={selectedTeam.last_played_season || ''}
                    onChange={(e) => setSelectedTeam({ ...selectedTeam, last_played_season: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0066FF] focus:border-transparent"
                    placeholder="e.g., Season13"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedTeam.is_auto_registered || false}
                    onChange={(e) => setSelectedTeam({ ...selectedTeam, is_auto_registered: e.target.checked })}
                    className="w-4 h-4 text-[#0066FF] border-gray-300 rounded focus:ring-[#0066FF]"
                  />
                  <label className="ml-2 text-sm text-gray-700">Auto-registered for next season</label>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveContract}
                  className="px-4 py-2 bg-[#0066FF] text-white rounded-lg hover:bg-[#0052CC] transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Components */}
      <AlertModal
        isOpen={alertState.isOpen}
        onClose={closeAlert}
        title={alertState.title}
        message={alertState.message}
        type={alertState.type}
      />

      <ConfirmModal
        isOpen={confirmState.isOpen}
        onConfirm={handleConfirm}
        onCancel={closeConfirm}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        cancelText={confirmState.cancelText}
        type={confirmState.type}
      />
    </div>
  );
}
