'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useTournamentContext } from '@/contexts/TournamentContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { db } from '@/lib/firebase/config';
import { collection, query, getDocs } from 'firebase/firestore';
import { usePermissions } from '@/hooks/usePermissions';
import { usePlayerStats } from '@/hooks';
import { useTournament } from '@/hooks/useTournaments';
import TournamentSelector from '@/components/TournamentSelector';

interface PlayerAward {
  player_id: string;
  name: string;
  team_name: string;
  category_name: string;
  matches_played: number;
  wins: number;
  draws: number;
  losses: number;
  goals: number;
  clean_sheets: number;
  potm: number;
  win_rate: number;
  points: number;
}

type AwardType = 'golden-boot' | 'golden-glove' | 'golden-ball' | 'legend-category' | 'classic-category' | 'overall';

export default function PlayerAwardsPage() {
  const { user, loading } = useAuth();
  const { selectedTournamentId } = useTournamentContext();
  const { userSeasonId } = usePermissions();
  const router = useRouter();
  
  // Get tournament info for display
  const { data: tournament } = useTournament(selectedTournamentId);
  
  const [activeTab, setActiveTab] = useState<AwardType>('golden-boot');
  const [players, setPlayers] = useState<PlayerAward[]>([]);
  
  // Use React Query hook for player stats from Neon - now tournament-aware
  const { data: playerStatsData, isLoading: statsLoading } = usePlayerStats({
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
    const fetchPlayerAwards = async () => {
      if (!user || user.role !== 'committee_admin' || !userSeasonId) return;

      try {
        // Fetch all realplayer to get team and category assignments
        const realPlayersQuery = query(collection(db, 'realplayer'));
        const realPlayersSnapshot = await getDocs(realPlayersQuery);
        const playersInfoMap = new Map();
        
        realPlayersSnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.player_id) {
            playersInfoMap.set(data.player_id, {
              team_name: data.team_name || 'Unassigned',
              category_name: data.category_name || 'Unknown',
              points: data.points || 0
            });
          }
        });

        // Store players info map for later use
        (window as any).playersInfoMap = playersInfoMap;
      } catch (error) {
        console.error('Error fetching player info:', error);
      }
    };

    fetchPlayerAwards();
  }, [user, userSeasonId]);

  // Process player stats data from Neon when it arrives
  useEffect(() => {
    if (!playerStatsData || playerStatsData.length === 0) return;
    
    const playersInfoMap = (window as any).playersInfoMap || new Map();
    
    const playersData: PlayerAward[] = playerStatsData.map((data: any) => {
      const playerInfo = playersInfoMap.get(data.player_id) || {};
      const winRate = data.matches_played > 0 ? (data.wins / data.matches_played) * 100 : 0;
      
      return {
        player_id: data.player_id,
        name: data.player_name,
        team_name: data.team || data.team_name || playerInfo.team_name || 'Unassigned',
        category_name: data.category || playerInfo.category_name || 'Unknown',
        matches_played: data.matches_played || 0,
        wins: data.wins || 0,
        draws: data.draws || 0,
        losses: data.losses || 0,
        goals: data.goals_scored || 0,
        clean_sheets: data.clean_sheets || 0,
        potm: data.motm_awards || 0,
        win_rate: winRate,
        points: data.points || playerInfo.points || 0,
      };
    });
    
    setPlayers(playersData);
  }, [playerStatsData]);

  if (loading || statsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading player awards...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'committee_admin') {
    return null;
  }

  // Filter and sort players based on award type
  const getFilteredPlayers = (awardType: AwardType) => {
    let filtered = [...players];
    
    switch (awardType) {
      case 'golden-boot':
        // Top goal scorers (minimum 1 goal)
        filtered = filtered
          .filter(p => p.goals > 0)
          .sort((a, b) => {
            if (b.goals !== a.goals) return b.goals - a.goals;
            return b.matches_played - a.matches_played; // Tie-breaker: more matches played
          });
        break;
        
      case 'golden-glove':
        // Most clean sheets (minimum 1 match)
        filtered = filtered
          .filter(p => p.matches_played > 0)
          .sort((a, b) => {
            if (b.clean_sheets !== a.clean_sheets) return b.clean_sheets - a.clean_sheets;
            return a.goals - b.goals; // Tie-breaker: fewer goals conceded per match
          });
        break;
        
      case 'golden-ball':
        // Most POTM awards
        filtered = filtered
          .filter(p => p.potm > 0)
          .sort((a, b) => {
            if (b.potm !== a.potm) return b.potm - a.potm;
            return b.win_rate - a.win_rate; // Tie-breaker: higher win rate
          });
        break;
        
      case 'legend-category':
        // Legend category players sorted by points
        filtered = filtered
          .filter(p => p.category_name?.toLowerCase().includes('legend'))
          .sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            return b.win_rate - a.win_rate;
          });
        break;
        
      case 'classic-category':
        // Classic category players sorted by points
        filtered = filtered
          .filter(p => p.category_name?.toLowerCase().includes('classic'))
          .sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            return b.win_rate - a.win_rate;
          });
        break;
        
      case 'overall':
        // Overall ranking by points, then win rate
        filtered = filtered
          .filter(p => p.matches_played > 0)
          .sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.win_rate !== a.win_rate) return b.win_rate - a.win_rate;
            return b.matches_played - a.matches_played;
          });
        break;
    }
    
    return filtered.slice(0, 20); // Top 20 for each category
  };

  const filteredPlayers = getFilteredPlayers(activeTab);

  const getAwardIcon = (awardType: AwardType) => {
    switch (awardType) {
      case 'golden-boot': return '⚽';
      case 'golden-glove': return '🧤';
      case 'golden-ball': return '⭐';
      case 'legend-category': return '👑';
      case 'classic-category': return '🎖️';
      case 'overall': return '🏆';
      default: return '🏅';
    }
  };

  const getAwardTitle = (awardType: AwardType) => {
    switch (awardType) {
      case 'golden-boot': return 'Golden Boot';
      case 'golden-glove': return 'Golden Glove';
      case 'golden-ball': return 'Golden Ball';
      case 'legend-category': return 'Legend Category';
      case 'classic-category': return 'Classic Category';
      case 'overall': return 'Overall Ranking';
      default: return 'Awards';
    }
  };

  const getAwardDescription = (awardType: AwardType) => {
    switch (awardType) {
      case 'golden-boot': return 'Top goal scorers this season';
      case 'golden-glove': return 'Most clean sheets (defensive excellence)';
      case 'golden-ball': return 'Most Player of the Match awards';
      case 'legend-category': return 'Top performers in Legend category';
      case 'classic-category': return 'Top performers in Classic category';
      case 'overall': return 'Overall player rankings by performance';
      default: return '';
    }
  };

  const getPrimaryMetric = (player: PlayerAward, awardType: AwardType) => {
    switch (awardType) {
      case 'golden-boot': return `${player.goals} Goals`;
      case 'golden-glove': return `${player.clean_sheets} Clean Sheets`;
      case 'golden-ball': return `${player.potm} POTM`;
      case 'legend-category': return `${player.points} Points`;
      case 'classic-category': return `${player.points} Points`;
      case 'overall': return `${player.points} Points`;
      default: return '';
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold gradient-text">Player Awards</h1>
          <p className="text-gray-500 mt-1">Golden Boot, Golden Glove, Golden Ball & Category Rankings</p>
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              View All Stats →
            </Link>
          </div>
        </div>
        <div>
          <TournamentSelector />
        </div>
      </div>

      {/* Award Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-1 overflow-x-auto">
            {(['golden-boot', 'golden-glove', 'golden-ball', 'legend-category', 'classic-category', 'overall'] as AwardType[]).map((award) => (
              <button
                key={award}
                onClick={() => setActiveTab(award)}
                className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
                  activeTab === award
                    ? 'border-[#0066FF] text-[#0066FF]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="text-lg">{getAwardIcon(award)}</span>
                {getAwardTitle(award)}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Award Table */}
      <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl overflow-hidden border border-gray-100/20">
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-yellow-50 to-amber-50">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{getAwardIcon(activeTab)}</span>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{getAwardTitle(activeTab)}</h2>
              <p className="text-sm text-gray-600">{getAwardDescription(activeTab)}</p>
            </div>
          </div>
        </div>

        {filteredPlayers.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <span className="text-6xl mb-4 block">{getAwardIcon(activeTab)}</span>
            <h3 className="text-lg font-medium text-gray-600 mb-2">No {getAwardTitle(activeTab)} Contenders</h3>
            <p className="text-sm">Complete more matches to see award contenders</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Player</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Primary Metric</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">MP</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Win %</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Goals</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">CS</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">POTM</th>
                </tr>
              </thead>
              <tbody className="bg-white/60 divide-y divide-gray-200/50">
                {filteredPlayers.map((player, index) => (
                  <tr key={player.player_id} className={`hover:bg-yellow-50/50 transition-colors ${index < 3 ? 'bg-yellow-50/30' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                      {index === 0 && <span className="text-2xl">🥇</span>}
                      {index === 1 && <span className="text-2xl">🥈</span>}
                      {index === 2 && <span className="text-2xl">🥉</span>}
                      {index > 2 && `#${index + 1}`}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-gray-900">{player.name}</div>
                      <div className="text-xs text-gray-500">{player.player_id}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{player.team_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        player.category_name?.toLowerCase().includes('legend') 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {player.category_name}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-yellow-100 text-yellow-800">
                        {getPrimaryMetric(player, activeTab)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium text-gray-900">{player.matches_played}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`text-sm font-semibold ${player.win_rate >= 50 ? 'text-green-600' : 'text-gray-600'}`}>
                        {player.win_rate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">⚽ {player.goals}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">🛡️ {player.clean_sheets}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">⭐ {player.potm}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Awards Info */}
      <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">🏆</span>
          <div>
            <h3 className="text-sm font-semibold text-yellow-800 mb-2">Award Criteria</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs text-yellow-700">
              <div><strong>Golden Boot ⚽:</strong> Most goals scored</div>
              <div><strong>Golden Glove 🧤:</strong> Most clean sheets</div>
              <div><strong>Golden Ball ⭐:</strong> Most POTM awards</div>
              <div><strong>Legend 👑:</strong> Top Legend category players</div>
              <div><strong>Classic 🎖️:</strong> Top Classic category players</div>
              <div><strong>Overall 🏆:</strong> Best overall performance</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
