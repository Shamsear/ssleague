'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface FootballPlayer {
  player_id: string;
  player_name: string;
  position: string;
  position_group: string;
  overall_rating: number;
  club: string;
  nationality: string;
  age: number;
  playing_style: string;
  purchase_price: number;
  acquired_at: string;
  speed: number;
  acceleration: number;
  ball_control: number;
  dribbling: number;
  finishing: number;
}

interface RealPlayer {
  player_id: string;
  player_name: string;
  team_name: string;
  season_id: string;
  category: string;
  star_rating: number;
  matches_played: number;
  goals_scored: number;
  assists: number;
  wins: number;
  draws: number;
  losses: number;
  clean_sheets: number;
  motm_awards: number;
  points: number;
  data_source?: string;
}

interface TeamSeasonData {
  id: string;
  team_id: string;
  team_name: string;
  team_code: string;
  season_id: string;
  season_name: string;
  logo_url?: string;
  manager_name?: string;

  stats: {
    matches_played: number;
    wins: number;
    draws: number;
    losses: number;
    goals_for: number;
    goals_against: number;
    goal_difference: number;
    points: number;
    clean_sheets: number;
    position?: number;
    form?: string;
  };
  trophies?: any;

  players?: Array<{
    player_id: string;
    player_name: string;
    matches_played: number;
    goals: number;
    assists: number;
  }>;
}

