'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function NewCategoryPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    color: 'red',
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

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'committee_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    // Auto-select color based on name
    if (formData.name) {
      const color = selectColorBasedOnName(formData.name);
      if (color) {
        setFormData(prev => ({ ...prev, color }));
      }
    }
  }, [formData.name]);

  const selectColorBasedOnName = (name: string): string => {
    const lowerName = name.toLowerCase();
    const colorKeywords: { [key: string]: string[] } = {
      red: ['red', 'crimson', 'scarlet', 'ruby', 'fire', 'flame', 'blood', 'cherry'],
      blue: ['blue', 'azure', 'sky', 'ocean', 'sea', 'navy', 'sapphire', 'indigo', 'teal', 'water'],
      black: ['black', 'dark', 'night', 'shadow', 'obsidian', 'onyx', 'coal', 'ebony', 'midnight'],
      white: ['white', 'light', 'snow', 'cloud', 'pearl', 'ivory', 'diamond', 'crystal', 'silver'],
    };

    for (const [color, keywords] of Object.entries(colorKeywords)) {
      for (const keyword of keywords) {
        if (lowerName.includes(keyword)) {
          return color;
        }
      }
    }

    if (name.length > 0) {
      const colors = ['red', 'blue', 'black', 'white'];
      const hashIndex = name.charCodeAt(0) % colors.length;
      return colors[hashIndex];
    }

    return 'red';
  };

  const getColorStyles = (color: string) => {
    const styles: { [key: string]: string } = {
      red: 'bg-red-600',
      blue: 'bg-blue-600',
      black: 'bg-black',
      white: 'bg-white border-2 border-gray-300',
    };
    return styles[color] || 'bg-gray-200';
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to create category');
      }

      // Success - redirect to categories list
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
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
        <div className="mb-2 sm:mb-0">
          <h1 className="text-3xl md:text-4xl font-bold gradient-text">Create New Category</h1>
          <p className="text-gray-500 mt-1">Configure a new player category for your tournament</p>
        </div>
        <Link 
          href="/dashboard/committee/team-management/categories" 
          className="glass rounded-xl px-4 py-3 text-gray-700 font-medium hover:bg-white/60 transition-all duration-300 shadow-sm flex items-center"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Categories
        </Link>
      </div>

      {/* Form Container */}
      <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl overflow-hidden border border-gray-100/20">
        <form onSubmit={handleSubmit} className="space-y-0">
          {/* Form Header with gradient */}
          <div className="bg-gradient-to-r from-[#0066FF]/5 to-[#0052CC]/5 px-6 sm:px-8 py-5 border-b border-gray-200/50">
            <h2 className="text-xl font-bold text-gray-900 flex items-center">
              <svg className="w-6 h-6 mr-2 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              Category Information
            </h2>
            <p className="text-sm text-gray-600 mt-1 ml-8">Configure category details and point system</p>
          </div>

          <div className="p-6 sm:p-8 space-y-8">
            {/* Basic Info Section */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <div className="p-2 bg-[#0066FF]/10 rounded-lg mr-3">
                    <svg className="w-5 h-5 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  Basic Information
                </h3>
                <span className="text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">Step 1 of 2</span>
              </div>
            
            {/* Category Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Category Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                </div>
                <input
                  type="text"
                  name="name"
                  id="name"
                  required
                  value={formData.name}
                  onChange={handleInputChange}
                  className="pl-10 block w-full rounded-xl bg-white/60 border-gray-300 shadow-sm focus:ring-[#0066FF]/40 focus:border-[#0066FF]/70 transition-all duration-200"
                  placeholder="e.g., Red, Blue, Black, White"
                />
              </div>
            </div>

              {/* Category Color */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                  <svg className="w-4 h-4 mr-1.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                  Category Color
                </label>
                <div className="relative">
                  <div className="p-4 bg-gradient-to-br from-white to-gray-50 rounded-xl border-2 border-gray-200 hover:border-[#0066FF]/30 transition-all duration-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className={`h-12 w-12 rounded-xl mr-4 shadow-lg transform transition-transform hover:scale-110 ${getColorStyles(formData.color)}`}></div>
                        <div>
                          <span className="block text-base font-semibold capitalize text-gray-900">{formData.color}</span>
                          <span className="text-xs text-gray-500 flex items-center mt-1">
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            Auto-assigned
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        {['red', 'blue', 'black', 'white'].map((color) => (
                          <div
                            key={color}
                            className={`h-6 w-6 rounded-lg shadow-sm border-2 transition-all ${
                              formData.color === color ? 'border-[#0066FF] scale-110' : 'border-transparent opacity-40'
                            } ${getColorStyles(color)}`}
                          ></div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-gray-500 flex items-center">
                    <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Color is automatically selected based on keywords in the category name
                  </p>
                </div>
              </div>

              {/* Priority */}
              <div>
                <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                  <svg className="w-4 h-4 mr-1.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  Priority Level
                </label>
                <div className="grid grid-cols-4 gap-3">
                  {[1, 2, 3, 4].map((priority) => (
                    <button
                      key={priority}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, priority: String(priority) }))}
                      className={`relative p-4 rounded-xl border-2 transition-all duration-200 ${
                        formData.priority === String(priority)
                          ? 'border-[#0066FF] bg-[#0066FF]/5 shadow-md'
                          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                      }`}
                    >
                      <div className="text-center">
                        <div className={`text-2xl font-bold mb-1 ${
                          formData.priority === String(priority) ? 'text-[#0066FF]' : 'text-gray-700'
                        }`}>
                          {priority}
                        </div>
                        <div className="text-xs font-medium text-gray-500">
                          {priority === 1 && 'Highest'}
                          {priority === 2 && 'High'}
                          {priority === 3 && 'Medium'}
                          {priority === 4 && 'Lowest'}
                        </div>
                      </div>
                      {formData.priority === String(priority) && (
                        <div className="absolute -top-2 -right-2 bg-[#0066FF] rounded-full p-1">
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-500 flex items-center">
                  <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Priority determines the skill level hierarchy (1 = Top tier, 4 = Entry level)
                </p>
              </div>
            </div>

            {/* Points Configuration */}
            <div className="border-t-2 border-gray-200 pt-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <div className="p-2 bg-[#0066FF]/10 rounded-lg mr-3">
                    <svg className="w-5 h-5 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 11V9a2 2 0 00-2-2m2 4v4a2 2 0 104 0v-1m-4-3H9m2 0h4m6 1a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  Points Configuration
                </h3>
                <span className="text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">Step 2 of 2</span>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">How Points Work</p>
                    <p className="text-blue-700">Configure points awarded based on match results and opponent strength. Points range from -20 to +20.</p>
                  </div>
                </div>
              </div>
            
            {/* Points for Wins */}
            <div className="mb-8 bg-white/60 rounded-xl p-4 shadow-sm border border-gray-100">
              <h4 className="text-md font-medium text-gray-800 mb-3 flex items-center">
                <svg className="w-4 h-4 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Points for Wins
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="points_same_category" className="block text-sm font-medium text-gray-700 mb-1">
                    Same Category Match Points
                  </label>
                  <input
                    type="number"
                    name="points_same_category"
                    id="points_same_category"
                    min="-20"
                    max="20"
                    value={formData.points_same_category}
                    onChange={handleInputChange}
                    className="block w-full rounded-lg bg-white/70 border-gray-300 shadow-sm focus:ring-[#0066FF]/40 focus:border-[#0066FF]/70"
                  />
                  <p className="mt-1 text-xs text-gray-500">Points awarded for wins between players of the same category</p>
                </div>

                <div>
                  <label htmlFor="points_one_level_diff" className="block text-sm font-medium text-gray-700 mb-1">
                    One Level Difference Points
                  </label>
                  <input
                    type="number"
                    name="points_one_level_diff"
                    id="points_one_level_diff"
                    min="-20"
                    max="20"
                    value={formData.points_one_level_diff}
                    onChange={handleInputChange}
                    className="block w-full rounded-lg bg-white/70 border-gray-300 shadow-sm focus:ring-[#0066FF]/40 focus:border-[#0066FF]/70"
                  />
                  <p className="mt-1 text-xs text-gray-500">Points awarded for wins between players with 1 level difference</p>
                </div>

                <div>
                  <label htmlFor="points_two_level_diff" className="block text-sm font-medium text-gray-700 mb-1">
                    Two Level Difference Points
                  </label>
                  <input
                    type="number"
                    name="points_two_level_diff"
                    id="points_two_level_diff"
                    min="-20"
                    max="20"
                    value={formData.points_two_level_diff}
                    onChange={handleInputChange}
                    className="block w-full rounded-lg bg-white/70 border-gray-300 shadow-sm focus:ring-[#0066FF]/40 focus:border-[#0066FF]/70"
                  />
                  <p className="mt-1 text-xs text-gray-500">Points awarded for wins between players with 2 level difference</p>
                </div>

                <div>
                  <label htmlFor="points_three_level_diff" className="block text-sm font-medium text-gray-700 mb-1">
                    Three Level Difference Points
                  </label>
                  <input
                    type="number"
                    name="points_three_level_diff"
                    id="points_three_level_diff"
                    min="-20"
                    max="20"
                    value={formData.points_three_level_diff}
                    onChange={handleInputChange}
                    className="block w-full rounded-lg bg-white/70 border-gray-300 shadow-sm focus:ring-[#0066FF]/40 focus:border-[#0066FF]/70"
                  />
                  <p className="mt-1 text-xs text-gray-500">Points awarded for wins between players with 3 level difference</p>
                </div>
              </div>
            </div>
            
            {/* Points for Draws */}
            <div className="mb-8 bg-white/60 rounded-xl p-4 shadow-sm border border-gray-100">
              <h4 className="text-md font-medium text-gray-800 mb-3 flex items-center">
                <svg className="w-4 h-4 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Points for Draws
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="draw_same_category" className="block text-sm font-medium text-gray-700 mb-1">
                    Same Category Draw Points
                  </label>
                  <input
                    type="number"
                    name="draw_same_category"
                    id="draw_same_category"
                    min="-20"
                    max="20"
                    value={formData.draw_same_category}
                    onChange={handleInputChange}
                    className="block w-full rounded-lg bg-white/70 border-gray-300 shadow-sm focus:ring-[#0066FF]/40 focus:border-[#0066FF]/70"
                  />
                  <p className="mt-1 text-xs text-gray-500">Points awarded for draws between players of the same category</p>
                </div>

                <div>
                  <label htmlFor="draw_one_level_diff" className="block text-sm font-medium text-gray-700 mb-1">
                    One Level Difference Draw Points
                  </label>
                  <input
                    type="number"
                    name="draw_one_level_diff"
                    id="draw_one_level_diff"
                    min="-20"
                    max="20"
                    value={formData.draw_one_level_diff}
                    onChange={handleInputChange}
                    className="block w-full rounded-lg bg-white/70 border-gray-300 shadow-sm focus:ring-[#0066FF]/40 focus:border-[#0066FF]/70"
                  />
                  <p className="mt-1 text-xs text-gray-500">Points awarded for draws between players with 1 level difference</p>
                </div>

                <div>
                  <label htmlFor="draw_two_level_diff" className="block text-sm font-medium text-gray-700 mb-1">
                    Two Level Difference Draw Points
                  </label>
                  <input
                    type="number"
                    name="draw_two_level_diff"
                    id="draw_two_level_diff"
                    min="-20"
                    max="20"
                    value={formData.draw_two_level_diff}
                    onChange={handleInputChange}
                    className="block w-full rounded-lg bg-white/70 border-gray-300 shadow-sm focus:ring-[#0066FF]/40 focus:border-[#0066FF]/70"
                  />
                  <p className="mt-1 text-xs text-gray-500">Points awarded for draws between players with 2 level difference</p>
                </div>

                <div>
                  <label htmlFor="draw_three_level_diff" className="block text-sm font-medium text-gray-700 mb-1">
                    Three Level Difference Draw Points
                  </label>
                  <input
                    type="number"
                    name="draw_three_level_diff"
                    id="draw_three_level_diff"
                    min="-20"
                    max="20"
                    value={formData.draw_three_level_diff}
                    onChange={handleInputChange}
                    className="block w-full rounded-lg bg-white/70 border-gray-300 shadow-sm focus:ring-[#0066FF]/40 focus:border-[#0066FF]/70"
                  />
                  <p className="mt-1 text-xs text-gray-500">Points awarded for draws between players with 3 level difference</p>
                </div>
              </div>
            </div>
            
            {/* Points for Losses */}
            <div className="bg-white/60 rounded-xl p-4 shadow-sm border border-gray-100">
              <h4 className="text-md font-medium text-gray-800 mb-3 flex items-center">
                <svg className="w-4 h-4 mr-2 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Points for Losses
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="loss_same_category" className="block text-sm font-medium text-gray-700 mb-1">
                    Same Category Loss Points
                  </label>
                  <input
                    type="number"
                    name="loss_same_category"
                    id="loss_same_category"
                    min="-20"
                    max="20"
                    value={formData.loss_same_category}
                    onChange={handleInputChange}
                    className="block w-full rounded-lg bg-white/70 border-gray-300 shadow-sm focus:ring-[#0066FF]/40 focus:border-[#0066FF]/70"
                  />
                  <p className="mt-1 text-xs text-gray-500">Points awarded for losses between players of the same category</p>
                </div>

                <div>
                  <label htmlFor="loss_one_level_diff" className="block text-sm font-medium text-gray-700 mb-1">
                    One Level Difference Loss Points
                  </label>
                  <input
                    type="number"
                    name="loss_one_level_diff"
                    id="loss_one_level_diff"
                    min="-20"
                    max="20"
                    value={formData.loss_one_level_diff}
                    onChange={handleInputChange}
                    className="block w-full rounded-lg bg-white/70 border-gray-300 shadow-sm focus:ring-[#0066FF]/40 focus:border-[#0066FF]/70"
                  />
                  <p className="mt-1 text-xs text-gray-500">Points awarded for losses between players with 1 level difference</p>
                </div>

                <div>
                  <label htmlFor="loss_two_level_diff" className="block text-sm font-medium text-gray-700 mb-1">
                    Two Level Difference Loss Points
                  </label>
                  <input
                    type="number"
                    name="loss_two_level_diff"
                    id="loss_two_level_diff"
                    min="-20"
                    max="20"
                    value={formData.loss_two_level_diff}
                    onChange={handleInputChange}
                    className="block w-full rounded-lg bg-white/70 border-gray-300 shadow-sm focus:ring-[#0066FF]/40 focus:border-[#0066FF]/70"
                  />
                  <p className="mt-1 text-xs text-gray-500">Points awarded for losses between players with 2 level difference</p>
                </div>

                <div>
                  <label htmlFor="loss_three_level_diff" className="block text-sm font-medium text-gray-700 mb-1">
                    Three Level Difference Loss Points
                  </label>
                  <input
                    type="number"
                    name="loss_three_level_diff"
                    id="loss_three_level_diff"
                    min="-20"
                    max="20"
                    value={formData.loss_three_level_diff}
                    onChange={handleInputChange}
                    className="block w-full rounded-lg bg-white/70 border-gray-300 shadow-sm focus:ring-[#0066FF]/40 focus:border-[#0066FF]/70"
                  />
                  <p className="mt-1 text-xs text-gray-500">Points awarded for losses between players with 3 level difference</p>
                </div>
              </div>
            </div>
          </div>

            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 animate-fade-in">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-red-600 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <h4 className="text-sm font-medium text-red-800">Error Creating Category</h4>
                    <p className="text-sm text-red-700 mt-1">{error}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Submit Button Area */}
          <div className="bg-gray-50 px-6 sm:px-8 py-4 border-t border-gray-200">
            <div className="flex justify-between items-center">
              <Link 
                href="/dashboard/committee/team-management/categories"
                className="inline-flex items-center px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center px-6 py-2.5 bg-gradient-to-r from-[#0066FF] to-[#0052CC] text-white font-semibold rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066FF]/50 focus:ring-offset-2 transition-all duration-300 hover:shadow-lg transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating Category...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    Create Category
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
