'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { getSeasonById } from '@/lib/firebase/seasons';
import { Season } from '@/types/season';
import { useCachedTeams } from '@/hooks/useCachedData';
import { calculateRealPlayerSalary } from '@/lib/contracts';
import Link from 'next/link';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface Player {
  id: string;
  playerName: string;
  starRating: number;
  categoryName?: string;
  auctionValue: number;
  salaryPerMatch: number;
  contractStartSeason?: string;
  contractEndSeason?: string;
}

interface TeamData {
  id: string;
  name: string;
  originalBudget: number;
  currentBudget: number;
  currentSpent: number;
  currencySystem: string;
  assignedPlayers: Player[];
  isExpanded: boolean;
}

export default function RealPlayersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { isCommitteeAdmin, userSeasonId } = usePermissions();
  const [currentSeason, setCurrentSeason] = useState<Season | null>(null);

  const { data: cachedTeams, isLoading: teamsLoading } = useCachedTeams();
  const [teamSeasons, setTeamSeasons] = useState<any[]>([]);
  const [loadingTeamSeasons, setLoadingTeamSeasons] = useState(true);

  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [savingTeamId, setSavingTeamId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [starRatingConfig, setStarRatingConfig] = useState<Map<number, number>>(new Map());
  const [updateCounter, setUpdateCounter] = useState(0);
  const [dropdownSearchTerms, setDropdownSearchTerms] = useState<Map<string, string>>(new Map());
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);
  const dropdownRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  // Quick assign state
  const [quickAssignPlayer, setQuickAssignPlayer] = useState<Player | null>(null);
  const [quickAssignTeam, setQuickAssignTeam] = useState<string>('');
  const [quickAssignAuction, setQuickAssignAuction] = useState<string>('');
  const [quickAssignContractStart, setQuickAssignContractStart] = useState<string>('');
  const [quickAssignContractEnd, setQuickAssignContractEnd] = useState<string>('');
  const [isQuickAssigning, setIsQuickAssigning] = useState(false);
  const [showActualBudget, setShowActualBudget] = useState(true); // Toggle for showing actual budget vs max limit

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && !isCommitteeAdmin) {
      router.push('/dashboard');
    }
  }, [user, loading, router, isCommitteeAdmin]);

  // Click outside handler for dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownOpen) {
        const dropdownElement = dropdownRefs.current.get(dropdownOpen);
        if (dropdownElement && !dropdownElement.contains(event.target as Node)) {
          setDropdownOpen(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  // Initialize default contract duration
  useEffect(() => {
    if (userSeasonId && !quickAssignContractStart) {
      const { start, end } = getContractSeasons();
      setQuickAssignContractStart(start);
      setQuickAssignContractEnd(end);
    }
  }, [userSeasonId]);

  useEffect(() => {
    const fetchData = async () => {
      if (!userSeasonId) return;

      try {
        // Fetch season
        const season = await getSeasonById(userSeasonId);
        setCurrentSeason(season);

        // Fetch team_seasons to get budget data
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase/config');

        const teamSeasonsQuery = query(
          collection(db, 'team_seasons'),
          where('season_id', '==', userSeasonId),
          where('status', '==', 'registered')
        );

        const teamSeasonsSnapshot = await getDocs(teamSeasonsQuery);
        const teamSeasonsData = teamSeasonsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        setTeamSeasons(teamSeasonsData);
        console.log(`Loaded ${teamSeasonsData.length} team seasons with budget data`);

        // Fetch star rating configuration
        try {
          const configResponse = await fetchWithTokenRefresh(`/api/star-rating-config?seasonId=${userSeasonId}`);
          const configResult = await configResponse.json();
          if (configResult.success && configResult.data) {
            const configMap = new Map<number, number>();
            configResult.data.forEach((item: any) => {
              configMap.set(item.star_rating, item.base_auction_value);
            });
            setStarRatingConfig(configMap);
            console.log(`Loaded star rating config for ${configResult.data.length} ratings`);
          }
        } catch (err) {
          console.warn('Could not load star rating config, will use defaults:', err);
        }
      } catch (error) {
        console.error('Error fetching season:', error);
      } finally {
        setLoadingTeamSeasons(false);
      }
    };

    if (isCommitteeAdmin && userSeasonId) {
      fetchData();
    }
  }, [isCommitteeAdmin, userSeasonId]);

  // Load existing players and organize by team
  useEffect(() => {
    const loadPlayers = async () => {
      if (!userSeasonId || !currentSeason || teamSeasons.length === 0) return;

      try {
        const seasonNum = parseInt(userSeasonId.replace(/\D/g, '')) || 0;
        const isModernSeason = seasonNum >= 16;

        if (isModernSeason) {
          // Fetch from Neon via API
          const response = await fetchWithTokenRefresh(`/api/stats/players?seasonId=${userSeasonId}&limit=1000`);
          const result = await response.json();

          if (result.success && result.data && result.data.length > 0) {
            const realPlayersData = result.data.filter((p: any) => p.star_rating && p.star_rating > 0);

            // Organize players by team
            const teamMap: { [key: string]: Player[] } = {};
            const unassignedPlayers: Player[] = [];

            realPlayersData.forEach((data: any) => {
              // Get star rating first
              const starRating = data.star_rating || 0;

              // Parse auction value from DB
              let auctionValue = data.auction_value !== null && data.auction_value !== undefined
                ? (typeof data.auction_value === 'number' ? data.auction_value : parseFloat(String(data.auction_value)))
                : 0;

              // If auction value is 0 or not set, use minimum based on star rating
              if (auctionValue === 0 || isNaN(auctionValue)) {
                // Try to get from database config first, fallback to hardcoded
                if (starRatingConfig.has(starRating)) {
                  auctionValue = starRatingConfig.get(starRating)!;
                  console.log(`Player ${data.player_name}: auction_value was 0, set to ${auctionValue} from DB config (${starRating}★)`);
                } else {
                  const { getMinimumAuctionValue } = require('@/lib/contracts');
                  auctionValue = getMinimumAuctionValue(starRating);
                  console.log(`Player ${data.player_name}: auction_value was 0, set to fallback ${auctionValue} (${starRating}★)`);
                }
              }

              // Calculate salary based on actual auction value
              // Ensure it's a number
              const salaryPerMatch = data.salary_per_match !== null && data.salary_per_match !== undefined
                ? (typeof data.salary_per_match === 'number' ? data.salary_per_match : parseFloat(String(data.salary_per_match)))
                : calculateRealPlayerSalary(auctionValue, starRating);

              console.log(`Player ${data.player_name}: auction_value=${data.auction_value} (${typeof data.auction_value}) -> parsed=${auctionValue}, team_id=${data.team_id}`);

              const player: Player = {
                id: data.player_id || data.id,
                playerName: data.player_name || '',
                starRating: starRating,
                categoryName: data.category || '',
                auctionValue: auctionValue,
                salaryPerMatch: salaryPerMatch,
                contractStartSeason: data.contract_start_season || '',
                contractEndSeason: data.contract_end_season || '',
              };

              // Check if player has a team assignment
              // Handle both null and empty string as unassigned
              const teamId = data.team_id;
              if (teamId && teamId !== '' && teamId !== null && teamId !== undefined) {
                if (!teamMap[teamId]) teamMap[teamId] = [];
                teamMap[teamId].push(player);
              } else {
                // Player is unassigned, add to available players
                unassignedPlayers.push(player);
              }
            });

            // Create team data structure
            const teamsData: TeamData[] = teamSeasons.map(teamSeason => {
              const teamId = teamSeason.team_id || teamSeason.id.split('_')[0];
              const assignedPlayers = teamMap[teamId] || [];

              // Get BOTH initial budget AND current budget/spent from Firebase
              let originalBudget = 0;
              let currentBudget = 0;
              let currentSpent = 0;

              if (teamSeason.currency_system === 'dual') {
                originalBudget = teamSeason.initial_real_player_budget ||
                  teamSeason.real_player_budget_initial ||
                  currentSeason?.dollar_budget ||
                  1000;
                currentBudget = teamSeason.real_player_budget ?? originalBudget;
                currentSpent = teamSeason.real_player_spent || 0;
              } else {
                originalBudget = teamSeason.initial_budget ||
                  teamSeason.budget_initial ||
                  currentSeason?.purseAmount ||
                  10000;
                currentBudget = teamSeason.budget ?? originalBudget;
                currentSpent = teamSeason.total_spent || 0;
              }

              console.log(`Team ${teamSeason.team_name || teamSeason.team_code}: currency=${teamSeason.currency_system}, originalBudget=${originalBudget}, currentBudget=${currentBudget}, currentSpent=${currentSpent}, fields:`, {
                initial_real_player_budget: teamSeason.initial_real_player_budget,
                real_player_budget_initial: teamSeason.real_player_budget_initial,
                real_player_budget: teamSeason.real_player_budget,
                real_player_spent: teamSeason.real_player_spent,
                initial_budget: teamSeason.initial_budget,
                budget_initial: teamSeason.budget_initial,
                budget: teamSeason.budget,
                total_spent: teamSeason.total_spent
              });

              return {
                id: teamId,
                name: teamSeason.team_name || teamSeason.team_code || 'Unknown Team',
                originalBudget: originalBudget,
                currentBudget: currentBudget,
                currentSpent: currentSpent,
                currencySystem: teamSeason.currency_system || 'single',
                assignedPlayers: assignedPlayers,
                isExpanded: false,
              };
            }).sort((a, b) => a.name.localeCompare(b.name));

            setTeams(teamsData);
            setAvailablePlayers(unassignedPlayers);
            console.log(`Loaded ${realPlayersData.length} players organized into ${teamsData.length} teams`);
            console.log(`Available (unassigned) players:`, unassignedPlayers.map(p => p.playerName));
            console.log(`Assigned players by team:`, Object.entries(teamMap).map(([teamId, players]) => ({
              teamId,
              count: players.length,
              players: players.map(p => p.playerName)
            })));
          }
        }
      } catch (error) {
        console.error('Error loading players:', error);
        setError('Failed to load players');
      }
    };

    loadPlayers();
  }, [userSeasonId, currentSeason, teamSeasons]);

  const toggleTeam = (teamId: string) => {
    setTeams(teams.map(t =>
      t.id === teamId ? { ...t, isExpanded: !t.isExpanded } : t
    ));
  };

  const addPlayerToTeam = (teamId: string, player: Player) => {
    console.log(`Adding player ${player.playerName} (ID: ${player.id}) to team ${teamId}`);

    // Remove from available
    setAvailablePlayers(prev => {
      const filtered = prev.filter(p => p.id !== player.id);
      console.log(`Player removed from available. Remaining available: ${filtered.length}`);
      return filtered;
    });

    // Add to team with default contract if not set
    const { start, end } = getContractSeasons();
    const playerWithContract = {
      ...player,
      contractStartSeason: player.contractStartSeason || start,
      contractEndSeason: player.contractEndSeason || end,
    };

    setTeams(prevTeams => prevTeams.map(t => {
      if (t.id === teamId) {
        const updated = { ...t, assignedPlayers: [...t.assignedPlayers, playerWithContract] };
        console.log(`Player added to team ${t.name}. Team now has ${updated.assignedPlayers.length} players`);
        return updated;
      }
      return t;
    }));
  };

  const removePlayerFromTeam = (teamId: string, playerId: string) => {
    // Find the player to remove first
    const team = teams.find(t => t.id === teamId);
    if (!team) {
      console.log(`Team ${teamId} not found`);
      return;
    }

    const removedPlayer = team.assignedPlayers.find(p => p.id === playerId);
    if (!removedPlayer) {
      console.log(`Player ${playerId} not found in team ${teamId}`);
      return;
    }

    console.log(`Removing player ${removedPlayer.playerName} (ID: ${playerId}) from team ${team.name}`);

    // Remove from team
    setTeams(prevTeams => prevTeams.map(t => {
      if (t.id === teamId) {
        return { ...t, assignedPlayers: t.assignedPlayers.filter(p => p.id !== playerId) };
      }
      return t;
    }));

    // Add back to available players list
    setAvailablePlayers(prev => {
      const updated = [...prev, removedPlayer];
      console.log(`Player ${removedPlayer.playerName} added back to available. Total available: ${updated.length}`);
      return updated;
    });

    // Force re-render of dropdowns
    setUpdateCounter(prev => prev + 1);
  };

  const updatePlayerAuctionValue = (teamId: string, playerId: string, value: number) => {
    setTeams(teams.map(t => {
      if (t.id === teamId) {
        return {
          ...t,
          assignedPlayers: t.assignedPlayers.map(p => {
            if (p.id === playerId) {
              const newSalary = calculateRealPlayerSalary(value, p.starRating);
              return { ...p, auctionValue: value, salaryPerMatch: newSalary };
            }
            return p;
          })
        };
      }
      return t;
    }));
  };

  const updatePlayerContract = (teamId: string, playerId: string, field: 'start' | 'end', value: string) => {
    setTeams(teams.map(t => {
      if (t.id === teamId) {
        return {
          ...t,
          assignedPlayers: t.assignedPlayers.map(p => {
            if (p.id === playerId) {
              return field === 'start'
                ? { ...p, contractStartSeason: value }
                : { ...p, contractEndSeason: value };
            }
            return p;
          })
        };
      }
      return t;
    }));
  };

  const getContractSeasons = () => {
    if (!userSeasonId) return { start: '', end: '' };

    const seasonNum = parseInt(userSeasonId.replace(/\D/g, ''));
    const seasonPrefix = userSeasonId.replace(/\d+$/, '');
    const nextSeasonNum = seasonNum + 1;

    return {
      start: userSeasonId,
      end: `${seasonPrefix}${nextSeasonNum}`
    };
  };

  // Get contract duration options
  const getContractOptions = () => {
    if (!userSeasonId) return [];

    const seasonNum = parseInt(userSeasonId.replace(/\D/g, ''));
    const seasonPrefix = userSeasonId.replace(/\d+$/, '');

    return [
      {
        label: `Full ${seasonNum} to Full ${seasonNum + 1} (2 seasons)`,
        start: `${seasonPrefix}${seasonNum}`,
        end: `${seasonPrefix}${seasonNum + 1}`,
        description: 'Standard 2-season contract'
      },
      {
        label: `Mid ${seasonNum} to Full ${seasonNum + 1} (1.5 seasons)`,
        start: `${seasonPrefix}${seasonNum}.5`,
        end: `${seasonPrefix}${seasonNum + 1}`,
        description: 'Joins mid-season, plays till end of next season'
      },
      {
        label: `Mid ${seasonNum} to Mid ${seasonNum + 2} (2 seasons)`,
        start: `${seasonPrefix}${seasonNum}.5`,
        end: `${seasonPrefix}${seasonNum + 2}.5`,
        description: 'Mid-season start, extended contract'
      },
      {
        label: `Full ${seasonNum} to Full ${seasonNum + 2} (3 seasons)`,
        start: `${seasonPrefix}${seasonNum}`,
        end: `${seasonPrefix}${seasonNum + 2}`,
        description: 'Extended 3-season contract'
      },
      {
        label: `Full ${seasonNum} only (1 season)`,
        start: `${seasonPrefix}${seasonNum}`,
        end: `${seasonPrefix}${seasonNum}`,
        description: 'Single season contract'
      },
      {
        label: 'Custom',
        start: '',
        end: '',
        description: 'Set custom start and end seasons'
      }
    ];
  };

  const handleQuickAssign = async () => {
    if (!quickAssignPlayer || !quickAssignTeam || !quickAssignAuction) {
      setError('Please select a player, team, and enter auction value');
      return;
    }

    if (!quickAssignContractStart || !quickAssignContractEnd) {
      setError('Please select contract duration');
      return;
    }

    const auctionValue = parseInt(quickAssignAuction);
    if (isNaN(auctionValue) || auctionValue <= 0) {
      setError('Please enter a valid auction value');
      return;
    }

    try {
      setIsQuickAssigning(true);
      setError(null);
      setSuccess(null);

      const salaryPerMatch = calculateRealPlayerSalary(auctionValue, quickAssignPlayer.starRating);

      // Assign player immediately (without removing from available list)
      const response = await fetchWithTokenRefresh('/api/contracts/assign-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seasonId: userSeasonId,
          startSeason: quickAssignContractStart,
          endSeason: quickAssignContractEnd,
          players: [{
            id: quickAssignPlayer.id,
            teamId: quickAssignTeam,
            playerName: quickAssignPlayer.playerName,
            auctionValue: auctionValue,
            salaryPerMatch: salaryPerMatch,
            contractStartSeason: quickAssignContractStart,
            contractEndSeason: quickAssignContractEnd,
          }],
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to assign player');
      }

      // Update local state - add to team AND remove from available
      setTeams(prevTeams => prevTeams.map(t => {
        if (t.id === quickAssignTeam) {
          // Check if player already exists in team
          const playerExists = t.assignedPlayers.some(p => p.id === quickAssignPlayer.id);
          if (playerExists) {
            return t; // Don't add duplicate
          }
          return {
            ...t,
            assignedPlayers: [...t.assignedPlayers, {
              ...quickAssignPlayer,
              auctionValue: auctionValue,
              salaryPerMatch: salaryPerMatch,
              contractStartSeason: quickAssignContractStart,
              contractEndSeason: quickAssignContractEnd,
            }]
          };
        }
        return t;
      }));

      // Remove from available players
      setAvailablePlayers(prev => prev.filter(p => p.id !== quickAssignPlayer.id));


      const teamName = teams.find(t => t.id === quickAssignTeam)?.name || 'Team';
      setSuccess(`✅ ${quickAssignPlayer.playerName} assigned to ${teamName} (${quickAssignContractStart} → ${quickAssignContractEnd}) for SSCoin ${auctionValue.toLocaleString()}!`);

      // Reset form (keep contract duration for next assignment)
      setQuickAssignPlayer(null);
      setQuickAssignTeam('');
      setQuickAssignAuction('');

      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to assign player');
    } finally {
      setIsQuickAssigning(false);
    }
  };

  const saveTeam = async (teamId: string) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;

    // Validate max players only
    const maxPlayers = currentSeason?.max_real_players || 7;

    if (team.assignedPlayers.length > maxPlayers) {
      setError(`${team.name} can have maximum ${maxPlayers} players (currently ${team.assignedPlayers.length})`);
      return;
    }

    try {
      setSavingTeamId(teamId);
      setError(null);
      setSuccess(null);

      // Refresh auth token
      const { auth } = await import('@/lib/firebase/config');
      const currentUser = auth.currentUser;
      if (currentUser) {
        const freshToken = await currentUser.getIdToken(true);
        await fetchWithTokenRefresh('/api/auth/set-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: freshToken }),
        });
      }

      const { start: startSeason, end: endSeason } = getContractSeasons();

      // Save only this team's players with their individual contracts
      const response = await fetchWithTokenRefresh('/api/contracts/assign-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seasonId: userSeasonId,
          startSeason: startSeason, // Kept for backward compatibility
          endSeason: endSeason, // Kept for backward compatibility
          players: team.assignedPlayers.map(p => ({
            id: p.id,
            teamId: teamId,
            playerName: p.playerName,
            auctionValue: p.auctionValue,
            salaryPerMatch: p.salaryPerMatch,
            contractStartSeason: p.contractStartSeason || startSeason,
            contractEndSeason: p.contractEndSeason || endSeason,
          })),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save team');
      }

      setSuccess(`✅ Successfully saved ${team.name} with ${team.assignedPlayers.length} players!`);

      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save team');
    } finally {
      setSavingTeamId(null);
    }
  };

  if (loading || teamsLoading || loadingTeamSeasons) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600 font-medium">Loading teams...</p>
        </div>
      </div>
    );
  }

  if (!user || !isCommitteeAdmin) {
    return null;
  }

  if (currentSeason?.type !== 'multi') {
    return (
      <div className="min-h-screen py-8 px-4 bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="container mx-auto max-w-6xl">
          <div className="glass rounded-3xl p-8 text-center shadow-xl">
            <div className="inline-flex items-center justify-center p-4 bg-amber-100 rounded-full mb-4">
              <svg className="w-12 h-12 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Season Type Not Supported</h2>
            <p className="text-amber-700 text-lg">This feature is only available for multi-season types (Season 16+)</p>
          </div>
        </div>
      </div>
    );
  }

  const filteredAvailablePlayers = availablePlayers.filter(p =>
    p.playerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const minPlayers = currentSeason?.min_real_players || 5;
  const maxPlayers = currentSeason?.max_real_players || 7;

  return (
    <div className="min-h-screen py-6 px-4 bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
                🎯 Team Management
              </h1>
              <p className="text-gray-600">
                Assign SS Members to teams • {currentSeason?.name}
              </p>
            </div>
            <button
              onClick={() => router.push('/dashboard/committee')}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-all"
            >
              ← Back
            </button>
          </div>

          {/* Contract Info */}
          <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-200">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-indigo-600 font-medium">2-Season Contract</p>
              <p className="text-lg font-bold text-indigo-900">
                {getContractSeasons().start} → {getContractSeasons().end}
              </p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-xs text-indigo-600">Players per team</p>
              <p className="text-lg font-bold text-indigo-900">{minPlayers} - {maxPlayers}</p>
            </div>
          </div>

          {/* Budget Display Toggle */}
          <div className="flex items-center justify-center gap-3 p-3 bg-white rounded-xl border border-gray-200">
            <span className="text-sm text-gray-600 font-medium">Budget Display:</span>
            <button
              onClick={() => setShowActualBudget(!showActualBudget)}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${showActualBudget
                ? 'bg-green-100 text-green-700 border-2 border-green-300'
                : 'bg-gray-100 text-gray-600 border-2 border-gray-300'
                }`}
            >
              💰 Actual Balance
            </button>
            <button
              onClick={() => setShowActualBudget(!showActualBudget)}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${!showActualBudget
                ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                : 'bg-gray-100 text-gray-600 border-2 border-gray-300'
                }`}
            >
              📊 Max Limit
            </button>
            <div className="ml-2 text-xs text-gray-500">
              {showActualBudget ? '(From Firebase team_seasons)' : '(Initial budget - local calc)'}
            </div>
          </div>
        </div>

        {/* Messages */}
        {success && (
          <div className="mb-4 p-4 bg-green-50 border-l-4 border-green-500 rounded-lg animate-pulse">
            <p className="text-green-800 font-medium">{success}</p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
            <p className="text-red-800 font-medium">{error}</p>
          </div>
        )}

        {/* Quick Assign - Live Auction Mode */}
        <div className="mb-6 bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl shadow-sm border-2 border-green-200 overflow-hidden">
          <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center">
                  <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Quick Assign - Live Auction
                </h2>
                <p className="text-green-100 text-sm mt-1">Assign players instantly as WhatsApp auction happens</p>
              </div>
              <div className="px-3 py-1 bg-green-500 rounded-full">
                <span className="text-white font-bold text-sm">🔴 LIVE</span>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {/* Player Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">1. Select Player</label>
                <select
                  value={quickAssignPlayer?.id || ''}
                  onChange={(e) => {
                    const player = availablePlayers.find(p => p.id === e.target.value);
                    setQuickAssignPlayer(player || null);
                    if (player) {
                      // Auto-fill minimum auction value
                      const minValue = starRatingConfig.get(player.starRating) || player.auctionValue;
                      setQuickAssignAuction(minValue.toString());
                    }
                  }}
                  className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm font-medium"
                >
                  <option value="">Choose player...</option>
                  {availablePlayers
                    .sort((a, b) => a.playerName.localeCompare(b.playerName))
                    .map(player => (
                      <option key={player.id} value={player.id}>
                        {player.playerName} ({player.starRating}⭐) - Min SSCoin {starRatingConfig.get(player.starRating) || player.auctionValue}
                      </option>
                    ))}
                </select>
                {quickAssignPlayer && (
                  <div className="mt-2 p-2 bg-white rounded border border-green-200">
                    <div className="flex items-center gap-2">
                      {quickAssignPlayer.categoryName && (
                        <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium">
                          {quickAssignPlayer.categoryName}
                        </span>
                      )}
                      <span className="text-xs text-amber-600 font-semibold">{quickAssignPlayer.starRating}⭐</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Team Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">2. Select Team</label>
                <select
                  value={quickAssignTeam}
                  onChange={(e) => setQuickAssignTeam(e.target.value)}
                  className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm font-medium"
                >
                  <option value="">Choose team...</option>
                  {teams
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(team => {
                      const slots = maxPlayers - team.assignedPlayers.length;
                      return (
                        <option
                          key={team.id}
                          value={team.id}
                          disabled={slots <= 0}
                        >
                          {team.name} ({team.assignedPlayers.length}/{maxPlayers}) {slots > 0 ? `- ${slots} slots` : '- FULL'}
                        </option>
                      );
                    })}
                </select>
                {quickAssignTeam && (
                  <div className="mt-2 p-2 bg-white rounded border border-green-200">
                    {(() => {
                      const team = teams.find(t => t.id === quickAssignTeam);
                      if (!team) return null;
                      const remaining = showActualBudget
                        ? team.currentBudget
                        : (team.originalBudget - team.assignedPlayers.reduce((sum, p) => sum + p.auctionValue, 0));
                      const currencySymbol = team.currencySystem === 'dual' ? '$' : '£';
                      return (
                        <p className="text-xs font-semibold text-gray-700">
                          Budget: {currencySymbol}{remaining.toLocaleString()} left
                          {showActualBudget && <span className="text-blue-600 ml-1">(Firebase)</span>}
                        </p>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Auction Value Input */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">3. Auction Value</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">SSCoin</span>
                  <input
                    type="number"
                    value={quickAssignAuction}
                    onChange={(e) => setQuickAssignAuction(e.target.value)}
                    placeholder="0"
                    min={quickAssignPlayer ? (starRatingConfig.get(quickAssignPlayer.starRating) || quickAssignPlayer.auctionValue) : 0}
                    step="10"
                    className="w-full pl-20 pr-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm font-bold text-right"
                  />
                </div>
                {quickAssignPlayer && quickAssignAuction && (
                  <div className="mt-2 p-2 bg-white rounded border border-green-200">
                    <p className="text-xs text-gray-600">
                      Salary: <span className="font-semibold text-green-600">SSCoin {calculateRealPlayerSalary(parseInt(quickAssignAuction) || 0, quickAssignPlayer.starRating).toFixed(2)}/match</span>
                    </p>
                  </div>
                )}
              </div>

              {/* Contract Duration */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">4. Contract Duration</label>
                <select
                  value={`${quickAssignContractStart}|${quickAssignContractEnd}`}
                  onChange={(e) => {
                    const [start, end] = e.target.value.split('|');
                    setQuickAssignContractStart(start);
                    setQuickAssignContractEnd(end);
                  }}
                  className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm font-medium"
                >
                  <option value="|">Choose duration...</option>
                  {getContractOptions().map((option, idx) => (
                    <option key={idx} value={`${option.start}|${option.end}`}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {quickAssignContractStart && quickAssignContractEnd && (
                  <div className="mt-2 p-2 bg-white rounded border border-green-200">
                    <p className="text-xs font-semibold text-indigo-700">
                      📄 {quickAssignContractStart} → {quickAssignContractEnd}
                    </p>
                  </div>
                )}
              </div>

              {/* Assign Button */}
              <div className="flex items-end">
                <button
                  onClick={handleQuickAssign}
                  disabled={!quickAssignPlayer || !quickAssignTeam || !quickAssignAuction || !quickAssignContractStart || !quickAssignContractEnd || isQuickAssigning}
                  className={`w-full py-3 px-4 rounded-lg font-bold text-white transition-all transform hover:scale-105 ${!quickAssignPlayer || !quickAssignTeam || !quickAssignAuction || !quickAssignContractStart || !quickAssignContractEnd || isQuickAssigning
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:shadow-lg'
                    }`}
                >
                  {isQuickAssigning ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Assigning...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Assign Now!
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Available Players Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden sticky top-6">
              <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-4 py-4">
                <h2 className="text-lg font-bold text-white flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Available Players
                </h2>
                <p className="text-purple-100 text-sm mt-1">{availablePlayers.length} unassigned</p>

                <div className="mt-3">
                  <input
                    type="text"
                    placeholder="Search players..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-purple-300 focus:outline-none"
                  />
                </div>
              </div>

              <div className="max-h-[calc(100vh-280px)] overflow-y-auto p-4 space-y-2">
                {filteredAvailablePlayers.length === 0 ? (
                  <div className="text-center py-8">
                    <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <p className="text-sm text-gray-500">
                      {searchTerm ? 'No players found' : 'All players assigned!'}
                    </p>
                    {availablePlayers.length === 0 && (
                      <p className="text-xs text-gray-400 mt-2">
                        <Link href="/dashboard/committee/player-ratings" className="text-purple-600 underline">
                          Set star ratings
                        </Link> to add players
                      </p>
                    )}
                  </div>
                ) : (
                  filteredAvailablePlayers.map(player => (
                    <div
                      key={player.id}
                      className="p-3 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 cursor-grab"
                      draggable
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900 text-sm">{player.playerName}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {player.categoryName && (
                              <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium">
                                {player.categoryName}
                              </span>
                            )}
                            <span className="text-xs text-amber-600 font-medium">{player.starRating}⭐</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-gray-600">
                        <span className="font-semibold text-blue-600">${player.auctionValue}</span>
                        <span className="mx-1">•</span>
                        <span className="text-green-600">${(typeof player.salaryPerMatch === 'number' ? player.salaryPerMatch : parseFloat(player.salaryPerMatch) || 0).toFixed(2)}/match</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Teams Panel */}
          <div className="lg:col-span-2 space-y-4">
            {teams.map(team => {
              // Calculate budget based on toggle
              const totalCost = team.assignedPlayers.reduce((sum, p) => sum + p.auctionValue, 0);

              // Use actual budget from Firebase if toggle is on, otherwise use max limit calculation
              const displayBudget = showActualBudget ? team.currentBudget : (team.originalBudget - totalCost);
              const displaySpent = showActualBudget ? team.currentSpent : totalCost;
              const displayTotal = showActualBudget ? (team.currentBudget + team.currentSpent) : team.originalBudget;

              const isOverBudget = displayBudget < 0;
              const playerCount = team.assignedPlayers.length;
              const isValidCount = playerCount <= maxPlayers; // Only check max, not min
              const currencySymbol = team.currencySystem === 'dual' ? '$' : '£';

              return (
                <div
                  key={team.id}
                  className={`bg-white rounded-2xl shadow-sm border-2 transition-all ${team.isExpanded ? 'border-blue-400' : 'border-gray-200'
                    }`}
                >
                  {/* Team Header */}
                  <div
                    className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => toggleTeam(team.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div className={`p-2 rounded-lg ${isValidCount && !isOverBudget ? 'bg-green-100' : 'bg-gray-100'
                          }`}>
                          <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-900 text-lg">{team.name}</h3>
                          <div className="flex items-center gap-3 mt-1 text-xs">
                            <span className={`font-semibold ${playerCount > maxPlayers ? 'text-red-600' : 'text-gray-700'
                              }`}>
                              {playerCount}/{maxPlayers} players
                            </span>
                            <span className="text-gray-400">•</span>
                            <span className={`font-semibold ${isOverBudget ? 'text-red-600' : 'text-green-600'
                              }`}>
                              {currencySymbol}{displayBudget.toLocaleString()} left
                              {showActualBudget && <span className="text-xs ml-1">(Firebase)</span>}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {isValidCount && !isOverBudget && (
                          <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                            ✓ Ready
                          </span>
                        )}

                        <svg
                          className={`w-5 h-5 text-gray-500 transition-transform ${team.isExpanded ? 'rotate-180' : ''
                            }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Team Content (Expanded) */}
                  {team.isExpanded && (
                    <div className="border-t border-gray-200">
                      {/* Budget Bar */}
                      <div className="px-4 py-3 bg-gray-50">
                        <div className="flex justify-between text-xs mb-2">
                          <span className="text-gray-600">Budget Usage</span>
                          <span className={`font-semibold ${isOverBudget ? 'text-red-600' : 'text-gray-700'
                            }`}>
                            {currencySymbol}{displaySpent.toLocaleString()} / {currencySymbol}{displayTotal.toLocaleString()}
                            {showActualBudget && <span className="text-xs ml-1 text-blue-600">(Firebase)</span>}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${isOverBudget ? 'bg-red-500' : 'bg-blue-500'
                              }`}
                            style={{ width: `${Math.min((displaySpent / displayTotal) * 100, 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Assigned Players */}
                      <div className="p-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">
                          Assigned Players ({playerCount})
                        </h4>

                        {team.assignedPlayers.length === 0 ? (
                          <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                            <p className="text-sm text-gray-500">No players assigned yet</p>
                            <p className="text-xs text-gray-400 mt-1">Select from available players</p>
                          </div>
                        ) : (
                          <div className="space-y-2 mb-4">
                            {team.assignedPlayers.map((player, index) => (
                              <div
                                key={player.id}
                                className="p-3 bg-blue-50 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors"
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2 flex-1">
                                    <span className="text-xs font-semibold text-gray-500">#{index + 1}</span>
                                    <div className="flex-1">
                                      <p className="font-semibold text-gray-900 text-sm">{player.playerName}</p>
                                      <div className="flex items-center gap-2 mt-1">
                                        {player.categoryName && (
                                          <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                                            {player.categoryName}
                                          </span>
                                        )}
                                        <span className="text-xs text-amber-600">{player.starRating}⭐</span>
                                      </div>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => removePlayerFromTeam(team.id, player.id)}
                                    className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                    title="Remove player"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                                <div className="space-y-2">
                                  <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-gray-600">Auction:</span>
                                      <input
                                        type="number"
                                        value={player.auctionValue}
                                        onChange={(e) => updatePlayerAuctionValue(team.id, player.id, parseInt(e.target.value) || 0)}
                                        min={starRatingConfig.get(player.starRating) || 0}
                                        step="10"
                                        className="w-20 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                        title={`Minimum: $${starRatingConfig.get(player.starRating) || 0} (${player.starRating}★ base value)`}
                                      />
                                    </div>
                                    <span className="text-xs text-gray-400">→</span>
                                    <span className="text-xs text-green-600 font-semibold">
                                      ${(typeof player.salaryPerMatch === 'number' ? player.salaryPerMatch : parseFloat(player.salaryPerMatch) || 0).toFixed(2)}/match
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-600">📄 Contract:</span>
                                    <input
                                      type="text"
                                      value={player.contractStartSeason || ''}
                                      onChange={(e) => updatePlayerContract(team.id, player.id, 'start', e.target.value)}
                                      placeholder="SSPSLS16"
                                      className="w-24 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                    />
                                    <span className="text-xs text-gray-400">→</span>
                                    <input
                                      type="text"
                                      value={player.contractEndSeason || ''}
                                      onChange={(e) => updatePlayerContract(team.id, player.id, 'end', e.target.value)}
                                      placeholder="SSPSLS17"
                                      className="w-24 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Add Player Dropdown with Search */}
                        <div className="mb-4 relative">
                          <label className="block text-xs font-medium text-gray-700 mb-2">
                            Add Player to {team.name}
                          </label>
                          <p className="text-xs text-gray-500 mb-1">Available: {availablePlayers.length} players</p>

                          {playerCount >= maxPlayers ? (
                            <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500 text-sm text-center">
                              Maximum {maxPlayers} players reached
                            </div>
                          ) : (
                            <div
                              className="relative"
                              ref={(el) => dropdownRefs.current.set(team.id, el)}
                            >
                              <input
                                type="text"
                                placeholder="Search and select player..."
                                value={dropdownSearchTerms.get(team.id) || ''}
                                onChange={(e) => {
                                  const newMap = new Map(dropdownSearchTerms);
                                  newMap.set(team.id, e.target.value);
                                  setDropdownSearchTerms(newMap);
                                  if (e.target.value) {
                                    setDropdownOpen(team.id);
                                  }
                                }}
                                onFocus={() => setDropdownOpen(team.id)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm pr-10"
                              />
                              <svg
                                className="w-5 h-5 text-gray-400 absolute right-3 top-2.5 pointer-events-none"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                              </svg>

                              {dropdownOpen === team.id && availablePlayers.length > 0 && (
                                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                  {availablePlayers
                                    .filter(p => {
                                      const searchTerm = (dropdownSearchTerms.get(team.id) || '').toLowerCase();
                                      if (!searchTerm) return true;
                                      return p.playerName.toLowerCase().includes(searchTerm) ||
                                        p.categoryName?.toLowerCase().includes(searchTerm) ||
                                        p.starRating.toString().includes(searchTerm);
                                    })
                                    .slice(0, 50)
                                    .map(player => (
                                      <button
                                        key={player.id}
                                        type="button"
                                        onClick={() => {
                                          console.log(`Selected player:`, player.playerName);
                                          addPlayerToTeam(team.id, player);
                                          const newMap = new Map(dropdownSearchTerms);
                                          newMap.set(team.id, '');
                                          setDropdownSearchTerms(newMap);
                                          setDropdownOpen(null);
                                        }}
                                        className="w-full px-3 py-2 text-left hover:bg-blue-50 border-b border-gray-100 last:border-0 text-sm transition-colors"
                                      >
                                        <div className="flex items-center justify-between">
                                          <div className="flex-1">
                                            <p className="font-medium text-gray-900">{player.playerName}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                              {player.categoryName && (
                                                <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                                                  {player.categoryName}
                                                </span>
                                              )}
                                              <span className="text-xs text-amber-600">{player.starRating}⭐</span>
                                            </div>
                                          </div>
                                          <span className="text-xs font-semibold text-blue-600 ml-2">
                                            ${player.auctionValue}
                                          </span>
                                        </div>
                                      </button>
                                    ))}
                                  {availablePlayers.filter(p => {
                                    const searchTerm = (dropdownSearchTerms.get(team.id) || '').toLowerCase();
                                    if (!searchTerm) return true;
                                    return p.playerName.toLowerCase().includes(searchTerm) ||
                                      p.categoryName?.toLowerCase().includes(searchTerm) ||
                                      p.starRating.toString().includes(searchTerm);
                                  }).length === 0 && (
                                      <div className="px-3 py-4 text-center text-sm text-gray-500">
                                        No players found
                                      </div>
                                    )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Save Button */}
                        <button
                          onClick={() => saveTeam(team.id)}
                          disabled={
                            savingTeamId === team.id ||
                            playerCount > maxPlayers ||
                            isOverBudget
                          }
                          className={`w-full py-3 px-4 rounded-xl font-semibold transition-all ${savingTeamId === team.id
                            ? 'bg-gray-400 text-white cursor-wait'
                            : playerCount > maxPlayers || isOverBudget
                              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              : 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:shadow-lg'
                            }`}
                        >
                          {savingTeamId === team.id ? (
                            <span className="flex items-center justify-center gap-2">
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              Saving...
                            </span>
                          ) : playerCount > maxPlayers ? (
                            `Remove ${playerCount - maxPlayers} player${playerCount - maxPlayers > 1 ? 's' : ''}`
                          ) : isOverBudget ? (
                            'Over budget!'
                          ) : (
                            `💾 Save ${team.name}`
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
