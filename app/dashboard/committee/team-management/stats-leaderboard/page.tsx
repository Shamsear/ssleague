'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useTournamentContext } from '@/contexts/TournamentContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { db } from '@/lib/firebase/config';
import { collection, query, getDocs } from 'firebase/firestore';
import { usePermissions } from '@/hooks/usePermissions';
import { usePlayerStats, useTeamStats } from '@/hooks';
import { useTournament } from '@/hooks/useTournaments';
import TournamentSelector from '@/components/TournamentSelector';

interface PlayerStats {
  player_id: string;
  name: string;
  team_name: string;
  matches_played: number;
  wins: number;
  draws: number;
  losses: number;
  goals: number;
  assists: number;
  clean_sheets: number;
  potm: number;
  win_rate: number;
  average_rating: number;
}

interface TeamStats {
  team_id: string;
  team_name: string;
  matches_played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
}

type TabType = 'players' | 'teams';

export default function StatsLeaderboardPage() {
  const { user, loading } = useAuth();
  const { selectedTournamentId } = useTournamentContext();
  const { userSeasonId } = usePermissions();
  const router = useRouter();
  
  // Get tournament info for display
  const { data: tournament } = useTournament(selectedTournamentId);
  
  const [activeTab, setActiveTab] = useState<TabType>('teams');
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([]);
  const [teamStats, setTeamStats] = useState<TeamStats[]>([]);
  
  // Use React Query hooks for stats from Neon - now tournament-aware
  const { data: playerStatsData, isLoading: playerStatsLoading } = usePlayerStats({
    tournamentId: selectedTournamentId,
    seasonId: userSeasonId || '' // Fallback for backward compatibility
  });
  
  const { data: teamStatsData, isLoading: teamStatsLoading } = useTeamStats({
    tournamentId: selectedTournamentId,
    seasonId: userSeasonId || '' // Fallback for backward compatibility
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'committee_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const fetchStats = async () => {
      if (!user || user.role !== 'committee_admin' || !userSeasonId) return;

      try {
        setIsLoading(true);

        // Fetch all realplayer to get team assignments
        const realPlayersQuery = query(collection(db, 'realplayer'));
        const realPlayersSnapshot = await getDocs(realPlayersQuery);
        const playersTeamMap = new Map();
        realPlayersSnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.player_id) {
            // Use team_name directly from realplayer collection
            const teamName = data.team_name || 'Unassigned';
            playersTeamMap.set(data.player_id, teamName);
          }
        });
        
        // Player stats now come from React Query hook (Neon)
        // Processing happens in separate useEffect

        // Team stats now come from React Query hook (Neon)
        
        // Fetch all teams to get team names
        const teamsQuery = query(collection(db, 'teams'));
        const teamsSnapshot = await getDocs(teamsQuery);
        const teamsMap = new Map();
        teamsSnapshot.forEach((doc) => {
          const data = doc.data();
          teamsMap.set(doc.id, data.name || data.team_name || 'Unknown Team');
        });
        
        const teams: TeamStats[] = [];
        teamStatsSnapshot.forEach((doc) => {
          const data = doc.data();
          const wins = data.wins || 0;
          const draws = data.draws || 0;
          const points = (wins * 3) + (draws * 1);
          
          teams.push({
            team_id: data.team_id,
            team_name: teamsMap.get(data.team_id) || 'Unknown Team',
            matches_played: data.matches_played || 0,
            wins,
            draws,
            losses: data.losses || 0,
            goals_for: data.goals_for || 0,
            goals_against: data.goals_against || 0,
            goal_difference: data.goal_difference || 0,
            points,
          });
        });

        // Sort by points, then goal difference, then goals for
        teams.sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points;
          if (b.goal_difference !== a.goal_difference) return b.goal_difference - a.goal_difference;
          return b.goals_for - a.goals_for;
        });

        setTeamStats(teams);
      } catch (error) {
        console.error('Error fetching team names:', error);
      }
    };

    fetchStats();
  }, [user, userSeasonId]);

  // Process player stats data from Neon when it arrives
  useEffect(() => {
    if (!playerStatsData || playerStatsData.length === 0) return;
    
    const players: PlayerStats[] = playerStatsData.map((data: any) => {
      const winRate = data.matches_played > 0 ? (data.wins / data.matches_played) * 100 : 0;
      
      return {
        player_id: data.player_id,
        name: data.player_name,
        team_name: data.team || data.team_name || 'Unassigned',
        matches_played: data.matches_played || 0,
        wins: data.wins || 0,
        draws: data.draws || 0,
        losses: data.losses || 0,
        goals: data.goals_scored || 0,
        assists: data.assists || 0,
        clean_sheets: data.clean_sheets || 0,
        potm: data.motm_awards || 0,
        win_rate: winRate,
        average_rating: 0,
      };
    });

    // Sort by matches played descending
    players.sort((a, b) => b.matches_played - a.matches_played);
    setPlayerStats(players);
  }, [playerStatsData]);

  // Process team stats data from Neon when it arrives
  useEffect(() => {
    if (!teamStatsData || teamStatsData.length === 0) return;
    
    const teams: TeamStats[] = teamStatsData.map((data: any) => {
      const wins = data.wins || 0;
      const draws = data.draws || 0;
      const points = data.points || ((wins * 3) + (draws * 1));
      
      return {
        team_id: data.team_id,
        team_name: data.team_name || 'Unknown Team',
        matches_played: data.matches_played || 0,
        wins,
        draws,
        losses: data.losses || 0,
        goals_for: data.goals_for || 0,
        goals_against: data.goals_against || 0,
        goal_difference: data.goal_difference || 0,
        points,
      };
    });

    // Sort by points, then goal difference, then goals for
    teams.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goal_difference !== a.goal_difference) return b.goal_difference - a.goal_difference;
      return b.goals_for - a.goals_for;
    });

    setTeamStats(teams);
  }, [teamStatsData]);

  if (loading || playerStatsLoading || teamStatsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading stats...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'committee_admin') {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold gradient-text">Stats & Leaderboard</h1>
          <p className="text-gray-500 mt-1">Player statistics and team standings</p>
          <Link
            href="/dashboard/committee/team-management"
            className="inline-flex items-center text-[#0066FF] hover:text-[#0052CC] text-sm mt-2"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Team Management
          </Link>
        </div>
        <div>
          <TournamentSelector />
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('teams')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'teams'
                  ? 'border-[#0066FF] text-[#0066FF]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Team Standings ({teamStats.length})
              </span>
            </button>
            <button
              onClick={() => setActiveTab('players')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'players'
                  ? 'border-[#0066FF] text-[#0066FF]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Player Stats ({playerStats.length})
              </span>
            </button>
          </nav>
        </div>
      </div>

      {/* Team Standings Tab */}
      {activeTab === 'teams' && (
        <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl overflow-hidden border border-gray-100/20">
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <h2 className="text-xl font-bold text-gray-900">Team Standings</h2>
            <p className="text-sm text-gray-600 mt-1">Season rankings based on points, goal difference, and goals scored</p>
          </div>

          {teamStats.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-600 mb-2">No Team Stats</h3>
              <p className="text-sm">Teams stats will appear once matches are completed</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">MP</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">W</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">D</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">L</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">GF</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">GA</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">GD</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider font-bold">PTS</th>
                  </tr>
                </thead>
                <tbody className="bg-white/60 divide-y divide-gray-200/50">
                  {teamStats.map((team, index) => (
                    <tr key={team.team_id} className={`hover:bg-blue-50/50 transition-colors ${index < 3 ? 'bg-green-50/30' : ''}`}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                        {index === 0 && <span className="text-2xl">🥇</span>}
                        {index === 1 && <span className="text-2xl">🥈</span>}
                        {index === 2 && <span className="text-2xl">🥉</span>}
                        {index > 2 && `#${index + 1}`}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-gray-900">{team.team_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600">{team.matches_played}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-semibold text-green-600">{team.wins}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600">{team.draws}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-semibold text-red-600">{team.losses}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">{team.goals_for}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">{team.goals_against}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`text-sm font-semibold ${team.goal_difference > 0 ? 'text-green-600' : team.goal_difference < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                          {team.goal_difference > 0 ? '+' : ''}{team.goal_difference}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-blue-100 text-blue-800">
                          {team.points}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Player Stats Tab */}
      {activeTab === 'players' && (
        <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl overflow-hidden border border-gray-100/20">
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50">
            <h2 className="text-xl font-bold text-gray-900">Player Statistics</h2>
            <p className="text-sm text-gray-600 mt-1">Individual player performance metrics</p>
          </div>

          {playerStats.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-600 mb-2">No Player Stats</h3>
              <p className="text-sm">Player statistics will appear once matches are completed</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Player</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">MP</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">W</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">D</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">L</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Goals</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Assists</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">CS</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">POTM</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Win %</th>
                  </tr>
                </thead>
                <tbody className="bg-white/60 divide-y divide-gray-200/50">
                  {playerStats.map((player) => (
                    <tr key={player.player_id} className="hover:bg-purple-50/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-gray-900">{player.name}</div>
                        <div className="text-xs text-gray-500">{player.player_id}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{player.team_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium text-gray-900">{player.matches_played}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-semibold text-green-600">{player.wins}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600">{player.draws}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-semibold text-red-600">{player.losses}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          ⚽ {player.goals}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          🎯 {player.assists}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          🛡️ {player.clean_sheets}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          ⭐ {player.potm}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`text-sm font-semibold ${player.win_rate >= 50 ? 'text-green-600' : 'text-gray-600'}`}>
                          {player.win_rate.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-xs text-blue-800 font-medium mb-2">📊 Legend</p>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 text-xs text-blue-700">
          <div><strong>MP</strong> = Matches Played</div>
          <div><strong>W</strong> = Wins</div>
          <div><strong>D</strong> = Draws</div>
          <div><strong>L</strong> = Losses</div>
          <div><strong>GF</strong> = Goals For</div>
          <div><strong>GA</strong> = Goals Against</div>
          <div><strong>GD</strong> = Goal Difference</div>
          <div><strong>PTS</strong> = Points (3 for win, 1 for draw)</div>
          <div><strong>CS</strong> = Clean Sheets</div>
          <div><strong>POTM</strong> = Player of the Match</div>
          <div><strong>Win %</strong> = Win Percentage</div>
        </div>
      </div>
    </div>
  );
}
