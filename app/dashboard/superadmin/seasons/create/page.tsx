'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createSeason } from '@/lib/firebase/seasons';

export default function CreateSeason() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [formData, setFormData] = useState({
    seasonNumber: '',
    year: new Date().getFullYear().toString(),
    description: '',
    type: 'single' as 'single' | 'multi',
    dollar_budget: 1000,
    euro_budget: 10000,
    min_real_players: 5,
    max_real_players: 7,
    max_football_players: 25,
    category_fine_amount: 20,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'super_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.seasonNumber.trim()) {
      setError('Season number is required');
      return;
    }

    if (!formData.year.trim()) {
      setError('Season year is required');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const seasonNumber = parseInt(formData.seasonNumber);
      
      await createSeason({
        name: `Season ${seasonNumber}`,
        season_number: seasonNumber,
        year: formData.year.trim(),
        type: formData.type,
        ...(formData.type === 'multi' && {
          dollar_budget: formData.dollar_budget,
          euro_budget: formData.euro_budget,
          min_real_players: formData.min_real_players,
          max_real_players: formData.max_real_players,
          max_football_players: formData.max_football_players,
          category_fine_amount: formData.category_fine_amount,
        }),
      });

      // Redirect to seasons page after successful creation
      router.push('/dashboard/superadmin/seasons');
    } catch (err: any) {
      setError(err.message || 'Failed to create season');
      setSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

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
      <div className="container mx-auto max-w-4xl">
        {/* Page Header */}
        <div className="glass rounded-3xl p-6 mb-8 shadow-lg backdrop-blur-md border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold gradient-text mb-2">Create New Season</h1>
              <p className="text-gray-600 text-sm md:text-base">
                Set up a new season for the auction system with customizable settings
              </p>
            </div>
            <div className="hidden md:flex items-center">
              <div className="p-3 rounded-xl bg-gradient-to-br from-[#9580FF]/20 to-[#9580FF]/10 text-[#9580FF]">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="glass rounded-2xl p-4 mb-6 bg-red-50 border border-red-200">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Form */}
        <div className="glass rounded-3xl shadow-lg backdrop-blur-md border border-white/20 overflow-hidden">
          <form onSubmit={handleSubmit} className="space-y-0">
            <div className="px-8 py-6 bg-gradient-to-r from-[#9580FF]/5 to-[#9580FF]/10 border-b border-[#9580FF]/20">
              <div className="flex items-center">
                <svg className="w-6 h-6 mr-3 text-[#9580FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <h3 className="text-xl font-semibold text-[#9580FF]">Season Information</h3>
              </div>
              <p className="mt-2 text-sm text-gray-600">Configure the basic settings for your new season</p>
            </div>

            <div className="p-8 space-y-8">
              {/* Season Number */}
              <div className="group">
                <label htmlFor="seasonNumber" className="block text-sm font-semibold text-gray-700 mb-3 group-focus-within:text-[#9580FF] transition-colors">
                  <span className="flex items-center">
                    <svg className="w-4 h-4 mr-2 text-gray-400 group-focus-within:text-[#9580FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                    Season Number *
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    name="seasonNumber"
                    id="seasonNumber"
                    value={formData.seasonNumber}
                    onChange={handleChange}
                    min="1"
                    max="999"
                    className="block w-full px-4 py-3 rounded-2xl border-2 border-gray-200 bg-white/50 backdrop-blur-sm shadow-sm transition-all duration-200 focus:ring-4 focus:ring-[#9580FF]/20 focus:border-[#9580FF] focus:bg-white hover:border-gray-300 sm:text-sm"
                    placeholder="e.g., 16"
                    required
                  />
                </div>
                <p className="mt-2 text-sm text-gray-500 flex items-center">
                  <svg className="w-4 h-4 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {formData.seasonNumber ? `Season will be named "Season ${formData.seasonNumber}"` : 'Season will be automatically named based on the number you enter'}
                </p>
              </div>

              {/* Year */}
              <div className="group">
                <label htmlFor="year" className="block text-sm font-semibold text-gray-700 mb-3 group-focus-within:text-[#9580FF] transition-colors">
                  <span className="flex items-center">
                    <svg className="w-4 h-4 mr-2 text-gray-400 group-focus-within:text-[#9580FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    Year *
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    name="year"
                    id="year"
                    value={formData.year}
                    onChange={handleChange}
                    className="block w-full px-4 py-3 rounded-2xl border-2 border-gray-200 bg-white/50 backdrop-blur-sm shadow-sm transition-all duration-200 focus:ring-4 focus:ring-[#9580FF]/20 focus:border-[#9580FF] focus:bg-white hover:border-gray-300 sm:text-sm"
                    placeholder="e.g., 2024"
                    required
                  />
                </div>
                <p className="mt-2 text-sm text-gray-500 flex items-center">
                  <svg className="w-4 h-4 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                  A short identifier used in URLs and compact displays
                </p>
              </div>

              {/* Season Type */}
              <div className="group">
                <label htmlFor="type" className="block text-sm font-semibold text-gray-700 mb-3 group-focus-within:text-[#9580FF] transition-colors">
                  <span className="flex items-center">
                    <svg className="w-4 h-4 mr-2 text-gray-400 group-focus-within:text-[#9580FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                    </svg>
                    Season Type *
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div
                    onClick={() => setFormData({ ...formData, type: 'single' })}
                    className={`cursor-pointer p-4 rounded-2xl border-2 transition-all duration-200 ${
                      formData.type === 'single'
                        ? 'border-[#9580FF] bg-[#9580FF]/10'
                        : 'border-gray-200 bg-white/50 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-gray-900">Single Season</h4>
                      {formData.type === 'single' && (
                        <svg className="w-5 h-5 text-[#9580FF]" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">Traditional season (Seasons 1-15)</p>
                  </div>
                  <div
                    onClick={() => setFormData({ ...formData, type: 'multi' })}
                    className={`cursor-pointer p-4 rounded-2xl border-2 transition-all duration-200 ${
                      formData.type === 'multi'
                        ? 'border-[#9580FF] bg-[#9580FF]/10'
                        : 'border-gray-200 bg-white/50 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-gray-900">Multi-Season</h4>
                      {formData.type === 'multi' && (
                        <svg className="w-5 h-5 text-[#9580FF]" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">Contract system (Season 16+)</p>
                  </div>
                </div>
                <p className="mt-2 text-sm text-gray-500 flex items-center">
                  <svg className="w-4 h-4 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Multi-season enables 2-season contracts, dual currency, and dynamic player categories
                </p>
              </div>

              {/* Multi-Season Configuration */}
              {formData.type === 'multi' && (
                <div className="space-y-6 p-6 rounded-2xl bg-gradient-to-br from-[#9580FF]/5 to-[#0066FF]/5 border border-[#9580FF]/20">
                  <div className="flex items-center mb-4">
                    <svg className="w-5 h-5 mr-2 text-[#9580FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h4 className="font-semibold text-gray-900">Multi-Season Configuration</h4>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Dollar Budget ($)</label>
                      <input
                        type="number"
                        value={formData.dollar_budget}
                        onChange={(e) => setFormData({ ...formData, dollar_budget: parseInt(e.target.value) || 0 })}
                        className="block w-full px-4 py-2 rounded-xl border-2 border-gray-200 bg-white shadow-sm focus:ring-2 focus:ring-[#9580FF]/20 focus:border-[#9580FF] sm:text-sm"
                      />
                      <p className="mt-1 text-xs text-gray-500">Budget for real players (SS Members)</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Euro Budget (€)</label>
                      <input
                        type="number"
                        value={formData.euro_budget}
                        onChange={(e) => setFormData({ ...formData, euro_budget: parseInt(e.target.value) || 0 })}
                        className="block w-full px-4 py-2 rounded-xl border-2 border-gray-200 bg-white shadow-sm focus:ring-2 focus:ring-[#9580FF]/20 focus:border-[#9580FF] sm:text-sm"
                      />
                      <p className="mt-1 text-xs text-gray-500">Budget for football players</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Min Real Players</label>
                      <input
                        type="number"
                        value={formData.min_real_players}
                        onChange={(e) => setFormData({ ...formData, min_real_players: parseInt(e.target.value) || 0 })}
                        className="block w-full px-4 py-2 rounded-xl border-2 border-gray-200 bg-white shadow-sm focus:ring-2 focus:ring-[#9580FF]/20 focus:border-[#9580FF] sm:text-sm"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Max Real Players</label>
                      <input
                        type="number"
                        value={formData.max_real_players}
                        onChange={(e) => setFormData({ ...formData, max_real_players: parseInt(e.target.value) || 0 })}
                        className="block w-full px-4 py-2 rounded-xl border-2 border-gray-200 bg-white shadow-sm focus:ring-2 focus:ring-[#9580FF]/20 focus:border-[#9580FF] sm:text-sm"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Max Football Players</label>
                      <input
                        type="number"
                        value={formData.max_football_players}
                        onChange={(e) => setFormData({ ...formData, max_football_players: parseInt(e.target.value) || 0 })}
                        className="block w-full px-4 py-2 rounded-xl border-2 border-gray-200 bg-white shadow-sm focus:ring-2 focus:ring-[#9580FF]/20 focus:border-[#9580FF] sm:text-sm"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Category Fine ($)</label>
                      <input
                        type="number"
                        value={formData.category_fine_amount}
                        onChange={(e) => setFormData({ ...formData, category_fine_amount: parseInt(e.target.value) || 0 })}
                        className="block w-full px-4 py-2 rounded-xl border-2 border-gray-200 bg-white shadow-sm focus:ring-2 focus:ring-[#9580FF]/20 focus:border-[#9580FF] sm:text-sm"
                      />
                      <p className="mt-1 text-xs text-gray-500">Fine for lineup violations</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Description (Optional) */}
              <div className="group">
                <label htmlFor="description" className="block text-sm font-semibold text-gray-700 mb-3 group-focus-within:text-[#9580FF] transition-colors">
                  <span className="flex items-center">
                    <svg className="w-4 h-4 mr-2 text-gray-400 group-focus-within:text-[#9580FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7" />
                    </svg>
                    Description <span className="text-gray-400 font-normal">(Optional)</span>
                  </span>
                </label>
                <div className="relative">
                  <textarea
                    name="description"
                    id="description"
                    rows={4}
                    value={formData.description}
                    onChange={handleChange}
                    className="block w-full px-4 py-3 rounded-2xl border-2 border-gray-200 bg-white/50 backdrop-blur-sm shadow-sm transition-all duration-200 focus:ring-4 focus:ring-[#9580FF]/20 focus:border-[#9580FF] focus:bg-white hover:border-gray-300 sm:text-sm resize-none"
                    placeholder="Optional description of the season, including any special rules or information..."
                  />
                </div>
                <p className="mt-2 text-sm text-gray-500 flex items-center">
                  <svg className="w-4 h-4 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Additional details about this season (will be shown to participants)
                </p>
              </div>
            </div>

            {/* Form Actions */}
            <div className="px-8 py-6 bg-gradient-to-r from-gray-50/50 to-white/50 border-t border-gray-200/50 flex flex-col sm:flex-row justify-between items-center gap-4">
              <button
                type="button"
                onClick={() => router.push('/dashboard/superadmin/seasons')}
                className="inline-flex items-center px-6 py-3 border-2 border-gray-300 text-sm font-medium rounded-2xl text-gray-700 bg-white/80 backdrop-blur-sm hover:bg-white hover:border-gray-400 transition-all duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-0.5 w-full sm:w-auto justify-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Cancel
              </button>

              <div className="flex items-center space-x-4">
                <div className="hidden sm:flex items-center text-xs text-gray-500">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Fields marked with * are required
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center px-8 py-3 border border-transparent text-sm font-semibold rounded-2xl text-white bg-gradient-to-r from-[#9580FF] to-[#0066FF] hover:from-[#9580FF]/90 hover:to-[#0066FF]/90 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 w-full sm:w-auto justify-center group disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {submitting ? (
                    <>
                      <svg className="animate-spin w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-2 group-hover:rotate-90 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Create Season
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
