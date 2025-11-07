'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { useModal } from '@/hooks/useModal';
import AlertModal from '@/components/modals/AlertModal';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

// Only these positions are used for position groups
const POSITION_GROUP_POSITIONS = ['CB', 'DMF', 'CMF', 'AMF', 'CF'] as const;

const POSITION_LABELS = {
  CB: 'Center Back',
  DMF: 'Defensive Midfielder',
  CMF: 'Central Midfielder',
  AMF: 'Attacking Midfielder',
  CF: 'Center Forward',
} as const;

const POSITION_COLORS = {
  CB: 'bg-green-500',
  DMF: 'bg-yellow-500',
  CMF: 'bg-yellow-500',
  AMF: 'bg-purple-500',
  CF: 'bg-red-500',
} as const;

interface Player {
  id: string; // UUID stored as string
  name: string;
  position: string;
  overall_rating: number;
  is_auction_eligible: boolean;
  position_group?: string | null;
}

interface GroupedPlayers {
  group1: Player[];
  group2: Player[];
  ungrouped: Player[];
}

interface PositionStats {
  [position: string]: {
    total: number;
    group1: number;
    group2: number;
    ungrouped: number;
  };
}

export default function PositionGroupsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<PositionStats>({});
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);
  const [groupedPlayers, setGroupedPlayers] = useState<GroupedPlayers>({
    group1: [],
    group2: [],
    ungrouped: []
  });
  const [dividing, setDividing] = useState(false);

  // Modal system
  const { alertState, showAlert, closeAlert } = useModal();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
    if (!authLoading && user && user.role !== 'committee_admin') {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user?.role === 'committee_admin') {
      fetchPlayers();
    }
  }, [user]);

  const fetchPlayers = async () => {
    try {
      setLoading(true);
      // Fetch all players without limit to get complete data
      const response = await fetchWithTokenRefresh('/api/players?limit=10000');
      const { data: players, success } = await response.json();

      if (success) {
        console.log(`📊 [Position Groups] Fetched ${players.length} total players`);
        
        // Filter to only show players with the specified positions
        // Don't filter by is_auction_eligible - we want to group ALL players
        const relevantPlayers = players.filter((p: Player) => 
          POSITION_GROUP_POSITIONS.includes(p.position?.toUpperCase() as any)
        );
        
        console.log(`📊 [Position Groups] Filtered to ${relevantPlayers.length} players in CB/DMF/CMF/AMF/CF positions`);

        setAllPlayers(relevantPlayers);
        calculateStats(relevantPlayers);
      }
    } catch (err) {
      console.error('Error fetching players:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (playerList: Player[]) => {
    const newStats: PositionStats = {};

    POSITION_GROUP_POSITIONS.forEach(pos => {
      const posPlayers = playerList.filter(p => p.position?.toUpperCase() === pos);
      newStats[pos] = {
        total: posPlayers.length,
        group1: posPlayers.filter(p => p.position_group === `${pos}-1`).length,
        group2: posPlayers.filter(p => p.position_group === `${pos}-2`).length,
        ungrouped: posPlayers.filter(p => !p.position_group).length,
      };
    });

    setStats(newStats);
  };

  const handlePositionClick = (position: string) => {
    setSelectedPosition(position);
    const posPlayers = allPlayers.filter(p => p.position?.toUpperCase() === position);
    
    setGroupedPlayers({
      group1: posPlayers.filter(p => p.position_group === `${position}-1`),
      group2: posPlayers.filter(p => p.position_group === `${position}-2`),
      ungrouped: posPlayers.filter(p => !p.position_group)
    });
  };

  const handleDividePlayers = async () => {
    if (!selectedPosition) return;

    setDividing(true);
    try {
      // Get all players for this position
      const posPlayers = allPlayers.filter(p => p.position?.toUpperCase() === selectedPosition);
      
      // Sort by rating (highest first) for balanced distribution
      const sortedPlayers = [...posPlayers].sort((a, b) => 
        (b.overall_rating || 0) - (a.overall_rating || 0)
      );

      // Distribute players alternately to balance groups
      const updates: Promise<any>[] = [];
      sortedPlayers.forEach((player, index) => {
        const group = index % 2 === 0 ? `${selectedPosition}-1` : `${selectedPosition}-2`;
        updates.push(
          fetchWithTokenRefresh(`/api/players/${player.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ position_group: group })
          })
        );
      });

      await Promise.all(updates);
      
      console.log(`✅ [Position Groups] Updated ${sortedPlayers.length} players with position_group`);
      
      // Refresh data from database
      await fetchPlayers();
      
      // Small delay to ensure state has updated
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Re-fetch the fresh data and update the view
      const response = await fetchWithTokenRefresh('/api/players?limit=10000');
      const { data: freshPlayers, success } = await response.json();
      
      if (success) {
        const relevantPlayers = freshPlayers.filter((p: Player) => 
          POSITION_GROUP_POSITIONS.includes(p.position?.toUpperCase() as any)
        );
        
        setAllPlayers(relevantPlayers);
        
        // Now update the position view with fresh data
        const posPlayers = relevantPlayers.filter(p => p.position?.toUpperCase() === selectedPosition);
        console.log(`📊 [Position Groups] Found ${posPlayers.length} ${selectedPosition} players after division`);
        
        setGroupedPlayers({
          group1: posPlayers.filter(p => p.position_group === `${selectedPosition}-1`),
          group2: posPlayers.filter(p => p.position_group === `${selectedPosition}-2`),
          ungrouped: posPlayers.filter(p => !p.position_group)
        });
        
        calculateStats(relevantPlayers);
      }
      
      showAlert({
        type: 'success',
        title: 'Success',
        message: `Successfully divided ${sortedPlayers.length} players into 2 balanced groups!`
      });
    } catch (err) {
      console.error('Error dividing players:', err);
      showAlert({
        type: 'error',
        title: 'Division Failed',
        message: 'Failed to divide players. Please try again.'
      });
    } finally {
      setDividing(false);
    }
  };

  const handleSwapGroup = async (player: Player) => {
    if (!selectedPosition || !player.position_group) return;

    const currentGroup = player.position_group;
    const newGroup = currentGroup.endsWith('-1') 
      ? `${selectedPosition}-2` 
      : `${selectedPosition}-1`;

    try {
      const response = await fetchWithTokenRefresh(`/api/players/${player.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position_group: newGroup })
      });

      if (response.ok) {
        // Update local state
        setAllPlayers(prev => prev.map(p => 
          p.id === player.id ? { ...p, position_group: newGroup } : p
        ));
        handlePositionClick(selectedPosition);
        calculateStats(allPlayers);
      }
    } catch (err) {
      console.error('Error swapping player:', err);
      showAlert({
        type: 'error',
        title: 'Swap Failed',
        message: 'Failed to swap player group'
      });
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading position groups...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'committee_admin') {
    return null;
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-6">
      <div className="glass rounded-3xl p-3 sm:p-6 mb-6 backdrop-blur-md">
        {/* Header */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center">
              <Link
                href="/dashboard/committee"
                className="inline-flex items-center justify-center p-2 mr-3 rounded-xl bg-white/60 text-gray-700 hover:bg-white/80 transition-all duration-200 backdrop-blur-sm border border-gray-200/50 shadow-sm"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <div>
                <h2 className="text-2xl font-bold text-dark gradient-text">Position Group Management</h2>
                <p className="text-sm text-gray-600 mt-1">Divide players into equal position groups for auction rounds</p>
              </div>
            </div>
          </div>
        </div>

        {/* Position Selection */}
        <div className="glass p-5 rounded-xl bg-white/40 backdrop-blur-sm border border-white/10 shadow-sm mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Select Position to Manage</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {POSITION_GROUP_POSITIONS.map((position) => {
              const stat = stats[position] || { total: 0, group1: 0, group2: 0, ungrouped: 0 };
              const isSelected = selectedPosition === position;
              
              return (
                <button
                  key={position}
                  onClick={() => handlePositionClick(position)}
                  className={`p-3 rounded-lg transition-all flex flex-col items-center justify-center gap-2 ${
                    isSelected 
                      ? 'bg-primary/20 border-2 border-primary' 
                      : 'bg-white/70 hover:bg-primary/10 border-2 border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${POSITION_COLORS[position as keyof typeof POSITION_COLORS]}`}></span>
                    <span className="font-medium text-sm">{position}</span>
                  </div>
                  <div className="text-xs text-gray-600 text-center">
                    <div>{stat.total} total</div>
                    {stat.ungrouped > 0 && (
                      <div className="text-orange-600 font-medium">{stat.ungrouped} ungrouped</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Group Management */}
        {selectedPosition && (
          <div className="glass p-5 rounded-xl bg-white/40 backdrop-blur-sm border border-white/10 shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5">
              <h3 className="text-lg font-semibold text-gray-800">
                {selectedPosition} Position Groups
              </h3>
              <button
                onClick={handleDividePlayers}
                disabled={dividing}
                className="px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition-all flex items-center gap-2 text-sm disabled:opacity-50"
              >
                {dividing ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Dividing...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    Divide Players
                  </>
                )}
              </button>
            </div>

            {/* Help Text */}
            <div className="bg-blue-50 p-3 rounded-lg mb-5 border border-blue-100">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-blue-700">
                  Use the "Divide Players" button to automatically split players into two equally balanced groups. 
                  You can then manually move players between groups using the swap buttons.
                </p>
              </div>
            </div>

            {/* Groups Display */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Group 1 */}
              <div className="glass p-4 rounded-xl bg-white/30 backdrop-blur-sm border border-white/10">
                <h4 className="text-base font-medium text-gray-700 mb-3">
                  {selectedPosition}-1 Group ({groupedPlayers.group1.length} players)
                </h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-white/50">
                      <tr>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Player</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rating</th>
                        <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Move</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white/30 divide-y divide-gray-200">
                      {groupedPlayers.group1.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-3 py-4 text-center text-sm text-gray-500">
                            No players in this group
                          </td>
                        </tr>
                      ) : (
                        groupedPlayers.group1.map(player => (
                          <tr key={player.id} className="hover:bg-white/60 transition-colors">
                            <td className="px-3 py-3 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{player.name}</div>
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap">
                              <div className="text-sm text-gray-500">{player.overall_rating || 'N/A'}</div>
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap text-center">
                              <button
                                onClick={() => handleSwapGroup(player)}
                                className="inline-flex items-center justify-center p-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-all"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Group 2 */}
              <div className="glass p-4 rounded-xl bg-white/30 backdrop-blur-sm border border-white/10">
                <h4 className="text-base font-medium text-gray-700 mb-3">
                  {selectedPosition}-2 Group ({groupedPlayers.group2.length} players)
                </h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-white/50">
                      <tr>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Player</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rating</th>
                        <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Move</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white/30 divide-y divide-gray-200">
                      {groupedPlayers.group2.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-3 py-4 text-center text-sm text-gray-500">
                            No players in this group
                          </td>
                        </tr>
                      ) : (
                        groupedPlayers.group2.map(player => (
                          <tr key={player.id} className="hover:bg-white/60 transition-colors">
                            <td className="px-3 py-3 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{player.name}</div>
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap">
                              <div className="text-sm text-gray-500">{player.overall_rating || 'N/A'}</div>
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap text-center">
                              <button
                                onClick={() => handleSwapGroup(player)}
                                className="inline-flex items-center justify-center p-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-all"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Warning for ungrouped players */}
            {groupedPlayers.ungrouped.length > 0 && (
              <div className="mt-4 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-sm text-yellow-700">
                    <strong>{groupedPlayers.ungrouped.length} players</strong> are not assigned to any group. 
                    Click "Divide Players" to assign them automatically.
                  </p>
                </div>
              </div>
            )}
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
