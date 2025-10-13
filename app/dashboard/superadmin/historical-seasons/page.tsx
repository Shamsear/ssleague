'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface Season {
  id: string;
  name: string;
  short_name: string;
  status: 'active' | 'completed' | 'archived';
  is_active: boolean;
  created_at: string; // ISO string from API
  teams_count: number;
  awards_count: number;
  description?: string;
  start_date?: string;
  end_date?: string;
}

export default function HistoricalSeasons() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [seasonsLoading, setSeasonsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch seasons data from API
  useEffect(() => {
    const fetchSeasons = async () => {
      try {
        setSeasonsLoading(true);
        const response = await fetch('/api/seasons/list');
        const data = await response.json();
        
        if (data.success) {
          setSeasons(data.seasons);
        } else {
          setError(data.error || 'Failed to fetch seasons');
        }
      } catch (error) {
        console.error('Error fetching seasons:', error);
        setError('Failed to load seasons data');
      } finally {
        setSeasonsLoading(false);
      }
    };

    // Only fetch if user is authenticated and is super admin
    if (!loading && user && user.role === 'super_admin') {
      fetchSeasons();
    }
  }, [user, loading]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'super_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch('/api/seasons/historical/template');
      
      if (!response.ok) {
        throw new Error('Failed to download template');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'SS_League_Historical_Season_Template.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading template:', error);
      alert('Failed to download template. Please try again.');
    }
  };

  if (loading || seasonsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">
            {loading ? 'Loading...' : 'Loading seasons data...'}
          </p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'super_admin') {
    return null;
  }

  if (error) {
    return (
      <div className="min-h-screen py-4 sm:py-8 px-4">
        <div className="container mx-auto max-w-screen-2xl">
          <div className="glass rounded-3xl p-8 shadow-lg backdrop-blur-md border border-white/20 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 13.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Seasons</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center px-4 py-2 bg-[#0066FF] hover:bg-[#0066FF]/90 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-4 sm:py-8 px-4">
      <div className="container mx-auto max-w-screen-2xl">
        {/* Info Banner about new structure */}
        <div className="glass rounded-2xl p-4 mb-6 shadow-md backdrop-blur-md border border-blue-200/50 bg-gradient-to-r from-blue-50/80 to-indigo-50/80">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-blue-900 mb-1">New Database Structure</h3>
              <p className="text-xs text-blue-800 mb-2">
                Player data is now split into two collections: <strong>realplayers</strong> (permanent info) and <strong>realplayerstats</strong> (season-specific stats).
                This ensures data integrity and allows players to have different categories and teams across seasons.
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-100 text-blue-700 font-medium">
                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Permanent data preserved
                </span>
                <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-100 text-blue-700 font-medium">
                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Season-specific categories
                </span>
                <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-100 text-blue-700 font-medium">
                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  No data overwriting
                </span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Page Header */}
        <div className="glass rounded-3xl p-6 mb-8 shadow-lg backdrop-blur-md border border-white/20">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold gradient-text mb-2">🏆 Historical Seasons</h1>
              <p className="text-gray-600 text-sm md:text-base">Manage and import previous season data</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleDownloadTemplate}
                className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                </svg>
                Download Template
              </button>
              <button
                onClick={() => router.push('/dashboard/superadmin/historical-seasons/import')}
                className="inline-flex items-center px-4 py-2 bg-[#0066FF] hover:bg-[#0066FF]/90 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Import New Season
              </button>
            </div>
          </div>
        </div>

        {/* Seasons List */}
        <div className="glass rounded-3xl shadow-lg backdrop-blur-md border border-white/20 overflow-hidden">
          <div className="px-6 py-5 bg-gradient-to-r from-[#0066FF]/5 to-[#0066FF]/10 border-b border-[#0066FF]/20">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-[#0066FF] flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                All Seasons
              </h3>
              {!seasonsLoading && seasons.length > 0 && (
                <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#0066FF]/20 text-[#0066FF]">
                  {seasons.length} Total Seasons
                </span>
              )}
            </div>
          </div>

          {!seasonsLoading && seasons.length > 0 ? (
            <div className="divide-y divide-gray-200/50">
              {seasons.map((season) => (
                <div key={season.id} className="px-6 py-5 hover:bg-white/30 transition-all duration-200 group">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center mb-3">
                        <div className="flex items-center space-x-3">
                          {/* Season Icon */}
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0066FF]/20 to-[#0066FF]/10 flex items-center justify-center">
                            <svg className="w-6 h-6 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                            </svg>
                          </div>

                          <div>
                            <h3 
                              className="text-lg font-semibold text-gray-900 group-hover:text-[#0066FF] transition-colors cursor-pointer hover:underline"
                              onClick={() => router.push(`/dashboard/superadmin/historical-seasons/${season.id}`)}
                            >
                              {season.name}
                            </h3>
                            <div className="flex items-center gap-3">
                              <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full transition-all duration-200 ${getStatusBadge(season.status)}`}>
                                {season.status.charAt(0).toUpperCase() + season.status.slice(1)}
                              </span>
                              <span className="text-sm text-gray-500">{season.short_name}</span>
                              {season.is_active && (
                                <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                                  Current Active
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                        {/* Creation Date */}
                        <div className="flex items-center">
                          <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Created: {formatDate(season.created_at)}
                        </div>

                        {/* Teams Count */}
                        <div className="flex items-center">
                          <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 6.292 4 4 0 010-6.292zM15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                          </svg>
                          {season.teams_count} Teams
                        </div>

                        {/* Awards Count */}
                        <div className="flex items-center">
                          <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                          </svg>
                          {season.awards_count} Awards
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {season.status === 'completed' && (
                        <div className="inline-flex items-center px-3 py-2 rounded-xl bg-blue-50 text-blue-700 text-xs font-medium border border-blue-200">
                          <svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                          </svg>
                          Historical Data
                        </div>
                      )}
                      {season.is_active && (
                        <div className="inline-flex items-center px-3 py-2 rounded-xl bg-green-50 text-green-700 text-xs font-medium border border-green-200">
                          <svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          Active Season
                        </div>
                      )}
                      <button
                        onClick={() => router.push(`/dashboard/superadmin/historical-seasons/${season.id}`)}
                        className="inline-flex items-center px-3 py-2 rounded-xl bg-gray-50 text-gray-700 text-xs font-medium border border-gray-200 hover:bg-[#0066FF]/10 hover:text-[#0066FF] hover:border-[#0066FF]/20 transition-all"
                      >
                        <svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-8 py-16 text-center">
              <div className="max-w-sm mx-auto">
                <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-[#0066FF]/20 to-[#0066FF]/10 flex items-center justify-center">
                  <svg className="w-10 h-10 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Seasons Found</h3>
                <p className="text-gray-500 mb-6">No seasons have been imported yet. Start by importing your first historical season.</p>
                <button
                  onClick={() => router.push('/dashboard/superadmin/historical-seasons/import')}
                  className="inline-flex items-center px-4 py-2 rounded-xl bg-[#0066FF] text-white text-sm font-medium hover:bg-[#0066FF]/90"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Import First Season
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
