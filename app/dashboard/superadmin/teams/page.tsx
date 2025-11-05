'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { TeamData } from '@/types/team';
import {
  createTeam,
  updateTeam,
  deleteTeam,
  toggleTeamStatus,
  getTeamStatistics,
} from '@/lib/firebase/teams';
import { getAllSeasons } from '@/lib/firebase/seasons';
import { useCachedTeams, useRefreshCache } from '@/hooks/useCachedData';

export default function TeamsManagement() {
  const { user, loading } = useAuth();
  const router = useRouter();
  
  // Use cached teams data (reduces Firebase reads from 20+ to 0 per user!)
  const { data: cachedTeams, isLoading: teamsLoading, refetch: refetchTeams } = useCachedTeams();
  const teams = cachedTeams || [];
  
  const [stats, setStats] = useState({
    totalTeams: 0,
    activeTeams: 0,
    inactiveTeams: 0,
    totalPlayers: 0,
  });
  const [seasons, setSeasons] = useState<Array<{ id: string; name: string }>>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterSeason, setFilterSeason] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showAddTeamModal, setShowAddTeamModal] = useState(false);
  const [showEditTeamModal, setShowEditTeamModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<TeamData | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form states for add/edit
  const [formData, setFormData] = useState({
    team_name: '',
    team_code: '',
    owner_name: '',
    owner_email: '',
    initial_balance: 10000000,
    season_id: '',
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'super_admin') {
      router.push('/dashboard');
    }
    if (!loading && user && user.role === 'super_admin') {
      loadData();
    }
  }, [user, loading, router]);

  const loadData = async () => {
    try {
      setLoadingData(true);
      setError(null);
      
      // Load stats and seasons (teams come from cached hook)
      // This reduces Firebase reads - teams are now cached!
      const [statsData, seasonsData] = await Promise.all([
        getTeamStatistics(),
        getAllSeasons(),
      ]);
      
      setStats(statsData);
      setSeasons(seasonsData.map(s => ({ id: s.id, name: s.name })));
      
      // Refresh cached teams data
      await refetchTeams();
    } catch (err) {
      console.error('Error loading data:', err);
      console.error('Error stack:', (err as Error)?.stack);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load data';
      setError(errorMessage);
    } finally {
      setLoadingData(false);
    }
  };

  const handleAddTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSubmitting(true);
      setError(null);
      
      await createTeam({
        team_name: formData.team_name,
        team_code: formData.team_code,
        owner_name: formData.owner_name || undefined,
        owner_email: formData.owner_email || undefined,
        initial_balance: formData.initial_balance,
        season_id: formData.season_id,
      });
      
      // Reload data
      await loadData();
      
      // Reset form and close modal
      setShowAddTeamModal(false);
      setFormData({
        team_name: '',
        team_code: '',
        owner_name: '',
        owner_email: '',
        initial_balance: 10000000,
        season_id: '',
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create team';
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditTeam = (team: TeamData) => {
    setSelectedTeam(team);
    setFormData({
      team_name: team.team_name,
      team_code: team.team_code,
      owner_name: team.owner_name || '',
      owner_email: team.owner_email || '',
      initial_balance: team.initial_balance,
      season_id: team.season_id,
    });
    setShowEditTeamModal(true);
    setError(null);
  };

  const handleUpdateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedTeam) return;
    
    try {
      setSubmitting(true);
      setError(null);
      
      await updateTeam(selectedTeam.id, {
        team_name: formData.team_name,
        team_code: formData.team_code,
        owner_name: formData.owner_name || undefined,
        owner_email: formData.owner_email || undefined,
        initial_balance: formData.initial_balance,
        season_id: formData.season_id,
      });
      
      // Reload data
      await loadData();
      
      // Close modal and reset
      setShowEditTeamModal(false);
      setSelectedTeam(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update team';
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTeam = async (team: TeamData) => {
    if (!confirm(`Are you sure you want to delete "${team.team_name}"? This action cannot be undone.`)) {
      return;
    }
    
    try {
      setError(null);
      await deleteTeam(team.id);
      
      // Reload data
      await loadData();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete team';
      setError(errorMessage);
      alert(`Error: ${errorMessage}`);
    }
  };

  const handleToggleStatus = async (team: TeamData) => {
    try {
      setError(null);
      await toggleTeamStatus(team.id, !team.is_active);
      
      // Reload data
      await loadData();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to toggle team status';
      setError(errorMessage);
      alert(`Error: ${errorMessage}`);
    }
  };

  const handleViewTeamDetails = (team: TeamData) => {
    router.push(`/dashboard/superadmin/teams/${team.id}`);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const filteredTeams = teams.filter(team => {
    const matchesSearch = team.team_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         team.team_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         team.owner_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSeason = filterSeason === 'all' || team.season_id === filterSeason;
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'active' && team.is_active) ||
                         (filterStatus === 'inactive' && !team.is_active);
    return matchesSearch && matchesSeason && matchesStatus;
  });

  if (loading || loadingData || teamsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'super_admin') {
    return null;
  }

  return (
    <div className="min-h-screen py-4 sm:py-8 px-4">
      <div className="container mx-auto max-w-screen-2xl">
        {/* Page Header */}
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => router.push('/dashboard/superadmin')}
              className="p-2 rounded-xl hover:bg-white/50 transition-colors"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-3xl md:text-4xl font-bold gradient-text">Team Management</h1>
          </div>
          <p className="text-gray-600 text-sm md:text-base ml-14">Manage all teams across seasons</p>
        </header>

        {/* Error Message */}
        {error && (
          <div className="glass rounded-2xl p-4 mb-6 bg-red-50 border border-red-200">
            <div className="flex items-center justify-between">
              <p className="text-red-800 text-sm">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-red-600 hover:text-red-800"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <div className="glass rounded-2xl p-6 shadow-lg backdrop-blur-md border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Teams</p>
                <p className="text-3xl font-bold text-[#0066FF]">{stats.totalTeams}</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-[#0066FF]/20 to-[#0066FF]/10">
                <svg className="w-8 h-8 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="glass rounded-2xl p-6 shadow-lg backdrop-blur-md border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Active Teams</p>
                <p className="text-3xl font-bold text-green-600">{stats.activeTeams}</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/10">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="glass rounded-2xl p-6 shadow-lg backdrop-blur-md border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Inactive Teams</p>
                <p className="text-3xl font-bold text-gray-600">{stats.inactiveTeams}</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-gray-400/20 to-gray-400/10">
                <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Actions */}
        <div className="glass rounded-3xl p-6 mb-8 shadow-lg backdrop-blur-md border border-white/20">
          <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
            {/* Search */}
            <div className="flex-1 w-full lg:max-w-md">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search teams, codes, or owners..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all"
                />
                <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <select
                value={filterSeason}
                onChange={(e) => setFilterSeason(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all text-sm"
              >
                <option value="all">All Seasons</option>
                {seasons.map(season => (
                  <option key={season.id} value={season.id}>{season.name}</option>
                ))}
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all text-sm"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>

              <button
                onClick={() => setShowAddTeamModal(true)}
                className="inline-flex items-center px-4 py-2 bg-[#0066FF] text-white rounded-xl hover:bg-[#0066FF]/90 transition-colors text-sm font-medium"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add Team
              </button>
            </div>
          </div>
        </div>

        {/* Teams List */}
        <div className="glass rounded-3xl shadow-lg backdrop-blur-md border border-white/20 overflow-hidden">
          <div className="px-6 py-5 bg-gradient-to-r from-[#0066FF]/5 to-[#0066FF]/10 border-b border-[#0066FF]/20">
            <h3 className="text-xl font-semibold text-[#0066FF] flex items-center justify-between">
              <span className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                All Teams
              </span>
              {filteredTeams.length > 0 && (
                <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#0066FF]/20 text-[#0066FF]">
                  {filteredTeams.length} {filteredTeams.length === 1 ? 'Team' : 'Teams'}
                </span>
              )}
            </h3>
          </div>

          {filteredTeams.length > 0 ? (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50/50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Team</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Owner</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Season</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white/30">
                    {filteredTeams.map((team) => (
                      <tr key={team.id} className="hover:bg-white/60 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 rounded-xl bg-white flex items-center justify-center">
                              {team.logo_url ? (
                                <img 
                                  src={team.logo_url} 
                                  alt={`${team.team_name} logo`}
                                  className="max-w-full max-h-full object-contain p-1"
                                  onError={(e) => {
                                    // Fallback to team code if image fails to load
                                    const target = e.target as HTMLElement;
                                    target.style.display = 'none';
                                    const parent = target.parentElement;
                                    if (parent) {
                                      parent.innerHTML = `<span class="text-[#0066FF] font-bold text-sm">${team.team_code}</span>`;
                                    }
                                  }}
                                />
                              ) : (
                                <span className="text-[#0066FF] font-bold text-sm">{team.team_code}</span>
                              )}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-semibold text-gray-900">{team.team_name}</div>
                              <div className="text-xs text-gray-500">Code: {team.team_code}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{team.owner_name || 'N/A'}</div>
                          <div className="text-xs text-gray-500">{team.owner_email || 'N/A'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            {team.season_name}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleToggleStatus(team)}
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                              team.is_active
                                ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                            }`}
                          >
                            {team.is_active ? (
                              <>
                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Active
                              </>
                            ) : (
                              <>
                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                </svg>
                                Inactive
                              </>
                            )}
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleViewTeamDetails(team)}
                              className="text-blue-600 hover:text-blue-800 p-1.5 hover:bg-blue-50 rounded-lg transition-colors"
                              title="View Details"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleEditTeam(team)}
                              className="text-green-600 hover:text-green-800 p-1.5 hover:bg-green-50 rounded-lg transition-colors"
                              title="Edit Team"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteTeam(team)}
                              className="text-red-600 hover:text-red-800 p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete Team"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="lg:hidden divide-y divide-gray-200">
                {filteredTeams.map((team) => (
                  <div key={team.id} className="p-6 hover:bg-white/30 transition-colors">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-12 w-12 rounded-xl bg-white flex items-center justify-center mr-3">
                          {team.logo_url ? (
                            <img 
                              src={team.logo_url} 
                              alt={`${team.team_name} logo`}
                              className="max-w-full max-h-full object-contain p-1"
                              onError={(e) => {
                                // Fallback to team code if image fails to load
                                const target = e.target as HTMLElement;
                                target.style.display = 'none';
                                const parent = target.parentElement;
                                if (parent) {
                                  parent.innerHTML = `<span class="text-[#0066FF] font-bold">${team.team_code}</span>`;
                                }
                              }}
                            />
                          ) : (
                            <span className="text-[#0066FF] font-bold">{team.team_code}</span>
                          )}
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-gray-900">{team.team_name}</h3>
                          <p className="text-sm text-gray-500">{team.owner_name}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleToggleStatus(team)}
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          team.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {team.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-gray-500">Season</p>
                        <p className="text-sm font-semibold text-gray-900">{team.season_name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Created</p>
                        <p className="text-sm font-semibold text-gray-900">{formatDate(team.created_at)}</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleViewTeamDetails(team)}
                        className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                      >
                        <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        View
                      </button>
                      <button
                        onClick={() => handleEditTeam(team)}
                        className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-green-300 rounded-lg text-sm font-medium text-green-700 bg-white hover:bg-green-50 transition-colors"
                      >
                        <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteTeam(team)}
                        className="px-3 py-2 border border-red-300 rounded-lg text-sm font-medium text-red-700 bg-white hover:bg-red-50 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="px-8 py-16 text-center">
              <div className="max-w-sm mx-auto">
                <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-[#0066FF]/20 to-[#0066FF]/10 flex items-center justify-center">
                  <svg className="w-10 h-10 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Teams Found</h3>
                <p className="text-gray-500 mb-6">
                  {searchQuery || filterSeason !== 'all' || filterStatus !== 'all'
                    ? 'No teams match your search criteria. Try adjusting your filters.'
                    : 'No teams have been created yet. Start by adding your first team.'}
                </p>
                {!searchQuery && filterSeason === 'all' && filterStatus === 'all' && (
                  <button
                    onClick={() => setShowAddTeamModal(true)}
                    className="inline-flex items-center px-4 py-2 rounded-xl bg-[#0066FF] text-white text-sm font-medium hover:bg-[#0066FF]/90"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add First Team
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Add Team Modal */}
        {showAddTeamModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="glass rounded-3xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-white/20">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold gradient-text">Add New Team</h2>
                <button
                  onClick={() => setShowAddTeamModal(false)}
                  className="p-2 hover:bg-white/50 rounded-lg transition-colors"
                >
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleAddTeam} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="team_name" className="block text-sm font-medium text-gray-700 mb-2">
                      Team Name *
                    </label>
                    <input
                      type="text"
                      id="team_name"
                      required
                      value={formData.team_name}
                      onChange={(e) => setFormData({ ...formData, team_name: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all"
                      placeholder="e.g., Manchester United FC"
                    />
                  </div>

                  <div>
                    <label htmlFor="team_code" className="block text-sm font-medium text-gray-700 mb-2">
                      Team Code *
                    </label>
                    <input
                      type="text"
                      id="team_code"
                      required
                      value={formData.team_code}
                      onChange={(e) => setFormData({ ...formData, team_code: e.target.value.toUpperCase() })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all"
                      placeholder="e.g., MUN"
                      maxLength={5}
                    />
                  </div>

                  <div>
                    <label htmlFor="owner_name" className="block text-sm font-medium text-gray-700 mb-2">
                      Owner Name
                    </label>
                    <input
                      type="text"
                      id="owner_name"
                      value={formData.owner_name}
                      onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all"
                      placeholder="e.g., John Doe"
                    />
                  </div>

                  <div>
                    <label htmlFor="owner_email" className="block text-sm font-medium text-gray-700 mb-2">
                      Owner Email
                    </label>
                    <input
                      type="email"
                      id="owner_email"
                      value={formData.owner_email}
                      onChange={(e) => setFormData({ ...formData, owner_email: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all"
                      placeholder="e.g., john@example.com"
                    />
                  </div>

                  <div>
                    <label htmlFor="initial_balance" className="block text-sm font-medium text-gray-700 mb-2">
                      Initial Balance (₹) *
                    </label>
                    <input
                      type="number"
                      id="initial_balance"
                      required
                      min="0"
                      value={formData.initial_balance}
                      onChange={(e) => setFormData({ ...formData, initial_balance: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all"
                      placeholder="10000000"
                    />
                  </div>

                  <div>
                    <label htmlFor="season_id" className="block text-sm font-medium text-gray-700 mb-2">
                      Season *
                    </label>
                    <select
                      id="season_id"
                      required
                      value={formData.season_id}
                      onChange={(e) => setFormData({ ...formData, season_id: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all"
                    >
                      <option value="">Select Season</option>
                      {seasons.map(season => (
                        <option key={season.id} value={season.id}>{season.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddTeamModal(false)}
                    className="px-6 py-3 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-3 bg-[#0066FF] text-white rounded-xl text-sm font-medium hover:bg-[#0066FF]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Adding...' : 'Add Team'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Team Modal */}
        {showEditTeamModal && selectedTeam && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="glass rounded-3xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-white/20">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold gradient-text">Edit Team</h2>
                <button
                  onClick={() => {
                    setShowEditTeamModal(false);
                    setSelectedTeam(null);
                  }}
                  className="p-2 hover:bg-white/50 rounded-lg transition-colors"
                >
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleUpdateTeam} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="edit_team_name" className="block text-sm font-medium text-gray-700 mb-2">
                      Team Name *
                    </label>
                    <input
                      type="text"
                      id="edit_team_name"
                      required
                      value={formData.team_name}
                      onChange={(e) => setFormData({ ...formData, team_name: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label htmlFor="edit_team_code" className="block text-sm font-medium text-gray-700 mb-2">
                      Team Code *
                    </label>
                    <input
                      type="text"
                      id="edit_team_code"
                      required
                      value={formData.team_code}
                      onChange={(e) => setFormData({ ...formData, team_code: e.target.value.toUpperCase() })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all"
                      maxLength={5}
                    />
                  </div>

                  <div>
                    <label htmlFor="edit_owner_name" className="block text-sm font-medium text-gray-700 mb-2">
                      Owner Name
                    </label>
                    <input
                      type="text"
                      id="edit_owner_name"
                      value={formData.owner_name}
                      onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label htmlFor="edit_owner_email" className="block text-sm font-medium text-gray-700 mb-2">
                      Owner Email
                    </label>
                    <input
                      type="email"
                      id="edit_owner_email"
                      value={formData.owner_email}
                      onChange={(e) => setFormData({ ...formData, owner_email: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label htmlFor="edit_initial_balance" className="block text-sm font-medium text-gray-700 mb-2">
                      Initial Balance (₹) *
                    </label>
                    <input
                      type="number"
                      id="edit_initial_balance"
                      required
                      min="0"
                      value={formData.initial_balance}
                      onChange={(e) => setFormData({ ...formData, initial_balance: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label htmlFor="edit_season_id" className="block text-sm font-medium text-gray-700 mb-2">
                      Season *
                    </label>
                    <select
                      id="edit_season_id"
                      required
                      value={formData.season_id}
                      onChange={(e) => setFormData({ ...formData, season_id: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all"
                    >
                      <option value="">Select Season</option>
                      {seasons.map(season => (
                        <option key={season.id} value={season.id}>{season.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditTeamModal(false);
                      setSelectedTeam(null);
                    }}
                    className="px-6 py-3 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-3 bg-[#0066FF] text-white rounded-xl text-sm font-medium hover:bg-[#0066FF]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Updating...' : 'Update Team'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
