'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

export default function NewCategoryPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    icon: '⭐',
    priority: '1',
    points_same_category: '8',
    points_one_level_diff: '7',
    points_two_level_diff: '6',
    points_three_level_diff: '5',
    draw_same_category: '4',
    draw_one_level_diff: '3',
    draw_two_level_diff: '3',
    draw_three_level_diff: '2',
    loss_same_category: '1',
    loss_one_level_diff: '1',
    loss_two_level_diff: '1',
    loss_three_level_diff: '0',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'committee_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetchWithTokenRefresh(/api/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setError(result.error || 'Failed to create category');
        return;
      }

      router.push('/dashboard/committee/team-management/categories?success=created');
    } catch (err: any) {
      console.error('Error creating category:', err);
      setError(err.message || 'Failed to create category');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'committee_admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 py-4 sm:py-8 px-3 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                </div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Create New Category
                </h1>
              </div>
              <p className="text-gray-600 text-sm sm:text-base ml-14">Define player tiers and point distribution rules</p>
            </div>
            <Link 
              href="/dashboard/committee/team-management/categories" 
              className="inline-flex items-center px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-300 shadow-sm transition-all"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="hidden sm:inline">Back to Categories</span>
              <span className="sm:hidden">Back</span>
            </Link>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 rounded-xl p-4 shadow-sm animate-fade-in">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-red-800 mb-1">Error Creating Category</h4>
                <p className="text-sm text-red-700">{error}</p>
              </div>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Step 1: Basic Information */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg backdrop-blur">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-white">Basic Information</h2>
                </div>
                <span className="text-xs font-semibold text-white/80 bg-white/20 px-3 py-1 rounded-full backdrop-blur">Step 1/2</span>
              </div>
            </div>

            <div className="p-4 sm:p-6 lg:p-8 space-y-6">
              {/* Category Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-2">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    name="name"
                    id="name"
                    required
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 pl-11 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all outline-none text-base"
                    placeholder="e.g., Legend, Classic, Superstar"
                  />
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Choose a descriptive name that reflects the skill tier
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Icon Selector */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Category Icon <span className="text-red-500">*</span>
                  </label>
                  
                  {/* Selected Icon Preview */}
                  <div className="mb-4 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200">
                    <div className="flex items-center gap-4">
                      <div className="text-5xl">{formData.icon}</div>
                      <div>
                        <p className="text-sm font-semibold text-gray-700">Selected Icon</p>
                        <p className="text-xs text-gray-500">Tap any icon below to change</p>
                      </div>
                    </div>
                  </div>

                  {/* Icon Grid */}
                  <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
                    {['⭐', '🏆', '👑', '💎', '🔥', '⚡', '🎯', '🌟', '💫', '✨', '🥇', '🥈', '🥉', '🎖️', '🏅', '🔰'].map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, icon: emoji }))}
                        className={`text-2xl sm:text-3xl p-2 sm:p-3 rounded-lg transition-all ${
                          formData.icon === emoji
                            ? 'bg-blue-600 scale-110 shadow-lg ring-4 ring-blue-100'
                            : 'bg-white hover:bg-blue-50 hover:scale-105 shadow-sm'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>

                  {/* Custom Emoji Input */}
                  <div className="mt-3">
                    <input
                      type="text"
                      maxLength={2}
                      value={formData.icon}
                      onChange={(e) => setFormData(prev => ({ ...prev, icon: e.target.value }))}
                      className="w-full px-4 py-2 text-center text-2xl rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all outline-none"
                      placeholder="Custom emoji"
                    />
                  </div>
                </div>

                {/* Priority Selector */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Priority Level <span className="text-red-500">*</span>
                  </label>
                  <p className="text-xs text-gray-500 mb-4 flex items-start gap-1">
                    <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    <span>Priority defines skill hierarchy: 1 = Elite, 4 = Beginner</span>
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { num: 1, label: 'Elite', gradient: 'from-yellow-400 to-orange-500' },
                      { num: 2, label: 'Advanced', gradient: 'from-blue-400 to-cyan-500' },
                      { num: 3, label: 'Intermediate', gradient: 'from-green-400 to-emerald-500' },
                      { num: 4, label: 'Beginner', gradient: 'from-purple-400 to-pink-500' }
                    ].map(({ num, label, gradient }) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, priority: String(num) }))}
                        className={`relative p-4 rounded-xl border-2 transition-all ${
                          formData.priority === String(num)
                            ? 'border-blue-500 bg-blue-50 shadow-lg scale-105'
                            : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
                        }`}
                      >
                        <div className={`text-3xl font-bold bg-gradient-to-r ${gradient} bg-clip-text text-transparent mb-1`}>
                          {num}
                        </div>
                        <div className="text-sm font-semibold text-gray-700">{label}</div>
                        {formData.priority === String(num) && (
                          <div className="absolute -top-2 -right-2 bg-blue-600 rounded-full p-1 shadow-lg">
                            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 2: Points Configuration */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg backdrop-blur">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 11V9a2 2 0 00-2-2m2 4v4a2 2 0 104 0v-1m-4-3H9m2 0h4m6 1a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-white">Points Configuration</h2>
                </div>
                <span className="text-xs font-semibold text-white/80 bg-white/20 px-3 py-1 rounded-full backdrop-blur">Step 2/2</span>
              </div>
            </div>

            <div className="p-4 sm:p-6 lg:p-8">
              {/* Info Banner */}
              <div className="mb-6 p-4 bg-blue-50 border-l-4 border-blue-500 rounded-lg">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm">
                    <p className="font-semibold text-blue-900 mb-1">Points System Explained</p>
                    <p className="text-blue-700">Configure points awarded based on match results and opponent strength. Range: -20 to +20 points.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {/* Wins Section */}
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 sm:p-6 border-2 border-green-200">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 bg-green-600 rounded-lg">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-green-900">Win Points</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { name: 'points_same_category', label: 'Same Level' },
                      { name: 'points_one_level_diff', label: '1 Level Up' },
                      { name: 'points_two_level_diff', label: '2 Levels Up' },
                      { name: 'points_three_level_diff', label: '3 Levels Up' }
                    ].map(({ name, label }) => (
                      <div key={name}>
                        <label htmlFor={name} className="block text-xs font-semibold text-gray-700 mb-1.5">
                          {label}
                        </label>
                        <input
                          type="number"
                          name={name}
                          id={name}
                          min="-20"
                          max="20"
                          value={formData[name as keyof typeof formData]}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 rounded-lg border-2 border-gray-200 focus:border-green-500 focus:ring-4 focus:ring-green-100 transition-all outline-none text-center text-lg font-bold"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Draws Section */}
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4 sm:p-6 border-2 border-blue-200">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 bg-blue-600 rounded-lg">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-blue-900">Draw Points</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { name: 'draw_same_category', label: 'Same Level' },
                      { name: 'draw_one_level_diff', label: '1 Level Up' },
                      { name: 'draw_two_level_diff', label: '2 Levels Up' },
                      { name: 'draw_three_level_diff', label: '3 Levels Up' }
                    ].map(({ name, label }) => (
                      <div key={name}>
                        <label htmlFor={name} className="block text-xs font-semibold text-gray-700 mb-1.5">
                          {label}
                        </label>
                        <input
                          type="number"
                          name={name}
                          id={name}
                          min="-20"
                          max="20"
                          value={formData[name as keyof typeof formData]}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all outline-none text-center text-lg font-bold"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Losses Section */}
                <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl p-4 sm:p-6 border-2 border-red-200">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 bg-red-600 rounded-lg">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-red-900">Loss Points</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { name: 'loss_same_category', label: 'Same Level' },
                      { name: 'loss_one_level_diff', label: '1 Level Down' },
                      { name: 'loss_two_level_diff', label: '2 Levels Down' },
                      { name: 'loss_three_level_diff', label: '3 Levels Down' }
                    ].map(({ name, label }) => (
                      <div key={name}>
                        <label htmlFor={name} className="block text-xs font-semibold text-gray-700 mb-1.5">
                          {label}
                        </label>
                        <input
                          type="number"
                          name={name}
                          id={name}
                          min="-20"
                          max="20"
                          value={formData[name as keyof typeof formData]}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 rounded-lg border-2 border-gray-200 focus:border-red-500 focus:ring-4 focus:ring-red-100 transition-all outline-none text-center text-lg font-bold"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 bg-white rounded-2xl shadow-lg border border-gray-100 p-4 sticky bottom-4">
            <Link 
              href="/dashboard/committee/team-management/categories"
              className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto inline-flex items-center justify-center px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-lg hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  Create Category
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
