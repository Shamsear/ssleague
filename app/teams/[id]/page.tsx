'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import Link from 'next/link';
import Image from 'next/image';
import { usePlayerStats, useFixtures } from '@/hooks';

interface TeamData {
  id: string;
  team_id: string;
  team_name: string;
  owner_name?: string;
  logo_url?: string;
  rank?: number;
  points?: number;
  matches_played?: number;
  wins?: number;
  draws?: number;
  losses?: number;
  goals_scored?: number;
  goals_conceded?: number;
}

interface Player {
  id: string;
  player_id: string;
  name: string;
  display_name?: string;
  category?: string;
  photo_url?: string;
  stats?: any;
}

interface Fixture {
  id: string;
  home_team: string;
  away_team: string;
  home_score?: number;
  away_score?: number;
  status: string;
  match_date?: any;
}

export default function TeamDetailPage() {
  const params = useParams();
  const router = useRouter();
  const teamId = params.id as string;
  const [team, setTeam] = useState<TeamData | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentSeasonId, setCurrentSeasonId] = useState<string>('');
  const [viewMode, setViewMode] = useState<'all-time' | 'season'>('all-time');
  const [seasonBreakdown, setSeasonBreakdown] = useState<any[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [allFixtures, setAllFixtures] = useState<Fixture[]>([]);

  // Use React Query hooks for player stats and fixtures
  const { data: playerStats, isLoading: statsLoading } = usePlayerStats({
    seasonId: currentSeasonId,
    teamId: teamId
  });

  const { data: fixturesData, isLoading: fixturesLoading } = useFixtures({
    seasonId: currentSeasonId,
    teamId: teamId
  });

  useEffect(() => {
    fetchTeamData();
  }, [teamId]);

  const fetchTeamData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check if we're coming from a season context via URL params
      const urlParams = new URLSearchParams(window.location.search);
      const seasonParam = urlParams.get('season');
      
      if (seasonParam) {
        // Season-specific view - Fetch comprehensive season data
        setViewMode('season');
        setCurrentSeasonId(seasonParam);
        
        // Fetch team stats for specific season
        const statsRes = await fetch(`/api/seasons/${seasonParam}/stats`);
        const statsData = await statsRes.json();
        
        if (statsData.success && statsData.data?.teams) {
          const teamStat = statsData.data.teams.find((t: TeamData) => t.team_id === teamId);
          if (teamStat) {
            setTeam(teamStat);
          } else {
            setError('Team not found in this season');
          }
          
          // Set players with season-specific stats
          const seasonPlayers = statsData.data.players?.filter((p: any) => p.team_id === teamId) || [];
          setPlayers(seasonPlayers.map((p: any) => ({
            id: p.player_id,
            player_id: p.player_id,
            name: p.player_name,
            display_name: p.player_name,
            category: p.category,
            stats: {
              matches_played: p.matches_played,
              goals_scored: p.goals_scored,
              clean_sheets: p.clean_sheets,
              points: p.points
            }
          })));
          
          // Fetch season-specific fixtures
          try {
            const fixturesRes = await fetch(
              `/api/tournament/fixtures?seasonId=${seasonParam}&teamId=${teamId}`
            );
            const fixturesData = await fixturesRes.json();
            if (fixturesData.success && fixturesData.data) {
              setAllFixtures(fixturesData.data);
            }
          } catch (err) {
            console.log('Could not fetch fixtures:', err);
          }
        }
      } else {
        // All-time view (default from /teams page) - Fetch comprehensive details
        setViewMode('all-time');
        
        // Fetch current season for context
        const seasonRes = await fetch('/api/public/current-season');
        const seasonData = await seasonRes.json();
        if (seasonData.success) {
          setCurrentSeasonId(seasonData.data.id);
        }
        
        // Fetch comprehensive team details
        const detailsRes = await fetch(`/api/teams/${teamId}/details`);
        const detailsData = await detailsRes.json();
        
        if (detailsData.success && detailsData.data) {
          // Set team with all-time stats
          setTeam({
            ...detailsData.data.team,
            ...detailsData.data.allTimeStats
          });
          
          // Set additional data
          setSeasonBreakdown(detailsData.data.seasonBreakdown || []);
          setAchievements(detailsData.data.achievements || []);
          setAllFixtures(detailsData.data.fixtures || []);
          
          // Set players with aggregated stats
          setPlayers(detailsData.data.players.map((p: any) => ({
            id: p.player_id,
            player_id: p.player_id,
            name: p.player_name,
            display_name: p.player_name,
            category: p.category,
            stats: {
              matches_played: p.total_matches,
              goals_scored: p.total_goals,
              points: p.total_points
            },
            seasons: p.seasons
          })));
        } else {
          setError('Team not found');
        }
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching team data:', error);
      setError('Failed to load team data');
      setLoading(false);
    }
  };

  // Fetch player details from Firebase (master data) when we have stats
  useEffect(() => {
    const fetchPlayerDetails = async () => {
      if (!playerStats || playerStats.length === 0) return;
      
      const playersData: Player[] = [];
      for (const stat of playerStats) {
        try {
          const playerDoc = await getDoc(doc(db, 'realplayers', stat.player_id));
          if (playerDoc.exists()) {
            playersData.push({
              id: playerDoc.id,
              ...playerDoc.data(),
              stats: stat // Include stats from Neon
            } as Player);
          }
        } catch (err) {
          console.error(`Error fetching player ${stat.player_id}:`, err);
        }
      }
      setPlayers(playersData);
    };
    
    fetchPlayerDetails();
  }, [playerStats]);

  if (loading || statsLoading || fixturesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading team...</p>
        </div>
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-gray-900 text-lg font-semibold mb-2">{error}</p>
          <Link href="/teams" className="text-blue-600 hover:text-blue-700">
            ← Back to Teams
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Back Button */}
      <Link
        href="/teams"
        className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-6 font-medium"
      >
        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Teams
      </Link>

      {/* Team Header */}
      <div className="glass rounded-2xl p-6 sm:p-8 mb-8">
        <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
          {/* Team Logo */}
          {team.logo_url && (
            <div className="w-32 h-32 rounded-xl overflow-hidden bg-white flex-shrink-0 p-4">
              <Image
                src={team.logo_url}
                alt={team.team_name}
                width={128}
                height={128}
                className="object-contain"
              />
            </div>
          )}

          {/* Team Info */}
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-3xl sm:text-4xl font-bold mb-2 gradient-text">
              {team.team_name}
            </h1>
            {team.owner_name && (
              <p className="text-gray-600 mb-3">Owner: {team.owner_name}</p>
            )}
            
            <div className="flex flex-wrap gap-3 justify-center sm:justify-start">
              {team.rank && (
                <span className={`px-4 py-2 rounded-lg font-bold ${
                  team.rank === 1 ? 'bg-amber-500 text-white' :
                  team.rank === 2 ? 'bg-gray-300 text-gray-700' :
                  team.rank === 3 ? 'bg-amber-700 text-white' :
                  'bg-blue-100 text-blue-600'
                }`}>
                  Rank #{team.rank}
                </span>
              )}
              <span className="px-4 py-2 rounded-lg bg-blue-500 text-white font-semibold">
                {team.points || 0} Points
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Current Season Stats */}
      <div className="glass rounded-2xl p-6 sm:p-8 mb-8">
        <h2 className="text-2xl font-bold mb-6 text-gray-900">Current Season Statistics</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-blue-50 rounded-xl p-4 text-center">
            <div className="text-2xl sm:text-3xl font-bold text-blue-600 mb-1">
              {team.matches_played || 0}
            </div>
            <div className="text-sm text-gray-600">Matches</div>
          </div>
          <div className="bg-green-50 rounded-xl p-4 text-center">
            <div className="text-2xl sm:text-3xl font-bold text-green-600 mb-1">
              {team.wins || 0}
            </div>
            <div className="text-sm text-gray-600">Wins</div>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 text-center">
            <div className="text-2xl sm:text-3xl font-bold text-gray-600 mb-1">
              {team.draws || 0}
            </div>
            <div className="text-sm text-gray-600">Draws</div>
          </div>
          <div className="bg-red-50 rounded-xl p-4 text-center">
            <div className="text-2xl sm:text-3xl font-bold text-red-600 mb-1">
              {team.losses || 0}
            </div>
            <div className="text-sm text-gray-600">Losses</div>
          </div>
          <div className="bg-purple-50 rounded-xl p-4 text-center">
            <div className="text-2xl sm:text-3xl font-bold text-purple-600 mb-1">
              {team.goals_scored || 0} - {team.goals_conceded || 0}
            </div>
            <div className="text-sm text-gray-600">Goals (F-A)</div>
          </div>
        </div>
      </div>

      {/* Squad Roster */}
      {players.length > 0 && (
        <div className="glass rounded-2xl p-6 sm:p-8 mb-8">
          <h2 className="text-2xl font-bold mb-6 text-gray-900">Squad Roster ({players.length} Players)</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(players || []).map((player) => (
              <Link
                key={player.id}
                href={`/players/${player.id}`}
                className="bg-white rounded-xl p-4 border border-gray-200 hover:shadow-md transition-all duration-200 hover:scale-105 flex items-center gap-3"
              >
                {player.photo_url ? (
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                    <Image
                      src={player.photo_url}
                      alt={player.name}
                      width={48}
                      height={48}
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                    </svg>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 truncate">
                    {player.display_name || player.name}
                  </div>
                  {player.category && (
                    <div className={`text-xs font-medium ${
                      player.category === 'Legend' ? 'text-amber-600' : 'text-blue-600'
                    }`}>
                      {player.category}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Achievements - Only in all-time view */}
      {viewMode === 'all-time' && achievements.length > 0 && (
        <div className="glass rounded-2xl p-6 sm:p-8 mb-8">
          <h2 className="text-2xl font-bold mb-6 text-gray-900">🏆 Achievements</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {achievements.map((achievement: any, index: number) => (
              <div key={index} className={`rounded-xl p-4 border-2 ${
                achievement.type === 'champion'
                  ? 'bg-amber-50 border-amber-300'
                  : 'bg-gray-50 border-gray-300'
              }`}>
                <div className="text-2xl mb-2">{achievement.type === 'champion' ? '🥇' : '🥈'}</div>
                <div className="font-bold text-lg text-gray-900">{achievement.achievement}</div>
                <div className="text-sm text-gray-600">{achievement.season_name}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Season-by-Season Breakdown - Only in all-time view */}
      {viewMode === 'all-time' && seasonBreakdown.length > 0 && (
        <div className="glass rounded-2xl p-6 sm:p-8 mb-8">
          <h2 className="text-2xl font-bold mb-6 text-gray-900">Season History</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Season</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Rank</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">MP</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">W</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">D</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">L</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">GF</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">GA</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">GD</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Pts</th>
                </tr>
              </thead>
              <tbody>
                {seasonBreakdown.map((season: any, index: number) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-blue-50 transition-colors">
                    <td className="py-3 px-4">
                      <Link href={`/seasons/${season.season_id}`} className="text-blue-600 hover:underline font-medium">
                        {season.season_id}
                      </Link>
                    </td>
                    <td className="text-center py-3 px-4">
                      {season.rank ? (
                        <span className={`px-2 py-1 rounded font-bold ${
                          season.rank === 1 ? 'bg-amber-100 text-amber-700' :
                          season.rank === 2 ? 'bg-gray-200 text-gray-700' :
                          season.rank === 3 ? 'bg-amber-50 text-amber-600' :
                          'bg-blue-50 text-blue-600'
                        }`}>
                          #{season.rank}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="text-center py-3 px-4 text-gray-700">{season.matches_played}</td>
                    <td className="text-center py-3 px-4 text-green-600 font-semibold">{season.wins}</td>
                    <td className="text-center py-3 px-4 text-gray-600">{season.draws}</td>
                    <td className="text-center py-3 px-4 text-red-600 font-semibold">{season.losses}</td>
                    <td className="text-center py-3 px-4 text-gray-700">{season.goals_scored}</td>
                    <td className="text-center py-3 px-4 text-gray-700">{season.goals_conceded}</td>
                    <td className="text-center py-3 px-4 font-semibold text-gray-900">
                      {season.goal_difference > 0 ? '+' : ''}{season.goal_difference}
                    </td>
                    <td className="text-center py-3 px-4 font-bold text-blue-600">{season.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* All Fixtures - Only in all-time view */}
      {viewMode === 'all-time' && allFixtures.length > 0 && (
        <div className="glass rounded-2xl p-6 sm:p-8 mb-8">
          <h2 className="text-2xl font-bold mb-6 text-gray-900">Recent Fixtures</h2>
          <div className="space-y-3">
            {allFixtures.slice(0, 10).map((fixture: any) => (
              <div key={fixture.id} className="bg-white rounded-xl p-4 border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500">{fixture.season_id} - MD{fixture.match_day}</span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    fixture.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {fixture.status}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className={`font-semibold ${
                      fixture.is_home ? 'text-blue-600' : 'text-gray-900'
                    }`}>
                      {fixture.home_team_name}
                    </div>
                    <div className="text-xs text-gray-500">Home</div>
                  </div>
                  
                  {fixture.status === 'completed' ? (
                    <div className="px-4 py-2 bg-blue-50 rounded-lg font-bold text-blue-600">
                      {fixture.home_score} - {fixture.away_score}
                    </div>
                  ) : (
                    <div className="px-4 py-2 bg-gray-100 rounded-lg text-gray-600 text-sm">
                      vs
                    </div>
                  )}
                  
                  <div className="flex-1 text-right">
                    <div className={`font-semibold ${
                      !fixture.is_home ? 'text-blue-600' : 'text-gray-900'
                    }`}>
                      {fixture.away_team_name}
                    </div>
                    <div className="text-xs text-gray-500">Away</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Season-specific Fixtures */}
      {viewMode === 'season' && allFixtures.length > 0 && (
        <div className="glass rounded-2xl p-6 sm:p-8">
          <h2 className="text-2xl font-bold mb-6 text-gray-900">Season Fixtures</h2>
          <div className="space-y-3">
            {allFixtures.map((fixture: any) => (
              <div key={fixture.id} className="bg-white rounded-xl p-4 border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500">Match Day {fixture.match_day || fixture.matchDay}</span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    fixture.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {fixture.status}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className={`font-semibold ${
                      fixture.home_team_id === teamId || fixture.homeTeamId === teamId ? 'text-blue-600' : 'text-gray-900'
                    }`}>
                      {fixture.home_team_name || fixture.homeTeam || fixture.home_team}
                    </div>
                    <div className="text-xs text-gray-500">Home</div>
                  </div>
                  
                  {fixture.status === 'completed' ? (
                    <div className="px-4 py-2 bg-blue-50 rounded-lg font-bold text-blue-600">
                      {fixture.home_score || fixture.homeScore || 0} - {fixture.away_score || fixture.awayScore || 0}
                    </div>
                  ) : (
                    <div className="px-4 py-2 bg-gray-100 rounded-lg text-gray-600 text-sm">
                      vs
                    </div>
                  )}
                  
                  <div className="flex-1 text-right">
                    <div className={`font-semibold ${
                      fixture.away_team_id === teamId || fixture.awayTeamId === teamId ? 'text-blue-600' : 'text-gray-900'
                    }`}>
                      {fixture.away_team_name || fixture.awayTeam || fixture.away_team}
                    </div>
                    <div className="text-xs text-gray-500">Away</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
