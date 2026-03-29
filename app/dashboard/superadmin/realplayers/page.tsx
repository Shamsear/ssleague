'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase/config';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import Link from 'next/link';

interface RealPlayer {
  player_id: string;
  name: string;
  display_name?: string;
  place?: string;
  phone?: string;
  email?: string;
  photo_url?: string;
  is_active?: boolean;
  dob?: any;
  date_of_birth?: any;
  created_at?: any;
  updated_at?: any;
}

export default function RealPlayersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [players, setPlayers] = useState<RealPlayer[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<RealPlayer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPlace, setFilterPlace] = useState<string>('all');
  const [sortByDob, setSortByDob] = useState<'asc' | 'desc' | 'none'>('none');
  const [availablePlaces, setAvailablePlaces] = useState<string[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'super_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const fetchPlayers = async () => {
      if (!user || user.role !== 'super_admin') return;

      try {
        setLoadingData(true);
        setError(null);

        const playersRef = collection(db, 'realplayers');
        const q = query(playersRef, orderBy('created_at', 'desc'));
        const querySnapshot = await getDocs(q);

        const playersData: RealPlayer[] = [];
        querySnapshot.forEach((doc) => {
          playersData.push({
            ...doc.data(),
            player_id: doc.data().player_id || doc.id,
          } as RealPlayer);
        });

        setPlayers(playersData);
        setFilteredPlayers(playersData);
        
        // Extract unique places for filter
        const places = new Set<string>();
        playersData.forEach(player => {
          if (player.place) {
            places.add(player.place);
          }
        });
        setAvailablePlaces(Array.from(places).sort());
      } catch (error) {
        console.error('Error fetching players:', error);
        setError('Failed to load players data');
      } finally {
        setLoadingData(false);
      }
    };

    fetchPlayers();
  }, [user]);

  useEffect(() => {
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      let filtered = players.filter(p => 
        p.name?.toLowerCase().includes(term) ||
        p.display_name?.toLowerCase().includes(term) ||
        p.player_id?.toLowerCase().includes(term) ||
        p.phone?.toLowerCase().includes(term) ||
        p.email?.toLowerCase().includes(term) ||
        p.place?.toLowerCase().includes(term)
      );
      
      // Apply place filter
      if (filterPlace !== 'all') {
        filtered = filtered.filter(p => p.place === filterPlace);
      }
      
      // Apply DOB sorting
      if (sortByDob !== 'none') {
        filtered = filtered.sort((a, b) => {
          const dobA = a.dob || a.date_of_birth;
          const dobB = b.dob || b.date_of_birth;
          
          if (!dobA && !dobB) return 0;
          if (!dobA) return 1;
          if (!dobB) return -1;
          
          const dateA = dobA.toDate ? dobA.toDate() : new Date(dobA);
          const dateB = dobB.toDate ? dobB.toDate() : new Date(dobB);
          
          return sortByDob === 'asc' 
            ? dateA.getTime() - dateB.getTime()
            : dateB.getTime() - dateA.getTime();
        });
      }
      
      setFilteredPlayers(filtered);
    } else {
      // Apply place filter even without search
      let filtered = filterPlace !== 'all' 
        ? players.filter(p => p.place === filterPlace)
        : [...players];
      
      // Apply DOB sorting
      if (sortByDob !== 'none') {
        filtered = filtered.sort((a, b) => {
          const dobA = a.dob || a.date_of_birth;
          const dobB = b.dob || b.date_of_birth;
          
          if (!dobA && !dobB) return 0;
          if (!dobA) return 1;
          if (!dobB) return -1;
          
          const dateA = dobA.toDate ? dobA.toDate() : new Date(dobA);
          const dateB = dobB.toDate ? dobB.toDate() : new Date(dobB);
          
          return sortByDob === 'asc' 
            ? dateA.getTime() - dateB.getTime()
            : dateB.getTime() - dateA.getTime();
        });
      }
      
      setFilteredPlayers(filtered);
    }
  }, [searchTerm, players, filterPlace, sortByDob]);

  const formatDate = (date: any) => {
    if (!date) return 'N/A';
    try {
      const dateObj = date.toDate ? date.toDate() : new Date(date);
      return dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return 'N/A';
    }
  };

  const formatDOB = (date: any) => {
    if (!date) return '-';
    try {
      const dateObj = date.toDate ? date.toDate() : new Date(date);
      return dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return '-';
    }
  };

  if (loading || loadingData) {
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
      <div className="container mx-auto max-w-screen-2xl">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => router.push('/dashboard/superadmin')}
              className="p-2 rounded-xl hover:bg-white/50 transition-colors"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-3xl md:text-4xl font-bold gradient-text">Real Players Database</h1>
          </div>
          <p className="text-gray-600 text-sm md:text-base ml-14">All players from Firebase realplayers collection</p>
        </header>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-red-600 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="glass rounded-3xl p-6 mb-8 shadow-lg">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass p-6 rounded-xl bg-white/10">
              <div className="text-sm text-gray-600 mb-1">Total Players</div>
              <div className="text-3xl font-bold text-[#0066FF]">{players.length}</div>
            </div>
            <div className="glass p-6 rounded-xl bg-white/10">
              <div className="text-sm text-gray-600 mb-1">Active Players</div>
              <div className="text-3xl font-bold text-green-600">
                {players.filter(p => p.is_active !== false).length}
              </div>
            </div>
            <div className="glass p-6 rounded-xl bg-white/10">
              <div className="text-sm text-gray-600 mb-1">With Photos</div>
              <div className="text-3xl font-bold text-purple-600">
                {players.filter(p => p.photo_url).length}
              </div>
            </div>
          </div>
        </div>

        {/* Search and Table */}
        <div className="glass rounded-3xl p-6 shadow-lg">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold gradient-text">All Players</h2>
            <div className="text-sm text-gray-600">
              Showing {filteredPlayers.length} of {players.length}
            </div>
          </div>

          {/* Search and Filters */}
          <div className="mb-6 space-y-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search by name, ID, phone, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-3 pl-10 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none"
              />
              <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            
            {/* Place Filter Pills */}
            {availablePlaces.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-sm font-medium text-gray-700">Filter by Place:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setFilterPlace('all')}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      filterPlace === 'all'
                        ? 'bg-gradient-to-r from-[#0066FF] to-[#0052CC] text-white shadow-md'
                        : 'bg-white text-gray-700 border border-gray-200 hover:border-[#0066FF] hover:text-[#0066FF]'
                    }`}
                  >
                    All Places
                    <span className="ml-1.5 opacity-75">({players.length})</span>
                  </button>
                  {availablePlaces.map(place => (
                    <button
                      key={place}
                      onClick={() => setFilterPlace(place)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                        filterPlace === place
                          ? 'bg-gradient-to-r from-[#0066FF] to-[#0052CC] text-white shadow-md'
                          : 'bg-white text-gray-700 border border-gray-200 hover:border-[#0066FF] hover:text-[#0066FF]'
                      }`}
                    >
                      {place}
                      <span className="ml-1.5 opacity-75">
                        ({players.filter(p => p.place === place).length})
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto rounded-xl">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Player ID</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Name</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Place</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Phone</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Created</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white/30">
                {filteredPlayers.map((player) => (
                  <tr key={player.player_id} className="hover:bg-white/60 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-mono text-[#0066FF] font-medium">{player.player_id}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {player.photo_url && (
                          <img 
                            src={player.photo_url} 
                            alt={player.name}
                            className="w-10 h-10 rounded-full object-cover border-2 border-white shadow"
                          />
                        )}
                        <div>
                          <div className="text-sm font-medium text-gray-900">{player.name}</div>
                          {player.display_name && player.display_name !== player.name && (
                            <div className="text-xs text-gray-500">{player.display_name}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {player.place ? (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md bg-purple-100 text-purple-800">
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {player.place}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {player.phone || <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {player.is_active !== false ? (
                        <span className="inline-flex px-2 py-1 text-xs font-medium rounded-md bg-green-100 text-green-800">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-1 text-xs font-medium rounded-md bg-gray-100 text-gray-600">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                      {formatDate(player.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        href={`/dashboard/superadmin/realplayers/${player.player_id}`}
                        className="inline-flex items-center px-3 py-1.5 bg-[#0066FF] text-white text-xs font-medium rounded-lg hover:bg-[#0066FF]/90 transition-colors"
                      >
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-4">
            {filteredPlayers.map((player) => (
              <div key={player.player_id} className="bg-white/30 rounded-xl p-4 border border-gray-100">
                <div className="flex items-start gap-3 mb-3">
                  {player.photo_url && (
                    <img 
                      src={player.photo_url} 
                      alt={player.name}
                      className="w-12 h-12 rounded-full object-cover border-2 border-white shadow"
                    />
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{player.name}</h3>
                    {player.display_name && player.display_name !== player.name && (
                      <p className="text-xs text-gray-500">{player.display_name}</p>
                    )}
                    <p className="text-xs font-mono text-[#0066FF] mt-1">{player.player_id}</p>
                  </div>
                </div>
                
                <div className="space-y-2 text-sm mb-3">
                  {player.place && (
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="text-gray-600">Place:</span>
                      <span className="font-medium">{player.place}</span>
                    </div>
                  )}
                  {player.phone && (
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <span className="text-gray-600">Phone:</span>
                      <span className="font-medium">{player.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-gray-600">Status:</span>
                    <span className={player.is_active !== false ? 'text-green-600 font-medium' : 'text-gray-500'}>
                      {player.is_active !== false ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>

                <Link
                  href={`/dashboard/superadmin/realplayers/${player.player_id}`}
                  className="block w-full text-center px-4 py-2 bg-[#0066FF] text-white text-sm font-medium rounded-lg hover:bg-[#0066FF]/90 transition-colors"
                >
                  View Details
                </Link>
              </div>
            ))}
          </div>

          {filteredPlayers.length === 0 && (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zm-4 7a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <h3 className="text-xl font-medium text-gray-600 mb-2">No players found</h3>
              <p className="text-gray-500">Try adjusting your search</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
