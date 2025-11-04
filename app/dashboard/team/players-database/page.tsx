'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import PlayerImage from '@/components/PlayerImage';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

// Position constants
const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'DST'];
const POSITION_GROUPS = ['Offense', 'Defense', 'Special Teams'];

interface Player {
  id: number;
  name: string;
  position: string;
  position_group?: string;
  nfl_team: string;
  overall_rating: number;
  acquisition_value?: number;
  player_id?: string;
}

export default function TeamPlayersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [positionFilter, setPositionFilter] = useState('all');
  const [positionGroupFilter, setPositionGroupFilter] = useState('all');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'team') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const fetchPlayers = async () => {
      if (!user) return;

      try {
        const response = await fetchWithTokenRefresh('/api/team/players', {
          headers: { 'Cache-Control': 'no-cache' },
        });
        
        if (!response.ok) {
          console.error('Failed to fetch players:', response.status, response.statusText);
          setIsLoading(false);
          return;
        }
        
        const { success, data, error } = await response.json();

        if (success) {
          console.log('Players fetched successfully:', data.players?.length || 0, 'players');
          setPlayers(data.players || []);
        } else {
          console.error('API returned error:', error);
        }
      } catch (err) {
        console.error('Error fetching players:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlayers();
  }, [user]);

  // Filter players
  const filteredPlayers = players.filter(player => {
    const matchesSearch = 
      player.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      player.position.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesPosition = positionFilter === 'all' || player.position === positionFilter;
    const matchesGroup = positionGroupFilter === 'all' || player.position_group === positionGroupFilter;

    return matchesSearch && matchesPosition && matchesGroup;
  });

  const getPositionColor = (position: string) => {
    switch (position) {
      case 'QB': return 'bg-red-100 text-red-800';
      case 'RB': return 'bg-blue-100 text-blue-800';
      case 'WR': return 'bg-green-100 text-green-800';
      case 'TE': return 'bg-purple-100 text-purple-800';
      case 'K': return 'bg-yellow-100 text-yellow-800';
      case 'DST': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 85) return 'bg-green-100 text-green-800 border-green-200';
    if (rating >= 75) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (rating >= 65) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading players...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'team') {
    return null;
  }

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
      {/* Mobile Header Section */}
      <div className="block sm:hidden glass rounded-3xl p-4 shadow-lg mb-4">
        <div className="text-center mb-4">
          <h2 className="text-xl font-bold text-dark mb-1">Players</h2>
          <p className="text-sm text-gray-500">{players.length} players acquired</p>
        </div>
        
        {/* Mobile Search Bar */}
        <div className="relative mb-3">
          <input 
            type="text" 
            placeholder="Search players..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 py-3 pr-4 bg-white/70 backdrop-blur-sm border border-white/30 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all duration-200 shadow-sm text-base"
          />
          <svg className="w-5 h-5 text-gray-500 absolute left-3 top-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        
        {/* Mobile Filters */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <select 
              value={positionFilter}
              onChange={(e) => setPositionFilter(e.target.value)}
              className="w-full pl-8 py-2.5 pr-4 bg-white/70 backdrop-blur-sm border border-white/30 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all duration-200 shadow-sm text-sm"
            >
              <option value="all">All Positions</option>
              {POSITIONS.map(position => (
                <option key={position} value={position}>{position}</option>
              ))}
            </select>
            <svg className="w-4 h-4 text-gray-500 absolute left-2.5 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          
          <Link href="/dashboard/team" className="px-4 py-2.5 rounded-xl bg-white/60 text-[#0066FF] hover:bg-white/80 transition-all duration-300 text-sm font-medium flex items-center shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
        </div>
      </div>
      
      {/* Desktop Header Section */}
      <div className="hidden sm:block glass rounded-3xl p-4 sm:p-6 shadow-lg mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="mb-2 sm:mb-0">
            <h2 className="text-2xl font-bold text-dark mb-1">Players</h2>
            <p className="text-sm text-gray-500">Manage your acquired players</p>
          </div>
          
          {/* Filter Controls */}
          <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="flex flex-col sm:flex-row gap-2">
              {/* Position Filter */}
              <div className="relative">
                <select 
                  value={positionFilter}
                  onChange={(e) => setPositionFilter(e.target.value)}
                  className="pl-10 py-2.5 pr-4 bg-white/70 backdrop-blur-sm border border-white/30 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all duration-200 shadow-sm w-full"
                >
                  <option value="all">All Positions</option>
                  {POSITIONS.map(position => (
                    <option key={position} value={position}>{position}</option>
                  ))}
                </select>
                <svg className="w-5 h-5 text-gray-500 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              
              {/* Position Group Filter */}
              <div className="relative">
                <select 
                  value={positionGroupFilter}
                  onChange={(e) => setPositionGroupFilter(e.target.value)}
                  className="pl-10 py-2.5 pr-4 bg-white/70 backdrop-blur-sm border border-white/30 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all duration-200 shadow-sm w-full"
                >
                  <option value="all">All Position Groups</option>
                  {POSITION_GROUPS.map(group => (
                    <option key={group} value={group}>{group}</option>
                  ))}
                </select>
                <svg className="w-5 h-5 text-gray-500 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            
            {/* Search Bar */}
            <div className="relative w-full sm:w-64">
              <input 
                type="text" 
                placeholder="Search players..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 py-2.5 pr-4 bg-white/70 backdrop-blur-sm border border-white/30 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all duration-200 shadow-sm"
              />
              <svg className="w-5 h-5 text-gray-500 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            <Link href="/dashboard/team" className="px-4 py-2.5 rounded-xl bg-white/60 text-[#0066FF] hover:bg-white/80 transition-all duration-300 text-sm font-medium flex items-center shadow-sm">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Dashboard
            </Link>
          </div>
        </div>
      </div>
      
      {/* Mobile Card View */}
      <div className="block md:hidden space-y-4 glass rounded-3xl p-4 sm:p-6 shadow-lg">
        {filteredPlayers.length > 0 ? (
          filteredPlayers.map(player => (
            <div 
              key={player.id}
              className="glass-card p-4 rounded-2xl hover:shadow-lg transition-all duration-300 backdrop-blur-sm bg-white/50 border border-white/30"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="h-14 w-14 rounded-full overflow-hidden flex items-center justify-center shadow-md border border-white/40 bg-[#0066FF]/10">
                    <PlayerImage
                      playerId={player.player_id || player.id}
                      playerName={player.name}
                      size={56}
                      className="rounded-full"
                    />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 text-base">{player.name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPositionColor(player.position)}`}>
                        {player.position}
                      </span>
                      {player.position_group && (
                        <span className="text-xs px-2 py-0.5 bg-[#0066FF]/10 text-[#0066FF] rounded-lg">{player.position_group}</span>
                      )}
                    </div>
                  </div>
                </div>
                <span className={`flex items-center justify-center h-10 w-10 rounded-full shadow-sm border ${getRatingColor(player.overall_rating)}`}>
                  <span className="font-bold text-sm">{player.overall_rating}</span>
                </span>
              </div>
              
              <div className="mt-4 pt-3 border-t border-gray-200/50 flex justify-between items-center">
                <div className="text-sm text-gray-700">
                  <span className="font-medium text-xs text-gray-500">Acquisition Value</span><br />
                  <span className={`text-base font-semibold ${player.acquisition_value ? 'text-[#0066FF]' : 'text-gray-500'}`}>
                    {player.acquisition_value ? `£${player.acquisition_value.toLocaleString()}` : 'Free Transfer'}
                  </span>
                </div>
                <Link href={`/dashboard/team/player/${player.player_id || player.id}`} className="px-4 py-2 rounded-xl bg-[#0066FF] text-white hover:bg-[#0052CC] transition-colors duration-200 flex items-center text-sm shadow-sm">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Details
                </Link>
              </div>
            </div>
          ))
        ) : (
          <div className="glass-card p-8 rounded-2xl text-center backdrop-blur-sm bg-white/40 border border-white/20 shadow-lg">
            <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="text-gray-700 text-lg font-medium mb-2">
              {players.length === 0 ? 'No players acquired yet' : 'No matches found'}
            </p>
            <p className="text-gray-500 text-sm mb-4">
              {players.length === 0 ? 'Join an active round to bid on players' : 'Try adjusting your filters'}
            </p>
            {players.length === 0 && (
              <Link href="/dashboard/team" className="inline-flex items-center px-4 py-2 rounded-xl bg-[#0066FF] text-white shadow-md hover:bg-[#0052CC] transition-all duration-300">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Browse Players
              </Link>
            )}
          </div>
        )}
      </div>
      
      {/* Desktop Table View */}
      <div className="hidden md:block glass rounded-3xl p-4 sm:p-6 shadow-lg overflow-hidden">
        <div className="overflow-x-auto rounded-xl">
          <table className="min-w-full divide-y divide-gray-200 bg-white/40 backdrop-blur-sm">
            <thead className="bg-gray-50/80">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Group</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rating</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acquisition Value</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white/30">
              {filteredPlayers.length > 0 ? (
                filteredPlayers.map(player => (
                  <tr key={player.id} className="hover:bg-white/70 transition-all duration-200">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-12 w-12 rounded-full overflow-hidden flex items-center justify-center border border-white/40 shadow-sm bg-[#0066FF]/10">
                          <PlayerImage
                            playerId={player.player_id || player.id}
                            playerName={player.name}
                            size={48}
                            className="rounded-full"
                          />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-800">{player.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${getPositionColor(player.position)}`}>
                        {player.position}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {player.position_group ? (
                        <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-[#0066FF]/10 text-[#0066FF]">
                          {player.position_group}
                        </span>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`flex items-center justify-center h-8 w-8 rounded-full text-xs font-medium border ${getRatingColor(player.overall_rating)}`}>
                        {player.overall_rating}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={player.acquisition_value ? 'text-[#0066FF] font-medium' : 'text-gray-500'}>
                        {player.acquisition_value ? `£${player.acquisition_value.toLocaleString()}` : 'Free Transfer'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Link href={`/dashboard/team/player/${player.player_id || player.id}`} className="inline-flex items-center px-3 py-1.5 rounded-lg bg-[#0066FF] text-white hover:bg-[#0052CC] transition-all duration-200 shadow-sm">
                        <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-10 whitespace-nowrap text-sm text-gray-500 text-center">
                    <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <p className="text-gray-700 text-lg font-medium mb-2">
                      {players.length === 0 ? 'No players acquired yet' : 'No matches found'}
                    </p>
                    <p className="text-gray-500 text-sm mb-4">
                      {players.length === 0 ? 'Join an active round to bid on players' : 'Try adjusting your filters'}
                    </p>
                    {players.length === 0 && (
                      <Link href="/dashboard/team" className="inline-flex items-center px-4 py-2 rounded-xl bg-[#0066FF] text-white shadow-md hover:bg-[#0052CC] transition-all duration-300">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        Browse Players
                      </Link>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
