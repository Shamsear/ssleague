'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useTournamentContext } from '@/contexts/TournamentContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { db } from '@/lib/firebase/config';
import { collection, query, getDocs } from 'firebase/firestore';
import { usePermissions } from '@/hooks/usePermissions';
import { useTeamStats } from '@/hooks';
import { useTournament } from '@/hooks/useTournaments';
import TournamentSelector from '@/components/TournamentSelector';

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

export default function TeamStandingsPage() {
  const { user, loading } = useAuth();
  const { selectedTournamentId } = useTournamentContext();
  const { userSeasonId } = usePermissions();
  const router = useRouter();
  
  // Get tournament info for display
  const { data: tournament } = useTournament(selectedTournamentId);
  
  const [teamStats, setTeamStats] = useState<TeamStats[]>([]);
  
  // Use React Query hook for team stats from Neon - now uses tournamentId
  const { data: teamStatsData, isLoading: statsLoading } = useTeamStats({
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
    const fetchTeamStats = async () => {
      if (!user || user.role !== 'committee_admin' || !userSeasonId) return;

      try {
        // Fetch teams for name mapping only
        
        // Fetch all teams to get team names
        const teamsQuery = query(collection(db, 'teams'));
        const teamsSnapshot = await getDocs(teamsQuery);
        const teamsMap = new Map();
        teamsSnapshot.forEach((doc) => {
          const data = doc.data();
          teamsMap.set(doc.id, data.name || data.team_name || 'Unknown Team');
        });
        
        // Store teams map for later use
        (window as any).teamsMap = teamsMap;
      } catch (error) {
        console.error('Error fetching team stats:', error);
      }
    };

    fetchTeamStats();
  }, [user, userSeasonId]);

  // Process team stats data from Neon when it arrives
  useEffect(() => {
    if (!teamStatsData || teamStatsData.length === 0) return;
    
    const teamsMap = (window as any).teamsMap || new Map();
    
    const teams: TeamStats[] = teamStatsData.map((data: any) => {
      const wins = data.wins || 0;
      const draws = data.draws || 0;
      const points = data.points || ((wins * 3) + (draws * 1));
      
      return {
        team_id: data.team_id,
        team_name: data.team_name || teamsMap.get(data.team_id) || 'Unknown Team',
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

  if (loading || statsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading team standings...</p>
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
          <h1 className="text-3xl md:text-4xl font-bold gradient-text">Team Standings</h1>
          <p className="text-gray-500 mt-1">Season rankings and league table</p>
          <div className="flex gap-4 mt-2">
            <Link
              href="/dashboard/committee/team-management"
              className="inline-flex items-center text-[#0066FF] hover:text-[#0052CC] text-sm"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Team Management
            </Link>
            <Link
              href="/dashboard/committee/team-management/player-stats"
              className="inline-flex items-center text-purple-600 hover:text-purple-700 text-sm font-medium"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              View Player Stats →
            </Link>
          </div>
        </div>
        <div>
          <TournamentSelector />
        </div>
      </div>

      {/* Team Standings Table */}
      <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl overflow-hidden border border-gray-100/20">
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-gray-900">League Table</h2>
              <p className="text-sm text-gray-600 mt-1">Ranked by points, goal difference, and goals scored</p>
            </div>
            <div className="text-sm text-gray-600">
              <span className="font-semibold">{teamStats.length}</span> Teams
            </div>
          </div>
        </div>

        {teamStats.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-600 mb-2">No Team Stats Available</h3>
            <p className="text-sm">Team standings will appear once matches are completed</p>
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
                      <div className="text-xs text-gray-500">{team.team_id}</div>
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

      {/* Legend */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-xs text-blue-800 font-medium mb-2">📊 Legend</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs text-blue-700">
          <div><strong>MP</strong> = Matches Played</div>
          <div><strong>W</strong> = Wins</div>
          <div><strong>D</strong> = Draws</div>
          <div><strong>L</strong> = Losses</div>
          <div><strong>GF</strong> = Goals For</div>
          <div><strong>GA</strong> = Goals Against</div>
          <div><strong>GD</strong> = Goal Difference</div>
          <div><strong>PTS</strong> = Points (3 for win, 1 for draw)</div>
        </div>
      </div>

      {/* Championship Info */}
      {teamStats.length > 0 && teamStats[0].matches_played > 0 && (
        <div className="mt-6 bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-xl p-6">
          <div className="flex items-center gap-3">
            <span className="text-4xl">🏆</span>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Current Leader</h3>
              <p className="text-2xl font-extrabold text-yellow-600 mt-1">{teamStats[0].team_name}</p>
              <p className="text-sm text-gray-600 mt-1">
                {teamStats[0].points} points • {teamStats[0].wins} wins • GD: {teamStats[0].goal_difference > 0 ? '+' : ''}{teamStats[0].goal_difference}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
