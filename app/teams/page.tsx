'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

interface Team {
  id: string;
  team_id: string;
  team_name: string;
  logo_url?: string;
  balance?: number;
  matches_played?: number;
  wins?: number;
  draws?: number;
  losses?: number;
  goals_scored?: number;
  goals_conceded?: number;
  points?: number;
  created_at?: any;
}

export default function AllTeamsPage() {
  const searchParams = useSearchParams();
  const seasonId = searchParams.get('season');
  
  const [teams, setTeams] = useState<Team[]>([]);
  const [filteredTeams, setFilteredTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<string>('name');
  const [seasonName, setSeasonName] = useState<string>('');

  useEffect(() => {
    fetchTeams();
  }, [seasonId]);

  useEffect(() => {
    applyFilters();
  }, [searchTerm, sortBy, teams]);

  const fetchTeams = async () => {
    try {
      setLoading(true);
      
      // If season filter is provided, fetch teams for that season
      if (seasonId) {
        const response = await fetch(`/api/seasons/${seasonId}/stats`);
        const data = await response.json();
        
        if (data.success && data.data?.teams) {
          setTeams(data.data.teams);
          setSeasonName(data.data.season_name || '');
        }
      } else {
        // Fetch all teams from Firebase
        const response = await fetch('/api/teams');
        const data = await response.json();
        
        if (data.success && data.teams) {
          setTeams(data.teams);
        }
      }
    } catch (error) {
      console.error('Error fetching teams:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...teams];
    
    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(team =>
        team.team_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.team_name.localeCompare(b.team_name);
        case 'balance':
          return (b.balance || 0) - (a.balance || 0);
        case 'wins':
          return (b.wins || 0) - (a.wins || 0);
        case 'goals':
          return (b.goals_scored || 0) - (a.goals_scored || 0);
        default:
          return 0;
      }
    });
    
    setFilteredTeams(filtered);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading teams...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2 gradient-text">
          {seasonName ? `${seasonName} Teams` : 'All Teams'}
        </h1>
        <p className="text-gray-600">
          {seasonName ? `Teams competing in ${seasonName}` : 'Browse team profiles and standings'}
        </p>
      </div>

      {/* Filters */}
      <div className="glass rounded-2xl p-6 mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <input
              type="text"
              placeholder="Search teams..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Sort */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="name">Name (A-Z)</option>
              <option value="balance">Balance (High to Low)</option>
              <option value="wins">Wins (High to Low)</option>
              <option value="goals">Goals (High to Low)</option>
            </select>
          </div>
        </div>

        {/* Results Count */}
        <div className="mt-4 text-sm text-gray-600">
          Showing {filteredTeams.length} of {teams.length} teams
        </div>
      </div>

      {/* Teams Grid */}
      {filteredTeams.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <p className="text-gray-600 text-lg">No teams found</p>
          <p className="text-gray-500 text-sm mt-2">Try adjusting your search</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTeams.map((team) => (
            <Link
              key={team.team_id}
              href={`/teams/${team.team_id}`}
              className="glass rounded-xl p-6 hover:shadow-lg transition-all duration-200 hover:scale-105 group"
            >
              {/* Team Header */}
              <div className="flex items-center gap-4 mb-4">
                {/* Team Logo */}
                {team.logo_url ? (
                  <div className="w-16 h-16 rounded-lg bg-white flex-shrink-0 flex items-center justify-center p-2">
                    <Image
                      src={team.logo_url}
                      alt={team.team_name}
                      width={64}
                      height={64}
                      className="object-contain w-full h-full"
                    />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                    <svg className="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
                    </svg>
                  </div>
                )}
              </div>

              {/* Team Name */}
              <h3 className="text-xl font-bold text-gray-900 mb-4 truncate">
                {team.team_name}
              </h3>

              {/* Stats */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Matches</span>
                  <span className="font-semibold text-gray-900">{team.matches_played || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Record</span>
                  <span className="font-semibold text-gray-900">
                    {team.wins || 0}W - {team.draws || 0}D - {team.losses || 0}L
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Goals</span>
                  <span className="font-semibold text-gray-900">
                    {team.goals_scored || 0} - {team.goals_conceded || 0}
                  </span>
                </div>
              </div>

              {/* View Details Arrow */}
              <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between text-blue-600 font-medium">
                <span>View Details</span>
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
