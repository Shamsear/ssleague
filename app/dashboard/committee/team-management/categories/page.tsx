'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';

interface Category {
  id: string;
  name: string;
  color: string;
  priority: number;
  points_same_category: number;
  points_one_level_diff: number;
  points_two_level_diff: number;
  points_three_level_diff: number;
  draw_same_category: number;
  draw_one_level_diff: number;
  draw_two_level_diff: number;
  draw_three_level_diff: number;
  loss_same_category: number;
  loss_one_level_diff: number;
  loss_two_level_diff: number;
  loss_three_level_diff: number;
}

function CategoriesPageContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'committee_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch('/api/categories');
        const result = await response.json();
        
        if (result.success) {
          setCategories(result.data);
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
      } finally {
        setIsLoadingCategories(false);
      }
    };

    if (user && user.role === 'committee_admin') {
      fetchCategories();
    }
  }, [user]);

  // Check for success messages
  useEffect(() => {
    const success = searchParams.get('success');
    if (success === 'created') {
      setSuccessMessage('Category created successfully!');
      setTimeout(() => setSuccessMessage(null), 5000);
    } else if (success === 'updated') {
      setSuccessMessage('Category updated successfully!');
      setTimeout(() => setSuccessMessage(null), 5000);
    } else if (success === 'deleted') {
      setSuccessMessage('Category deleted successfully!');
      setTimeout(() => setSuccessMessage(null), 5000);
    }
  }, [searchParams]);

  const handleDelete = async (categoryId: string) => {
    try {
      const response = await fetch(`/api/categories/${categoryId}`, {
        method: 'DELETE',
      });
      
      const result = await response.json();
      
      if (result.success) {
        setCategories(categories.filter(c => c.id !== categoryId));
        setSuccessMessage('Category deleted successfully!');
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error deleting category:', error);
      alert('Failed to delete category');
    } finally {
      setDeleteConfirm(null);
    }
  };

  const getColorClass = (color: string) => {
    const colorMap: { [key: string]: string } = {
      red: 'bg-red-600',
      blue: 'bg-blue-600',
      black: 'bg-black',
      white: 'bg-white border-2 border-gray-300',
    };
    return colorMap[color] || 'bg-gray-200';
  };

  if (loading || isLoadingCategories) {
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
      {/* Success Message */}
      {successMessage && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4 flex items-start animate-fade-in">
          <svg className="w-5 h-5 text-green-600 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h4 className="text-sm font-medium text-green-800">Success</h4>
            <p className="text-sm text-green-700 mt-1">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Header - hidden on mobile */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4 hidden sm:flex">
        <div className="mb-2 sm:mb-0">
          <h1 className="text-3xl md:text-4xl font-bold gradient-text">Categories</h1>
          <p className="text-gray-500 mt-1">Manage your match categories and point system</p>
          <Link 
            href="/dashboard/committee/team-management" 
            className="inline-flex items-center mt-2 text-[#0066FF] hover:text-[#0052CC]"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </Link>
        </div>
        <Link 
          href="/dashboard/committee/team-management/categories/new"
          className="bg-gradient-to-r from-[#0066FF] to-[#0052CC] text-white font-bold py-3 px-6 rounded-xl focus:outline-none shadow-md hover:shadow-lg transition-all duration-300 flex items-center justify-center"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          New Category
        </Link>
      </div>

      <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-xl overflow-hidden border border-gray-100/20">
        {/* Desktop Table (hidden on mobile) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200/50">
            <thead className="bg-gray-50/50">
              <tr>
                <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Color
                </th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Priority
                </th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Points Configuration
                </th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white/60 divide-y divide-gray-200/50">
              {categories.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 whitespace-nowrap text-center text-sm text-gray-500">
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      className="h-12 w-12 mx-auto mb-4 text-gray-300" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth="1.5" 
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" 
                      />
                    </svg>
                    <p className="font-medium">No categories found</p>
                    <Link
                      href="/dashboard/committee/team-management/categories/new"
                      className="inline-flex items-center mt-4 text-[#0066FF] hover:text-[#0052CC] font-medium"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Create your first category
                    </Link>
                  </td>
                </tr>
              ) : (
                categories.map((category) => (
                  <tr key={category.id} className="hover:bg-gray-50/80 transition-colors duration-200">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-base font-medium text-gray-900">{category.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`h-6 w-6 rounded-full mr-2 shadow-sm ${getColorClass(category.color)}`}></div>
                        <div className="text-sm text-gray-900 capitalize">{category.color}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {category.priority}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex items-center">
                            <span className="w-2 h-2 bg-[#0066FF] rounded-full mr-2"></span>
                            <span>Same: {category.points_same_category}</span>
                          </div>
                          <div className="flex items-center">
                            <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
                            <span>One Level: {category.points_one_level_diff}</span>
                          </div>
                          <div className="flex items-center">
                            <span className="w-2 h-2 bg-purple-400 rounded-full mr-2"></span>
                            <span>Two Levels: {category.points_two_level_diff}</span>
                          </div>
                          <div className="flex items-center">
                            <span className="w-2 h-2 bg-pink-400 rounded-full mr-2"></span>
                            <span>Three Levels: {category.points_three_level_diff}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <Link
                          href={`/dashboard/committee/team-management/categories/${category.id}/edit`}
                          className="inline-flex items-center px-3 py-1.5 rounded-lg bg-[#0066FF]/10 text-[#0066FF] hover:bg-[#0066FF]/20 transition-colors"
                        >
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit
                        </Link>
                        {deleteConfirm === category.id ? (
                          <div className="flex space-x-1">
                            <button
                              onClick={() => handleDelete(category.id)}
                              className="inline-flex items-center px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors text-xs"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="inline-flex items-center px-3 py-1.5 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors text-xs"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(category.id)}
                            className="inline-flex items-center px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Mobile Cards (shown only on small screens) */}
        <div className="md:hidden divide-y divide-gray-200/50">
          {categories.length === 0 ? (
            <div className="p-6 text-center">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-12 w-12 mx-auto mb-3 text-gray-300" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth="1.5" 
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" 
                />
              </svg>
              <p className="text-gray-500 mb-4 font-medium">No categories found</p>
              <Link
                href="/dashboard/committee/team-management/categories/new"
                className="inline-flex items-center text-[#0066FF] hover:text-[#0052CC] font-medium"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Create your first category
              </Link>
            </div>
          ) : (
            categories.map((category) => (
              <div key={category.id} className="p-4 bg-white/70 hover:bg-white/90 transition-colors">
                <div className="flex justify-between mb-2">
                  <div className="flex items-center">
                    <div className={`h-8 w-8 rounded-full mr-2 shadow-sm flex-shrink-0 ${getColorClass(category.color)}`}></div>
                    <h3 className="font-medium text-gray-900">{category.name}</h3>
                  </div>
                  <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    Priority: {category.priority}
                  </div>
                </div>

                <div className="mb-4 bg-white/80 rounded-xl p-3 shadow-sm">
                  <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Points Configuration</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center">
                      <span className="w-2 h-2 bg-[#0066FF] rounded-full mr-2"></span>
                      <span>Same: {category.points_same_category}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
                      <span>One Level: {category.points_one_level_diff}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="w-2 h-2 bg-purple-400 rounded-full mr-2"></span>
                      <span>Two Levels: {category.points_two_level_diff}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="w-2 h-2 bg-pink-400 rounded-full mr-2"></span>
                      <span>Three: {category.points_three_level_diff}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-2">
                  <Link
                    href={`/dashboard/committee/team-management/categories/${category.id}/edit`}
                    className="inline-flex items-center px-3 py-1.5 rounded-lg bg-[#0066FF]/10 text-[#0066FF] text-sm font-medium hover:bg-[#0066FF]/20 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit
                  </Link>
                  {deleteConfirm === category.id ? (
                    <div className="flex space-x-1">
                      <button
                        onClick={() => handleDelete(category.id)}
                        className="inline-flex items-center px-2 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors text-xs"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="inline-flex items-center px-2 py-1.5 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(category.id)}
                      className="inline-flex items-center px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 transition-colors"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function CategoriesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading categories...</p>
          </div>
        </div>
      }
    >
      <CategoriesPageContent />
    </Suspense>
  );
}
