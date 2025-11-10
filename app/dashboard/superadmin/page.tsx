'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getPendingUsers } from '@/lib/firebase/auth';
import { getPendingResetRequests } from '@/lib/firebase/passwordResetRequests';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

export default function SuperAdminDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [pendingUsers, setPendingUsers] = useState(0);
  const [pendingResets, setPendingResets] = useState(0);
  const [loadingPending, setLoadingPending] = useState(true);
  const [activeSeason, setActiveSeason] = useState<any>(null);
  const [teamsCount, setTeamsCount] = useState(0);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'super_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const fetchPendingItems = async () => {
      if (!user || user.role !== 'super_admin') return;
      
      try {
        setLoadingPending(true);
        const [users, resets] = await Promise.all([
          getPendingUsers(),
          getPendingResetRequests()
        ]);
        setPendingUsers(users.length);
        setPendingResets(resets.length);
      } catch (error) {
        console.error('Error fetching pending items:', error);
      } finally {
        setLoadingPending(false);
      }
    };

    fetchPendingItems();
  }, [user]);

  useEffect(() => {
    const fetchActiveSeason = async () => {
      if (!user || user.role !== 'super_admin') return;
      
      try {
        // Fetch active season
        const seasonRes = await fetchWithTokenRefresh('/api/seasons/active');
        if (seasonRes.ok) {
          const seasonData = await seasonRes.json();
          if (seasonData.season) {
            setActiveSeason(seasonData.season);
            
            // Fetch teams count for active season
            const teamsRes = await fetchWithTokenRefresh(`/api/teams?seasonId=${seasonData.season.id}`);
            if (teamsRes.ok) {
              const teamsData = await teamsRes.json();
              setTeamsCount(teamsData.teams?.length || 0);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching active season:', error);
      }
    };

    fetchActiveSeason();
  }, [user]);

  if (loading) {
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
        {/* Header */}
        <header className="mb-8 hidden sm:block">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold gradient-text mb-2">
                Super Admin Dashboard
              </h1>
              <p className="text-gray-600 text-sm md:text-base">
                Manage all seasons and system-wide settings
              </p>
            </div>
            
            {/* Season Context */}
            <div className="bg-gradient-to-r from-[#0066FF]/10 to-[#9580FF]/10 border border-[#0066FF]/20 rounded-lg p-4">
              {activeSeason ? (
                <>
                  <div className="text-sm font-medium text-gray-700 mb-1">
                    Active Season
                  </div>
                  <div className="font-bold text-[#0066FF] text-lg">{activeSeason.name || activeSeason.short_name || 'Current Season'}</div>
                  <div className="text-xs text-gray-600">
                    {teamsCount} {teamsCount === 1 ? 'team' : 'teams'} participating
                  </div>
                </>
              ) : (
                <>
                  <div className="text-sm font-medium text-gray-700 mb-1">
                    Active Season
                  </div>
                  <div className="font-bold text-gray-500 text-lg">No Active Season</div>
                  <div className="text-xs text-gray-600">
                    Create a season to get started
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Pending Actions Summary */}
        {(pendingUsers > 0 || pendingResets > 0) && (
          <div className="glass rounded-2xl p-5 mb-8 shadow-lg backdrop-blur-md border border-white/20 animate-fade-in">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold gradient-text flex items-center">
                <svg className="w-5 h-5 mr-2 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Pending Actions
              </h2>
              <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                {pendingUsers + pendingResets} Items
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {pendingUsers > 0 && (
                <div className="glass p-4 rounded-2xl border-l-4 border-yellow-400 hover:shadow-md transition-all duration-300">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-semibold text-gray-800 flex items-center">
                      <svg className="w-4 h-4 mr-1.5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zm-4 7a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      User Approvals
                    </h3>
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 flex items-center">
                      <span className="w-2 h-2 bg-yellow-500 rounded-full mr-1.5 animate-pulse"></span>
                      {pendingUsers} Pending
                    </span>
                  </div>
                  <div className="mb-3">
                    <p className="text-sm text-gray-600">Users waiting for account approval</p>
                  </div>
                  <button 
                    onClick={() => router.push('/dashboard/superadmin/users?filter=pending')}
                    className="inline-flex items-center px-4 py-2 bg-white/50 hover:bg-white/80 border border-transparent rounded-md text-sm font-medium text-[#0066FF] transition-colors"
                  >
                    <span>View and approve</span>
                    <svg className="w-4 h-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                    </svg>
                  </button>
                </div>
              )}
              
              {pendingResets > 0 && (
                <div className="glass p-4 rounded-2xl border-l-4 border-yellow-400 hover:shadow-md transition-all duration-300">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-semibold text-gray-800 flex items-center">
                      <svg className="w-4 h-4 mr-1.5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                      Password Resets
                    </h3>
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 flex items-center">
                      <span className="w-2 h-2 bg-yellow-500 rounded-full mr-1.5 animate-pulse"></span>
                      {pendingResets} Pending
                    </span>
                  </div>
                  <div className="mb-3">
                    <p className="text-sm text-gray-600">Password reset requests waiting for review</p>
                  </div>
                  <button 
                    onClick={() => router.push('/dashboard/superadmin/password-requests')}
                    className="inline-flex items-center px-4 py-2 bg-white/50 hover:bg-white/80 border border-transparent rounded-md text-sm font-medium text-[#0066FF] transition-colors"
                  >
                    <span>View and process</span>
                    <svg className="w-4 h-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="glass rounded-3xl p-4 sm:p-6 mb-6 shadow-lg backdrop-blur-md border border-white/20">
          <div className="flex flex-col gap-5 mb-6">
            {/* Navigation Cards */}
            <div className="glass rounded-2xl p-5 mb-8 shadow-lg backdrop-blur-md border border-white/20">
              <div className="mb-6">
                <h2 className="text-xl font-bold gradient-text mb-5">Quick Navigation</h2>
                
                {/* Core Management */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  <button 
                    onClick={() => router.push('/dashboard/superadmin/users')}
                    className="glass group rounded-2xl p-5 border border-white/10 hover:border-[#9580FF]/30 transition-all duration-300 shadow-sm hover:shadow-lg flex flex-col gap-3 hover:-translate-y-1">
                    <div className="flex items-center">
                      <div className="p-3 rounded-xl bg-gradient-to-br from-[#9580FF]/20 to-[#9580FF]/10 text-[#9580FF] group-hover:from-[#9580FF]/30 group-hover:to-[#9580FF]/20 transition-all">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                      </div>
                      <h3 className="ml-3 text-lg font-semibold text-gray-800 group-hover:text-[#9580FF] transition-colors">User Management</h3>
                    </div>
                    <p className="text-sm text-gray-600">Manage all system users and permissions</p>
                  </button>
                  
                  <button 
                    onClick={() => router.push('/dashboard/superadmin/seasons')}
                    className="glass group rounded-2xl p-5 border border-white/10 hover:border-[#9580FF]/30 transition-all duration-300 shadow-sm hover:shadow-lg flex flex-col gap-3 hover:-translate-y-1">
                    <div className="flex items-center">
                      <div className="p-3 rounded-xl bg-gradient-to-br from-[#9580FF]/20 to-[#9580FF]/10 text-[#9580FF] group-hover:from-[#9580FF]/30 group-hover:to-[#9580FF]/20 transition-all">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <h3 className="ml-3 text-lg font-semibold text-gray-800 group-hover:text-[#9580FF] transition-colors">Season Management</h3>
                    </div>
                    <p className="text-sm text-gray-600">Create and manage auction seasons</p>
                  </button>
                  
                  <button 
                    onClick={() => router.push('/dashboard/superadmin/teams')}
                    className="glass group rounded-2xl p-5 border border-white/10 hover:border-[#9580FF]/30 transition-all duration-300 shadow-sm hover:shadow-lg flex flex-col gap-3 hover:-translate-y-1">
                    <div className="flex items-center">
                      <div className="p-3 rounded-xl bg-gradient-to-br from-[#9580FF]/20 to-[#9580FF]/10 text-[#9580FF] group-hover:from-[#9580FF]/30 group-hover:to-[#9580FF]/20 transition-all">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <h3 className="ml-3 text-lg font-semibold text-gray-800 group-hover:text-[#9580FF] transition-colors">Team Management</h3>
                    </div>
                    <p className="text-sm text-gray-600">Manage teams across all seasons</p>
                  </button>
                  
                  <button 
                    onClick={() => router.push('/dashboard/superadmin/players')}
                    className="glass group rounded-2xl p-5 border border-white/10 hover:border-[#9580FF]/30 transition-all duration-300 shadow-sm hover:shadow-lg flex flex-col gap-3 hover:-translate-y-1">
                    <div className="flex items-center">
                      <div className="p-3 rounded-xl bg-gradient-to-br from-[#9580FF]/20 to-[#9580FF]/10 text-[#9580FF] group-hover:from-[#9580FF]/30 group-hover:to-[#9580FF]/20 transition-all">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zm-4 7a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <h3 className="ml-3 text-lg font-semibold text-gray-800 group-hover:text-[#9580FF] transition-colors">Player Management</h3>
                    </div>
                    <p className="text-sm text-gray-600">Manage player database and bulk operations</p>
                  </button>
                  
                  <button 
                    onClick={() => router.push('/dashboard/superadmin/player-photos')}
                    className="glass group rounded-2xl p-5 border border-white/10 hover:border-[#9580FF]/30 transition-all duration-300 shadow-sm hover:shadow-lg flex flex-col gap-3 hover:-translate-y-1">
                    <div className="flex items-center">
                      <div className="p-3 rounded-xl bg-gradient-to-br from-[#9580FF]/20 to-[#9580FF]/10 text-[#9580FF] group-hover:from-[#9580FF]/30 group-hover:to-[#9580FF]/20 transition-all">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <h3 className="ml-3 text-lg font-semibold text-gray-800 group-hover:text-[#9580FF] transition-colors">Player Photos</h3>
                    </div>
                    <p className="text-sm text-gray-600">Upload and manage player profile photos</p>
                  </button>
                  
                  <button 
                    onClick={() => router.push('/dashboard/superadmin/invites')}
                    className="glass group rounded-2xl p-5 border border-white/10 hover:border-[#9580FF]/30 transition-all duration-300 shadow-sm hover:shadow-lg flex flex-col gap-3 hover:-translate-y-1">
                    <div className="flex items-center">
                      <div className="p-3 rounded-xl bg-gradient-to-br from-[#9580FF]/20 to-[#9580FF]/10 text-[#9580FF] group-hover:from-[#9580FF]/30 group-hover:to-[#9580FF]/20 transition-all">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                      </div>
                      <h3 className="ml-3 text-lg font-semibold text-gray-800 group-hover:text-[#9580FF] transition-colors">Admin Invites</h3>
                    </div>
                    <p className="text-sm text-gray-600">Generate and manage admin invitation codes</p>
                  </button>
                  
                  <button 
                    onClick={() => router.push('/dashboard/superadmin/password-requests')}
                    className="glass group rounded-2xl p-5 border border-white/10 hover:border-[#9580FF]/30 transition-all duration-300 shadow-sm hover:shadow-lg flex flex-col gap-3 hover:-translate-y-1">
                    <div className="flex items-center">
                      <div className="p-3 rounded-xl bg-gradient-to-br from-[#9580FF]/20 to-[#9580FF]/10 text-[#9580FF] group-hover:from-[#9580FF]/30 group-hover:to-[#9580FF]/20 transition-all">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                      </div>
                      <h3 className="ml-3 text-lg font-semibold text-gray-800 group-hover:text-[#9580FF] transition-colors">Password Requests</h3>
                    </div>
                    <p className="text-sm text-gray-600">Review and manage password reset requests</p>
                  </button>
                  
                  <button 
                    onClick={() => router.push('/dashboard/superadmin/seasons/create')}
                    className="glass group rounded-2xl p-5 border border-white/10 hover:border-[#9580FF]/30 transition-all duration-300 shadow-sm hover:shadow-lg flex flex-col gap-3 hover:-translate-y-1">
                    <div className="flex items-center">
                      <div className="p-3 rounded-xl bg-gradient-to-br from-[#9580FF]/20 to-[#9580FF]/10 text-[#9580FF] group-hover:from-[#9580FF]/30 group-hover:to-[#9580FF]/20 transition-all">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      </div>
                      <h3 className="ml-3 text-lg font-semibold text-gray-800 group-hover:text-[#9580FF] transition-colors">Create Season</h3>
                    </div>
                    <p className="text-sm text-gray-600">Set up new auction seasons</p>
                  </button>
                  
                  <button 
                    onClick={() => router.push('/dashboard/superadmin/historical-seasons')}
                    className="glass group rounded-2xl p-5 border border-white/10 hover:border-[#9580FF]/30 transition-all duration-300 shadow-sm hover:shadow-lg flex flex-col gap-3 hover:-translate-y-1">
                    <div className="flex items-center">
                      <div className="p-3 rounded-xl bg-gradient-to-br from-[#9580FF]/20 to-[#9580FF]/10 text-[#9580FF] group-hover:from-[#9580FF]/30 group-hover:to-[#9580FF]/20 transition-all">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </div>
                      <h3 className="ml-3 text-lg font-semibold text-gray-800 group-hover:text-[#9580FF] transition-colors">Historical Seasons</h3>
                    </div>
                    <p className="text-sm text-gray-600">Import and manage previous season data</p>
                  </button>
                  
                  <button className="glass group rounded-2xl p-5 border border-white/10 hover:border-[#9580FF]/30 transition-all duration-300 shadow-sm hover:shadow-lg flex flex-col gap-3 hover:-translate-y-1">
                    <div className="flex items-center">
                      <div className="p-3 rounded-xl bg-gradient-to-br from-[#9580FF]/20 to-[#9580FF]/10 text-[#9580FF] group-hover:from-[#9580FF]/30 group-hover:to-[#9580FF]/20 transition-all">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <h3 className="ml-3 text-lg font-semibold text-gray-800 group-hover:text-[#9580FF] transition-colors">Season Details</h3>
                    </div>
                    <p className="text-sm text-gray-600">View current season overview and statistics</p>
                  </button>
                  
                  <button 
                    onClick={() => router.push('/dashboard/superadmin/season-player-stats')}
                    className="glass group rounded-2xl p-5 border border-white/10 hover:border-[#9580FF]/30 transition-all duration-300 shadow-sm hover:shadow-lg flex flex-col gap-3 hover:-translate-y-1">
                    <div className="flex items-center">
                      <div className="p-3 rounded-xl bg-gradient-to-br from-[#9580FF]/20 to-[#9580FF]/10 text-[#9580FF] group-hover:from-[#9580FF]/30 group-hover:to-[#9580FF]/20 transition-all">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <h3 className="ml-3 text-lg font-semibold text-gray-800 group-hover:text-[#9580FF] transition-colors">Player Statistics</h3>
                    </div>
                    <p className="text-sm text-gray-600">Analyze player performance and auction data</p>
                  </button>
                </div>
                
                {/* Advanced Tools Section */}
                <div className="mt-8">
                  <h3 className="text-lg font-bold text-[#9580FF] mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Advanced Tools
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    <button className="glass group rounded-2xl p-4 border border-white/10 hover:border-[#9580FF]/30 transition-all duration-300 shadow-sm hover:shadow-lg flex items-center gap-3 hover:-translate-y-1">
                      <div className="p-2 rounded-lg bg-gradient-to-br from-[#9580FF]/20 to-[#9580FF]/10 text-[#9580FF]">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-800 group-hover:text-[#9580FF] transition-colors">Team Analytics</h4>
                        <p className="text-xs text-gray-500">View team statistics and performance</p>
                      </div>
                    </button>
                    
                    <button 
                      onClick={() => router.push('/dashboard/superadmin/monitoring')}
                      className="glass group rounded-2xl p-4 border border-white/10 hover:border-[#9580FF]/30 transition-all duration-300 shadow-sm hover:shadow-lg flex items-center gap-3 hover:-translate-y-1">
                      <div className="p-2 rounded-lg bg-gradient-to-br from-[#9580FF]/20 to-[#9580FF]/10 text-[#9580FF]">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-800 group-hover:text-[#9580FF] transition-colors">System Monitoring</h4>
                        <p className="text-xs text-gray-500">Monitor system health and performance</p>
                      </div>
                    </button>
                    
                    <button 
                      onClick={() => router.push('/dashboard/superadmin/upload-award-images')}
                      className="glass group rounded-2xl p-4 border border-white/10 hover:border-[#9580FF]/30 transition-all duration-300 shadow-sm hover:shadow-lg flex items-center gap-3 hover:-translate-y-1">
                      <div className="p-2 rounded-lg bg-gradient-to-br from-[#9580FF]/20 to-[#9580FF]/10 text-[#9580FF]">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-800 group-hover:text-[#9580FF] transition-colors">Upload Award Images</h4>
                        <p className="text-xs text-gray-500">Upload and manage award photos</p>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fade-in {
          animation: fadeIn 0.6s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
