'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useTournamentContext } from '@/contexts/TournamentContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePermissions } from '@/hooks/usePermissions';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';
import TournamentSelector from '@/components/TournamentSelector';

interface PlayerStats {
  player_id: string;
  player_name: string;
  team_name: string;
  matches_played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_scored: number;
  goals_conceded: number;
  goal_difference: number;
  clean_sheets: number;
  motm_awards: number;
  win_rate: number;
  points: number;
  rounds_played: number[];
}

export default function PlayerStatsByRoundPage() {
  const { user, loading } = useAuth();
  const { selectedTournamentId } = useTournamentContext();
  const { userSeasonId } = usePermissions();
  const router = useRouter();
  
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRound, setSelectedRound] = useState<string>('all');
  const [maxRounds, setMaxRounds] = useState(0);
  const [activeTab, setActiveTab] = useState<'all' | 'golden-boot' | 'golden-glove' | 'golden-ball' | 'top-20' | 'by-week'>('all');
  const [selectedWeek, setSelectedWeek] = useState<number>(1);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'committee_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  // Fetch max rounds
  useEffect(() => {
    const fetchMaxRounds = async () => {
      if (!selectedTournamentId) return;
      
      try {
        const response = await fetchWithTokenRefresh(`/api/fixtures/season?tournament_id=${selectedTournamentId}`);
        const result = await response.json();
        
        if (result.fixtures && result.fixtures.length > 0) {
          const maxRound = Math.max(...result.fixtures.map((f: any) => f.round_number || 0));
          setMaxRounds(maxRound);
        }
      } catch (err) {
        console.error('Error fetching rounds:', err);
      }
    };
    
    fetchMaxRounds();
  }, [selectedTournamentId]);

  // Load player stats
  useEffect(() => {
    const loadStats = async () => {
      if (!selectedTournamentId || !userSeasonId) return;
      
      setIsLoading(true);
      try {
        let url = `/api/committee/player-stats-by-round?tournament_id=${selectedTournamentId}&season_id=${userSeasonId}`;
        
        if (activeTab === 'by-week') {
          // For week view, calculate round range
          const startRound = (selectedWeek - 1) * 7 + 1;
          const endRound = selectedWeek * 7;
          url += `&round_number=${endRound}`; // Use cumulative up to end of week
        } else {
          url += `&round_number=${selectedRound}`;
        }
        
        const response = await fetchWithTokenRefresh(url);
        
        if (response.ok) {
          const data = await response.json();
          setPlayerStats(data.players || []);
        }
      } catch (error) {
        console.error('Error loading player stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();
  }, [selectedTournamentId, userSeasonId, selectedRound, activeTab, selectedWeek]);

  // Filter players based on active tab
  let filteredPlayers = playerStats.filter((player) =>
    player.player_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    player.team_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Apply tab filters
  if (activeTab === 'golden-boot') {
    filteredPlayers = filteredPlayers
      .filter(p => p.goals_scored > 0)
      .map(player => ({
        ...player,
        goals_per_match: player.matches_played > 0 
          ? Math.round((player.goals_scored / player.matches_played) * 100) / 100 
          : 0
      }))
      .sort((a: any, b: any) => {
        // Sort by goals first, then by goals per match ratio
        if (b.goals_scored !== a.goals_scored) {
          return b.goals_scored - a.goals_scored;
        }
        return b.goals_per_match - a.goals_per_match;
      })
      .slice(0, 10);
  } else if (activeTab === 'golden-glove') {
    filteredPlayers = filteredPlayers
      .filter(p => p.matches_played > 0)
      .map(player => ({
        ...player,
        clean_sheet_ratio: player.matches_played > 0 
          ? Math.round((player.clean_sheets / player.matches_played) * 100) 
          : 0
      }))
      .sort((a: any, b: any) => {
        // Sort by clean sheets first, then by clean sheet ratio, then by fewest goals conceded
        if (b.clean_sheets !== a.clean_sheets) {
          return b.clean_sheets - a.clean_sheets;
        }
        if (b.clean_sheet_ratio !== a.clean_sheet_ratio) {
          return b.clean_sheet_ratio - a.clean_sheet_ratio;
        }
        return a.goals_conceded - b.goals_conceded;
      })
      .slice(0, 10);
  } else if (activeTab === 'golden-ball') {
    // Golden Ball: Best overall players based on multiple criteria
    // Scoring system: Points (40%), Goals (20%), Win Rate (20%), MOTM (10%), Clean Sheets (10%)
    filteredPlayers = filteredPlayers
      .filter(p => p.matches_played >= 3) // Minimum 3 matches played
      .map(player => {
        // Normalize each stat to 0-100 scale
        const maxPoints = Math.max(...playerStats.map(p => p.points));
        const maxGoals = Math.max(...playerStats.map(p => p.goals_scored));
        const maxMotm = Math.max(...playerStats.map(p => p.motm_awards));
        const maxCleanSheets = Math.max(...playerStats.map(p => p.clean_sheets));
        
        const pointsScore = maxPoints > 0 ? (player.points / maxPoints) * 100 : 0;
        const goalsScore = maxGoals > 0 ? (player.goals_scored / maxGoals) * 100 : 0;
        const winRateScore = player.win_rate; // Already 0-100
        const motmScore = maxMotm > 0 ? (player.motm_awards / maxMotm) * 100 : 0;
        const cleanSheetScore = maxCleanSheets > 0 ? (player.clean_sheets / maxCleanSheets) * 100 : 0;
        
        // Weighted average
        const overallScore = (
          pointsScore * 0.40 +
          goalsScore * 0.20 +
          winRateScore * 0.20 +
          motmScore * 0.10 +
          cleanSheetScore * 0.10
        );
        
        return {
          ...player,
          overallScore: Math.round(overallScore * 10) / 10
        };
      })
      .sort((a: any, b: any) => b.overallScore - a.overallScore)
      .slice(0, 20);
  } else if (activeTab === 'top-20') {
    filteredPlayers = filteredPlayers
      .sort((a, b) => b.points - a.points)
      .slice(0, 20);
  }

  const exportToExcel = async () => {
    try {
      const XLSX = await import('xlsx');
      
      const exportData = filteredPlayers.map((player, index) => ({
        'Rank': index + 1,
        'Player Name': player.player_name,
        'Team': player.team_name,
        'Points': player.points,
        'Matches Played': player.matches_played,
        'Wins': player.wins,
        'Draws': player.draws,
        'Losses': player.losses,
        'Goals Scored': player.goals_scored,
        'Goals Conceded': player.goals_conceded,
        'Goal Difference': player.goal_difference,
        'Clean Sheets': player.clean_sheets,
        'MOTM Awards': player.motm_awards,
        'Win Rate (%)': player.win_rate.toFixed(1),
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      
      const sheetName = selectedRound === 'all' 
        ? 'All Rounds' 
        : `Rounds 1-${selectedRound}`;
      
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      
      const fileName = selectedRound === 'all'
        ? `player_stats_all_rounds_${new Date().toISOString().split('T')[0]}.xlsx`
        : `player_stats_rounds_1_to_${selectedRound}_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      XLSX.writeFile(workbook, fileName);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Failed to export to Excel');
    }
  };

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading player statistics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/dashboard/committee"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </Link>

          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            📊 Player Statistics by Round
          </h1>
          <p className="text-gray-600">View cumulative player performance up to any round</p>
        </div>

        {/* Tournament Selector */}
        <div className="mb-6">
          <TournamentSelector />
        </div>

        {/* Round Selector (hidden for By Week tab) */}
        {activeTab !== 'by-week' && (
          <div className="mb-6 bg-white rounded-xl shadow-lg p-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Select Round (Cumulative Stats)
            </label>
            <p className="text-xs text-gray-500 mb-3">
              Shows cumulative statistics from Round 1 up to the selected round
            </p>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setSelectedRound('all')}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  selectedRound === 'all'
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All Rounds
              </button>
              {Array.from({ length: maxRounds }, (_, i) => i + 1).map((round) => (
                <button
                  key={round}
                  onClick={() => setSelectedRound(round.toString())}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                    selectedRound === round.toString()
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Up to R{round}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 flex gap-2 flex-wrap">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              activeTab === 'all'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            All Players
          </button>
          <button
            onClick={() => setActiveTab('by-week')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              activeTab === 'by-week'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            📅 By Week
          </button>
          <button
            onClick={() => setActiveTab('golden-boot')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              activeTab === 'golden-boot'
                ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            ⚽ Golden Boot
          </button>
          <button
            onClick={() => setActiveTab('golden-glove')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              activeTab === 'golden-glove'
                ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            🧤 Golden Glove
          </button>
          <button
            onClick={() => setActiveTab('golden-ball')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              activeTab === 'golden-ball'
                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            ⚡ Golden Ball
          </button>
          <button
            onClick={() => setActiveTab('top-20')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              activeTab === 'top-20'
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            🏆 Top 20
          </button>
        </div>

        {/* Week Selector (only for By Week tab) */}
        {activeTab === 'by-week' && (
          <div className="mb-6 bg-gradient-to-r from-cyan-50 to-blue-50 rounded-xl shadow-lg p-4 border-2 border-cyan-200">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Select Week (7 rounds per week)
            </label>
            <div className="flex gap-2 flex-wrap">
              {Array.from({ length: Math.ceil(maxRounds / 7) }, (_, i) => i + 1).map((week) => {
                const startRound = (week - 1) * 7 + 1;
                const endRound = Math.min(week * 7, maxRounds);
                return (
                  <button
                    key={week}
                    onClick={() => setSelectedWeek(week)}
                    className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                      selectedWeek === week
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg'
                        : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    Week {week}
                    <span className="block text-xs opacity-80">R{startRound}-{endRound}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Search and Export */}
        <div className="mb-6 flex gap-4">
          {activeTab === 'all' && (
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Search players or teams..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-3 pl-12 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <svg className="w-5 h-5 text-gray-400 absolute left-4 top-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          )}
          {activeTab !== 'all' && <div className="flex-1"></div>}
          <button
            onClick={exportToExcel}
            disabled={filteredPlayers.length === 0}
            className="px-6 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-colors flex items-center gap-2 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export Excel
          </button>
        </div>

        {/* Stats Table */}
        <div className="bg-white rounded-xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase">Rank</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase">Player</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase">Team</th>
                  {activeTab === 'golden-ball' && (
                    <th className="px-4 py-3 text-center text-xs font-bold uppercase">Score</th>
                  )}
                  {activeTab === 'golden-boot' && (
                    <th className="px-4 py-3 text-center text-xs font-bold uppercase">G/M</th>
                  )}
                  {activeTab === 'golden-glove' && (
                    <th className="px-4 py-3 text-center text-xs font-bold uppercase">CS%</th>
                  )}
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase">Pts</th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase">MP</th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase">W</th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase">D</th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase">L</th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase">GF</th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase">GA</th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase">GD</th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase">CS</th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase">MOTM</th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase">Win%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredPlayers.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="px-4 py-12 text-center text-gray-500">
                      No player data available for this round
                    </td>
                  </tr>
                ) : (
                  filteredPlayers.map((player, index) => (
                    <tr key={player.player_id} className="hover:bg-blue-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                          {index + 1}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-900">{player.player_name}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{player.team_name}</td>
                      {activeTab === 'golden-ball' && (
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-700">
                            {(player as any).overallScore}
                          </span>
                        </td>
                      )}
                      {activeTab === 'golden-boot' && (
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700">
                            {(player as any).goals_per_match}
                          </span>
                        </td>
                      )}
                      {activeTab === 'golden-glove' && (
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                            {(player as any).clean_sheet_ratio}%
                          </span>
                        </td>
                      )}
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-blue-100 text-blue-700">
                          {player.points}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-900">{player.matches_played}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                          {player.wins}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700">
                          {player.draws}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
                          {player.losses}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                          ⚽ {player.goals_scored}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-600">{player.goals_conceded}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-bold ${
                          player.goal_difference > 0 ? 'text-green-600' : 
                          player.goal_difference < 0 ? 'text-red-600' : 
                          'text-gray-600'
                        }`}>
                          {player.goal_difference > 0 ? '+' : ''}{player.goal_difference}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                          🛡️ {player.clean_sheets}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                          ⭐ {player.motm_awards}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm font-semibold text-gray-900">
                        {player.win_rate}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary */}
        <div className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border-2 border-blue-200">
          <p className="text-sm text-gray-700">
            <span className="font-semibold">{filteredPlayers.length}</span> players shown
            {activeTab === 'by-week' && ` • Week ${selectedWeek} (Rounds ${(selectedWeek - 1) * 7 + 1}-${Math.min(selectedWeek * 7, maxRounds)})`}
            {activeTab === 'golden-boot' && ' • Top 10 goal scorers (sorted by goals, then goals/match ratio)'}
            {activeTab === 'golden-glove' && ' • Top 10 clean sheet leaders (sorted by clean sheets, then CS%, then fewest GA)'}
            {activeTab === 'golden-ball' && ' • Top 20 best overall players (min. 3 matches)'}
            {activeTab === 'top-20' && ' • Top 20 by points'}
            {activeTab !== 'by-week' && selectedRound !== 'all' && ` • Cumulative stats from Round 1 to Round ${selectedRound}`}
            {activeTab !== 'by-week' && selectedRound === 'all' && ` • All rounds (complete season)`}
          </p>
          {activeTab === 'golden-ball' && (
            <p className="text-xs text-gray-600 mt-2">
              Scoring: Points (40%) • Goals (20%) • Win Rate (20%) • MOTM (10%) • Clean Sheets (10%)
            </p>
          )}
          {activeTab === 'golden-boot' && (
            <p className="text-xs text-gray-600 mt-2">
              G/M = Goals per Match ratio
            </p>
          )}
          {activeTab === 'golden-glove' && (
            <p className="text-xs text-gray-600 mt-2">
              CS% = Clean Sheet percentage (clean sheets / matches played × 100)
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