export default function TeamDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [team, setTeam] = useState<TeamSeasonData | null>(null);
  const [allSeasonData, setAllSeasonData] = useState<TeamSeasonData[]>([]);
  const [footballPlayers, setFootballPlayers] = useState<FootballPlayer[]>([]);
  const [realPlayers, setRealPlayers] = useState<RealPlayer[]>([]);
  const [loadingFootballPlayers, setLoadingFootballPlayers] = useState(false);
  const [loadingRealPlayers, setLoadingRealPlayers] = useState(false);
  const [awards, setAwards] = useState<any[]>([]);
  const [loadingAwards, setLoadingAwards] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedView, setSelectedView] = useState<'overall' | 'all-seasons' | 'season'>('overall');
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);

  const teamId = params.id as string;

  useEffect(() => {
    fetchTeamData();
  }, [teamId]);

  useEffect(() => {
    // Only fetch players when a specific season is selected
    if (selectedView === 'season' && selectedSeasonId) {
      // Check if this is a modern season (S16+)
      const seasonNum = parseInt(selectedSeasonId?.match(/\d+/)?.[0] || '0');
      const isModernSeason = seasonNum >= 16;

      // Only fetch football players for modern seasons (S16+)
      if (isModernSeason) {
        fetchFootballPlayers(selectedSeasonId);
      } else {
        // Clear football players for older seasons
        setFootballPlayers([]);
      }

      // Always fetch real players for any season
      fetchRealPlayers(selectedSeasonId);

      // Fetch awards for modern seasons (S16+)
      if (isModernSeason) {
        fetchAwards(selectedSeasonId);
      } else {
        setAwards([]);
      }
    } else {
      // Clear players when not viewing a specific season
      setFootballPlayers([]);
      setRealPlayers([]);
      setAwards([]);
    }
  }, [selectedView, selectedSeasonId, teamId]);

  const fetchTeamData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch team data across all seasons from Neon database
      const response = await fetch(`/api/teams/${teamId}/all-seasons`);
      const data = await response.json();

      if (!data.success || !data.seasons || data.seasons.length === 0) {
        setError('No team data found');
        return;
      }

      setAllSeasonData(data.seasons);
      setTeam(data.seasons[0]); // Set current season as default
    } catch (err) {
      console.error('Error fetching team data:', err);
      setError('Failed to load team data');
    } finally {
      setLoading(false);
    }
  };

  const fetchFootballPlayers = async (seasonId: string) => {
    try {
      setLoadingFootballPlayers(true);
      const response = await fetch(`/api/teams/${teamId}/football-players?seasonId=${seasonId}`);
      const data = await response.json();

      if (data.success && data.data && data.data.players) {
        setFootballPlayers(data.data.players);
      } else {
        setFootballPlayers([]);
      }
    } catch (err) {
      console.error('Error fetching football players:', err);
      setFootballPlayers([]);
    } finally {
      setLoadingFootballPlayers(false);
    }
  };

  const fetchRealPlayers = async (seasonId: string) => {
    try {
      setLoadingRealPlayers(true);
      const response = await fetch(`/api/teams/${teamId}/real-players?seasonId=${seasonId}`);
      const data = await response.json();

      if (data.success && data.data && data.data.players) {
        setRealPlayers(data.data.players);
      } else {
        setRealPlayers([]);
      }
    } catch (err) {
      console.error('Error fetching real players:', err);
      setRealPlayers([]);
    } finally {
      setLoadingRealPlayers(false);
    }
  };

  const fetchAwards = async (seasonId: string) => {
    try {
      setLoadingAwards(true);
      const response = await fetch(`/api/teams/${teamId}/awards?seasonId=${seasonId}`);
      const data = await response.json();

      if (data.success && data.data && data.data.awards) {
        setAwards(data.data.awards);
      } else {
        setAwards([]);
      }
    } catch (err) {
      console.error('Error fetching awards:', err);
      setAwards([]);
    } finally {
      setLoadingAwards(false);
    }
  };

  const calculateOverallStats = () => {
    if (allSeasonData.length === 0) return {
      matches_played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goals_for: 0,
      goals_against: 0,
      goal_difference: 0,
      points: 0,
      clean_sheets: 0,
    };

    return allSeasonData.reduce((acc, season) => {
      const s = season.stats;
      return {
        matches_played: acc.matches_played + s.matches_played,
        wins: acc.wins + s.wins,
        draws: acc.draws + s.draws,
        losses: acc.losses + s.losses,
        goals_for: acc.goals_for + s.goals_for,
        goals_against: acc.goals_against + s.goals_against,
        goal_difference: acc.goal_difference + s.goal_difference,
        points: acc.points + s.points,
        clean_sheets: acc.clean_sheets + s.clean_sheets,
      };
    }, {
      matches_played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goals_for: 0,
      goals_against: 0,
      goal_difference: 0,
      points: 0,
      clean_sheets: 0,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading team details...</p>
        </div>
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error || 'Team not found'}</p>
          <Link
            href="/teams"
            className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            Back to Teams
          </Link>
        </div>
      </div>
    );
  }

  const overallStats = calculateOverallStats();

  // Get stats based on selected view
  let displayStats;
  let currentSeasonData = team;

  if (selectedView === 'overall') {
    displayStats = overallStats;
  } else if (selectedView === 'all-seasons') {
    displayStats = overallStats;
  } else if (selectedView === 'season' && selectedSeasonId) {
    const selectedSeason = allSeasonData.find(s => s.season_id === selectedSeasonId);
    if (selectedSeason) {
      currentSeasonData = selectedSeason;
      displayStats = selectedSeason.stats;
    } else {
      displayStats = team.stats;
    }
  } else {
    displayStats = team.stats;
  }

  const stats = displayStats;
  const winRate = stats.matches_played > 0
    ? Math.round((stats.wins / stats.matches_played) * 100)
    : 0;
  const goalsPerGame = stats.matches_played > 0
    ? (stats.goals_for / stats.matches_played).toFixed(2)
    : '0.00';
  const concededPerGame = stats.matches_played > 0
    ? (stats.goals_against / stats.matches_played).toFixed(2)
    : '0.00';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="glass rounded-3xl p-6 md:p-8 shadow-xl">
          {/* Header with Back Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
            <Link
              href="/teams"
              className="flex items-center text-gray-600 hover:text-primary transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back to Teams</span>
            </Link>

            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-600">
                Team ID: {team.team_id}
              </span>
              {allSeasonData.length > 1 && (
                <span className="px-3 py-1 bg-blue-100 rounded-full text-sm text-blue-700 font-medium">
                  {allSeasonData.length} Seasons
                </span>
              )}
              <Link
                href={`/teams/${teamId}/awards`}
                className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white rounded-lg text-sm font-semibold shadow-md hover:shadow-lg transition-all flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                Season Awards
              </Link>
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
                  className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${selectedView === 'overall'
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
                  className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${selectedView === 'all-seasons'
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
                  const isSelected = selectedView === 'season' && selectedSeasonId === seasonData.season_id;

                  return (
                    <button
                      key={`${seasonData.team_id}-${seasonData.season_id}-${index}`}
                      onClick={() => {
                        setSelectedView('season');
                        setSelectedSeasonId(seasonData.season_id);
                      }}
                      className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${isSelected
                        ? 'bg-blue-500 text-white shadow-md'
                        : 'text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                      {seasonData.season_name || `Season ${allSeasonData.length - index}`}
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
            {/* Left Column - Team Info */}
            <div className="lg:col-span-1 space-y-6">
              {/* Team Card */}
              <div className="bg-white/60 rounded-2xl p-6 shadow-md border border-white/20">
                {/* Team Logo */}
                <div className="relative w-40 h-40 mx-auto mb-4 rounded-xl shadow-md bg-white flex items-center justify-center p-3">
                  {team.logo_url ? (
                    <img
                      src={team.logo_url}
                      alt={team.team_name}
                      className="object-contain w-full h-full"
                    />
                  ) : (
                    <div className="bg-primary/10 w-full h-full flex items-center justify-center">
                      <span className="text-5xl font-bold text-primary">{team.team_name[0]}</span>
                    </div>
                  )}
                </div>

                {/* Team Basic Info */}
                <div className="text-center">
                  <h1 className="text-2xl font-bold text-dark mb-1">{currentSeasonData.team_name}</h1>
                  <p className="text-sm text-gray-500 mb-4">{team.team_code}</p>

                  {currentSeasonData.manager_name && (
                    <div className="mb-4">
                      <span className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200">
                        Manager: {currentSeasonData.manager_name}
                      </span>
                    </div>
                  )}

                  {/* Season Info */}
                  {selectedView === 'season' && selectedSeasonId && (
                    <div className="mb-4">
                      <span className="px-3 py-1.5 rounded-lg text-sm font-medium bg-purple-50 text-purple-700 border border-purple-200">
                        {currentSeasonData.season_name}
                      </span>
                    </div>
                  )}
                </div>

                {/* League Position */}
                {selectedView === 'season' && currentSeasonData.stats.position !== undefined && currentSeasonData.stats.position !== null && (
                  <div className="mt-4 p-3 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">League Position</span>
                      <span className="text-2xl font-bold text-orange-600">
                        {currentSeasonData.stats.position > 0 ? `#${currentSeasonData.stats.position}` : 'N/A'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Record Card */}
              <div className="glass rounded-2xl p-6 shadow-md border border-white/20 bg-white/60">
                <h3 className="text-lg font-semibold text-dark mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Record
                </h3>

                {/* Win/Draw/Loss */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="glass rounded-xl p-3 bg-green-50/60 text-center">
                    <p className="text-xs text-green-700 font-medium mb-1">WINS</p>
                    <p className="text-2xl font-bold text-green-800">{stats.wins}</p>
                  </div>
                  <div className="glass rounded-xl p-3 bg-yellow-50/60 text-center">
                    <p className="text-xs text-yellow-700 font-medium mb-1">DRAWS</p>
                    <p className="text-2xl font-bold text-yellow-800">{stats.draws}</p>
                  </div>
                  <div className="glass rounded-xl p-3 bg-red-50/60 text-center">
                    <p className="text-xs text-red-700 font-medium mb-1">LOSSES</p>
                    <p className="text-2xl font-bold text-red-800">{stats.losses}</p>
                  </div>
                </div>

                {/* Stats */}
                <div className="mt-4 space-y-3">
                  <div className="flex justify-between items-center px-3 py-2 bg-white/50 rounded-lg">
                    <span className="text-sm text-gray-600">Goals For (GF):</span>
                    <span className="text-sm font-bold text-green-600">{stats.goals_for}</span>
                  </div>
                  <div className="flex justify-between items-center px-3 py-2 bg-white/50 rounded-lg">
                    <span className="text-sm text-gray-600">Goals Against (GA):</span>
                    <span className="text-sm font-bold text-red-600">{stats.goals_against}</span>
                  </div>
                  <div className="flex justify-between items-center px-3 py-2 bg-white/50 rounded-lg">
                    <span className="text-sm text-gray-600">Goal Difference (GD):</span>
                    <span className={`text-sm font-bold ${stats.goal_difference > 0 ? 'text-green-600' : stats.goal_difference < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                      {stats.goal_difference > 0 ? '+' : ''}{stats.goal_difference}
                    </span>
                  </div>
                  <div className="flex justify-between items-center px-3 py-2 bg-white/50 rounded-lg">
                    <span className="text-sm text-gray-600">Clean Sheets:</span>
                    <span className="text-sm font-bold text-blue-600">{stats.clean_sheets}</span>
                  </div>
                </div>
              </div>
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
                      const isCurrentSeason = index === 0;
                      const s = seasonData.stats;

                      return (
                        <div key={`all-seasons-${seasonData.team_id}-${seasonData.season_id}-${index}`} className={`rounded-xl p-5 border-2 ${isCurrentSeason
                          ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-300'
                          : 'bg-white/50 border-gray-200'
                          }`}>
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${isCurrentSeason ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
                                }`}>
                                {allSeasonData.length - index}
                              </div>
                              <div>
                                <h4 className="font-bold text-gray-900">
                                  {seasonData.season_name || `Season ${allSeasonData.length - index}`}
                                </h4>
                                {s.position && (
                                  <p className="text-sm text-gray-600">Position: #{s.position}</p>
                                )}
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
                              <p className="text-xl font-bold text-gray-900">{s.matches_played}</p>
                            </div>
                            <div className="bg-white/60 rounded-lg p-3 text-center">
                              <p className="text-xs text-gray-500 mb-1">W-D-L</p>
                              <p className="text-sm font-bold text-gray-900">
                                {s.wins}-{s.draws}-{s.losses}
                              </p>
                            </div>
                            <div className="bg-white/60 rounded-lg p-3 text-center">
                              <p className="text-xs text-gray-500 mb-1">Goals</p>
                              <p className="text-xl font-bold text-green-600">{s.goals_for}</p>
                            </div>
                            <div className="bg-white/60 rounded-lg p-3 text-center">
                              <p className="text-xs text-gray-500 mb-1">Points</p>
                              <p className="text-xl font-bold text-indigo-600">{s.points}</p>
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
                    {selectedView === 'overall' ? 'Overall Statistics' : `Statistics - ${currentSeasonData.season_name}`}
                  </h3>

                  {/* Main Stats Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                    <div className="glass-card rounded-xl bg-white/30 p-4 text-center">
                      <p className="text-xs text-gray-500 mb-1">Matches</p>
                      <p className="text-2xl font-bold text-dark">{stats.matches_played}</p>
                    </div>
                    <div className="glass-card rounded-xl bg-white/30 p-4 text-center">
                      <p className="text-xs text-gray-500 mb-1">Goals For</p>
                      <p className="text-2xl font-bold text-green-600">{stats.goals_for}</p>
                    </div>
                    <div className="glass-card rounded-xl bg-white/30 p-4 text-center">
                      <p className="text-xs text-gray-500 mb-1">Clean Sheets</p>
                      <p className="text-2xl font-bold text-blue-600">{stats.clean_sheets}</p>
                    </div>
                    <div className="glass-card rounded-xl bg-white/30 p-4 text-center">
                      <p className="text-xs text-gray-500 mb-1">GD</p>
                      <p className={`text-2xl font-bold ${stats.goal_difference > 0 ? 'text-green-600' :
                        stats.goal_difference < 0 ? 'text-red-600' : 'text-gray-600'
                        }`}>
                        {stats.goal_difference > 0 ? '+' : ''}{stats.goal_difference}
                      </p>
                    </div>
                  </div>

                  {/* Secondary Stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
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
                      <p className="text-2xl font-bold text-red-600">{concededPerGame}</p>
                    </div>
                  </div>

                  {/* Performance Progress Bars */}
                  <div className="mt-6">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Performance Metrics</h4>

                    {/* Win Percentage */}
                    <div className="mb-4">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-gray-600">Win Percentage</span>
                        <span className="text-xs font-bold text-gray-700">{winRate}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="h-2.5 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full"
                          style={{ width: `${winRate}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Real Players Section (Season-specific) */}
              {selectedView === 'season' && selectedSeasonId && (
                <div className="bg-white/60 rounded-2xl p-6 shadow-md border border-white/20">
                  <h3 className="text-lg font-semibold text-dark mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Real Players {realPlayers.length > 0 && `(${realPlayers.length})`}
                  </h3>

                  {loadingRealPlayers ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="text-gray-600 mt-2">Loading players...</p>
                    </div>
                  ) : realPlayers.length === 0 ? (
                    <div className="text-center py-8">
                      <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <p className="text-gray-600 text-lg font-medium">No real players found for this season</p>
                      <p className="text-gray-500 text-sm mt-2">This team may not have had any real players registered in this season.</p>
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        {(() => {
                          // Check if this is a modern season (S16+) to show rating column
                          const seasonNum = parseInt(selectedSeasonId?.match(/\d+/)?.[0] || '0');
                          const isModernSeason = seasonNum >= 16;

                          // For S16+, check if any player has a category
                          // For S15 and below, always show category
                          const hasCategory = isModernSeason
                            ? realPlayers.some(p => p.category && p.category.trim() !== '')
                            : true;

                          return (
                            <table className="w-full">
                              <thead>
                                <tr className="border-b-2 border-gray-200">
                                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Player</th>
                                  {hasCategory && (
                                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Category</th>
                                  )}
                                  {isModernSeason && (
                                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Rating</th>
                                  )}
                                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Matches</th>
                                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Goals</th>
                                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Points</th>
                                </tr>
                              </thead>
                              <tbody>
                                {realPlayers
                                  .sort((a, b) => (b.points || 0) - (a.points || 0))
                                  .map((player, index) => (
                                    <tr key={`${player.player_id}-${player.season_id}-${index}`} className={`border-b border-gray-100 hover:bg-blue-50 transition-colors ${index < 3 ? 'bg-blue-50/30' : ''}`}>
                                      <td className="py-3 px-4">
                                        <div className="flex items-center gap-2">
                                          {index < 3 && (
                                            <span className="text-blue-500 font-bold text-sm">★</span>
                                          )}
                                          <div>
                                            <div className="font-medium text-gray-900">{player.player_name}</div>
                                          </div>
                                        </div>
                                      </td>
                                      {hasCategory && (
                                        <td className="text-center py-3 px-4">
                                          <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                                            {player.category || 'N/A'}
                                          </span>
                                        </td>
                                      )}
                                      {isModernSeason && (
                                        <td className="text-center py-3 px-4">
                                          <span className={`px-3 py-1 rounded-full text-sm font-bold ${(player.star_rating || 0) >= 8 ? 'bg-yellow-100 text-yellow-800' :
                                            (player.star_rating || 0) >= 6 ? 'bg-blue-100 text-blue-800' :
                                              'bg-gray-100 text-gray-700'
                                            }`}>
                                            {player.star_rating || 0}
                                          </span>
                                        </td>
                                      )}
                                      <td className="text-center py-3 px-4 text-gray-700">{player.matches_played || 0}</td>
                                      <td className="text-center py-3 px-4 text-green-600 font-semibold">{player.goals_scored || 0}</td>
                                      <td className="text-center py-3 px-4 text-indigo-600 font-bold">{player.points || 0}</td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          );
                        })()}
                      </div>

                      {/* Summary Stats */}
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          <div className="bg-blue-50 rounded-lg p-3 text-center">
                            <p className="text-xs text-blue-700 font-medium mb-1">Total Players</p>
                            <p className="text-xl font-bold text-blue-800">{realPlayers.length}</p>
                          </div>
                          <div className="bg-green-50 rounded-lg p-3 text-center">
                            <p className="text-xs text-green-700 font-medium mb-1">Total Goals</p>
                            <p className="text-xl font-bold text-green-800">
                              {realPlayers.reduce((sum, p) => sum + (p.goals_scored || 0), 0)}
                            </p>
                          </div>
                          <div className="bg-indigo-50 rounded-lg p-3 text-center">
                            <p className="text-xs text-indigo-700 font-medium mb-1">Total Points</p>
                            <p className="text-xl font-bold text-indigo-800">
                              {realPlayers.reduce((sum, p) => sum + (p.points || 0), 0)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Awards Section (Season 16+ only) */}
              {selectedView === 'season' && selectedSeasonId && (() => {
                const seasonNum = parseInt(selectedSeasonId?.match(/\d+/)?.[0] || '0');
                return seasonNum >= 16;
              })() && (
                  <div className="bg-white/60 rounded-2xl p-6 shadow-md border border-white/20">
                    <h3 className="text-lg font-semibold text-dark mb-4 flex items-center">
                      <svg className="w-5 h-5 mr-2 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      Awards {awards.length > 0 && `(${awards.length})`}
                    </h3>

                    {loadingAwards ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600 mx-auto"></div>
                        <p className="text-gray-600 mt-2">Loading awards...</p>
                      </div>
                    ) : awards.length === 0 ? (
                      <div className="text-center py-8">
                        <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <p className="text-gray-600 text-lg font-medium">No awards won this season</p>
                        <p className="text-gray-500 text-sm mt-2">Awards will appear here when they are given.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {awards.map((award: any, index: number) => {
                          // Map award types to readable labels
                          const awardTypeLabels: Record<string, string> = {
                            'season_player': 'Player of the Season',
                            'season_team': 'Team of the Season',
                            'potm': 'Player of the Month',
                            'totw': 'Team of the Week',
                            'TOD': 'Team of the Day',
                            'TOW': 'Team of the Week',
                            'POTD': 'Player of the Day',
                            'POTW': 'Player of the Week'
                          };

                          // Map specific styles for each award type
                          const getStyle = (type: string) => {
                            const t = type.toLowerCase();
                            if (t.includes('season')) return 'from-amber-50 to-yellow-50 border-amber-200';
                            if (t.includes('team') || t === 'tod' || t === 'tow' || t === 'totw') return 'from-emerald-50 to-green-50 border-emerald-200';
                            if (t.includes('player') || t === 'potd' || t === 'potw' || t === 'potm') return 'from-blue-50 to-cyan-50 border-blue-200';
                            return 'from-gray-50 to-gray-100 border-gray-200';
                          };

                          // Helper to format stats
                          const renderStats = (rawStats: any) => {
                            if (!rawStats) return null;
                            let stats;
                            try {
                              stats = typeof rawStats === 'string' ? JSON.parse(rawStats) : rawStats;
                            } catch (e) { return null; }
                            if (!stats || typeof stats !== 'object') return null;

                            // Define which stats to show and how
                            const allowedStats = [
                              'wins', 'draws', 'losses', 'goals_for', 'goals',
                              'goals_against', 'goal_difference', 'clean_sheet',
                              'motm', 'assists', 'matchup'
                            ];

                            return (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {/* Special Badge for Clean Sheet */}
                                {(stats.clean_sheet === true || stats.clean_sheet === 'true' || stats.clean_sheets > 0) && (
                                  <span className="px-2 py-1 bg-teal-100 text-teal-800 rounded border border-teal-200 text-xs font-bold flex items-center shadow-sm">
                                    🛡️ Clean Sheet
                                  </span>
                                )}

                                {/* Special Display for Matchup */}
                                {stats.matchup && (
                                  <div className="w-full text-xs font-medium text-gray-600 italic mb-1 border-l-2 border-blue-300 pl-2">
                                    {stats.matchup}
                                  </div>
                                )}

                                {/* Standard Stats */}
                                {Object.entries(stats).map(([originalKey, value]: [string, any]) => {
                                  const key = originalKey.toLowerCase();
                                  // Skip unwanted or empty values
                                  if (!allowedStats.includes(key)) return null;
                                  if (value === null || value === '' || value === undefined) return null;
                                  if (key === 'clean_sheet' || key === 'matchup') return null; // Handled above
                                  if (key.includes('played')) return null; // Skip rounds/matches played count often redundant

                                  // Format Labels
                                  let label = key.replace(/_/g, ' ');
                                  let suffix = '';
                                  let colorClass = 'bg-white text-gray-700 border-gray-200';

                                  if (key === 'wins') { label = 'W'; colorClass = 'bg-green-100 text-green-800 border-green-200'; }
                                  else if (key === 'losses') { label = 'L'; colorClass = 'bg-red-50 text-red-800 border-red-200'; }
                                  else if (key === 'draws') { label = 'D'; colorClass = 'bg-gray-100 text-gray-800 border-gray-200'; }
                                  else if (key === 'goals_for' || key === 'goals') { label = 'Goals'; colorClass = 'bg-blue-50 text-blue-800 border-blue-200'; }
                                  else if (key === 'goals_against') { label = 'Conc'; colorClass = 'bg-orange-50 text-orange-800 border-orange-200'; }
                                  else if (key === 'goal_difference') { label = 'GD'; colorClass = 'bg-indigo-50 text-indigo-800 border-indigo-200'; }
                                  else if (key === 'motm') { label = 'MOTM'; suffix = '🏆'; colorClass = 'bg-yellow-50 text-yellow-800 border-yellow-200'; }

                                  return (
                                    <span key={originalKey} className={`px-2 py-1 ${colorClass} rounded border text-xs font-semibold shadow-sm flex items-center`}>
                                      {label}: {value} {suffix}
                                    </span>
                                  );
                                })}
                              </div>
                            );
                          };

                          return (
                            <div
                              key={award.id || index}
                              className={`bg-gradient-to-br ${getStyle(award.award_type)} rounded-xl p-4 border shadow-sm hover:shadow-md transition-shadow`}
                            >
                              <div className="flex items-start gap-3">
                                <div className="p-2 bg-white/50 rounded-full shadow-sm">
                                  <span className="text-2xl block leading-none">🏆</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex justify-between items-start">
                                    <h4 className="font-bold text-gray-900 text-sm uppercase tracking-wide">
                                      {awardTypeLabels[award.award_type] || award.award_type}
                                    </h4>
                                    <span className="text-[10px] font-bold text-gray-500 bg-white/60 px-2 py-0.5 rounded-full uppercase">
                                      {award.round_number ? `Round ${award.round_number}` : award.week_number ? `Week ${award.week_number}` : 'Season'}
                                    </span>
                                  </div>

                                  {award.player_name && (
                                    <p className="text-sm text-gray-800 font-bold mt-0.5 truncate">
                                      {award.player_name}
                                    </p>
                                  )}

                                  {renderStats(award.performance_stats)}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}


              {/* Football Players Section (eFootball) - Season-specific, only for S16+ */}
              {selectedView === 'season' && selectedSeasonId && (() => {
                const seasonNum = parseInt(selectedSeasonId?.match(/\d+/)?.[0] || '0');
                const isModernSeason = seasonNum >= 16;
                return isModernSeason;
              })() && (
                  <div className="bg-white/60 rounded-2xl p-6 shadow-md border border-white/20">
                    <h3 className="text-lg font-semibold text-dark mb-4 flex items-center">
                      <svg className="w-5 h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Football Players (eFootball) {footballPlayers.length > 0 && `(${footballPlayers.length})`}
                    </h3>

                    {loadingFootballPlayers ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                        <p className="text-gray-600 mt-2">Loading players...</p>
                      </div>
                    ) : footballPlayers.length === 0 ? (
                      <div className="text-center py-8">
                        <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-gray-600 text-lg font-medium">No football players found for this season</p>
                        <p className="text-gray-500 text-sm mt-2">This team may not have acquired any eFootball players in this season.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b-2 border-gray-200">
                              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Player</th>
                              <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Position</th>
                              <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Rating</th>
                              <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Club</th>
                              <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Style</th>
                              <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Price</th>
                              <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Stats</th>
                            </tr>
                          </thead>
                          <tbody>
                            {footballPlayers
                              .sort((a, b) => b.purchase_price - a.purchase_price)
                              .map((player, index) => (
                                <tr key={player.player_id} className={`border-b border-gray-100 hover:bg-green-50 transition-colors ${index < 3 ? 'bg-green-50/30' : ''}`}>
                                  <td className="py-3 px-4">
                                    <div className="flex items-center gap-2">
                                      <div>
                                        <div className="font-medium text-gray-900">{player.player_name}</div>
                                        {player.nationality && (
                                          <div className="text-xs text-gray-500">{player.nationality}</div>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="text-center py-3 px-4">
                                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                                      {player.position || 'N/A'}
                                    </span>
                                  </td>
                                  <td className="text-center py-3 px-4">
                                    <span className={`font-bold text-lg ${player.overall_rating >= 85 ? 'text-purple-600' :
                                      player.overall_rating >= 80 ? 'text-blue-600' :
                                        player.overall_rating >= 75 ? 'text-green-600' :
                                          'text-gray-600'
                                      }`}>
                                      {player.overall_rating}
                                    </span>
                                  </td>
                                  <td className="text-center py-3 px-4 text-sm text-gray-700">
                                    {player.club || 'Free Agent'}
                                  </td>
                                  <td className="text-center py-3 px-4 text-xs text-gray-600">
                                    {player.playing_style || '-'}
                                  </td>
                                  <td className="text-center py-3 px-4">
                                    <span className="font-semibold text-orange-600">
                                      €{player.purchase_price}
                                    </span>
                                  </td>
                                  <td className="text-center py-3 px-4">
                                    <div className="flex gap-1 justify-center text-xs">
                                      <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded" title="Speed">
                                        SPD {player.speed || '-'}
                                      </span>
                                      <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded" title="Ball Control">
                                        BC {player.ball_control || '-'}
                                      </span>
                                      <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded" title="Finishing">
                                        FIN {player.finishing || '-'}
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>

                        {/* Summary Stats */}
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="bg-green-50 rounded-lg p-3 text-center">
                              <p className="text-xs text-green-700 font-medium mb-1">Total Players</p>
                              <p className="text-xl font-bold text-green-800">{footballPlayers.length}</p>
                            </div>
                            <div className="bg-orange-50 rounded-lg p-3 text-center">
                              <p className="text-xs text-orange-700 font-medium mb-1">Total Spent</p>
                              <p className="text-xl font-bold text-orange-800">
                                €{footballPlayers.reduce((sum, p) => sum + p.purchase_price, 0)}
                              </p>
                            </div>
                            <div className="bg-purple-50 rounded-lg p-3 text-center">
                              <p className="text-xs text-purple-700 font-medium mb-1">Avg Rating</p>
                              <p className="text-xl font-bold text-purple-800">
                                {(footballPlayers.reduce((sum, p) => sum + p.overall_rating, 0) / footballPlayers.length).toFixed(1)}
                              </p>
                            </div>
                            <div className="bg-blue-50 rounded-lg p-3 text-center">
                              <p className="text-xs text-blue-700 font-medium mb-1">Top Rating</p>
                              <p className="text-xl font-bold text-blue-800">
                                {Math.max(...footballPlayers.map(p => p.overall_rating))}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

              {/* Trophies Section */}
              {((selectedView === 'overall' && allSeasonData.some(s => s.trophies && s.trophies.length > 0)) ||
                (selectedView === 'season' && currentSeasonData.trophies && currentSeasonData.trophies.length > 0)) && (
                  <div className="bg-white/60 rounded-2xl p-6 shadow-md border border-white/20">
                    <h3 className="text-lg font-semibold text-dark mb-4 flex items-center">
                      <svg className="w-5 h-5 mr-2 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      {selectedView === 'overall' ? 'All Trophies' : 'Trophies Won This Season'}
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {selectedView === 'overall' ? (
                        allSeasonData.flatMap(seasonData =>
                          (seasonData.trophies || []).map((trophy: any) => ({
                            ...trophy,
                            season: seasonData.season_name
                          }))
                        ).map((trophy: any) => (
                          <div key={trophy.id} className="bg-gradient-to-r from-yellow-50 to-amber-50 rounded-lg p-4 border-2 border-yellow-300 shadow-sm">
                            <div className="flex items-center gap-3">
                              <span className="text-3xl">🏆</span>
                              <div className="flex-1">
                                <h4 className="font-bold text-gray-900 text-lg">{trophy.trophy_name}</h4>
                                {trophy.trophy_position && (
                                  <p className="text-sm text-orange-600 font-bold">
                                    {trophy.trophy_position}
                                  </p>
                                )}
                                {trophy.position && (
                                  <p className="text-xs text-gray-600">
                                    League Position: #{trophy.position}
                                  </p>
                                )}
                                <p className="text-xs text-gray-500 mt-1">{trophy.season}</p>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        currentSeasonData.trophies?.map((trophy: any) => (
                          <div key={trophy.id} className="bg-gradient-to-r from-yellow-50 to-amber-50 rounded-lg p-4 border-2 border-yellow-300 shadow-sm">
                            <div className="flex items-center gap-3">
                              <span className="text-3xl">🏆</span>
                              <div className="flex-1">
                                <h4 className="font-bold text-gray-900 text-lg">{trophy.trophy_name}</h4>
                                {trophy.trophy_position && (
                                  <p className="text-sm text-orange-600 font-bold">
                                    {trophy.trophy_position}
                                  </p>
                                )}
                                {trophy.position && (
                                  <p className="text-xs text-gray-600">
                                    League Position: #{trophy.position}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
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
