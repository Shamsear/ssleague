'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import PlayerImage, { PlayerAvatar } from '@/components/PlayerImage';
import { useModal } from '@/hooks/useModal';
import AlertModal from '@/components/modals/AlertModal';

// Position constants
const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'DST'];
const POSITION_GROUPS = ['Offense', 'Defense', 'Special Teams'];

interface Player {
  id: number;
  name: string;
  position: string;
  position_group?: string;
  playing_style?: string;
  overall_rating: number;
  speed?: number;
  acceleration?: number;
  ball_control?: number;
  dribbling?: number;
  low_pass?: number;
  lofted_pass?: number;
  finishing?: number;
  tackling?: number;
  defensive_awareness?: number;
  stamina?: number;
  gk_awareness?: number;
  gk_reflexes?: number;
  gk_catching?: number;
  player_id?: string;
  is_starred?: boolean;
}

export default function PlayerStatisticsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const { alertState, showAlert, closeAlert } = useModal();
  const [players, setPlayers] = useState<Player[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [positionFilter, setPositionFilter] = useState('');
  const [playingStyleFilter, setPlayingStyleFilter] = useState('');
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [playingStyles, setPlayingStyles] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const itemsPerPage = 50; // Show 50 players per page

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

      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/players/database?page=${currentPage}&limit=${itemsPerPage}`,
          { headers: { 'Cache-Control': 'no-cache' } }
        );
        const { success, data } = await response.json();

        if (success) {
          setPlayers(data.players || []);
          
          if (data.pagination) {
            setTotalPages(data.pagination.totalPages);
            setTotalPlayers(data.pagination.total);
          }
          
          // Extract unique playing styles
          const styles = Array.from(new Set(
            data.players
              .map((p: Player) => p.playing_style)
              .filter((s: string | undefined) => s)
          )) as string[];
          setPlayingStyles(styles);
        }
      } catch (err) {
        console.error('Error fetching players:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlayers();
  }, [user, currentPage]);

  // Filter players based on all criteria
  useEffect(() => {
    let filtered = [...players];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(player =>
        player.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Position filter
    if (positionFilter) {
      // Check if it's a position or position group
      if (POSITIONS.includes(positionFilter)) {
        filtered = filtered.filter(player => player.position === positionFilter);
      } else if (POSITION_GROUPS.includes(positionFilter)) {
        filtered = filtered.filter(player => player.position_group === positionFilter);
      }
    }

    // Playing style filter
    if (playingStyleFilter) {
      filtered = filtered.filter(player => player.playing_style === playingStyleFilter);
    }

    // Starred filter
    if (showStarredOnly) {
      filtered = filtered.filter(player => player.is_starred);
    }

    setFilteredPlayers(filtered);
  }, [players, searchTerm, positionFilter, playingStyleFilter, showStarredOnly]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, positionFilter, playingStyleFilter, showStarredOnly]);

  const toggleStarPlayer = async (playerId: number, event: React.MouseEvent) => {
    event.stopPropagation();
    
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    const endpoint = player.is_starred 
      ? `/api/players/unstar/${playerId}` 
      : `/api/players/star/${playerId}`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        // Update local state
        setPlayers(prevPlayers =>
          prevPlayers.map(p =>
            p.id === playerId ? { ...p, is_starred: !p.is_starred } : p
          )
        );
      }
    } catch (err) {
      console.error('Error toggling star:', err);
      showAlert({
        type: 'error',
        title: 'Update Failed',
        message: 'Failed to update starred status. Please try again.'
      });
    }
  };

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
    if (rating >= 85) return 'bg-green-100 text-green-800';
    if (rating >= 75) return 'bg-blue-100 text-blue-800';
    if (rating >= 65) return 'bg-yellow-100 text-yellow-800';
    return 'bg-gray-100 text-gray-800';
  };

  const getStatColor = (stat: number) => {
    if (stat >= 85) return 'text-purple-600';
    if (stat >= 80) return 'text-indigo-600';
    if (stat >= 75) return 'text-blue-600';
    if (stat >= 70) return 'text-green-600';
    return 'text-gray-600';
  };

  const renderPlayerStats = (player: Player) => {
    // Different stats based on position
    if (player.position === 'K') {
      return (
        <>
          <div className="text-center">
            <span className="block text-xs text-gray-500">GK Awareness</span>
            <span className={`block text-sm font-medium ${getStatColor(player.gk_awareness || 0)}`}>
              {player.gk_awareness || '-'}
            </span>
          </div>
          <div className="text-center">
            <span className="block text-xs text-gray-500">GK Reflexes</span>
            <span className={`block text-sm font-medium ${getStatColor(player.gk_reflexes || 0)}`}>
              {player.gk_reflexes || '-'}
            </span>
          </div>
          <div className="text-center">
            <span className="block text-xs text-gray-500">GK Catching</span>
            <span className={`block text-sm font-medium ${getStatColor(player.gk_catching || 0)}`}>
              {player.gk_catching || '-'}
            </span>
          </div>
        </>
      );
    } else if (['RB', 'WR', 'TE'].includes(player.position)) {
      return (
        <>
          <div className="text-center">
            <span className="block text-xs text-gray-500">Speed</span>
            <span className={`block text-sm font-medium ${getStatColor(player.speed || 0)}`}>
              {player.speed || '-'}
            </span>
          </div>
          <div className="text-center">
            <span className="block text-xs text-gray-500">Acceleration</span>
            <span className={`block text-sm font-medium ${getStatColor(player.acceleration || 0)}`}>
              {player.acceleration || '-'}
            </span>
          </div>
          <div className="text-center">
            <span className="block text-xs text-gray-500">Ball Control</span>
            <span className={`block text-sm font-medium ${getStatColor(player.ball_control || 0)}`}>
              {player.ball_control || '-'}
            </span>
          </div>
        </>
      );
    } else {
      return (
        <>
          <div className="text-center">
            <span className="block text-xs text-gray-500">Speed</span>
            <span className={`block text-sm font-medium ${getStatColor(player.speed || 0)}`}>
              {player.speed || '-'}
            </span>
          </div>
          <div className="text-center">
            <span className="block text-xs text-gray-500">Acceleration</span>
            <span className={`block text-sm font-medium ${getStatColor(player.acceleration || 0)}`}>
              {player.acceleration || '-'}
            </span>
          </div>
          <div className="text-center">
            <span className="block text-xs text-gray-500">Ball Control</span>
            <span className={`block text-sm font-medium ${getStatColor(player.ball_control || 0)}`}>
              {player.ball_control || '-'}
            </span>
          </div>
        </>
      );
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading football players database...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'team') {
    return null;
  }

  return (
    <div className="container mx-auto space-y-6 px-4 py-4 sm:py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold gradient-text">Football Players Database</h1>
        <div className="flex flex-col sm:flex-row w-full sm:w-auto space-y-3 sm:space-y-0 sm:space-x-4">
          <div className="relative w-full sm:w-auto">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative w-full">
                <input
                  type="text"
                  placeholder="Search players..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full sm:w-64 pl-10 py-2 pr-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all duration-200"
                />
                <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <select
                value={positionFilter}
                onChange={(e) => setPositionFilter(e.target.value)}
                className="w-full sm:w-auto py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all duration-200"
              >
                <option value="">All Positions</option>
                <optgroup label="Positions">
                  {POSITIONS.map(position => (
                    <option key={position} value={position}>{position}</option>
                  ))}
                </optgroup>
                <optgroup label="Position Groups">
                  {POSITION_GROUPS.map(group => (
                    <option key={group} value={group}>{group}</option>
                  ))}
                </optgroup>
              </select>
              <select
                value={playingStyleFilter}
                onChange={(e) => setPlayingStyleFilter(e.target.value)}
                className="w-full sm:w-auto py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all duration-200"
              >
                <option value="">All Playing Styles</option>
                {playingStyles.map(style => (
                  <option key={style} value={style}>{style}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Show Starred Players Toggle and Stats */}
      <div className="mt-4 mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="showStarredOnly"
              checked={showStarredOnly}
              onChange={(e) => setShowStarredOnly(e.target.checked)}
              className="w-4 h-4 text-[#0066FF] focus:ring-[#0066FF] border-gray-300 rounded"
            />
            <label htmlFor="showStarredOnly" className="text-sm font-medium text-gray-700">
              Show Only Starred Players
            </label>
          </div>
          <div className="text-sm text-gray-600">
            Showing {filteredPlayers.length} of {totalPlayers} players
          </div>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {filteredPlayers.map(player => (
          <div key={player.id} className="bg-white/20 backdrop-blur-lg p-4 rounded-2xl shadow-sm border border-white/20 hover:bg-white/30 transition-all duration-200">
            <div className="flex items-start justify-between">
              <div className="flex items-center">
                <div className="flex-shrink-0 mr-3">
                  <div className="relative">
                    <PlayerImage
                      playerId={player.player_id || player.id}
                      playerName={player.name}
                      size={56}
                      className="rounded-full border-2 border-gray-300"
                    />
                    <div className="absolute -bottom-1 -right-1 h-6 w-6 flex items-center justify-center rounded-full bg-gray-800 text-white text-xs font-bold">
                      {player.overall_rating}
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-800">{player.name}</h3>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs rounded-full ${getPositionColor(player.position)}`}>
                      {player.position}
                    </span>
                    <span className="text-xs text-gray-500">{player.playing_style || 'None'}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={(e) => toggleStarPlayer(player.id, e)}
                className={`${player.is_starred ? 'text-yellow-500' : 'text-gray-400'} hover:text-yellow-500 transition-colors duration-200`}
              >
                <svg className="w-6 h-6" fill={player.is_starred ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </button>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              {renderPlayerStats(player)}
            </div>

            <div className="mt-3">
              <Link href={`/dashboard/team/player/${player.id}`} className="w-full py-2 px-4 bg-indigo-600/90 hover:bg-indigo-700/90 backdrop-blur-sm text-white text-sm rounded-lg transition-colors duration-200 block text-center">
                View Details
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="glass-card p-4 sm:p-6 rounded-2xl hidden md:block">
        <div className="mb-4 text-sm text-gray-500">
          <p>Browse the database of football players available for auction. Use the search and filter options to find specific players.</p>
        </div>
        <div className="overflow-x-auto rounded-xl shadow-sm">
          <table className="min-w-full divide-y divide-gray-200/30">
            <thead className="bg-white/30 backdrop-blur-md shadow-sm border-b border-white/20">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Star</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Name</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Position</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Style</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Overall</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Speed</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Acceleration</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Ball Control</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Dribbling</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Low Pass</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Lofted Pass</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Finishing</th>
              </tr>
            </thead>
            <tbody className="bg-white/20 backdrop-blur-sm divide-y divide-gray-200/30">
              {filteredPlayers.map(player => (
                <tr key={player.id} className="hover:bg-white/40 transition-all duration-200">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={(e) => toggleStarPlayer(player.id, e)}
                      className={`${player.is_starred ? 'text-yellow-500' : 'text-gray-400'} hover:text-yellow-500 transition-colors duration-200`}
                    >
                      <svg className="w-5 h-5" fill={player.is_starred ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link href={`/dashboard/team/player/${player.id}`} className="flex items-center hover:opacity-80 transition-opacity duration-200">
                      <div className="flex-shrink-0">
                        <PlayerAvatar
                          playerId={player.player_id || player.id}
                          playerName={player.name}
                          size={40}
                        />
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-medium text-[#0066FF] hover:text-[#0052CC] transition-colors duration-200">{player.name}</div>
                      </div>
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-700">{player.position}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-700">{player.playing_style || 'None'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full ${getRatingColor(player.overall_rating)}`}>
                      {player.overall_rating}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-700">{player.speed || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-700">{player.acceleration || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-700">{player.ball_control || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-700">{player.dribbling || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-700">{player.low_pass || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-700">{player.lofted_pass || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-700">{player.finishing || '-'}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      {!showStarredOnly && totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-6">
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 bg-white/60 border border-gray-200 rounded-xl hover:bg-white/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            Previous
          </button>
          
          <div className="flex items-center gap-2">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`px-4 py-2 rounded-xl transition-all duration-200 ${
                    currentPage === pageNum
                      ? 'bg-[#0066FF] text-white'
                      : 'bg-white/60 border border-gray-200 hover:bg-white/80'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
          
          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 bg-white/60 border border-gray-200 rounded-xl hover:bg-white/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            Next
          </button>
        </div>
      )}

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
