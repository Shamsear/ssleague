'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { usePlayerStats, usePlayerAwards, useTeamTrophies, useTeamSeasonStats, type PlayerAward, type TeamTrophy, type TeamStats } from '@/hooks';

interface PlayerData {
  id: string;
  player_id?: string;
  name: string;
  category?: string;
  team?: string;
  team_id?: string;
  season_id?: string;
  season_name?: string;
  display_name?: string;
  email?: string;
  phone?: string;
  role?: string;
  psn_id?: string;
  xbox_id?: string;
  steam_id?: string;
  is_registered?: boolean;
  is_active?: boolean;
  is_available?: boolean;
  notes?: string;
  photo_url?: string;
  nationality?: string;
  age?: number;
  height?: number;
  weight?: number;
  is_potm?: boolean;
  potm_awards?: Array<{ month: string; year: string }>;
  ranking?: number;
  round_performance?: any;
  
  // Trophy/Award fields (arrays for unlimited trophies)
  category_trophies?: string[];
  individual_trophies?: string[];
  
  // Team trophy fields
  has_league_trophy?: boolean;
  team_rank?: number;
  cup_achievement?: string;
  
  // Direct stats (may be at root level)
  played?: number;
  points?: number;
  goals_scored?: number;
  clean_sheets?: number;
  
  // Stats object from realplayers
  stats?: {
    matches_played: number;
    matches_won: number;
    matches_lost: number;
    matches_drawn: number;
    goals_scored: number;
    goals_per_game: number;
    goals_conceded: number;
    conceded_per_game: number;
    net_goals: number;
    assists: number;
    clean_sheets: number;
    points: number;
    total_points: number;
    win_rate: number;
    average_rating: number;
    current_season_matches: number;
    current_season_wins: number;
  };
}

interface MatchHistory {
  match_number: string;
  opponent?: string;
  result: 'win' | 'loss' | 'draw';
  player_goals: number;
  opponent_goals: number;
  is_potm: boolean;
  points: number;
  date?: Date;
}

