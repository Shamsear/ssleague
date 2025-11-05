'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { 
  activateSeason, 
  completeSeason, 
  deleteSeason,
  toggleRegistration 
} from '@/lib/firebase/seasons';
import { useRealtimeSeasons } from '@/hooks/useRealtimeData';

export default function SeasonsManagement() {
  const { user, loading } = useAuth();
  const router = useRouter();
  
  // Real-time seasons data - only start listening when user is authenticated
  const { seasons, loading: loadingSeasons, error } = useRealtimeSeasons(user, loading);

  // Debug logging
  useEffect(() => {
    if (seasons.length > 0) {
      console.log('Seasons data:', seasons);
    }
  }, [seasons]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'super_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const handleActivateSeason = async (seasonId: string) => {
    if (!confirm('Are you sure you want to activate this season? This will deactivate the current active season.')) return;
    
    try {
      await activateSeason(seasonId);
      // No need to fetch - real-time listener will update automatically
    } catch (err: any) {
      alert(err.message || 'Failed to activate season');
    }
  };

  const handleCompleteSeason = async (seasonId: string) => {
    if (!confirm('Are you sure you want to mark this season as completed? This action cannot be undone.')) return;
    
    try {
      await completeSeason(seasonId);
      // No need to fetch - real-time listener will update automatically
    } catch (err: any) {
      alert(err.message || 'Failed to complete season');
    }
  };

  const handleDeleteSeason = async (seasonId: string, seasonName: string) => {
    const confirmed = confirm(
      `⚠️ WARNING\n\nAre you sure you want to delete "${seasonName}"?\n\nThis will permanently delete:\n• Season data\n• All associated teams\n• All rounds and auctions\n• All player data for this season\n\nThis action CANNOT be undone!`
    );
    
    if (!confirmed) return;
    
    try {
      await deleteSeason(seasonId);
      // No need to fetch - real-time listener will update automatically
    } catch (err: any) {
      alert(err.message || 'Failed to delete season');
    }
  };

  const handleToggleRegistration = async (seasonId: string, currentStatus: boolean) => {
    try {
      await toggleRegistration(seasonId, !currentStatus);
      // No need to fetch - real-time listener will update automatically
    } catch (err: any) {
      alert(err.message || 'Failed to toggle registration');
    }
  };

  const getStatusBadgeClasses = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-gray-100 text-gray-800';
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'ongoing':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const formatDate = (date?: Date) => {
    if (!date) return 'Not set';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading || loadingSeasons) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading seasons...</p>
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
        <div className="glass rounded-3xl p-6 mb-8 shadow-lg backdrop-blur-md border border-white/20">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/dashboard/superadmin')}
                className="p-2 rounded-xl hover:bg-white/50 transition-colors"
              >
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="p-3 rounded-xl bg-gradient-to-br from-[#9580FF]/20 to-[#9580FF]/10 text-[#9580FF]">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold gradient-text mb-2">Season Management</h1>
                <p className="text-gray-600 text-sm md:text-base">Create and manage auction seasons with complete control</p>
              </div>
            </div>
            <button
              onClick={() => router.push('/dashboard/superadmin/seasons/create')}
              className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-semibold rounded-2xl text-white bg-gradient-to-r from-[#9580FF] to-[#0066FF] hover:from-[#9580FF]/90 hover:to-[#0066FF]/90 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 group w-full md:w-auto justify-center"
            >
              <svg className="w-4 h-4 mr-2 group-hover:rotate-90 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Create Season
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="glass rounded-2xl p-4 mb-6 bg-red-50 border border-red-200">
            <p className="text-red-800 text-sm">⚠️ {error}</p>
          </div>
        )}

        {/* Seasons List */}
        <div className="glass rounded-3xl shadow-lg backdrop-blur-md border border-white/20 overflow-hidden">
          <div className="px-6 py-5 bg-gradient-to-r from-[#9580FF]/5 to-[#9580FF]/10 border-b border-[#9580FF]/20">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-[#9580FF] flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                All Seasons
              </h3>
              {seasons.length > 0 && (
                <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#9580FF]/20 text-[#9580FF]">
                  {seasons.length} Total
                </span>
              )}
            </div>
          </div>

          {seasons.length > 0 ? (
            <div className="divide-y divide-gray-200/50">
              {seasons.map((season) => (
                <div key={season.id} className="px-6 py-5 hover:bg-white/30 transition-all duration-200 group">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center mb-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#9580FF]/20 to-[#9580FF]/10 flex items-center justify-center mr-4">
                          <svg className="w-6 h-6 text-[#9580FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-[#9580FF] transition-colors">
                              {season.name}
                            </h3>
                            <span className={`px-3 py-1 text-xs font-semibold rounded-full transition-all duration-200 ${getStatusBadgeClasses(season.status)}`}>
                              {season.status.charAt(0).toUpperCase() + season.status.slice(1)}
                            </span>
                            {season.isActive && (
                              <span className="inline-flex items-center px-3 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full group-hover:bg-blue-200 transition-all duration-200">
                                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                Active
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-2">
                            <span className="flex items-center">
                              <svg className="w-4 h-4 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 0 0-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 0 1 5.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 0 1 9.288 0M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm6 3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM7 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" />
                              </svg>
                              {season.totalTeams} teams
                            </span>
                            <span className="flex items-center">
                              <svg className="w-4 h-4 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {season.totalRounds} rounds
                            </span>
                            <span className="flex items-center">
                              <svg className="w-4 h-4 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Status: {season.status.charAt(0).toUpperCase() + season.status.slice(1)}
                            </span>
                            {season.registrationOpen && (
                              <span className="flex items-center text-green-600">
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                                </svg>
                                Registration Open
                              </span>
                            )}
                          </div>

                          {(season.startDate || season.endDate) && (
                            <div className="flex items-center text-sm text-gray-500">
                              <svg className="w-4 h-4 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              {formatDate(season.startDate)} - {formatDate(season.endDate)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center space-x-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
                      {!season.isActive && season.status !== 'completed' && (
                        <button
                          onClick={() => handleActivateSeason(season.id)}
                          className="inline-flex items-center px-3 py-2 border border-transparent text-xs font-medium rounded-xl text-white bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 transition-all duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
                        >
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h1m4 0h1m2 6V8a3 3 0 00-3-3H8a3 3 0 00-3 3v12l3-3 3 3z" />
                          </svg>
                          Activate
                        </button>
                      )}

                      {season.isActive && season.status !== 'completed' && (
                        <button
                          onClick={() => handleCompleteSeason(season.id)}
                          className="inline-flex items-center px-3 py-2 border border-transparent text-xs font-medium rounded-xl text-white bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 transition-all duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
                        >
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Complete
                        </button>
                      )}

                      <button
                        onClick={() => router.push(`/dashboard/superadmin/seasons/${season.id}`)}
                        className="inline-flex items-center px-3 py-2 border border-[#9580FF]/30 text-xs font-medium rounded-xl text-[#9580FF] bg-[#9580FF]/10 hover:bg-[#9580FF]/20 hover:border-[#9580FF]/50 transition-all duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
                      >
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        Details
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-8 py-16 text-center">
              <div className="max-w-sm mx-auto">
                <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-[#9580FF]/20 to-[#9580FF]/10 flex items-center justify-center">
                  <svg className="w-10 h-10 text-[#9580FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Seasons Found</h3>
                <p className="text-gray-500 mb-6">Create your first season to start managing auction tournaments.</p>
                <button
                  onClick={() => router.push('/dashboard/superadmin/seasons/create')}
                  className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-semibold rounded-2xl text-white bg-gradient-to-r from-[#9580FF] to-[#0066FF] hover:from-[#9580FF]/90 hover:to-[#0066FF]/90 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 group"
                >
                  <svg className="w-4 h-4 mr-2 group-hover:rotate-90 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Create First Season
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
