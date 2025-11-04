'use client';

import { Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useModal } from '@/hooks/useModal';
import AlertModal from '@/components/modals/AlertModal';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface Category {
  id: string;
  name: string;
  icon?: string;
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
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  // Modal system
  const { alertState, showAlert, closeAlert } = useModal();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'committee_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetchWithTokenRefresh(/api/categories');
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
      const response = await fetchWithTokenRefresh(`/api/categories/${categoryId}`, {
        method: 'DELETE',
      });
      
      const result = await response.json();
      
      if (result.success) {
        setCategories(categories.filter(c => c.id !== categoryId));
        setSuccessMessage('Category deleted successfully!');
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        showAlert({
          type: 'error',
          title: 'Delete Failed',
          message: `Error: ${result.error}`
        });
      }
    } catch (error) {
      console.error('Error deleting category:', error);
      showAlert({
        type: 'error',
        title: 'Delete Failed',
        message: 'Failed to delete category'
      });
    } finally {
      setDeleteConfirm(null);
    }
  };

  if (loading || isLoadingCategories) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading categories...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'committee_admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 py-4 sm:py-8 px-3 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
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
                  Categories
                </h1>
              </div>
              <p className="text-gray-600 text-sm sm:text-base ml-14">Manage player tiers and point distribution</p>
              <Link 
                href="/dashboard/committee/team-management" 
                className="inline-flex items-center ml-14 mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Dashboard
              </Link>
            </div>
            <Link 
              href="/dashboard/committee/team-management/categories/new" 
              className="inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-lg hover:scale-105 transition-all"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span className="hidden sm:inline">New Category</span>
              <span className="sm:hidden">New</span>
            </Link>
          </div>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 bg-green-50 border-l-4 border-green-500 rounded-xl p-4 shadow-sm animate-fade-in">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-green-800">Success</h4>
                <p className="text-sm text-green-700 mt-1">{successMessage}</p>
              </div>
              <button onClick={() => setSuccessMessage(null)} className="text-green-400 hover:text-green-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Categories Grid/List */}
        {categories.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="bg-gradient-to-br from-blue-100 to-indigo-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">No Categories Yet</h3>
              <p className="text-gray-600 mb-6">Create your first category to start organizing players into skill tiers.</p>
              <Link
                href="/dashboard/committee/team-management/categories/new"
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg shadow-md hover:shadow-lg hover:scale-105 transition-all"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Create First Category
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
            {categories.map((category) => (
              <div key={category.id} className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300">
                {/* Card Header */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-4xl">{category.icon || '⭐'}</div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">{category.name}</h3>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 mt-1">
                          Priority {category.priority}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-6 space-y-4">
                  {/* Win Points */}
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-3 border border-green-100">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 bg-green-600 rounded-md">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <h4 className="text-xs font-bold text-green-900 uppercase">Win Points</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center justify-between bg-white/60 rounded px-2 py-1">
                        <span className="text-gray-600">Same:</span>
                        <span className="font-bold text-green-700">{category.points_same_category}</span>
                      </div>
                      <div className="flex items-center justify-between bg-white/60 rounded px-2 py-1">
                        <span className="text-gray-600">+1:</span>
                        <span className="font-bold text-green-700">{category.points_one_level_diff}</span>
                      </div>
                      <div className="flex items-center justify-between bg-white/60 rounded px-2 py-1">
                        <span className="text-gray-600">+2:</span>
                        <span className="font-bold text-green-700">{category.points_two_level_diff}</span>
                      </div>
                      <div className="flex items-center justify-between bg-white/60 rounded px-2 py-1">
                        <span className="text-gray-600">+3:</span>
                        <span className="font-bold text-green-700">{category.points_three_level_diff}</span>
                      </div>
                    </div>
                  </div>

                  {/* Draw Points */}
                  <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg p-3 border border-blue-100">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 bg-blue-600 rounded-md">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <h4 className="text-xs font-bold text-blue-900 uppercase">Draw Points</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center justify-between bg-white/60 rounded px-2 py-1">
                        <span className="text-gray-600">Same:</span>
                        <span className="font-bold text-blue-700">{category.draw_same_category}</span>
                      </div>
                      <div className="flex items-center justify-between bg-white/60 rounded px-2 py-1">
                        <span className="text-gray-600">+1:</span>
                        <span className="font-bold text-blue-700">{category.draw_one_level_diff}</span>
                      </div>
                      <div className="flex items-center justify-between bg-white/60 rounded px-2 py-1">
                        <span className="text-gray-600">+2:</span>
                        <span className="font-bold text-blue-700">{category.draw_two_level_diff}</span>
                      </div>
                      <div className="flex items-center justify-between bg-white/60 rounded px-2 py-1">
                        <span className="text-gray-600">+3:</span>
                        <span className="font-bold text-blue-700">{category.draw_three_level_diff}</span>
                      </div>
                    </div>
                  </div>

                  {/* Loss Points */}
                  <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-lg p-3 border border-red-100">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 bg-red-600 rounded-md">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <h4 className="text-xs font-bold text-red-900 uppercase">Loss Points</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center justify-between bg-white/60 rounded px-2 py-1">
                        <span className="text-gray-600">Same:</span>
                        <span className="font-bold text-red-700">{category.loss_same_category}</span>
                      </div>
                      <div className="flex items-center justify-between bg-white/60 rounded px-2 py-1">
                        <span className="text-gray-600">-1:</span>
                        <span className="font-bold text-red-700">{category.loss_one_level_diff}</span>
                      </div>
                      <div className="flex items-center justify-between bg-white/60 rounded px-2 py-1">
                        <span className="text-gray-600">-2:</span>
                        <span className="font-bold text-red-700">{category.loss_two_level_diff}</span>
                      </div>
                      <div className="flex items-center justify-between bg-white/60 rounded px-2 py-1">
                        <span className="text-gray-600">-3:</span>
                        <span className="font-bold text-red-700">{category.loss_three_level_diff}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="bg-gray-50 px-6 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
                  <Link
                    href={`/dashboard/committee/team-management/categories/${category.id}/edit`}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-all"
                  >
                    <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit
                  </Link>
                  {deleteConfirm === category.id ? (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleDelete(category.id)}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-all"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(category.id)}
                      className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-all"
                    >
                      <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Component */}
      <AlertModal
        isOpen={alertState.isOpen}
        onClose={closeAlert}
        title={alertState.title}
        message={alertState.message}
        type={alertState.type}
      />
    </div>
  );
}

export default function CategoriesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mx-auto"></div>
            <p className="mt-4 text-gray-600 font-medium">Loading categories...</p>
          </div>
        </div>
      }
    >
      <CategoriesPageContent />
    </Suspense>
  );
}
