'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import Link from 'next/link';

interface Season {
  id: string;
  name: string;
  short_name?: string;
  status: string;
  is_historical: boolean;
  season_start?: any;
  season_end?: any;
  champion_team_name?: string;
  runner_up_team_name?: string;
  total_teams?: number;
  total_players?: number;
}

export default function SeasonsArchivePage() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [filteredSeasons, setFilteredSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'historical' | 'active'>('all');

  useEffect(() => {
    fetchSeasons();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchTerm, filterType, seasons]);

  const fetchSeasons = async () => {
    try {
      setLoading(true);
      
      // Fetch all seasons
      const seasonsRef = collection(db, 'seasons');
      const seasonsQuery = query(seasonsRef, orderBy('created_at', 'desc'));
      const seasonsSnapshot = await getDocs(seasonsQuery);
      
      const seasonsData = seasonsSnapshot.docs.map(doc => {
        const data = doc.data();
        let name = data.name;
        
        // Generate name from ID if missing (for historical seasons like sspsls15)
        if (!name && doc.id) {
          const seasonNum = doc.id.match(/\d+/);
          if (seasonNum) {
            name = `Season ${seasonNum[0]}`;
          } else {
            name = doc.id;
          }
        }
        
        return {
          id: doc.id,
          ...data,
          name
        };
      }) as Season[];
      
      setSeasons(seasonsData);
    } catch (error) {
      console.error('Error fetching seasons:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...seasons];
    
    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(season =>
        season.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        season.short_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Type filter
    if (filterType === 'historical') {
      filtered = filtered.filter(season => season.is_historical);
    } else if (filterType === 'active') {
      filtered = filtered.filter(season => !season.is_historical && season.status !== 'completed');
    }
    
    setFilteredSeasons(filtered);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading seasons...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2 gradient-text">Seasons Archive</h1>
        <p className="text-gray-600">Browse all past and current seasons</p>
      </div>

      {/* Filters */}
      <div className="glass rounded-2xl p-6 mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <input
              type="text"
              placeholder="Search seasons..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Filter Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as 'all' | 'historical' | 'active')}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Seasons</option>
              <option value="active">Active Seasons</option>
              <option value="historical">Historical Seasons</option>
            </select>
          </div>
        </div>

        {/* Results Count */}
        <div className="mt-4 text-sm text-gray-600">
          Showing {filteredSeasons.length} of {seasons.length} seasons
        </div>
      </div>

      {/* Seasons Grid */}
      {filteredSeasons.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-gray-600 text-lg">No seasons found</p>
          <p className="text-gray-500 text-sm mt-2">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSeasons.map((season) => {
            const isActive = !season.is_historical && season.status !== 'completed';
            const detailLink = season.is_historical 
              ? `/seasons/${season.id}` 
              : '/season/current';
            
            return (
              <Link
                key={season.id}
                href={detailLink}
                className="glass rounded-xl p-6 hover:shadow-lg transition-all duration-200 hover:scale-105 group"
              >
                {/* Season Header */}
                <div className="mb-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-xl font-bold text-gray-900 flex-1">
                      {season.name}
                    </h3>
                    {isActive && (
                      <span className="ml-2 px-2 py-1 rounded-lg bg-green-100 text-green-700 text-xs font-semibold flex-shrink-0">
                        🟢 Active
                      </span>
                    )}
                  </div>
                  {season.short_name && (
                    <p className="text-sm text-gray-600">{season.short_name}</p>
                  )}
                </div>

                {/* Champion Info */}
                {season.champion_team_name && (
                  <div className="mb-4 p-3 bg-amber-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">🏆</span>
                      <span className="text-xs font-medium text-amber-700">Champion</span>
                    </div>
                    <p className="font-semibold text-amber-900 text-sm">
                      {season.champion_team_name}
                    </p>
                    {season.runner_up_team_name && (
                      <p className="text-xs text-amber-700 mt-1">
                        Runner-up: {season.runner_up_team_name}
                      </p>
                    )}
                  </div>
                )}

                {/* Stats */}
                {(season.total_teams || season.total_players) && (
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {season.total_teams && (
                      <div className="bg-blue-50 rounded-lg p-3">
                        <div className="text-xs text-gray-600 mb-1">Teams</div>
                        <div className="text-lg font-bold text-blue-600">{season.total_teams}</div>
                      </div>
                    )}
                    {season.total_players && (
                      <div className="bg-purple-50 rounded-lg p-3">
                        <div className="text-xs text-gray-600 mb-1">Players</div>
                        <div className="text-lg font-bold text-purple-600">{season.total_players}</div>
                      </div>
                    )}
                  </div>
                )}

                {/* View Details */}
                <div className="pt-3 border-t border-gray-200 flex items-center justify-between text-blue-600 font-medium">
                  <span className="text-sm">View Details</span>
                  <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
