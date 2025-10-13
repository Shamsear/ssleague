'use client';

import React, { useEffect, useState } from 'react';
import { TiebreakerListResponse, Tiebreaker } from '@/types/tiebreaker';
import TiebreakerCard from '@/components/tiebreaker/TiebreakerCard';
import { sortTiebreakersByUrgency } from '@/lib/utils/tiebreakerUtils';
import { Filter, AlertCircle, CheckCircle, Clock, X } from 'lucide-react';

type FilterType = 'all' | 'active' | 'completed' | 'pending';

export default function TeamTiebreakersPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TiebreakerListResponse | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  useEffect(() => {
    fetchTiebreakers();
  }, []);

  const fetchTiebreakers = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/team/bulk-tiebreakers');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch tiebreakers');
      }

      setData(result.data);
    } catch (err: any) {
      console.error('Error fetching tiebreakers:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredTiebreakers = (): Tiebreaker[] => {
    if (!data) return [];

    switch (activeFilter) {
      case 'active':
        return sortTiebreakersByUrgency(data.grouped.active);
      case 'completed':
        return data.grouped.completed;
      case 'pending':
        return data.grouped.pending;
      default:
        return sortTiebreakersByUrgency(data.all);
    }
  };

  const filteredTiebreakers = getFilteredTiebreakers();

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading tiebreakers...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle className="w-6 h-6 text-red-600" />
            <h2 className="text-xl font-semibold text-red-900">Error Loading Tiebreakers</h2>
          </div>
          <p className="text-red-700 mb-4">{error}</p>
          <button
            onClick={fetchTiebreakers}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">My Tiebreakers</h1>
        <p className="text-gray-600">
          View and manage your tiebreaker auctions using the Last Person Standing mechanism
        </p>
      </div>

      {/* Stats Cards */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total</p>
                <p className="text-2xl font-bold text-gray-900">{data.count.total}</p>
              </div>
              <Filter className="w-8 h-8 text-gray-400" />
            </div>
          </div>

          <div className="bg-green-50 rounded-lg shadow-md border border-green-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700 mb-1">Active</p>
                <p className="text-2xl font-bold text-green-900">{data.count.active}</p>
              </div>
              <Clock className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg shadow-md border border-blue-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-700 mb-1">Completed</p>
                <p className="text-2xl font-bold text-blue-900">{data.count.completed}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg shadow-md border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Pending</p>
                <p className="text-2xl font-bold text-gray-900">{data.count.pending}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-gray-400" />
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setActiveFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeFilter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          All ({data?.count.total || 0})
        </button>
        <button
          onClick={() => setActiveFilter('active')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeFilter === 'active'
              ? 'bg-green-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          Active ({data?.count.active || 0})
        </button>
        <button
          onClick={() => setActiveFilter('completed')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeFilter === 'completed'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          Completed ({data?.count.completed || 0})
        </button>
        <button
          onClick={() => setActiveFilter('pending')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeFilter === 'pending'
              ? 'bg-gray-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          Pending ({data?.count.pending || 0})
        </button>
      </div>

      {/* Tiebreaker List */}
      {filteredTiebreakers.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-12 text-center">
          <X className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            No {activeFilter !== 'all' && activeFilter} tiebreakers
          </h3>
          <p className="text-gray-600 mb-6">
            {activeFilter === 'all'
              ? "You're not currently in any tiebreakers."
              : `You don't have any ${activeFilter} tiebreakers at the moment.`}
          </p>
          {activeFilter !== 'all' && (
            <button
              onClick={() => setActiveFilter('all')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              View All Tiebreakers
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTiebreakers.map((tiebreaker: any) => (
            <TiebreakerCard
              key={tiebreaker.id}
              tiebreaker={tiebreaker}
              myStatus={tiebreaker.my_status}
              showMyStatus={true}
            />
          ))}
        </div>
      )}

      {/* Refresh Button */}
      <div className="mt-8 text-center">
        <button
          onClick={fetchTiebreakers}
          className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
        >
          Refresh List
        </button>
      </div>
    </div>
  );
}