export default function PlayerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [player, setPlayer] = useState<PlayerData | null>(null);
  const [allSeasonData, setAllSeasonData] = useState<PlayerData[]>([]);
  const [matchHistory, setMatchHistory] = useState<MatchHistory[]>([]);
  const [seasonName, setSeasonName] = useState<string>('Season');
  const [error, setError] = useState<string | null>(null);
  const [selectedView, setSelectedView] = useState<'overall' | 'all-seasons' | string>('overall');
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);

  const playerId = params.id as string;
  const [firebaseSeasons, setFirebaseSeasons] = useState<any[]>([]);
  const [firebasePlayer, setFirebasePlayer] = useState<any>(null);
  
  // Use React Query hook for player stats from Neon
  const { data: playerStatsData, isLoading: statsLoading } = usePlayerStats({
    playerId: playerId
  });
  
  // Fetch seasons and player data from Firebase
  useEffect(() => {
    const fetchFirebaseData = async () => {
      try {
        // Fetch seasons
        const seasonsRef = collection(db, 'seasons');
        const seasonsSnapshot = await getDocs(seasonsRef);
        const seasonsData = seasonsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setFirebaseSeasons(seasonsData);
        
        // Fetch player from realplayers
        const playersRef = collection(db, 'realplayers');
        const q = query(playersRef, where('player_id', '==', playerId));
        const playerSnapshot = await getDocs(q);
        
        if (!playerSnapshot.empty) {
          const playerDoc = playerSnapshot.docs[0];
          setFirebasePlayer({
            id: playerDoc.id,
            ...playerDoc.data()
          });
        }
      } catch (error) {
        console.error('Error fetching Firebase data:', error);
      }
    };
    fetchFirebaseData();
  }, [playerId]);
  
  // Fetch player awards for currently selected season
  const currentSeasonIdForAwards = selectedView === 'season' && selectedSeasonId ? selectedSeasonId : null;
  const { data: playerAwards = [], isLoading: awardsLoading } = usePlayerAwards(
    playerId,
    currentSeasonIdForAwards || undefined
  );
  
  // Fetch team trophies and stats for currently selected season
  const currentTeamId = selectedView === 'season' && selectedSeasonId ? 
    allSeasonData.find(s => (s.season_id || s.id) === selectedSeasonId)?.team_id : null;
  
  const { data: teamTrophies = [], isLoading: trophiesLoading } = useTeamTrophies(
    currentTeamId || undefined,
    currentSeasonIdForAwards || undefined
  );
  
  const { data: teamStats, isLoading: teamStatsLoading } = useTeamSeasonStats(
    currentTeamId || undefined,
    currentSeasonIdForAwards || undefined
  );

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      router.push('/login');
      return;
    }

    // Check if user has permission (super_admin, committee_admin, or team)
    if (!['super_admin', 'committee_admin', 'team'].includes(user.role)) {
      router.push('/dashboard');
      return;
    }

    // No need to fetch player data - React Query hook handles it
  }, [user, authLoading, playerId]);

  // Process player stats data from Neon when it arrives
  useEffect(() => {
    // Clear error when data starts loading
    if (statsLoading) {
      setError(null);
      return;
    }
    
    // Wait for Firebase data to load before processing
    if (firebaseSeasons.length === 0 || !firebasePlayer) {
      return;
    }
    
    // If we have Firebase player data but no stats, show basic player info without error
    if (!playerStatsData || playerStatsData.length === 0) {
      // Set basic player data from Firebase
      setPlayer({
        id: firebasePlayer.id,
        player_id: firebasePlayer.player_id,
        name: firebasePlayer.name || 'Unknown Player',
        display_name: firebasePlayer.display_name,
        photo_url: firebasePlayer.photo_url,
        team: firebasePlayer.team,
        category: firebasePlayer.category,
      } as any);
      setAllSeasonData([]);
      // Don't set error - player exists but has no stats yet
      return;
    }
    
    // Clear error when we have data
    setError(null);
    
    // Only show seasons that exist in Firebase and have started
    const startedSeasons = playerStatsData.filter((statsData: any) => {
      const seasonId = statsData.season_id;
      
      // Find the season in Firebase
      const fbSeason = firebaseSeasons.find(s => s.id === seasonId);
      
      // If season not found in Firebase, exclude it
      if (!fbSeason) return false;
      
      // Check if season has started
      if (fbSeason.start_date) {
        const startDate = fbSeason.start_date.toDate ? fbSeason.start_date.toDate() : new Date(fbSeason.start_date);
        const now = new Date();
        return startDate <= now;
      }
      
      // If no start_date field, include it (for backward compatibility with old seasons)
      return true;
    });
    
    // Process all season data from Neon
    const allData = startedSeasons.map((statsData: any) => {
      const seasonName = statsData.season_name || statsData.season_id;
      
      const matchesPlayed = statsData.matches_played || 0;
      const goalsScored = statsData.goals_scored || 0;
      const goalsConceded = statsData.goals_conceded || 0;
      const wins = statsData.wins || 0;
      
      return {
        ...statsData,
        id: statsData.id || statsData.player_id,
        name: statsData.player_name || firebasePlayer?.name || 'Unknown Player',
        display_name: firebasePlayer?.display_name || statsData.player_name,
        photo_url: firebasePlayer?.photo_url,
        player_id: statsData.player_id,
        season_name: seasonName,
        team: statsData.team,
        team_id: statsData.team_id,
        category: statsData.category,
        stats: {
          matches_played: matchesPlayed,
          matches_won: wins,
          matches_lost: statsData.losses || 0,
          matches_drawn: statsData.draws || 0,
          goals_scored: goalsScored,
          goals_conceded: goalsConceded,
          assists: statsData.assists || 0,
          clean_sheets: statsData.clean_sheets || 0,
          points: statsData.points || 0,
          // Calculate derived stats
          net_goals: goalsScored - goalsConceded,
          goals_per_game: matchesPlayed > 0 ? (goalsScored / matchesPlayed).toFixed(2) : '0.00',
          conceded_per_game: matchesPlayed > 0 ? (goalsConceded / matchesPlayed).toFixed(2) : '0.00',
          win_rate: matchesPlayed > 0 
            ? parseFloat(((wins / matchesPlayed) * 100).toFixed(1))
            : 0
        }
      };
    });
    
    setAllSeasonData(allData);
    
    // Set the first season as default
    if (allData.length > 0) {
      setPlayer(allData[0]);
      setSeasonName(allData[0].season_name || 'Season');
    } else if (startedSeasons.length === 0 && playerStatsData.length > 0) {
      // If we have data but all seasons were filtered out, show message
      setError('No active seasons found for this player');
    }
  }, [playerStatsData, statsLoading, firebaseSeasons, firebasePlayer]);


  const fetchSeasonName = async (seasonId: string) => {
    try {
      const seasonDoc = await getDoc(doc(db, 'seasons', seasonId));
      if (seasonDoc.exists()) {
        const seasonData = seasonDoc.data();
        setSeasonName(seasonData.name || seasonData.short_name || 'Season');
      }
    } catch (err) {
      console.error('Error fetching season name:', err);
    }
  };
  
  const fetchMatchHistory = async (playerId: string, teamId?: string) => {
    try {
      // This is a simplified version - adjust based on your actual data structure
      // You may need to query match_matchups where this player was involved
      if (!teamId) return;

      const matchupsRef = collection(db, 'match_matchups');
      const q = query(
        matchupsRef,
        where('player_ids', 'array-contains', playerId),
        orderBy('created_at', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const history: MatchHistory[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Transform data to match history format
        // This is a placeholder - adjust based on your actual data structure
        history.push({
          match_number: data.match_number || 'N/A',
          opponent: data.opponent_name,
          result: data.result || 'draw',
          player_goals: data.player_goals || 0,
          opponent_goals: data.opponent_goals || 0,
          is_potm: data.potm_player_id === playerId,
          points: data.points || 0,
          date: data.match_date?.toDate(),
        });
      });

      setMatchHistory(history);
    } catch (err) {
      console.error('Error fetching match history:', err);
    }
  };


  const getCategoryColor = (category: string) => {
    const cat = category.toLowerCase();
    switch (cat) {
      case 'red':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'black':
        return 'bg-gray-800 text-white border-gray-700';
      case 'blue':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'orange':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'white':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (authLoading || statsLoading || firebaseSeasons.length === 0 || (!firebasePlayer && !error)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading player details...</p>
        </div>
      </div>
    );
  }

  if (error || !player) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error || 'Player not found'}</p>
          <Link
            href="/dashboard"
            className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Calculate overall stats from all seasons
  const calculateOverallStats = () => {
    if (allSeasonData.length === 0) return {
      matches_played: 0,
      matches_won: 0,
      matches_drawn: 0,
      matches_lost: 0,
      goals_scored: 0,
      goals_conceded: 0,
      clean_sheets: 0,
      assists: 0,
      points: 0,
    };
    
    const overall = allSeasonData.reduce((acc, seasonData) => {
      const s = (seasonData.stats || {}) as any;
      return {
        matches_played: (acc.matches_played || 0) + (s.matches_played || 0),
        matches_won: (acc.matches_won || 0) + (s.matches_won || 0),
        matches_drawn: (acc.matches_drawn || 0) + (s.matches_drawn || 0),
        matches_lost: (acc.matches_lost || 0) + (s.matches_lost || 0),
        goals_scored: (acc.goals_scored || 0) + (s.goals_scored || 0),
        goals_conceded: (acc.goals_conceded || 0) + (s.goals_conceded || 0),
        clean_sheets: (acc.clean_sheets || 0) + (s.clean_sheets || 0),
        assists: (acc.assists || 0) + (s.assists || 0),
        points: (acc.points || 0) + (s.points || 0),
      };
    }, {
      matches_played: 0,
      matches_won: 0,
      matches_drawn: 0,
      matches_lost: 0,
      goals_scored: 0,
      goals_conceded: 0,
      clean_sheets: 0,
      assists: 0,
      points: 0,
    } as any);
    
    // Calculate derived stats
    if (overall.matches_played > 0) {
      overall.goals_per_game = (overall.goals_scored / overall.matches_played).toFixed(2);
      overall.conceded_per_game = (overall.goals_conceded / overall.matches_played).toFixed(2);
      overall.win_rate = Math.round((overall.matches_won / overall.matches_played) * 100);
    }
    overall.net_goals = overall.goals_scored - overall.goals_conceded;
    
    return overall;
  };
  
  const overallStats = calculateOverallStats();
  
  // Get stats based on selected view
  let displayStats;
  let currentSeasonData = player;
  
  if (selectedView === 'overall') {
    displayStats = overallStats;
  } else if (selectedView === 'all-seasons') {
    displayStats = overallStats; // Show overall in the sidebar
  } else if (selectedView === 'season' && selectedSeasonId) {
    // Find the selected season data using season_id (not document id)
    const selectedSeason = allSeasonData.find(s => (s.season_id || s.id) === selectedSeasonId);
    console.log('Looking for season:', selectedSeasonId, 'Found:', selectedSeason?.season_id || selectedSeason?.id);
    if (selectedSeason) {
      currentSeasonData = selectedSeason;
      displayStats = selectedSeason.stats || {};
    } else {
      displayStats = player.stats || {};
    }
  } else {
    displayStats = player.stats || {};
  }
  
  const stats = displayStats;
  
  const goalDifference = stats.net_goals || ((stats.goals_scored || 0) - (stats.goals_conceded || 0));
  const winRate = stats.win_rate || (stats.matches_played && stats.matches_played > 0 
    ? parseFloat((((stats.matches_won || 0) / stats.matches_played) * 100).toFixed(1))
    : 0);
  const goalsPerGame = stats.goals_per_game || (stats.matches_played && stats.matches_played > 0
    ? ((stats.goals_scored || 0) / stats.matches_played).toFixed(2)
    : '0.00');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="glass rounded-3xl p-6 md:p-8 shadow-xl">
          {/* Header with Back Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
            <Link
              href="/dashboard"
              className="flex items-center text-gray-600 hover:text-primary transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back to Dashboard</span>
            </Link>
            
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-600">
                Player ID: {player.player_id || player.id}
              </span>
              {allSeasonData.length > 1 && (
                <span className="px-3 py-1 bg-blue-100 rounded-full text-sm text-blue-700 font-medium">
                  {allSeasonData.length} Seasons
                </span>
              )}
            </div>
          </div>
          
          {/* View Tabs */}
          {allSeasonData.length > 0 && (
            <div className="mb-6 bg-white rounded-xl p-2 shadow-sm border border-gray-200">
              <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                {/* Overall Tab */}
                <button
                  onClick={() => {
                    setSelectedView('overall');
                    setSelectedSeasonId(null);
                  }}
                  className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                    selectedView === 'overall'
                      ? 'bg-green-500 text-white shadow-md'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Overall Stats
                </button>
                
                {/* All Seasons Tab */}
                <button
                  onClick={() => {
                    setSelectedView('all-seasons');
                    setSelectedSeasonId(null);
                  }}
                  className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                    selectedView === 'all-seasons'
                      ? 'bg-purple-500 text-white shadow-md'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  All Seasons ({allSeasonData.length})
                </button>
                
                {/* Divider */}
                {allSeasonData.length > 0 && (
                  <div className="flex items-center px-2">
                    <div className="h-6 w-px bg-gray-300"></div>
                  </div>
                )}
                
                {/* Individual Season Tabs */}
                {allSeasonData.map((seasonData, index) => {
                  const isCurrentSeason = index === 0;
                  // Use season_id (not document id) as the unique identifier
                  const seasonId = seasonData.season_id || seasonData.id;
                  const isSelected = selectedView === 'season' && selectedSeasonId === seasonId;
                  
                  console.log(`Tab ${index}: season_id=${seasonData.season_id}, seasonId=${seasonId}, selectedSeasonId=${selectedSeasonId}, isSelected=${isSelected}`);
                  
                  return (
                    <button
                      key={`${seasonData.player_id || playerId}-${seasonData.season_id}-${seasonData.id}-${index}`}
                      onClick={async () => {
                        console.log(`Clicked season tab ${index}, setting seasonId to:`, seasonId);
                        setSelectedView('season');
                        setSelectedSeasonId(seasonId);
                        // Fetch season name if not already loaded
                        if (seasonData.season_id && index === 0) {
                          await fetchSeasonName(seasonData.season_id);
                        }
                      }}
                      className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                        isSelected
                          ? 'bg-blue-500 text-white shadow-md'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {seasonData.season_name || seasonData.season_id || `Season ${allSeasonData.length - index}`}
                      {isCurrentSeason && (
                        <span className="ml-1.5 inline-flex items-center justify-center w-2 h-2 bg-green-400 rounded-full"></span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">
            {/* Left Column - Player Info */}
            <div className="lg:col-span-1 space-y-6">
              {/* Player Card */}
              <div className="bg-white/60 rounded-2xl p-6 shadow-md border border-white/20">
                {/* Player Image */}
                <div className="relative w-40 h-40 mx-auto mb-4 rounded-xl overflow-hidden shadow-md">
                  {player.photo_url ? (
                    <img
                      src={player.photo_url}
                      alt={player.name}
                      className="object-cover w-full h-full"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <div className={`bg-primary/10 w-full h-full flex items-center justify-center ${player.photo_url ? 'hidden' : ''}`}>
                    <span className="text-5xl font-bold text-primary">{player.name?.[0] || 'P'}</span>
                  </div>
                  
                  {/* POTM Badge */}
                  {player.is_potm && (
                    <div className="absolute top-0 left-0 bg-amber-500 text-white text-xs font-bold py-1 px-2 rounded-br-lg">
                      POTM
                    </div>
                  )}
                </div>

                {/* Player Basic Info */}
                <div className="text-center">
                  <h1 className="text-2xl font-bold text-dark mb-1">{player.name}</h1>
                  {currentSeasonData.team && (
                    <div className="mb-4">
                      <span className="text-sm text-gray-500">{currentSeasonData.team}</span>
                    </div>
                  )}

                  {/* Player Category - Season Specific */}
                  {currentSeasonData.category && (
                    <div className="mb-4">
                      <span className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${getCategoryColor(currentSeasonData.category)}`}>
                        Category: {currentSeasonData.category}
                      </span>
                    </div>
                  )}
                  
                  {/* Season Info for individual season view */}
                  {selectedView === 'season' && selectedSeasonId && currentSeasonData.season_name && (
                    <div className="mb-4">
                      <span className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200">
                        {currentSeasonData.season_name}
                      </span>
                    </div>
                  )}
                </div>

                {/* Player Details */}
                <div className="space-y-3 text-sm border-t border-gray-200 pt-4">
                  {player.nationality && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Nationality:</span>
                      <span className="font-medium text-gray-700">{player.nationality}</span>
                    </div>
                  )}
                  {player.age && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Age:</span>
                      <span className="font-medium text-gray-700">{player.age}</span>
                    </div>
                  )}
                  {player.height && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Height:</span>
                      <span className="font-medium text-gray-700">{player.height} cm</span>
                    </div>
                  )}
                  {player.weight && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Weight:</span>
                      <span className="font-medium text-gray-700">{player.weight} kg</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Overall Record Card */}
              <div className="glass rounded-2xl p-6 shadow-md border border-white/20 bg-white/60">
                <h3 className="text-lg font-semibold text-dark mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Overall Record
                </h3>

                {/* Win/Draw/Loss Record */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="glass rounded-xl p-3 bg-green-50/60 text-center">
                    <p className="text-xs text-green-700 font-medium mb-1">WINS</p>
                    <p className="text-2xl font-bold text-green-800">{stats.matches_won || 0}</p>
                  </div>
                  <div className="glass rounded-xl p-3 bg-yellow-50/60 text-center">
                    <p className="text-xs text-yellow-700 font-medium mb-1">DRAWS</p>
                    <p className="text-2xl font-bold text-yellow-800">{stats.matches_drawn || 0}</p>
                  </div>
                  <div className="glass rounded-xl p-3 bg-red-50/60 text-center">
                    <p className="text-xs text-red-700 font-medium mb-1">LOSSES</p>
                    <p className="text-2xl font-bold text-red-800">{stats.matches_lost || 0}</p>
                  </div>
                </div>

                {/* Goal Stats */}
                <div className="mt-4 space-y-3">
                  <div className="flex justify-between items-center px-3 py-2 bg-white/50 rounded-lg">
                    <span className="text-sm text-gray-600">Goals Scored (GS):</span>
                    <span className="text-sm font-bold text-primary">{stats.goals_scored || 0}</span>
                  </div>
                  <div className="flex justify-between items-center px-3 py-2 bg-white/50 rounded-lg">
                    <span className="text-sm text-gray-600">Goals Conceded (GC):</span>
                    <span className="text-sm font-bold text-red-600">{stats.goals_conceded || 0}</span>
                  </div>
                  <div className="flex justify-between items-center px-3 py-2 bg-white/50 rounded-lg">
                    <span className="text-sm text-gray-600">Goal Difference (GD):</span>
                    <span className={`text-sm font-bold ${goalDifference > 0 ? 'text-green-600' : goalDifference < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                      {goalDifference > 0 ? '+' : ''}{goalDifference}
                    </span>
                  </div>
                  <div className="flex justify-between items-center px-3 py-2 bg-white/50 rounded-lg">
                    <span className="text-sm text-gray-600">Points:</span>
                    <span className="text-sm font-bold text-indigo-600">{stats.points || stats.total_points || 0}</span>
                  </div>
                  <div className="flex justify-between items-center px-3 py-2 bg-white/50 rounded-lg">
                    <span className="text-sm text-gray-600">Clean Sheets:</span>
                    <span className="text-sm font-bold text-purple-600">{stats.clean_sheets || 0}</span>
                  </div>
                </div>
              </div>

              {/* POTM Awards */}
              {player.potm_awards && player.potm_awards.length > 0 && (
                <div className="glass rounded-2xl p-6 shadow-md border border-white/20 bg-white/60">
                  <h3 className="text-lg font-semibold text-dark mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                    Player of the Month
                  </h3>

                  <div className="space-y-3">
                    {player.potm_awards.map((award, index) => (
                      <div key={index} className="glass rounded-xl p-3 bg-amber-50/60 flex items-center">
                        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center mr-3">
                          <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-amber-800">{award.month}</p>
                          <p className="text-xs text-amber-600">{award.year}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - Stats */}
            <div className="lg:col-span-3 space-y-6">
              {/* All Seasons View */}
              {selectedView === 'all-seasons' && allSeasonData.length > 0 && (
                <div className="bg-white/60 rounded-2xl p-6 shadow-md border border-white/20">
                  <h3 className="text-lg font-semibold text-dark mb-6 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    Season-by-Season Breakdown
                  </h3>
                  
                  <div className="space-y-4">
                    {allSeasonData.map((seasonData, index) => {
                      const seasonStats = (seasonData.stats || {}) as any;
                      const isCurrentSeason = index === 0;
                      
                      return (
                        <div key={`all-seasons-${seasonData.player_id || playerId}-${seasonData.season_id || seasonData.id}-${index}`} className={`rounded-xl p-5 border-2 ${
                          isCurrentSeason 
                            ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-300' 
                            : 'bg-white/50 border-gray-200'
                        }`}>
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                                isCurrentSeason ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
                              }`}>
                                {allSeasonData.length - index}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="font-bold text-gray-900">
                                    {seasonData.season_name || seasonData.season_id || `Season ${allSeasonData.length - index}`}
                                  </h4>
                                  {seasonData.category && (
                                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getCategoryColor(seasonData.category)}`}>
                                      {seasonData.category}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-600">{seasonData.team || 'No Team'}</p>
                              </div>
                            </div>
                            {isCurrentSeason && (
                              <span className="px-3 py-1 bg-blue-500 text-white text-xs font-bold rounded-full">
                                CURRENT
                              </span>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="bg-white/60 rounded-lg p-3 text-center">
                              <p className="text-xs text-gray-500 mb-1">Matches</p>
                              <p className="text-xl font-bold text-gray-900">{seasonStats.matches_played || 0}</p>
                            </div>
                            <div className="bg-white/60 rounded-lg p-3 text-center">
                              <p className="text-xs text-gray-500 mb-1">W-D-L</p>
                              <p className="text-sm font-bold text-gray-900">
                                {seasonStats.matches_won || 0}-{seasonStats.matches_drawn || 0}-{seasonStats.matches_lost || 0}
                              </p>
                            </div>
                            <div className="bg-white/60 rounded-lg p-3 text-center">
                              <p className="text-xs text-gray-500 mb-1">Goals</p>
                              <p className="text-xl font-bold text-green-600">{seasonStats.goals_scored || 0}</p>
                            </div>
                            <div className="bg-white/60 rounded-lg p-3 text-center">
                              <p className="text-xs text-gray-500 mb-1">Points</p>
                              <p className="text-xl font-bold text-indigo-600">{seasonStats.points || seasonStats.total_points || 0}</p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-3 mt-3">
                            <div className="bg-white/60 rounded-lg p-3 text-center">
                              <p className="text-xs text-gray-500 mb-1">Conceded</p>
                              <p className="text-lg font-bold text-red-600">{seasonStats.goals_conceded || 0}</p>
                            </div>
                            <div className="bg-white/60 rounded-lg p-3 text-center">
                              <p className="text-xs text-gray-500 mb-1">Net Goals</p>
                              <p className={`text-lg font-bold ${
                                (seasonStats.net_goals || 0) > 0 ? 'text-green-600' : 
                                (seasonStats.net_goals || 0) < 0 ? 'text-red-600' : 'text-gray-600'
                              }`}>
                                {(seasonStats.net_goals || 0) > 0 ? '+' : ''}{seasonStats.net_goals || 0}
                              </p>
                            </div>
                            <div className="bg-white/60 rounded-lg p-3 text-center">
                              <p className="text-xs text-gray-500 mb-1">Clean Sheets</p>
                              <p className="text-lg font-bold text-purple-600">{seasonStats.clean_sheets || 0}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* Stats Display (Overall or Individual Season) */}
              {selectedView !== 'all-seasons' && (
              <div className="bg-white/60 rounded-2xl p-6 shadow-md border border-white/20">
                <h3 className="text-lg font-semibold text-dark mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  {selectedView === 'overall' ? 'Overall Statistics' : 
                   selectedView === 'season' && selectedSeasonId ? 
                   `Statistics - ${currentSeasonData.season_name || currentSeasonData.season_id || 'Season'}` : 
                   `Statistics - ${seasonName}`}
                </h3>

                {/* Points display - Only for individual season view */}
                {selectedView === 'season' && (
                  <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 shadow-sm border-2 border-blue-200 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-blue-700 font-medium">TOTAL POINTS</p>
                      <p className="text-3xl font-bold text-blue-800">{stats.points || stats.total_points || 0}</p>
                    </div>
                    {selectedSeasonId === allSeasonData[0]?.id && currentSeasonData.ranking && (
                      <div className="bg-white px-4 py-2 rounded-lg shadow-sm">
                        <p className="text-xs text-gray-500">League Ranking</p>
                        <p className="text-xl font-bold text-primary">#{player.ranking}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Main Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                  <div className="glass-card rounded-xl bg-white/30 p-4 text-center transform hover:scale-105 transition-all duration-300">
                    <p className="text-xs text-gray-500 mb-1">Matches</p>
                    <p className="text-2xl font-bold text-dark">{stats.matches_played || 0}</p>
                  </div>
                  <div className="glass-card rounded-xl bg-white/30 p-4 text-center transform hover:scale-105 transition-all duration-300">
                    <p className="text-xs text-gray-500 mb-1">Goals</p>
                    <p className="text-2xl font-bold text-primary">{stats.goals_scored || 0}</p>
                  </div>
                  <div className="glass-card rounded-xl bg-white/30 p-4 text-center transform hover:scale-105 transition-all duration-300">
                    <p className="text-xs text-gray-500 mb-1">Clean Sheets</p>
                    <p className="text-2xl font-bold text-blue-600">{stats.clean_sheets || 0}</p>
                  </div>
                  <div className="glass-card rounded-xl bg-white/30 p-4 text-center transform hover:scale-105 transition-all duration-300">
                    <p className="text-xs text-gray-500 mb-1">Net Goals</p>
                    <p className={`text-2xl font-bold ${
                      (stats.net_goals || 0) > 0 ? 'text-green-600' : 
                      (stats.net_goals || 0) < 0 ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {(stats.net_goals || 0) > 0 ? '+' : ''}{stats.net_goals || 0}
                    </p>
                  </div>
                </div>

                {/* Secondary Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                  <div className="bg-white/40 rounded-xl p-4 text-center">
                    <p className="text-xs text-gray-500 mb-1">Win Rate</p>
                    <p className="text-2xl font-bold text-green-600">{winRate}%</p>
                  </div>
                  <div className="bg-white/40 rounded-xl p-4 text-center">
                    <p className="text-xs text-gray-500 mb-1">Goals/Game</p>
                    <p className="text-2xl font-bold text-orange-600">{goalsPerGame}</p>
                  </div>
                  <div className="bg-white/40 rounded-xl p-4 text-center">
                    <p className="text-xs text-gray-500 mb-1">Conceded/Game</p>
                    <p className="text-2xl font-bold text-red-600">{typeof stats.conceded_per_game === 'number' ? stats.conceded_per_game.toFixed(2) : (stats.conceded_per_game || '0.00')}</p>
                  </div>
                  {stats.average_rating > 0 && (
                    <div className="bg-white/40 rounded-xl p-4 text-center">
                      <p className="text-xs text-gray-500 mb-1">Avg Rating</p>
                      <p className="text-2xl font-bold text-amber-600">{stats.average_rating.toFixed(1)}</p>
                    </div>
                  )}
                </div>

                {/* Goals Stats */}
                {(stats.goals_conceded !== undefined || stats.net_goals !== undefined || stats.conceded_per_game !== undefined) && (
                  <div className="mt-6">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Goal Statistics</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-red-50 rounded-xl p-4 text-center border border-red-100">
                        <p className="text-xs text-red-700 mb-1">Conceded</p>
                        <p className="text-2xl font-bold text-red-600">{stats.goals_conceded || 0}</p>
                        {stats.conceded_per_game && (
                          <p className="text-xs text-red-500 mt-1">{stats.conceded_per_game} per game</p>
                        )}
                      </div>
                      <div className={`rounded-xl p-4 text-center border ${
                        goalDifference > 0 
                          ? 'bg-green-50 border-green-100' 
                          : goalDifference < 0 
                          ? 'bg-red-50 border-red-100' 
                          : 'bg-gray-50 border-gray-100'
                      }`}>
                        <p className="text-xs text-gray-600 mb-1">Goal Difference</p>
                        <p className={`text-2xl font-bold ${
                          goalDifference > 0 ? 'text-green-600' : goalDifference < 0 ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {goalDifference > 0 ? '+' : ''}{goalDifference}
                        </p>
                      </div>
                      <div className="bg-green-50 rounded-xl p-4 text-center border border-green-100">
                        <p className="text-xs text-green-700 mb-1">Goals For</p>
                        <p className="text-2xl font-bold text-green-600">{stats.goals_scored || 0}</p>
                        {stats.goals_per_game && (
                          <p className="text-xs text-green-500 mt-1">{stats.goals_per_game} per game</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Performance Progress Bars */}
                <div className="mt-6">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Performance Metrics</h4>

                  {/* Goals per Game */}
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-gray-600">Goals per Game</span>
                      <span className="text-xs font-bold text-gray-700">{goalsPerGame}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="h-2.5 bg-gradient-to-r from-primary to-blue-600 rounded-full transition-all duration-1000"
                        style={{ width: `${Math.min(parseFloat(goalsPerGame as string) * 50, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Win Percentage */}
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-gray-600">Win Percentage</span>
                      <span className="text-xs font-bold text-gray-700">{winRate}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="h-2.5 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full transition-all duration-1000"
                        style={{ width: `${winRate}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
              )}

              {/* Team Trophies - Only for Individual Season View */}
              {selectedView === 'season' && selectedSeasonId && !trophiesLoading && teamTrophies.length > 0 && (
                <div className="bg-white/60 rounded-2xl p-6 shadow-md border border-white/20">
                  <h3 className="text-lg font-semibold text-dark mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    🏆 Team Trophies
                  </h3>
                  <p className="text-xs text-gray-500 mb-4">
                    {currentSeasonData.season_name || 'This Season'} - with {currentSeasonData.team}
                  </p>
                  
                  {/* League Position from teamstats */}
                  {teamStats && teamStats.position && (
                    <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                          </svg>
                          <span className="text-sm font-semibold text-blue-800">League Position</span>
                        </div>
                        <span className="text-2xl font-bold text-blue-700">#{teamStats.position}</span>
                      </div>
                      <p className="text-xs text-blue-600 mt-1">
                        {teamStats.points} points • {teamStats.wins}W-{teamStats.draws}D-{teamStats.losses}L
                      </p>
                    </div>
                  )}

                  <div className="space-y-3">
                    {teamTrophies.map((trophy) => {
                      const isLeague = trophy.trophy_type === 'league';
                      const isCup = trophy.trophy_type === 'cup';
                      const isRunnerUp = trophy.trophy_type === 'runner_up';
                      
                      const bgGradient = isLeague
                        ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300'
                        : isCup
                        ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-300'
                        : 'bg-gradient-to-r from-gray-50 to-slate-50 border-gray-300';
                      
                      const iconBg = isLeague
                        ? 'bg-green-500'
                        : isCup
                        ? 'bg-blue-500'
                        : 'bg-gray-400';

                      return (
                        <div key={trophy.id} className={`glass rounded-xl p-4 border-2 ${bgGradient}`}>
                          <div className="flex items-start gap-3">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${iconBg}`}>
                              <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 3.5a1.5 1.5 0 013 0V4a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-.5a1.5 1.5 0 000 3h.5a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-.5a1.5 1.5 0 00-3 0v.5a1 1 0 01-1 1H6a1 1 0 01-1-1v-3a1 1 0 00-1-1h-.5a1.5 1.5 0 010-3H4a1 1 0 001-1V6a1 1 0 011-1h3a1 1 0 001-1v-.5z" />
                              </svg>
                            </div>
                            <div className="flex-1">
                              <p className={`text-xs font-semibold mb-1 ${
                                isLeague ? 'text-green-700' :
                                isCup ? 'text-blue-700' : 'text-gray-700'
                              }`}>
                                🏆 Team Trophy
                              </p>
                              <p className="text-sm font-bold text-gray-900">{trophy.trophy_name}</p>
                              {trophy.position && (
                                <p className="text-xs text-gray-600 mt-1">
                                  Position: #{trophy.position}
                                </p>
                              )}
                              {trophy.notes && (
                                <p className="text-xs text-gray-500 mt-1 italic">{trophy.notes}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Player Awards - Only for Individual Season View */}
              {selectedView === 'season' && selectedSeasonId && !awardsLoading && playerAwards.length > 0 && (
                <div className="bg-white/60 rounded-2xl p-6 shadow-md border border-white/20">
                  <h3 className="text-lg font-semibold text-dark mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    ⭐ Player Awards
                  </h3>
                  <p className="text-xs text-gray-500 mb-4">{currentSeasonData.season_name || 'This Season'}</p>

                  <div className="space-y-3">
                    {playerAwards.map((award) => {
                      const isWinner = award.award_position?.toLowerCase() === 'winner' || !award.award_position;
                      const bgGradient = isWinner
                        ? 'bg-gradient-to-r from-purple-50 to-pink-50 border-purple-400'
                        : award.award_position?.toLowerCase() === 'runner-up'
                        ? 'bg-gradient-to-r from-gray-50 to-slate-50 border-gray-300'
                        : 'bg-gradient-to-r from-orange-50 to-amber-50 border-orange-300';
                      
                      const iconBg = isWinner
                        ? 'bg-purple-500'
                        : award.award_position?.toLowerCase() === 'runner-up'
                        ? 'bg-gray-400'
                        : 'bg-orange-500';
                      
                      const textColor = isWinner
                        ? 'text-purple-700'
                        : award.award_position?.toLowerCase() === 'runner-up'
                        ? 'text-gray-700'
                        : 'text-orange-700';

                      return (
                        <div key={award.id} className={`glass rounded-xl p-4 border-2 ${bgGradient}`}>
                          <div className="flex items-start gap-3">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${iconBg}`}>
                              <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <p className={`text-xs font-semibold ${textColor}`}>
                                  {award.award_category === 'category' ? '🎯 Category Award' : '🌟 Individual Award'}
                                </p>
                                {award.award_position && (
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                                    isWinner ? 'bg-purple-100 text-purple-700' :
                                    award.award_position.toLowerCase() === 'runner-up' ? 'bg-gray-200 text-gray-700' :
                                    'bg-orange-100 text-orange-700'
                                  }`}>
                                    {award.award_position}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm font-bold text-gray-900">{award.award_type}</p>
                              {award.player_category && (
                                <p className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L11 4.323V3a1 1 0 011-1zm-5 8.274l-.818 2.552c-.25.78.057 1.62.754 2.062.629.4 1.446.45 2.122.085.577-.312.998-.835 1.187-1.452l.818-2.552-4.063-1.094zm10 0l-4.063 1.094.818 2.552c.189.617.61 1.14 1.187 1.452.676.365 1.493.315 2.122-.085.697-.442 1.004-1.282.754-2.062L15 10.274z" clipRule="evenodd" />
                                  </svg>
                                  {award.player_category}
                                </p>
                              )}
                              {award.performance_stats && Object.keys(award.performance_stats).length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {Object.entries(award.performance_stats).map(([key, value]) => (
                                    <span key={key} className="text-xs bg-white/70 px-2 py-1 rounded-md">
                                      <span className="font-medium text-gray-600">{key}:</span>{' '}
                                      <span className="font-bold text-gray-900">{String(value)}</span>
                                    </span>
                                  ))}
                                </div>
                              )}
                              {award.notes && (
                                <p className="text-xs text-gray-500 mt-2 italic">{award.notes}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Round Performance - Only for Individual Season View */}
              {selectedView === 'season' && selectedSeasonId && currentSeasonData.round_performance && Object.keys(currentSeasonData.round_performance).length > 0 && (
                <div className="bg-white/60 rounded-2xl p-6 shadow-md border border-white/20">
                  <h3 className="text-lg font-semibold text-dark mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Round Performance
                  </h3>

                  <div className="space-y-4">
                    {Object.entries(currentSeasonData.round_performance).map(([roundKey, roundData]: [string, any]) => (
                      <div key={roundKey} className="glass rounded-xl p-4 bg-white/40 hover:bg-white/50 transition-all duration-300">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="text-sm font-semibold text-gray-700 capitalize">{roundKey}</h4>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            roundData.wins > roundData.losses
                              ? 'bg-green-100 text-green-800'
                              : roundData.wins < roundData.losses
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {roundData.matches} Matches
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-white/50 rounded-lg p-2">
                            <p className="text-xs text-gray-500 mb-1">Goals</p>
                            <p className="text-lg font-bold text-green-600">{roundData.goals || 0}</p>
                          </div>
                          <div className="bg-white/50 rounded-lg p-2">
                            <p className="text-xs text-gray-500 mb-1">Conceded</p>
                            <p className="text-lg font-bold text-red-600">{roundData.goals_conceded || 0}</p>
                          </div>
                          <div className="bg-white/50 rounded-lg p-2">
                            <p className="text-xs text-gray-500 mb-1">GD</p>
                            <p className={`text-lg font-bold ${
                              roundData.goal_difference > 0
                                ? 'text-green-600'
                                : roundData.goal_difference < 0
                                ? 'text-red-600'
                                : 'text-gray-600'
                            }`}>
                              {roundData.goal_difference}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center mt-2">
                          <div className="bg-white/50 rounded-lg p-2">
                            <p className="text-xs text-gray-500 mb-1">W/D/L</p>
                            <p className="text-sm font-bold text-gray-700">
                              {roundData.wins}/{roundData.draws}/{roundData.losses}
                            </p>
                          </div>
                          <div className="bg-white/50 rounded-lg p-2">
                            <p className="text-xs text-gray-500 mb-1">POTM</p>
                            <p className="text-lg font-bold text-amber-600">{roundData.potm_count || 0}</p>
                          </div>
                          <div className="bg-white/50 rounded-lg p-2">
                            <p className="text-xs text-gray-500 mb-1">Points</p>
                            <p className="text-lg font-bold text-blue-600">{roundData.points || 0}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Match History - Only for Individual Season View */}
              {selectedView === 'season' && selectedSeasonId && matchHistory && matchHistory.length > 0 && (
                <div className="bg-white/60 rounded-2xl shadow-md border border-white/20 overflow-hidden">
                  <div className="px-6 py-4 bg-gray-50/50 border-b border-gray-200/50">
                    <h3 className="text-lg font-semibold text-gray-800">Match History</h3>
                  </div>

                  <div className="p-6 overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-xs font-medium text-left text-gray-500 uppercase tracking-wider">Match</th>
                          <th className="px-4 py-2 text-xs font-medium text-left text-gray-500 uppercase tracking-wider">Result</th>
                          <th className="px-4 py-2 text-xs font-medium text-center text-gray-500 uppercase tracking-wider">GS</th>
                          <th className="px-4 py-2 text-xs font-medium text-center text-gray-500 uppercase tracking-wider">GC</th>
                          <th className="px-4 py-2 text-xs font-medium text-center text-gray-500 uppercase tracking-wider">GD</th>
                          <th className="px-4 py-2 text-xs font-medium text-center text-gray-500 uppercase tracking-wider">POTM</th>
                          <th className="px-4 py-2 text-xs font-medium text-center text-gray-500 uppercase tracking-wider">Points</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {matchHistory.map((match, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">
                              {match.opponent ? `vs ${match.opponent}` : `Match ${match.match_number}`}
                            </td>
                            <td className={`px-4 py-2 whitespace-nowrap text-sm font-medium ${
                              match.result === 'win' ? 'text-green-600' :
                              match.result === 'loss' ? 'text-red-600' :
                              'text-amber-500'
                            }`}>
                              {match.result.charAt(0).toUpperCase() + match.result.slice(1)}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-center text-green-600 font-medium">
                              {match.player_goals}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-center text-red-600 font-medium">
                              {match.opponent_goals}
                            </td>
                            <td className={`px-4 py-2 whitespace-nowrap text-sm text-center font-medium ${
                              match.player_goals - match.opponent_goals > 0 ? 'text-green-600' :
                              match.player_goals - match.opponent_goals < 0 ? 'text-red-600' :
                              'text-gray-600'
                            }`}>
                              {match.player_goals - match.opponent_goals}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-center text-amber-600 font-medium">
                              {match.is_potm ? '✓' : '—'}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-center text-blue-600 font-medium">
                              {match.points}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
